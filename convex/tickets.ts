import {v} from 'convex/values';
import {mutation, query, MutationCtx, QueryCtx} from './_generated/server';
import {Id} from './_generated/dataModel';
import {getAuthUserId} from '@convex-dev/auth/server';
import {getCallerUserId, requirePermission} from './_helpers/permissions';
import {writeAuditLog} from './_helpers/audit';
import {signTicketQr, buildQrData} from './_helpers/qr';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TICKET_NUM_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function buildEventPrefix(title: string): string {
  const alpha = title.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return alpha.slice(0, 4).padEnd(4, 'X');
}

export async function generateUniqueTicketNumber(ctx: MutationCtx, prefix: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const arr = new Uint8Array(5);
    crypto.getRandomValues(arr);
    const random = Array.from(arr, b => TICKET_NUM_CHARS[b % TICKET_NUM_CHARS.length]).join('');
    const num = `${prefix}-${random}`;
    const existing = await ctx.db
      .query('tickets')
      .withIndex('by_ticketNumber', q => q.eq('ticketNumber', num))
      .unique();
    if (!existing) return num;
  }
  throw new Error('Could not generate unique ticket number');
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Purchase tickets for an event tier. Any authenticated, non-suspended user
 * may call this. Creates ticket record(s) and a single payment record for the
 * order. Free tiers are confirmed immediately; paid tiers start as
 * pending_payment.
 */
export const purchase = mutation({
  args: {
    eventId: v.id('events'),
    tierId: v.id('ticketTiers'),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);

    if (args.quantity < 1 || args.quantity > 10) {
      throw new Error('Quantity must be between 1 and 10');
    }

    const event = await ctx.db.get(args.eventId);
    if (!event || event.status !== 'live') {
      throw new Error('Event is not available for purchase');
    }

    const tier = await ctx.db.get(args.tierId);
    if (!tier || tier.eventId !== args.eventId) {
      throw new Error('Ticket tier not found');
    }

    const available = tier.quantity - tier.quantitySold;
    if (available < args.quantity) {
      throw new Error(
        `Only ${available} ticket${available === 1 ? '' : 's'} remaining`,
      );
    }

    // Reserve quantity atomically before creating tickets
    await ctx.db.patch(args.tierId, {
      quantitySold: tier.quantitySold + args.quantity,
    });

    const isFree = tier.price === 0;
    const now = Date.now();
    const ticketIds: Id<'tickets'>[] = [];

    const prefix = isFree ? buildEventPrefix(event.title) : null;
    for (let i = 0; i < args.quantity; i++) {
      const ticketNumber = prefix
        ? await generateUniqueTicketNumber(ctx, prefix)
        : undefined;
      const ticketId = await ctx.db.insert('tickets', {
        eventId: args.eventId,
        tierId: args.tierId,
        userId,
        status: isFree ? 'confirmed' : 'pending_payment',
        ...(ticketNumber ? {ticketNumber} : {}),
        createdAt: now,
      });

      // Sign QR with per-event secret
      const qrSignature = await signTicketQr(ticketId, event.hmacSecret);
      await ctx.db.patch(ticketId, {qrSignature});

      ticketIds.push(ticketId);
    }

    // Create a single payment record for the whole order (skipped for free tiers)
    let paymentId: Id<'payments'> | null = null;
    if (!isFree) {
      paymentId = await ctx.db.insert('payments', {
        ticketId: ticketIds[0],
        eventId: args.eventId,
        userId,
        amount: tier.price * args.quantity,
        currency: tier.currency,
        method: event.paymentMode,
        status: 'pending',
      });
    }

    await writeAuditLog(ctx, {
      actorId: userId,
      action: 'tickets:create',
      targetType: 'tickets',
      targetId: ticketIds[0],
      metadata: {
        eventId: args.eventId,
        tierId: args.tierId,
        quantity: args.quantity,
        totalAmount: tier.price * args.quantity,
        isFree,
      },
    });

    return {ticketIds, paymentId};
  },
});

/**
 * Attach a payment proof screenshot to a pending payment.
 * Only the payment owner may call this.
 */
export const submitPaymentProof = mutation({
  args: {
    paymentId: v.id('payments'),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);

    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error('Payment not found');
    if (payment.userId !== userId) throw new Error('Forbidden');
    if (payment.status !== 'pending') {
      throw new Error('This payment has already been processed');
    }

    const evidenceUrl = await ctx.storage.getUrl(args.storageId);
    if (!evidenceUrl) throw new Error('Failed to retrieve uploaded file');

    await ctx.db.patch(args.paymentId, {evidenceUrl});

    await writeAuditLog(ctx, {
      actorId: userId,
      action: 'payments:submit_proof',
      targetType: 'payments',
      targetId: args.paymentId,
      metadata: {eventId: payment.eventId},
    });
  },
});

/**
 * Cancel a ticket. Enforces the event's cancellation policy server-side.
 * Only the ticket owner can cancel their own ticket.
 */
export const cancel = mutation({
  args: {ticketId: v.id('tickets')},
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);

    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error('Ticket not found');
    if (ticket.userId !== userId) throw new Error('Forbidden');

    if (ticket.status === 'cancelled') throw new Error('Ticket is already cancelled');
    if (ticket.status === 'used') throw new Error('Used tickets cannot be cancelled');
    if (ticket.status === 'expired') throw new Error('Expired tickets cannot be cancelled');

    const event = await ctx.db.get(ticket.eventId);
    if (!event) throw new Error('Event not found');

    if (!event.cancellationPolicy.allowed) {
      throw new Error('This event does not allow cancellations');
    }

    if (event.cancellationPolicy.cutoffHours) {
      const cutoffMs = event.cancellationPolicy.cutoffHours * 3_600_000;
      if (Date.now() > event.date - cutoffMs) {
        throw new Error(
          `Cancellations close ${event.cancellationPolicy.cutoffHours} hours before the event`,
        );
      }
    }

    await ctx.db.patch(args.ticketId, {status: 'cancelled'});

    // Return the reserved slot to inventory
    const tier = await ctx.db.get(ticket.tierId);
    if (tier) {
      await ctx.db.patch(ticket.tierId, {
        quantitySold: Math.max(0, tier.quantitySold - 1),
      });
    }

    await writeAuditLog(ctx, {
      actorId: userId,
      action: 'tickets:cancel',
      targetType: 'tickets',
      targetId: args.ticketId,
      metadata: {eventId: ticket.eventId},
    });
  },
});

/**
 * Mark a ticket as used (check-in). Requires tickets:scan permission on the
 * event (event staff or platform role).
 */
export const markUsed = mutation({
  args: {ticketId: v.id('tickets')},
  handler: async (ctx, args) => {
    // Read ticket first so we can scope the permission check to the event
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error('Ticket not found');

    const actorId = await requirePermission(ctx, 'tickets:scan', ticket.eventId);

    if (ticket.status !== 'confirmed') {
      throw new Error('Only confirmed tickets can be scanned');
    }

    await ctx.db.patch(args.ticketId, {
      status: 'used',
      scannedBy: actorId,
      scannedAt: Date.now(),
    });

    await writeAuditLog(ctx, {
      actorId,
      action: 'tickets:scan',
      targetType: 'tickets',
      targetId: args.ticketId,
      metadata: {eventId: ticket.eventId},
    });
  },
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Returns all tickets for the authenticated user, enriched with event, tier,
 * and payment data. Used by the "My Tickets" page.
 */
export const listMine = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const tickets = await ctx.db
      .query('tickets')
      .withIndex('by_userId', q => q.eq('userId', userId))
      .order('desc')
      .take(50);

    return await Promise.all(
      tickets.map(async ticket => {
        const [event, tier] = await Promise.all([
          ctx.db.get(ticket.eventId),
          ctx.db.get(ticket.tierId),
        ]);

        const payment = await ctx.db
          .query('payments')
          .withIndex('by_ticketId', q => q.eq('ticketId', ticket._id))
          .first();

        const coverImageUrl = event?.coverImageStorageId
          ? await ctx.storage.getUrl(event.coverImageStorageId)
          : null;

        return {
          ...ticket,
          qrData:
            ticket.qrSignature
              ? buildQrData(ticket._id, ticket.qrSignature)
              : null,
          event: event
            ? {
                _id: event._id,
                title: event.title,
                date: event.date,
                startTime: event.startTime,
                venue: event.venue,
                coverImageUrl,
                cancellationPolicy: event.cancellationPolicy,
              }
            : null,
          tier: tier
            ? {
                name: tier.name,
                price: tier.price,
                currency: tier.currency,
              }
            : null,
          payment: payment
            ? {
                _id: payment._id,
                status: payment.status,
                amount: payment.amount,
                currency: payment.currency,
                method: payment.method,
                evidenceUrl: payment.evidenceUrl ?? null,
              }
            : null,
        };
      }),
    );
  },
});

/**
 * Returns all tickets for a given event. Only accessible to the event owner
 * or event staff with tickets:read permission.
 */
export const listByEvent = query({
  args: {eventId: v.id('events')},
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const event = await ctx.db.get(args.eventId);
    if (!event) return [];

    const isOwner = event.ownerId === userId;
    if (!isOwner) {
      const staff = await ctx.db
        .query('eventStaff')
        .withIndex('by_eventId_and_userId', q =>
          q.eq('eventId', args.eventId).eq('userId', userId),
        )
        .unique();
      const hasAccess =
        staff?.isActive !== false &&
        (staff?.permissionSlugs.includes('*') ||
          staff?.permissionSlugs.includes('tickets:read'));
      if (!hasAccess) return [];
    }

    const tickets = await ctx.db
      .query('tickets')
      .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
      .order('desc')
      .take(200);

    return await Promise.all(
      tickets.map(async ticket => {
        const [user, tier] = await Promise.all([
          ctx.db.get(ticket.userId),
          ctx.db.get(ticket.tierId),
        ]);
        return {
          ...ticket,
          userName: user?.name ?? user?.email ?? 'Unknown',
          tierName: tier?.name ?? '—',
          tierPrice: tier?.price ?? 0,
          tierCurrency: tier?.currency ?? '',
        };
      }),
    );
  },
});

/**
 * Returns all ticket data needed to generate a PDF. Accessible to the ticket
 * owner, the event owner, or event staff with tickets:read.
 */
export const getForPdf = query({
  args: {ticketId: v.id('tickets')},
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) return null;

    const event = await ctx.db.get(ticket.eventId);
    if (!event) return null;

    const isTicketOwner = ticket.userId === userId;
    const isEventOwner = event.ownerId === userId;

    if (!isTicketOwner && !isEventOwner) {
      const staff = await ctx.db
        .query('eventStaff')
        .withIndex('by_eventId_and_userId', q =>
          q.eq('eventId', ticket.eventId).eq('userId', userId),
        )
        .unique();
      const hasAccess =
        staff?.isActive !== false &&
        (staff?.permissionSlugs.includes('*') ||
          staff?.permissionSlugs.includes('tickets:read'));
      if (!hasAccess) return null;
    }

    const [tier, buyer] = await Promise.all([
      ctx.db.get(ticket.tierId),
      ctx.db.get(ticket.userId),
    ]);

    return {
      ticket: {
        _id: ticket._id,
        ticketNumber: ticket.ticketNumber ?? null,
        status: ticket.status,
        qrData: ticket.qrSignature
          ? buildQrData(ticket._id, ticket.qrSignature)
          : ticket._id,
      },
      event: {
        title: event.title,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime ?? null,
        timezone: event.timezone,
        venue: event.venue,
      },
      tier: {
        name: tier?.name ?? '—',
        price: tier?.price ?? 0,
        currency: tier?.currency ?? '',
      },
      buyer: {
        name: buyer?.name ?? null,
        email: buyer?.email ?? '—',
      },
    };
  },
});

/**
 * Look up a ticket by ticket number or QR content for the check-in preview.
 * Accessible to event owners and staff with tickets:scan or tickets:read.
 */
export const findTicket = query({
  args: {
    eventId: v.id('events'),
    identifier: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const event = await ctx.db.get(args.eventId);
    if (!event) return null;

    const isOwner = event.ownerId === userId;
    if (!isOwner) {
      const staff = await ctx.db
        .query('eventStaff')
        .withIndex('by_eventId_and_userId', q =>
          q.eq('eventId', args.eventId).eq('userId', userId),
        )
        .unique();
      const hasAccess =
        staff?.isActive !== false &&
        (staff?.permissionSlugs.includes('*') ||
          staff?.permissionSlugs.includes('tickets:scan') ||
          staff?.permissionSlugs.includes('tickets:read'));
      if (!hasAccess) return null;
    }

    const id = args.identifier.trim().toUpperCase();
    let ticket;

    if (id.startsWith('TOCK:')) {
      const parts = id.split(':');
      if (parts.length >= 2) {
        ticket = await ctx.db.get(parts[1] as Id<'tickets'>).catch(() => null);
      }
    } else {
      ticket = await ctx.db
        .query('tickets')
        .withIndex('by_ticketNumber', q => q.eq('ticketNumber', id))
        .unique();
    }

    if (!ticket || ticket.eventId !== args.eventId) return null;

    const [tier, buyer] = await Promise.all([
      ctx.db.get(ticket.tierId),
      ctx.db.get(ticket.userId),
    ]);

    return {
      _id: ticket._id,
      ticketNumber: ticket.ticketNumber ?? null,
      status: ticket.status,
      scannedAt: ticket.scannedAt ?? null,
      tierName: tier?.name ?? '—',
      buyerName: buyer?.name ?? buyer?.email ?? 'Unknown',
      buyerEmail: buyer?.email ?? '—',
    };
  },
});

/**
 * Returns the 20 most recently checked-in tickets for an event.
 * Accessible to event owners and staff with tickets:scan.
 */
export const recentCheckIns = query({
  args: {eventId: v.id('events')},
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const event = await ctx.db.get(args.eventId);
    if (!event) return [];

    const isOwner = event.ownerId === userId;
    if (!isOwner) {
      const staff = await ctx.db
        .query('eventStaff')
        .withIndex('by_eventId_and_userId', q =>
          q.eq('eventId', args.eventId).eq('userId', userId),
        )
        .unique();
      const hasAccess =
        staff?.isActive !== false &&
        (staff?.permissionSlugs.includes('*') ||
          staff?.permissionSlugs.includes('tickets:scan'));
      if (!hasAccess) return [];
    }

    const tickets = await ctx.db
      .query('tickets')
      .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
      .take(500);

    const used = tickets
      .filter(t => t.status === 'used' && t.scannedAt)
      .sort((a, b) => (b.scannedAt ?? 0) - (a.scannedAt ?? 0))
      .slice(0, 20);

    return await Promise.all(
      used.map(async t => {
        const [buyer, tier] = await Promise.all([
          ctx.db.get(t.userId),
          ctx.db.get(t.tierId),
        ]);
        return {
          _id: t._id,
          ticketNumber: t.ticketNumber ?? null,
          scannedAt: t.scannedAt ?? 0,
          buyerName: buyer?.name ?? buyer?.email ?? 'Unknown',
          tierName: tier?.name ?? '—',
        };
      }),
    );
  },
});

/**
 * Check in an attendee by ticket number or QR content ("TOCK:…").
 * Validates the ticket belongs to this event and is in confirmed status.
 */
export const checkIn = mutation({
  args: {
    eventId: v.id('events'),
    identifier: v.string(),
  },
  handler: async (ctx, args) => {
    const actorId = await requirePermission(ctx, 'tickets:scan', args.eventId);

    const id = args.identifier.trim().toUpperCase();
    let ticket;

    if (id.startsWith('TOCK:')) {
      const parts = id.split(':');
      if (parts.length >= 2) {
        ticket = await ctx.db.get(parts[1] as Id<'tickets'>).catch(() => null);
      }
    } else {
      ticket = await ctx.db
        .query('tickets')
        .withIndex('by_ticketNumber', q => q.eq('ticketNumber', id))
        .unique();
    }

    if (!ticket) throw new Error('Ticket not found');
    if (ticket.eventId !== args.eventId) throw new Error('This ticket is for a different event');

    if (ticket.status === 'pending_payment') throw new Error('Payment not yet confirmed');
    if (ticket.status === 'cancelled') throw new Error('This ticket has been cancelled');
    if (ticket.status === 'used') throw new Error('This ticket has already been used');
    if (ticket.status === 'expired') throw new Error('This ticket has expired');
    if (ticket.status !== 'confirmed') throw new Error('Ticket is not valid for entry');

    await ctx.db.patch(ticket._id, {
      status: 'used',
      scannedBy: actorId,
      scannedAt: Date.now(),
    });

    const [tier, buyer] = await Promise.all([
      ctx.db.get(ticket.tierId),
      ctx.db.get(ticket.userId),
    ]);

    await writeAuditLog(ctx, {
      actorId,
      action: 'tickets:scan',
      targetType: 'tickets',
      targetId: ticket._id,
      metadata: {
        ticketNumber: ticket.ticketNumber ?? '',
        eventId: args.eventId,
      },
    });

    return {
      ticketId: ticket._id,
      buyerName: buyer?.name ?? buyer?.email ?? 'Unknown',
      tierName: tier?.name ?? '—',
    };
  },
});
