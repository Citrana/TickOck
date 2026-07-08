import {v} from 'convex/values';
import {mutation, query, MutationCtx, QueryCtx} from './_generated/server';
import {Id} from './_generated/dataModel';
import {getAuthUserId} from '@convex-dev/auth/server';
import {getCallerUserId} from './_helpers/permissions';
import {writeAuditLog} from './_helpers/audit';
import {MAX_SEATS_PER_CALL} from '../lib/venueGenerators';

const seatDraftValidator = v.object({
  x: v.number(),
  y: v.number(),
  rowLabel: v.optional(v.string()),
  seatLabel: v.string(),
  tableLabel: v.optional(v.string()),
  displayOrder: v.number(),
  tierId: v.optional(v.id('venueLayoutTiers')),
});

async function requireOwnedEditableTemplate(
  ctx: MutationCtx,
  layoutId: Id<'venueLayoutTemplates'>,
  userId: Id<'users'>,
) {
  const template = await ctx.db.get(layoutId);
  if (!template) throw new Error('Venue layout not found');
  if (template.ownerId !== userId) throw new Error('Forbidden: not the layout owner');
  if (template.isSnapshot) throw new Error('Cannot modify a locked event snapshot');
  return template;
}

async function deleteSeatsForSection(
  ctx: MutationCtx,
  sectionId: Id<'venueLayoutSections'>,
) {
  for (;;) {
    const seats = await ctx.db
      .query('venueLayoutSeats')
      .withIndex('by_sectionId', q => q.eq('sectionId', sectionId))
      .take(200);
    if (seats.length === 0) break;
    for (const seat of seats) await ctx.db.delete(seat._id);
    if (seats.length < 200) break;
  }
}

/**
 * Deep-copies a layout's sections, tiers, and seats into a brand-new
 * venueLayoutTemplates row (new _ids throughout). Used both for organizer-
 * initiated duplication and for producing the immutable per-event snapshot
 * on attach — the source layout's rows are never mutated by this path.
 *
 * Returns the tier-id remapping (old venueLayoutTiers _id -> new copy's
 * _id) so callers that linked ticketTiers to the SOURCE layout's tiers
 * (event-scoped building, see ensureShadowTiersForEvent) can re-point those
 * links onto the copy.
 */
export async function copyLayout(
  ctx: MutationCtx,
  sourceLayoutId: Id<'venueLayoutTemplates'>,
  opts: {
    ownerId: Id<'users'>;
    isSnapshot: boolean;
    snapshotOfTemplateId?: Id<'venueLayoutTemplates'>;
    snapshotEventId?: Id<'events'>;
    name?: string;
  },
): Promise<{layoutId: Id<'venueLayoutTemplates'>; tierIdMap: Map<Id<'venueLayoutTiers'>, Id<'venueLayoutTiers'>>}> {
  const source = await ctx.db.get(sourceLayoutId);
  if (!source) throw new Error('Venue layout not found');

  const now = Date.now();
  const newLayoutId = await ctx.db.insert('venueLayoutTemplates', {
    ownerId: opts.ownerId,
    name: opts.name ?? source.name,
    description: source.description,
    backgroundImageStorageId: source.backgroundImageStorageId,
    canvasWidth: source.canvasWidth,
    canvasHeight: source.canvasHeight,
    status: source.status,
    isSnapshot: opts.isSnapshot,
    snapshotOfTemplateId: opts.isSnapshot ? sourceLayoutId : opts.snapshotOfTemplateId,
    snapshotEventId: opts.snapshotEventId,
    createdAt: now,
    updatedAt: now,
  });

  const sections = await ctx.db
    .query('venueLayoutSections')
    .withIndex('by_layoutId', q => q.eq('layoutId', sourceLayoutId))
    .collect();
  const sectionIdMap = new Map<Id<'venueLayoutSections'>, Id<'venueLayoutSections'>>();
  for (const s of sections) {
    const newId = await ctx.db.insert('venueLayoutSections', {
      layoutId: newLayoutId,
      name: s.name,
      kind: s.kind,
      shape: s.shape,
      x: s.x,
      y: s.y,
      rotation: s.rotation,
      gaCapacity: s.gaCapacity,
      tierId: undefined, // remapped below once tiers exist
      displayOrder: s.displayOrder,
    });
    sectionIdMap.set(s._id, newId);
  }

  const tiers = await ctx.db
    .query('venueLayoutTiers')
    .withIndex('by_layoutId', q => q.eq('layoutId', sourceLayoutId))
    .collect();
  const tierIdMap = new Map<Id<'venueLayoutTiers'>, Id<'venueLayoutTiers'>>();
  for (const t of tiers) {
    const newId = await ctx.db.insert('venueLayoutTiers', {
      layoutId: newLayoutId,
      name: t.name,
      color: t.color,
      displayOrder: t.displayOrder,
    });
    tierIdMap.set(t._id, newId);
  }

  // Now that tiers exist in the copy, remap each GA section's tierId.
  for (const s of sections) {
    if (!s.tierId) continue;
    const newSectionId = sectionIdMap.get(s._id)!;
    const newTierId = tierIdMap.get(s.tierId);
    if (newTierId) await ctx.db.patch(newSectionId, {tierId: newTierId});
  }

  const seats = await ctx.db
    .query('venueLayoutSeats')
    .withIndex('by_layoutId', q => q.eq('layoutId', sourceLayoutId))
    .take(5000);
  for (const seat of seats) {
    await ctx.db.insert('venueLayoutSeats', {
      layoutId: newLayoutId,
      sectionId: sectionIdMap.get(seat.sectionId)!,
      tierId: seat.tierId ? tierIdMap.get(seat.tierId) : undefined,
      rowLabel: seat.rowLabel,
      seatLabel: seat.seatLabel,
      tableLabel: seat.tableLabel,
      x: seat.x,
      y: seat.y,
      displayOrder: seat.displayOrder,
    });
  }

  return {layoutId: newLayoutId, tierIdMap};
}

// ---------------------------------------------------------------------------
// Template CRUD
// ---------------------------------------------------------------------------

export const createTemplate = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    canvasWidth: v.number(),
    canvasHeight: v.number(),
  },
  handler: async (ctx, args) => {
    const ownerId = await getCallerUserId(ctx as unknown as QueryCtx);
    const now = Date.now();
    const id = await ctx.db.insert('venueLayoutTemplates', {
      ownerId,
      name: args.name,
      description: args.description,
      canvasWidth: args.canvasWidth,
      canvasHeight: args.canvasHeight,
      status: 'draft',
      isSnapshot: false,
      createdAt: now,
      updatedAt: now,
    });

    await writeAuditLog(ctx, {
      actorId: ownerId,
      action: 'venueLayout:create',
      targetType: 'venueLayoutTemplates',
      targetId: id,
      metadata: {name: args.name},
    });

    return id;
  },
});

export const updateTemplateMeta = mutation({
  args: {
    layoutId: v.id('venueLayoutTemplates'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal('draft'), v.literal('published'))),
    backgroundImageStorageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);
    await requireOwnedEditableTemplate(ctx, args.layoutId, userId);

    await ctx.db.patch(args.layoutId, {
      ...(args.name !== undefined ? {name: args.name} : {}),
      ...(args.description !== undefined ? {description: args.description} : {}),
      ...(args.status !== undefined ? {status: args.status} : {}),
      ...(args.backgroundImageStorageId !== undefined
        ? {backgroundImageStorageId: args.backgroundImageStorageId}
        : {}),
      updatedAt: Date.now(),
    });
  },
});

export const duplicateTemplate = mutation({
  args: {
    layoutId: v.id('venueLayoutTemplates'),
    newName: v.string(),
  },
  handler: async (ctx, args) => {
    const ownerId = await getCallerUserId(ctx as unknown as QueryCtx);
    const source = await ctx.db.get(args.layoutId);
    if (!source) throw new Error('Venue layout not found');
    if (source.ownerId !== ownerId) throw new Error('Forbidden: not the layout owner');

    const {layoutId: newId} = await copyLayout(ctx, args.layoutId, {
      ownerId,
      isSnapshot: false,
      name: args.newName,
    });

    await writeAuditLog(ctx, {
      actorId: ownerId,
      action: 'venueLayout:duplicate',
      targetType: 'venueLayoutTemplates',
      targetId: newId,
      metadata: {sourceLayoutId: args.layoutId},
    });

    return newId;
  },
});

// Deletes a layout's sections (and their seats) and tiers, then the layout
// itself. No ownership/lock checks — callers must authorize before invoking
// this, since it's also used to tear down an event's locked snapshot layout
// when the event itself is deleted (see events.remove).
export async function deleteLayoutCascade(
  ctx: MutationCtx,
  layoutId: Id<'venueLayoutTemplates'>,
): Promise<void> {
  const sections = await ctx.db
    .query('venueLayoutSections')
    .withIndex('by_layoutId', q => q.eq('layoutId', layoutId))
    .collect();
  for (const section of sections) {
    await deleteSeatsForSection(ctx, section._id);
    await ctx.db.delete(section._id);
  }

  const tiers = await ctx.db
    .query('venueLayoutTiers')
    .withIndex('by_layoutId', q => q.eq('layoutId', layoutId))
    .collect();
  for (const tier of tiers) await ctx.db.delete(tier._id);

  await ctx.db.delete(layoutId);
}

export const deleteTemplate = mutation({
  args: {layoutId: v.id('venueLayoutTemplates')},
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);
    const template = await requireOwnedEditableTemplate(ctx, args.layoutId, userId);

    await deleteLayoutCascade(ctx, args.layoutId);

    await writeAuditLog(ctx, {
      actorId: userId,
      action: 'venueLayout:delete',
      targetType: 'venueLayoutTemplates',
      targetId: args.layoutId,
      metadata: {name: template.name},
    });
  },
});

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export const addSection = mutation({
  args: {
    layoutId: v.id('venueLayoutTemplates'),
    name: v.string(),
    kind: v.union(v.literal('seated'), v.literal('ga')),
    shape: v.optional(v.string()),
    x: v.number(),
    y: v.number(),
    rotation: v.optional(v.number()),
    gaCapacity: v.optional(v.number()),
    tierId: v.optional(v.id('venueLayoutTiers')),
  },
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);
    await requireOwnedEditableTemplate(ctx, args.layoutId, userId);

    const existing = await ctx.db
      .query('venueLayoutSections')
      .withIndex('by_layoutId', q => q.eq('layoutId', args.layoutId))
      .collect();
    const maxOrder = existing.reduce((m, s) => Math.max(m, s.displayOrder), -1);

    const id = await ctx.db.insert('venueLayoutSections', {
      layoutId: args.layoutId,
      name: args.name,
      kind: args.kind,
      shape: args.shape,
      x: args.x,
      y: args.y,
      rotation: args.rotation,
      gaCapacity: args.gaCapacity,
      tierId: args.tierId,
      displayOrder: maxOrder + 1,
    });

    await ctx.db.patch(args.layoutId, {updatedAt: Date.now()});
    return id;
  },
});

export const updateSection = mutation({
  args: {
    sectionId: v.id('venueLayoutSections'),
    name: v.optional(v.string()),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    rotation: v.optional(v.number()),
    gaCapacity: v.optional(v.number()),
    tierId: v.optional(v.id('venueLayoutTiers')),
  },
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);
    const section = await ctx.db.get(args.sectionId);
    if (!section) throw new Error('Section not found');
    await requireOwnedEditableTemplate(ctx, section.layoutId, userId);

    await ctx.db.patch(args.sectionId, {
      ...(args.name !== undefined ? {name: args.name} : {}),
      ...(args.x !== undefined ? {x: args.x} : {}),
      ...(args.y !== undefined ? {y: args.y} : {}),
      ...(args.rotation !== undefined ? {rotation: args.rotation} : {}),
      ...(args.gaCapacity !== undefined ? {gaCapacity: args.gaCapacity} : {}),
      ...(args.tierId !== undefined ? {tierId: args.tierId} : {}),
    });
  },
});

export const deleteSection = mutation({
  args: {sectionId: v.id('venueLayoutSections')},
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);
    const section = await ctx.db.get(args.sectionId);
    if (!section) throw new Error('Section not found');
    await requireOwnedEditableTemplate(ctx, section.layoutId, userId);

    await deleteSeatsForSection(ctx, args.sectionId);
    await ctx.db.delete(args.sectionId);
  },
});

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

export const addTier = mutation({
  args: {
    layoutId: v.id('venueLayoutTemplates'),
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);
    await requireOwnedEditableTemplate(ctx, args.layoutId, userId);

    const existing = await ctx.db
      .query('venueLayoutTiers')
      .withIndex('by_layoutId', q => q.eq('layoutId', args.layoutId))
      .collect();
    const maxOrder = existing.reduce((m, t) => Math.max(m, t.displayOrder), -1);

    return await ctx.db.insert('venueLayoutTiers', {
      layoutId: args.layoutId,
      name: args.name,
      color: args.color,
      displayOrder: maxOrder + 1,
    });
  },
});

export const updateTier = mutation({
  args: {
    tierId: v.id('venueLayoutTiers'),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);
    const tier = await ctx.db.get(args.tierId);
    if (!tier) throw new Error('Tier not found');
    await requireOwnedEditableTemplate(ctx, tier.layoutId, userId);

    await ctx.db.patch(args.tierId, {
      ...(args.name !== undefined ? {name: args.name} : {}),
      ...(args.color !== undefined ? {color: args.color} : {}),
    });
  },
});

export const deleteTier = mutation({
  args: {tierId: v.id('venueLayoutTiers')},
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);
    const tier = await ctx.db.get(args.tierId);
    if (!tier) throw new Error('Tier not found');
    await requireOwnedEditableTemplate(ctx, tier.layoutId, userId);

    // Unassign any seats/GA sections that referenced this tier rather than
    // blocking deletion.
    for (;;) {
      const seats = await ctx.db
        .query('venueLayoutSeats')
        .withIndex('by_layoutId', q => q.eq('layoutId', tier.layoutId))
        .take(200);
      const affected = seats.filter(s => s.tierId === args.tierId);
      for (const seat of affected) await ctx.db.patch(seat._id, {tierId: undefined});
      if (seats.length < 200) break;
    }

    const sections = await ctx.db
      .query('venueLayoutSections')
      .withIndex('by_layoutId', q => q.eq('layoutId', tier.layoutId))
      .collect();
    for (const section of sections) {
      if (section.tierId === args.tierId) {
        await ctx.db.patch(section._id, {tierId: undefined});
      }
    }

    await ctx.db.delete(args.tierId);
  },
});

// ---------------------------------------------------------------------------
// Event <-> layout tier mapping
// ---------------------------------------------------------------------------

// Links (or unlinks) one of an event's real, priced ticketTiers to a
// category (venueLayoutTiers row) on that event's locked snapshot. Never
// touches quantity — that stays entirely organizer-owned, exactly like a
// non-seat-map event's tiers.
export const mapVenueLayoutTierToTicketTier = mutation({
  args: {
    eventId: v.id('events'),
    venueLayoutTierId: v.id('venueLayoutTiers'),
    ticketTierId: v.optional(v.id('ticketTiers')),
  },
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error('Event not found');
    if (event.ownerId !== userId) throw new Error('Forbidden: not the event owner');
    if (!event.venueLayoutSnapshotId) {
      throw new Error('This event has no attached seating layout yet');
    }

    const category = await ctx.db.get(args.venueLayoutTierId);
    if (!category || category.layoutId !== event.venueLayoutSnapshotId) {
      throw new Error("This category does not belong to this event's layout");
    }

    const eventTiers = await ctx.db
      .query('ticketTiers')
      .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
      .collect();

    // Keep the mapping 1:1 — clear whichever tier (if any) currently claims
    // this category before assigning a new one.
    for (const tier of eventTiers) {
      if (tier.venueLayoutTierId === args.venueLayoutTierId && tier._id !== args.ticketTierId) {
        await ctx.db.patch(tier._id, {venueLayoutTierId: undefined});
      }
    }

    if (args.ticketTierId) {
      const ticketTier = eventTiers.find(t => t._id === args.ticketTierId);
      if (!ticketTier) throw new Error('Ticket tier not found on this event');
      await ctx.db.patch(args.ticketTierId, {venueLayoutTierId: args.venueLayoutTierId});
    }
  },
});

// Called once when the organizer opens the builder in "event-scoped" mode
// (building a brand-new layout for one specific event that already has
// priced ticket tiers). For each of the event's ticketTiers, finds or
// creates a matching category (venueLayoutTiers row) on this draft layout,
// keeping name/color synced, so the canvas/generators can treat it exactly
// like any other category with zero special-casing.
export const ensureShadowTiersForEvent = mutation({
  args: {
    layoutId: v.id('venueLayoutTemplates'),
    eventId: v.id('events'),
  },
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);
    await requireOwnedEditableTemplate(ctx, args.layoutId, userId);

    const event = await ctx.db.get(args.eventId);
    if (!event || event.ownerId !== userId) throw new Error('Forbidden: not the event owner');

    const [ticketTiers, shadowTiers] = await Promise.all([
      ctx.db
        .query('ticketTiers')
        .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
        .collect(),
      ctx.db
        .query('venueLayoutTiers')
        .withIndex('by_layoutId', q => q.eq('layoutId', args.layoutId))
        .collect(),
    ]);
    const shadowById = new Map(shadowTiers.map(t => [t._id, t]));
    let maxOrder = shadowTiers.reduce((m, t) => Math.max(m, t.displayOrder), -1);

    for (const tier of ticketTiers) {
      const existingShadow = tier.venueLayoutTierId
        ? shadowById.get(tier.venueLayoutTierId)
        : undefined;

      if (existingShadow && existingShadow.layoutId === args.layoutId) {
        const nextColor = tier.color ?? existingShadow.color;
        if (existingShadow.name !== tier.name || existingShadow.color !== nextColor) {
          await ctx.db.patch(existingShadow._id, {name: tier.name, color: nextColor});
        }
      } else {
        const newId = await ctx.db.insert('venueLayoutTiers', {
          layoutId: args.layoutId,
          name: tier.name,
          color: tier.color ?? '#2563EB',
          displayOrder: ++maxOrder,
        });
        await ctx.db.patch(tier._id, {venueLayoutTierId: newId});
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Seats
// ---------------------------------------------------------------------------

export const bulkInsertSeats = mutation({
  args: {
    layoutId: v.id('venueLayoutTemplates'),
    sectionId: v.id('venueLayoutSections'),
    seats: v.array(seatDraftValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);
    await requireOwnedEditableTemplate(ctx, args.layoutId, userId);

    if (args.seats.length > MAX_SEATS_PER_CALL) {
      throw new Error(
        `Cannot insert more than ${MAX_SEATS_PER_CALL} seats in a single call — split into multiple calls`,
      );
    }

    const section = await ctx.db.get(args.sectionId);
    if (!section || section.layoutId !== args.layoutId) {
      throw new Error('Section not found');
    }

    const ids: Id<'venueLayoutSeats'>[] = [];
    for (const seat of args.seats) {
      const id = await ctx.db.insert('venueLayoutSeats', {
        layoutId: args.layoutId,
        sectionId: args.sectionId,
        tierId: seat.tierId,
        rowLabel: seat.rowLabel,
        seatLabel: seat.seatLabel,
        tableLabel: seat.tableLabel,
        x: seat.x,
        y: seat.y,
        displayOrder: seat.displayOrder,
      });
      ids.push(id);
    }

    await ctx.db.patch(args.layoutId, {updatedAt: Date.now()});
    return ids;
  },
});

export const updateSeatPosition = mutation({
  args: {seatId: v.id('venueLayoutSeats'), x: v.number(), y: v.number()},
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);
    const seat = await ctx.db.get(args.seatId);
    if (!seat) throw new Error('Seat not found');
    await requireOwnedEditableTemplate(ctx, seat.layoutId, userId);

    await ctx.db.patch(args.seatId, {x: args.x, y: args.y});
  },
});

export const updateSeatLabel = mutation({
  args: {
    seatId: v.id('venueLayoutSeats'),
    seatLabel: v.string(),
    rowLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);
    const seat = await ctx.db.get(args.seatId);
    if (!seat) throw new Error('Seat not found');
    await requireOwnedEditableTemplate(ctx, seat.layoutId, userId);

    await ctx.db.patch(args.seatId, {
      seatLabel: args.seatLabel,
      ...(args.rowLabel !== undefined ? {rowLabel: args.rowLabel} : {}),
    });
  },
});

export const assignSeatsToTier = mutation({
  args: {
    seatIds: v.array(v.id('venueLayoutSeats')),
    tierId: v.optional(v.id('venueLayoutTiers')),
  },
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);
    if (args.seatIds.length > MAX_SEATS_PER_CALL) {
      throw new Error(`Cannot update more than ${MAX_SEATS_PER_CALL} seats at once`);
    }

    for (const seatId of args.seatIds) {
      const seat = await ctx.db.get(seatId);
      if (!seat) continue;
      await requireOwnedEditableTemplate(ctx, seat.layoutId, userId);
      await ctx.db.patch(seatId, {tierId: args.tierId});
    }
  },
});

export const deleteSeats = mutation({
  args: {seatIds: v.array(v.id('venueLayoutSeats'))},
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);
    if (args.seatIds.length > MAX_SEATS_PER_CALL) {
      throw new Error(`Cannot delete more than ${MAX_SEATS_PER_CALL} seats at once`);
    }

    for (const seatId of args.seatIds) {
      const seat = await ctx.db.get(seatId);
      if (!seat) continue;
      await requireOwnedEditableTemplate(ctx, seat.layoutId, userId);
      await ctx.db.delete(seatId);
    }
  },
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// Full read of a template/snapshot — used by the builder and by the
// organizer's read-only "Seating" tab on their own event. Owner-only.
export const getTemplate = query({
  args: {layoutId: v.id('venueLayoutTemplates')},
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const template = await ctx.db.get(args.layoutId);
    if (!template) return null;
    if (template.ownerId !== userId) return null;

    const [sections, tiers, seats] = await Promise.all([
      ctx.db
        .query('venueLayoutSections')
        .withIndex('by_layoutId', q => q.eq('layoutId', args.layoutId))
        .collect(),
      ctx.db
        .query('venueLayoutTiers')
        .withIndex('by_layoutId', q => q.eq('layoutId', args.layoutId))
        .collect(),
      ctx.db
        .query('venueLayoutSeats')
        .withIndex('by_layoutId', q => q.eq('layoutId', args.layoutId))
        .take(5000),
    ]);

    return {
      ...template,
      sections: sections.sort((a, b) => a.displayOrder - b.displayOrder),
      tiers: tiers.sort((a, b) => a.displayOrder - b.displayOrder),
      seats,
    };
  },
});

// Reusable templates the caller owns (excludes locked event snapshots) —
// used by the "attach a layout" picker in event creation.
export const listMineForAttach = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const templates = await ctx.db
      .query('venueLayoutTemplates')
      .withIndex('by_ownerId', q => q.eq('ownerId', userId))
      .order('desc')
      .take(50);

    return templates.filter(t => !t.isSnapshot);
  },
});

// Read-only structural view of an event's locked seating snapshot, for
// checkout's seat picker. Mirrors events.get's visibility gate: only a
// live, non-private event (or its owner) may be read here.
export const getSnapshotForEvent = query({
  args: {eventId: v.id('events')},
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || !event.venueLayoutSnapshotId) return null;

    const isPublicLive = event.status === 'live' && event.visibility !== 'private';
    if (!isPublicLive) {
      const userId = await getAuthUserId(ctx);
      if (userId !== event.ownerId) return null;
    }

    const layoutId = event.venueLayoutSnapshotId;
    const [template, sections, tiers, seats] = await Promise.all([
      ctx.db.get(layoutId),
      ctx.db
        .query('venueLayoutSections')
        .withIndex('by_layoutId', q => q.eq('layoutId', layoutId))
        .collect(),
      ctx.db
        .query('venueLayoutTiers')
        .withIndex('by_layoutId', q => q.eq('layoutId', layoutId))
        .collect(),
      ctx.db
        .query('venueLayoutSeats')
        .withIndex('by_layoutId', q => q.eq('layoutId', layoutId))
        .take(5000),
    ]);
    if (!template) return null;

    return {
      ...template,
      sections: sections.sort((a, b) => a.displayOrder - b.displayOrder),
      tiers: tiers.sort((a, b) => a.displayOrder - b.displayOrder),
      seats,
    };
  },
});
