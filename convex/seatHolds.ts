import {v} from 'convex/values';
import {mutation, query, internalMutation, QueryCtx} from './_generated/server';
import {Id} from './_generated/dataModel';
import {getCallerUserId} from './_helpers/permissions';
import {internal} from './_generated/api';
import {MAX_SEATS_PER_CALL} from '../lib/venueGenerators';

const HOLD_TTL_MS = 5 * 60 * 1000;
const EXPIRED_SWEEP_BATCH_SIZE = 200;

/**
 * Places a temporary hold on one or more seats for the calling buyer. The
 * whole check-then-insert happens inside this single mutation, so Convex's
 * transactional/OCC guarantees are what actually prevent two concurrent
 * buyers from both succeeding on the same seat — no extra locking primitive
 * is needed beyond that.
 */
export const holdSeats = mutation({
  args: {
    eventId: v.id('events'),
    seatIds: v.array(v.id('venueLayoutSeats')),
  },
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);

    if (args.seatIds.length === 0) {
      throw new Error('Select at least one seat');
    }
    if (args.seatIds.length > MAX_SEATS_PER_CALL) {
      throw new Error(`Cannot hold more than ${MAX_SEATS_PER_CALL} seats at once`);
    }

    const event = await ctx.db.get(args.eventId);
    if (!event || event.status !== 'live') {
      throw new Error('Event is not available for purchase');
    }
    if (!event.venueLayoutSnapshotId) {
      throw new Error('This event has no seating layout');
    }

    const now = Date.now();
    const expiresAt = now + HOLD_TTL_MS;
    const holdIds: Id<'seatHolds'>[] = [];

    for (const seatId of args.seatIds) {
      const seat = await ctx.db.get(seatId);
      if (!seat || seat.layoutId !== event.venueLayoutSnapshotId) {
        throw new Error('Seat not found on this event');
      }

      const existingHolds = await ctx.db
        .query('seatHolds')
        .withIndex('by_seatId', q => q.eq('seatId', seatId))
        .collect();

      const conflict = existingHolds.find(
        h =>
          h.status === 'purchased' ||
          (h.status === 'held' && h.expiresAt > now && h.userId !== userId),
      );
      if (conflict) {
        throw new Error(`Seat ${seat.seatLabel} is no longer available`);
      }

      const ownHeld = existingHolds.find(h => h.status === 'held' && h.userId === userId);
      if (ownHeld) {
        await ctx.db.patch(ownHeld._id, {expiresAt});
        holdIds.push(ownHeld._id);
      } else {
        const holdId = await ctx.db.insert('seatHolds', {
          eventId: args.eventId,
          seatId,
          userId,
          status: 'held',
          expiresAt,
          createdAt: now,
        });
        holdIds.push(holdId);
      }
    }

    return {holdIds, expiresAt};
  },
});

// Buyer explicitly deselects seats / navigates away before completing checkout.
export const releaseSeats = mutation({
  args: {holdIds: v.array(v.id('seatHolds'))},
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);

    for (const holdId of args.holdIds) {
      const hold = await ctx.db.get(holdId);
      if (!hold) continue;
      if (hold.userId !== userId) throw new Error('Forbidden');
      if (hold.status === 'held') {
        await ctx.db.patch(holdId, {status: 'released'});
      }
    }
  },
});

// Cron-driven sweep (see convex/crons.ts) — releases holds past their
// expiry so abandoned seat selections become available again. Batches and
// self-chains via the scheduler rather than one unbounded mutation.
export const releaseExpiredInternal = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now();
    const expired = await ctx.db
      .query('seatHolds')
      .withIndex('by_status_and_expiresAt', q =>
        q.eq('status', 'held').lt('expiresAt', now),
      )
      .take(EXPIRED_SWEEP_BATCH_SIZE);

    for (const hold of expired) {
      await ctx.db.patch(hold._id, {status: 'released'});
    }

    if (expired.length === EXPIRED_SWEEP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.seatHolds.releaseExpiredInternal, {});
    }
  },
});

// Reactive availability map for the checkout seat picker — Convex's live
// queries push updates automatically as holds/tickets change, so the UI
// refreshes without polling.
export const getAvailability = query({
  args: {eventId: v.id('events')},
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || !event.venueLayoutSnapshotId) return {};

    const [holds, tickets] = await Promise.all([
      ctx.db
        .query('seatHolds')
        .withIndex('by_eventId_and_status', q =>
          q.eq('eventId', args.eventId).eq('status', 'held'),
        )
        .collect(),
      ctx.db
        .query('tickets')
        .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
        .take(5000),
    ]);

    const now = Date.now();
    const status: Record<string, 'unavailable'> = {};
    for (const hold of holds) {
      if (hold.expiresAt > now) status[hold.seatId] = 'unavailable';
    }
    for (const ticket of tickets) {
      if (ticket.seatId && ticket.status !== 'cancelled' && ticket.status !== 'expired') {
        status[ticket.seatId] = 'unavailable';
      }
    }
    return status;
  },
});
