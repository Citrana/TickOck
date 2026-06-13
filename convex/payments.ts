import {v} from 'convex/values';
import {mutation, query, QueryCtx} from './_generated/server';
import {getAuthUserId} from '@convex-dev/auth/server';
import {getCallerUserId, requirePermission} from './_helpers/permissions';
import {writeAuditLog} from './_helpers/audit';

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Confirm a pending payment and activate the associated tickets.
 * Only the event owner or a user with payments:confirm permission may call this.
 */
export const confirmPayment = mutation({
  args: {paymentId: v.id('payments')},
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error('Payment not found');

    const event = await ctx.db.get(payment.eventId);
    if (!event) throw new Error('Event not found');

    // Resolve caller and check authorization
    const callerId = await getCallerUserId(ctx as unknown as QueryCtx);
    if (event.ownerId !== callerId) {
      await requirePermission(ctx, 'payments:confirm');
    }

    if (payment.status !== 'pending') {
      throw new Error('Payment is not in a pending state');
    }

    await ctx.db.patch(args.paymentId, {
      status: 'confirmed',
      confirmedBy: callerId,
      confirmedAt: Date.now(),
    });

    // Activate the primary ticket linked to this payment
    const primaryTicket = await ctx.db.get(payment.ticketId);
    if (primaryTicket && primaryTicket.status === 'pending_payment') {
      await ctx.db.patch(payment.ticketId, {status: 'confirmed'});
    }

    // Activate any other pending_payment tickets from the same order
    // (multi-ticket purchases share the same userId + eventId + createdAt batch)
    const relatedTickets = await ctx.db
      .query('tickets')
      .withIndex('by_eventId_and_userId', q =>
        q.eq('eventId', payment.eventId).eq('userId', payment.userId),
      )
      .take(20);

    for (const ticket of relatedTickets) {
      if (ticket._id !== payment.ticketId && ticket.status === 'pending_payment') {
        await ctx.db.patch(ticket._id, {status: 'confirmed'});
      }
    }

    await writeAuditLog(ctx, {
      actorId: callerId,
      action: 'payments:confirm',
      targetType: 'payments',
      targetId: args.paymentId,
      metadata: {eventId: payment.eventId, userId: payment.userId},
    });
  },
});

/**
 * Reject a pending payment. Only the event owner or a user with
 * payments:reject permission may call this.
 */
export const rejectPayment = mutation({
  args: {
    paymentId: v.id('payments'),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error('Payment not found');

    const event = await ctx.db.get(payment.eventId);
    if (!event) throw new Error('Event not found');

    const callerId = await getCallerUserId(ctx as unknown as QueryCtx);
    if (event.ownerId !== callerId) {
      await requirePermission(ctx, 'payments:reject');
    }

    if (payment.status !== 'pending') {
      throw new Error('Payment is not in a pending state');
    }

    await ctx.db.patch(args.paymentId, {status: 'rejected'});

    await writeAuditLog(ctx, {
      actorId: callerId,
      action: 'payments:reject',
      targetType: 'payments',
      targetId: args.paymentId,
      metadata: {reason: args.reason ?? '', eventId: payment.eventId},
    });
  },
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Lists all payments for an event. Only the event owner can view these.
 * Used by the event owner's dashboard to confirm/reject payments.
 */
export const listByEvent = query({
  args: {eventId: v.id('events')},
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const event = await ctx.db.get(args.eventId);
    if (!event || event.ownerId !== userId) return [];

    const payments = await ctx.db
      .query('payments')
      .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
      .order('desc')
      .take(100);

    return await Promise.all(
      payments.map(async payment => {
        const [user, ticket] = await Promise.all([
          ctx.db.get(payment.userId),
          ctx.db.get(payment.ticketId),
        ]);
        return {
          ...payment,
          userName: user?.name ?? user?.email ?? 'Unknown',
          userEmail: user?.email ?? null,
          ticketStatus: ticket?.status ?? 'unknown',
        };
      }),
    );
  },
});
