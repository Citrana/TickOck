import {v} from 'convex/values';
import {mutation, query, MutationCtx, QueryCtx} from './_generated/server';
import {Id, Doc} from './_generated/dataModel';
import {getAuthUserId} from '@convex-dev/auth/server';
import {assertPermission, getCallerUserId, requirePermission} from './_helpers/permissions';
import {writeAuditLog} from './_helpers/audit';
import {signTicketQr, buildQrData} from './_helpers/qr';
import {internal} from './_generated/api';

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

// Event end = date (UTC midnight of the event's day) + endTime ("HH:mm",
// treated as UTC), or +24h if endTime isn't set. Naive, ignores
// event.timezone — consistent with the cancellation-cutoff check below.
function getEventEndMs(event: Doc<'events'>): number {
  if (!event.endTime) return event.date + 24 * 3_600_000;
  const [hours, minutes] = event.endTime.split(':').map(Number);
  return event.date + hours * 3_600_000 + minutes * 60_000;
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
    paymentMethod: v.optional(v.union(v.literal('manual'), v.literal('cash'))),
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
    if (Date.now() > getEventEndMs(event)) {
      throw new Error('This event has ended');
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
      const method =
        event.paymentMode === 'manual' && args.paymentMethod === 'cash'
          ? 'cash'
          : event.paymentMode;
      paymentId = await ctx.db.insert('payments', {
        ticketId: ticketIds[0],
        eventId: args.eventId,
        userId,
        amount: tier.price * args.quantity,
        currency: tier.currency,
        method,
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

    if (isFree) {
      await ctx.scheduler.runAfter(0, internal.pushNotifications.deliver, {
        userId,
        title: 'Ticket confirmed',
        body: `Your free ticket for ${event.title} is ready!`,
        url: '/en/tickets',
      });
    }

    return {ticketIds, paymentId};
  },
});

/**
 * Purchase specific seats on a venue-layout event. Each seatId must be
 * covered by a live, unexpired seatHold owned by the caller — see
 * convex/seatHolds.ts's holdSeats. Structurally parallel to purchase()
 * above: free seats confirm immediately, paid seats start as
 * pending_payment and share a single payment record for the whole order,
 * exactly like the quantity-based flow, so submitPaymentProof / confirmPayment
 * need no changes to handle seat-based orders.
 */
export const purchaseSeats = mutation({
  args: {
    eventId: v.id('events'),
    holdIds: v.array(v.id('seatHolds')),
    paymentMethod: v.optional(v.union(v.literal('manual'), v.literal('cash'))),
  },
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);

    if (args.holdIds.length === 0) {
      throw new Error('No seats selected');
    }
    if (args.holdIds.length > 20) {
      throw new Error('Cannot purchase more than 20 seats in a single order');
    }

    const event = await ctx.db.get(args.eventId);
    if (!event || event.status !== 'live') {
      throw new Error('Event is not available for purchase');
    }
    if (Date.now() > getEventEndMs(event)) {
      throw new Error('This event has ended');
    }
    if (!event.venueLayoutSnapshotId) {
      throw new Error('This event has no seating layout');
    }

    const now = Date.now();
    const holds = [];
    for (const holdId of args.holdIds) {
      const hold = await ctx.db.get(holdId);
      if (!hold) throw new Error('Seat hold not found');
      if (hold.userId !== userId) throw new Error('Forbidden');
      if (hold.eventId !== args.eventId) {
        throw new Error('Seat hold does not belong to this event');
      }
      if (hold.status !== 'held' || hold.expiresAt <= now) {
        throw new Error('Your seat hold has expired — please reselect your seats');
      }
      holds.push(hold);
    }

    // Bridge each seat's venueLayoutTierId back to this event's ticketTiers
    // row, which remains the single source of truth for price/inventory.
    const ticketTiersForEvent = await ctx.db
      .query('ticketTiers')
      .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
      .collect();
    const ticketTierByVenueLayoutTierId = new Map(
      ticketTiersForEvent
        .filter(tier => tier.venueLayoutTierId)
        .map(tier => [tier.venueLayoutTierId!, tier]),
    );

    const quantitySoldDelta = new Map<Id<'ticketTiers'>, number>();
    const seatPurchases: {
      seatId: Id<'venueLayoutSeats'>;
      seatLabel: string;
      ticketTier: (typeof ticketTiersForEvent)[number];
    }[] = [];

    for (const hold of holds) {
      const seat = await ctx.db.get(hold.seatId);
      if (!seat) throw new Error('Seat not found');
      if (!seat.tierId) throw new Error(`Seat ${seat.seatLabel} has no pricing tier assigned`);

      const ticketTier = ticketTierByVenueLayoutTierId.get(seat.tierId);
      if (!ticketTier) {
        throw new Error(`Seat ${seat.seatLabel}'s pricing tier is not linked to this event`);
      }

      const alreadyReserved = quantitySoldDelta.get(ticketTier._id) ?? 0;
      const available = ticketTier.quantity - ticketTier.quantitySold - alreadyReserved;
      if (available < 1) {
        throw new Error(`No remaining capacity for tier "${ticketTier.name}"`);
      }
      quantitySoldDelta.set(ticketTier._id, alreadyReserved + 1);

      seatPurchases.push({seatId: seat._id, seatLabel: seat.seatLabel, ticketTier});
    }

    const isFree = seatPurchases.every(p => p.ticketTier.price === 0);
    const prefix = isFree ? buildEventPrefix(event.title) : null;
    const ticketIds: Id<'tickets'>[] = [];
    let totalAmount = 0;
    let currency = '';

    for (let i = 0; i < seatPurchases.length; i++) {
      const {seatId, ticketTier} = seatPurchases[i];
      const hold = holds[i];
      const ticketNumber = prefix
        ? await generateUniqueTicketNumber(ctx, prefix)
        : undefined;

      const ticketId = await ctx.db.insert('tickets', {
        eventId: args.eventId,
        tierId: ticketTier._id,
        userId,
        status: isFree ? 'confirmed' : 'pending_payment',
        ...(ticketNumber ? {ticketNumber} : {}),
        seatId,
        createdAt: now,
      });

      const qrSignature = await signTicketQr(ticketId, event.hmacSecret);
      await ctx.db.patch(ticketId, {qrSignature});
      await ctx.db.patch(hold._id, {status: 'purchased', ticketId});

      ticketIds.push(ticketId);
      totalAmount += ticketTier.price;
      currency = ticketTier.currency;
    }

    for (const [tierId, delta] of Array.from(quantitySoldDelta.entries())) {
      const tier = ticketTiersForEvent.find(t => t._id === tierId)!;
      await ctx.db.patch(tierId, {quantitySold: tier.quantitySold + delta});
    }

    let paymentId: Id<'payments'> | null = null;
    if (!isFree) {
      const method =
        event.paymentMode === 'manual' && args.paymentMethod === 'cash'
          ? 'cash'
          : event.paymentMode;
      paymentId = await ctx.db.insert('payments', {
        ticketId: ticketIds[0],
        eventId: args.eventId,
        userId,
        amount: totalAmount,
        currency,
        method,
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
        seatCount: seatPurchases.length,
        totalAmount,
        isFree,
      },
    });

    if (isFree) {
      await ctx.scheduler.runAfter(0, internal.pushNotifications.deliver, {
        userId,
        title: 'Ticket confirmed',
        body: `Your ticket${seatPurchases.length > 1 ? 's are' : ' is'} ready for ${event.title}!`,
        url: '/en/tickets',
      });
    }

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
    referenceNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);

    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error('Payment not found');
    if (payment.userId !== userId) throw new Error('Forbidden');
    if (payment.status !== 'pending') {
      throw new Error('This payment has already been processed');
    }

    if (args.referenceNumber) {
      const duplicate = await ctx.db
        .query('payments')
        .withIndex('by_referenceNumber_and_eventId', q =>
          q.eq('referenceNumber', args.referenceNumber).eq('eventId', payment.eventId),
        )
        .first();
      if (duplicate && duplicate._id !== args.paymentId) {
        throw new Error('This payment reference number has already been used for this event');
      }
    }

    const evidenceUrl = await ctx.storage.getUrl(args.storageId);
    if (!evidenceUrl) throw new Error('Failed to retrieve uploaded file');

    await ctx.db.patch(args.paymentId, {
      evidenceUrl,
      ...(args.referenceNumber ? {referenceNumber: args.referenceNumber} : {}),
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action: 'payments:submit_proof',
      targetType: 'payments',
      targetId: args.paymentId,
      metadata: {eventId: payment.eventId},
    });

    const event = await ctx.db.get(payment.eventId);
    if (event) {
      await ctx.scheduler.runAfter(0, internal.pushNotifications.deliver, {
        userId: event.ownerId,
        title: 'New payment submitted',
        body: `A payment was submitted for ${event.title}.`,
        url: `/en/events/${event._id}/manage`,
      });
    }
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
                referenceNumber: payment.referenceNumber ?? null,
                rejectionReason: payment.rejectionReason ?? null,
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
    try {
      await assertPermission(ctx, 'tickets:read', args.eventId);
    } catch {
      return [];
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

    const id = args.identifier.trim();
    let ticket;

    if (id.toUpperCase().startsWith('TOCK:')) {
      const parts = id.split(':');
      if (parts.length >= 2) {
        ticket = await ctx.db.get(parts[1] as Id<'tickets'>).catch(() => null);
      }
    } else {
      ticket = await ctx.db
        .query('tickets')
        .withIndex('by_ticketNumber', q => q.eq('ticketNumber', id.toUpperCase()))
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
    try {
      await assertPermission(ctx, 'tickets:scan', args.eventId);
    } catch {
      return [];
    }

    const tickets = await ctx.db
      .query('tickets')
      .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
      .take(500);

    const used = tickets
      .filter(t => t.status === 'used' && t.scannedAt)
      .sort((a, b) => (b.scannedAt ?? 0) - (a.scannedAt ?? 0));

    return await Promise.all(
      used.map(async t => {
        const [buyer, tier, scanner] = await Promise.all([
          ctx.db.get(t.userId),
          ctx.db.get(t.tierId),
          t.scannedBy ? ctx.db.get(t.scannedBy) : Promise.resolve(null),
        ]);
        return {
          _id: t._id,
          ticketNumber: t.ticketNumber ?? null,
          scannedAt: t.scannedAt ?? 0,
          buyerName: buyer?.name ?? buyer?.email ?? 'Unknown',
          tierName: tier?.name ?? '—',
          scannedByName: scanner?.name ?? scanner?.email ?? '—',
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

    const id = args.identifier.trim();
    let ticket;

    if (id.toUpperCase().startsWith('TOCK:')) {
      const parts = id.split(':');
      if (parts.length >= 2) {
        ticket = await ctx.db.get(parts[1] as Id<'tickets'>).catch(() => null);
      }
    } else {
      ticket = await ctx.db
        .query('tickets')
        .withIndex('by_ticketNumber', q => q.eq('ticketNumber', id.toUpperCase()))
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
