import {v} from 'convex/values';
import {mutation, query} from './_generated/server';
import {assertPermission, requirePermission} from './_helpers/permissions';
import {requireEventNotEnded} from './_helpers/eventTiming';
import {writeAuditLog} from './_helpers/audit';

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Add a named manual-payment destination (e.g. a mobile money number) to an
 * event. Buyers pick one of these when submitting payment proof.
 */
export const addDestination = mutation({
  args: {
    eventId: v.id('events'),
    name: v.string(),
    phone: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error('Event not found');
    const actorId = await requirePermission(ctx, 'events:edit', args.eventId);
    requireEventNotEnded(event);

    const existing = await ctx.db
      .query('eventPaymentDestinations')
      .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
      .collect();

    const destinationId = await ctx.db.insert('eventPaymentDestinations', {
      eventId: args.eventId,
      name: args.name,
      phone: args.phone,
      note: args.note,
      isActive: true,
      displayOrder: existing.length,
      createdAt: Date.now(),
    });

    await writeAuditLog(ctx, {
      actorId,
      action: 'paymentDestinations:create',
      targetType: 'eventPaymentDestinations',
      targetId: destinationId,
      metadata: {eventId: args.eventId, name: args.name},
    });

    return destinationId;
  },
});

/**
 * Update a payment destination's details. Only the owner (or a caller with
 * events:edit) may call this.
 */
export const updateDestination = mutation({
  args: {
    destinationId: v.id('eventPaymentDestinations'),
    name: v.string(),
    phone: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const destination = await ctx.db.get(args.destinationId);
    if (!destination) throw new Error('Payment destination not found');
    const event = await ctx.db.get(destination.eventId);
    if (!event) throw new Error('Event not found');
    const actorId = await requirePermission(ctx, 'events:edit', destination.eventId);
    requireEventNotEnded(event);

    await ctx.db.patch(args.destinationId, {
      name: args.name,
      phone: args.phone,
      note: args.note,
    });

    await writeAuditLog(ctx, {
      actorId,
      action: 'paymentDestinations:update',
      targetType: 'eventPaymentDestinations',
      targetId: args.destinationId,
      metadata: {eventId: destination.eventId, name: args.name},
    });
  },
});

/**
 * Deactivate a payment destination — hides it from the buyer-facing picker
 * but keeps the record (and its history on past payments) intact. Never
 * hard-deleted.
 */
export const deactivateDestination = mutation({
  args: {destinationId: v.id('eventPaymentDestinations')},
  handler: async (ctx, args) => {
    const destination = await ctx.db.get(args.destinationId);
    if (!destination) throw new Error('Payment destination not found');
    const event = await ctx.db.get(destination.eventId);
    if (!event) throw new Error('Event not found');
    const actorId = await requirePermission(ctx, 'events:edit', destination.eventId);
    requireEventNotEnded(event);

    if (!destination.isActive) throw new Error('Payment destination is already inactive');

    await ctx.db.patch(args.destinationId, {isActive: false});

    await writeAuditLog(ctx, {
      actorId,
      action: 'paymentDestinations:deactivate',
      targetType: 'eventPaymentDestinations',
      targetId: args.destinationId,
      metadata: {eventId: destination.eventId},
    });
  },
});

/**
 * Reactivate a previously deactivated payment destination.
 */
export const reactivateDestination = mutation({
  args: {destinationId: v.id('eventPaymentDestinations')},
  handler: async (ctx, args) => {
    const destination = await ctx.db.get(args.destinationId);
    if (!destination) throw new Error('Payment destination not found');
    const event = await ctx.db.get(destination.eventId);
    if (!event) throw new Error('Event not found');
    const actorId = await requirePermission(ctx, 'events:edit', destination.eventId);
    requireEventNotEnded(event);

    if (destination.isActive) throw new Error('Payment destination is already active');

    await ctx.db.patch(args.destinationId, {isActive: true});

    await writeAuditLog(ctx, {
      actorId,
      action: 'paymentDestinations:reactivate',
      targetType: 'eventPaymentDestinations',
      targetId: args.destinationId,
      metadata: {eventId: destination.eventId},
    });
  },
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Lists every payment destination for an event, active and inactive, for
 * the owner/staff management view. Available to the event owner and any
 * staff holding payments:view (same gate as payments.listByEvent).
 */
export const listByEvent = query({
  args: {eventId: v.id('events')},
  handler: async (ctx, args) => {
    try {
      await assertPermission(ctx, 'payments:view', args.eventId);
    } catch {
      return [];
    }

    const destinations = await ctx.db
      .query('eventPaymentDestinations')
      .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
      .collect();

    return destinations.sort((a, b) => a.displayOrder - b.displayOrder);
  },
});

/**
 * Lists only the active payment destinations for an event — used by buyers
 * during checkout to pick who they paid. No permission check: same trust
 * level as public event details.
 */
export const listActiveForCheckout = query({
  args: {eventId: v.id('events')},
  handler: async (ctx, args) => {
    const destinations = await ctx.db
      .query('eventPaymentDestinations')
      .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
      .collect();

    return destinations
      .filter(d => d.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(d => ({_id: d._id, name: d.name, phone: d.phone, note: d.note}));
  },
});
