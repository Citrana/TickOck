import {v} from 'convex/values';
import {mutation, query, QueryCtx} from './_generated/server';
import {assertPermission, getCallerUserId, requirePermission} from './_helpers/permissions';
import {writeAuditLog} from './_helpers/audit';
import {buildEventPrefix, generateUniqueTicketNumber} from './tickets';
import {internal} from './_generated/api';

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
      await requirePermission(ctx, 'payments:confirm', payment.eventId);
    }

    if (payment.status !== 'pending') {
      throw new Error('Payment is not in a pending state');
    }

    await ctx.db.patch(args.paymentId, {
      status: 'confirmed',
      confirmedBy: callerId,
      confirmedAt: Date.now(),
    });

    const prefix = buildEventPrefix(event.title);

    // Activate the primary ticket linked to this payment
    const primaryTicket = await ctx.db.get(payment.ticketId);
    if (primaryTicket && primaryTicket.status === 'pending_payment') {
      const ticketNumber = await generateUniqueTicketNumber(ctx, prefix);
      await ctx.db.patch(payment.ticketId, {status: 'confirmed', ticketNumber});
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
        const ticketNumber = await generateUniqueTicketNumber(ctx, prefix);
        await ctx.db.patch(ticket._id, {status: 'confirmed', ticketNumber});
      }
    }

    await writeAuditLog(ctx, {
      actorId: callerId,
      action: 'payments:confirm',
      targetType: 'payments',
      targetId: args.paymentId,
      metadata: {eventId: payment.eventId, userId: payment.userId},
    });

    await ctx.scheduler.runAfter(0, internal.pushNotifications.deliver, {
      userId: payment.userId,
      title: 'Payment confirmed',
      body: 'Your payment was confirmed — your ticket is ready!',
      url: '/en/tickets',
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
      await requirePermission(ctx, 'payments:reject', payment.eventId);
    }

    if (payment.status !== 'pending') {
      throw new Error('Payment is not in a pending state');
    }

    await ctx.db.patch(args.paymentId, {
      status: 'rejected',
      rejectedBy: callerId,
      rejectedAt: Date.now(),
      rejectionReason: args.reason,
    });

    await writeAuditLog(ctx, {
      actorId: callerId,
      action: 'payments:reject',
      targetType: 'payments',
      targetId: args.paymentId,
      metadata: {reason: args.reason ?? '', eventId: payment.eventId},
    });

    await ctx.scheduler.runAfter(0, internal.pushNotifications.deliver, {
      userId: payment.userId,
      title: 'Payment rejected',
      body: 'Your payment was rejected. See the reason in your tickets.',
      url: '/en/tickets',
    });
  },
});

/**
 * Resubmit a new payment proof after a rejection.
 * Resets the payment to pending so the event owner can review again.
 */
export const resubmitPaymentProof = mutation({
  args: {
    paymentId: v.id('payments'),
    storageId: v.id('_storage'),
    referenceNumber: v.optional(v.string()),
    paymentAccountId: v.optional(v.id('eventPaymentDestinations')),
  },
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);

    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error('Payment not found');
    if (payment.userId !== userId) throw new Error('Forbidden');
    if (payment.status !== 'rejected') {
      throw new Error('Only rejected payments can be resubmitted');
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

    if (args.paymentAccountId) {
      const destination = await ctx.db.get(args.paymentAccountId);
      if (!destination || destination.eventId !== payment.eventId) {
        throw new Error('Invalid payment destination');
      }
    }

    const evidenceUrl = await ctx.storage.getUrl(args.storageId);
    if (!evidenceUrl) throw new Error('Failed to retrieve uploaded file');

    await ctx.db.patch(args.paymentId, {
      status: 'pending',
      evidenceUrl,
      ...(args.referenceNumber ? {referenceNumber: args.referenceNumber} : {}),
      ...(args.paymentAccountId ? {paymentAccountId: args.paymentAccountId} : {}),
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action: 'payments:resubmit_proof',
      targetType: 'payments',
      targetId: args.paymentId,
      metadata: {eventId: payment.eventId},
    });
  },
});

/**
 * Resubmit a rejected payment as cash. No proof needed — resets status to
 * pending and updates method to cash so the event owner can confirm on receipt.
 */
export const resubmitAsCash = mutation({
  args: {paymentId: v.id('payments')},
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);

    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error('Payment not found');
    if (payment.userId !== userId) throw new Error('Forbidden');
    if (payment.status !== 'rejected') {
      throw new Error('Only rejected payments can be resubmitted');
    }

    await ctx.db.patch(args.paymentId, {
      status: 'pending',
      method: 'cash',
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action: 'payments:resubmit_as_cash',
      targetType: 'payments',
      targetId: args.paymentId,
      metadata: {eventId: payment.eventId},
    });
  },
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Lists all payments for an event. Available to the event owner and any
 * event staff holding the payments:view permission (or a broader payments
 * permission / platform role).
 */
export const listByEvent = query({
  args: {eventId: v.id('events')},
  handler: async (ctx, args) => {
    try {
      await assertPermission(ctx, 'payments:view', args.eventId);
    } catch {
      return [];
    }

    const payments = await ctx.db
      .query('payments')
      .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
      .order('desc')
      .take(100);

    return await Promise.all(
      payments.map(async payment => {
        const [user, ticket, actioner, destination] = await Promise.all([
          ctx.db.get(payment.userId),
          ctx.db.get(payment.ticketId),
          payment.confirmedBy
            ? ctx.db.get(payment.confirmedBy)
            : payment.rejectedBy
              ? ctx.db.get(payment.rejectedBy)
              : Promise.resolve(null),
          payment.paymentAccountId ? ctx.db.get(payment.paymentAccountId) : Promise.resolve(null),
        ]);
        return {
          ...payment,
          userName: user?.name ?? user?.email ?? 'Unknown',
          userEmail: user?.email ?? null,
          ticketStatus: ticket?.status ?? 'unknown',
          actionedByName: actioner ? (actioner.name ?? actioner.email ?? null) : null,
          actionedAt: payment.confirmedAt ?? payment.rejectedAt ?? null,
          paidToName: destination?.name ?? null,
          paidToPhone: destination?.phone ?? null,
        };
      }),
    );
  },
});
