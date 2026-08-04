import {v} from 'convex/values';
import {query} from './_generated/server';
import {getAuthUserId} from '@convex-dev/auth/server';
import {hasPlatformPermission} from './_helpers/permissions';

// Assembles everything a downloadable event report can draw from in one
// round trip. Scoped to the event owner or a platform admin only — unlike
// most event-scoped reads, there is deliberately no eventStaff fallback,
// since this bundles buyer PII, payment references, and who-approved-what
// in one place (same owner-only precedent as the manage dashboard's Staff
// tab). Returns null if the caller isn't authorized; the API route that
// renders the actual file turns that into a 403.
export const getReportData = query({
  args: {eventId: v.id('events')},
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const event = await ctx.db.get(args.eventId);
    if (!event) return null;

    const isOwner = event.ownerId === userId;
    if (!isOwner && !(await hasPlatformPermission(ctx, userId, 'events:edit'))) {
      return null;
    }

    const [tiers, tickets, payments] = await Promise.all([
      ctx.db
        .query('ticketTiers')
        .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
        .collect(),
      ctx.db
        .query('tickets')
        .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
        .take(5000),
      ctx.db
        .query('payments')
        .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
        .take(5000),
    ]);

    const tierById = new Map(tiers.map(t => [t._id, t]));

    const sales = tiers.map(t => ({
      _id: t._id,
      name: t.name,
      price: t.price,
      currency: t.currency,
      quantity: t.quantity,
      quantitySold: t.quantitySold,
      revenue: t.price * t.quantitySold,
    }));

    const attendees = await Promise.all(
      tickets.map(async ticket => {
        const [buyer, seat] = await Promise.all([
          ctx.db.get(ticket.userId),
          ticket.seatId ? ctx.db.get(ticket.seatId) : Promise.resolve(null),
        ]);
        const tier = tierById.get(ticket.tierId);
        return {
          _id: ticket._id,
          ticketNumber: ticket.ticketNumber ?? null,
          status: ticket.status,
          buyerName: buyer?.name ?? buyer?.email ?? 'Unknown',
          buyerEmail: buyer?.email ?? null,
          tierName: tier?.name ?? '—',
          seatLabel: seat?.seatLabel ?? null,
          createdAt: ticket.createdAt,
        };
      }),
    );

    let totalRevenue = 0;
    let pendingRevenue = 0;
    const paymentMethodCounts = {online: 0, manual: 0, cash: 0} as Record<string, number>;
    for (const p of payments) {
      if (p.status === 'confirmed') totalRevenue += p.amount;
      if (p.status === 'pending') pendingRevenue += p.amount;
      paymentMethodCounts[p.method] = (paymentMethodCounts[p.method] ?? 0) + 1;
    }
    const currency = tiers[0]?.currency ?? payments[0]?.currency ?? null;

    const finance = {
      currency,
      totalRevenue,
      pendingRevenue,
      platformFeeTotal: event.platformFeeTotal ?? null,
      platformFeeCurrency: event.platformFeeCurrency ?? null,
      venueLayoutFeeTotal: event.venueLayoutFeeTotal ?? null,
      venueLayoutFeeCurrency: event.venueLayoutFeeCurrency ?? null,
      paymentMethodCounts,
    };

    const paymentApprovals = await Promise.all(
      payments.map(async payment => {
        const [buyer, actioner] = await Promise.all([
          ctx.db.get(payment.userId),
          payment.confirmedBy
            ? ctx.db.get(payment.confirmedBy)
            : payment.rejectedBy
              ? ctx.db.get(payment.rejectedBy)
              : Promise.resolve(null),
        ]);
        return {
          _id: payment._id,
          buyerName: buyer?.name ?? buyer?.email ?? 'Unknown',
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method,
          status: payment.status,
          actionedByName: actioner ? (actioner.name ?? actioner.email ?? null) : null,
          actionedAt: payment.confirmedAt ?? payment.rejectedAt ?? null,
          rejectionReason: payment.rejectionReason ?? null,
        };
      }),
    );

    const checkIns = await Promise.all(
      tickets
        .filter(t => t.status === 'used' && t.scannedAt)
        .sort((a, b) => (b.scannedAt ?? 0) - (a.scannedAt ?? 0))
        .map(async ticket => {
          const [buyer, scanner] = await Promise.all([
            ctx.db.get(ticket.userId),
            ticket.scannedBy ? ctx.db.get(ticket.scannedBy) : Promise.resolve(null),
          ]);
          return {
            _id: ticket._id,
            ticketNumber: ticket.ticketNumber ?? null,
            buyerName: buyer?.name ?? buyer?.email ?? 'Unknown',
            scannedByName: scanner ? (scanner.name ?? scanner.email ?? null) : null,
            scannedAt: ticket.scannedAt ?? null,
          };
        }),
    );

    return {
      event: {
        title: event.title,
        date: event.date,
        venue: event.venue,
        status: event.status,
        paymentMode: event.paymentMode,
      },
      sales,
      attendees,
      finance,
      paymentApprovals,
      checkIns,
    };
  },
});
