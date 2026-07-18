import {v} from 'convex/values';
import {mutation} from './_generated/server';
import {QueryCtx} from './_generated/server';
import {getCallerUserId} from './_helpers/permissions';
import {writeAuditLog} from './_helpers/audit';
import {requireOwnedTemplate} from './venueLayout';

const kindValidator = v.union(
  v.literal('wall'),
  v.literal('door'),
  v.literal('window'),
  v.literal('parking'),
  v.literal('amenity'),
  v.literal('zone'),
  v.literal('stage'),
);

const shapeValidator = v.union(v.literal('rectangle'), v.literal('circle'), v.literal('polygon'));

const pointValidator = v.object({x: v.number(), y: v.number()});

const amenityTypeValidator = v.union(
  v.literal('toilet'),
  v.literal('bar'),
  v.literal('first_aid'),
  v.literal('info'),
  v.literal('coat_check'),
  v.literal('smoking_area'),
  v.literal('atm'),
  v.literal('charging_station'),
  v.literal('wheelchair_access'),
  v.literal('lost_found'),
  v.literal('parking'),
);

// Structural elements never reference seats, so — unlike sections/tiers/
// seats — they carry no sold/reserved risk and can be added/edited/removed
// on a live event's layout at any time; no snapshot lock, no seat guard.

function assertRequiredFieldsForKind(args: {
  kind: 'wall' | 'door' | 'window' | 'parking' | 'amenity' | 'zone' | 'stage';
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  amenityType?: string;
  shape?: 'rectangle' | 'circle' | 'polygon';
  points?: {x: number; y: number}[];
}): void {
  if (args.kind === 'wall' && (args.x2 === undefined || args.y2 === undefined)) {
    throw new Error('A wall requires an end point (x2, y2)');
  }
  if (
    (args.kind === 'door' || args.kind === 'window' || args.kind === 'parking' || args.kind === 'zone') &&
    (args.width === undefined || args.height === undefined)
  ) {
    throw new Error(`A ${args.kind} requires width and height`);
  }
  if (args.kind === 'amenity' && args.amenityType === undefined) {
    throw new Error('An amenity marker requires an amenityType');
  }
  if (args.kind === 'stage') {
    if (args.shape === undefined) {
      throw new Error('A stage requires a shape');
    }
    if ((args.shape === 'rectangle' || args.shape === 'circle') && (args.width === undefined || args.height === undefined)) {
      throw new Error('A rectangle or circle stage requires width and height');
    }
    if (args.shape === 'polygon' && (args.points === undefined || args.points.length < 3)) {
      throw new Error('A polygon stage requires at least 3 points');
    }
  }
}

export const addElement = mutation({
  args: {
    layoutId: v.id('venueLayoutTemplates'),
    kind: kindValidator,
    x: v.number(),
    y: v.number(),
    x2: v.optional(v.number()),
    y2: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    rotation: v.optional(v.number()),
    shape: v.optional(shapeValidator),
    points: v.optional(v.array(pointValidator)),
    doorType: v.optional(v.union(v.literal('main'), v.literal('emergency'), v.literal('staff'))),
    amenityType: v.optional(amenityTypeValidator),
    capacity: v.optional(v.number()),
    label: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);
    await requireOwnedTemplate(ctx, args.layoutId, userId);
    assertRequiredFieldsForKind(args);

    const existing = await ctx.db
      .query('venueLayoutElements')
      .withIndex('by_layoutId', q => q.eq('layoutId', args.layoutId))
      .collect();
    const maxOrder = existing.reduce((m, el) => Math.max(m, el.displayOrder), -1);

    const id = await ctx.db.insert('venueLayoutElements', {
      layoutId: args.layoutId,
      kind: args.kind,
      x: args.x,
      y: args.y,
      x2: args.x2,
      y2: args.y2,
      width: args.width,
      height: args.height,
      rotation: args.rotation,
      shape: args.shape,
      points: args.points,
      doorType: args.doorType,
      amenityType: args.amenityType,
      capacity: args.capacity,
      label: args.label,
      color: args.color,
      displayOrder: maxOrder + 1,
    });

    await ctx.db.patch(args.layoutId, {updatedAt: Date.now()});
    await writeAuditLog(ctx, {
      actorId: userId,
      action: 'venueLayoutElement:create',
      targetType: 'venueLayoutElements',
      targetId: id,
      metadata: {layoutId: args.layoutId, kind: args.kind},
    });
    return id;
  },
});

export const updateElement = mutation({
  args: {
    elementId: v.id('venueLayoutElements'),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    x2: v.optional(v.number()),
    y2: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    rotation: v.optional(v.number()),
    points: v.optional(v.array(pointValidator)),
    doorType: v.optional(v.union(v.literal('main'), v.literal('emergency'), v.literal('staff'))),
    amenityType: v.optional(amenityTypeValidator),
    capacity: v.optional(v.number()),
    label: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);
    const element = await ctx.db.get(args.elementId);
    if (!element) throw new Error('Element not found');
    await requireOwnedTemplate(ctx, element.layoutId, userId);

    const {elementId, ...patch} = args;
    await ctx.db.patch(elementId, {
      ...(patch.x !== undefined ? {x: patch.x} : {}),
      ...(patch.y !== undefined ? {y: patch.y} : {}),
      ...(patch.x2 !== undefined ? {x2: patch.x2} : {}),
      ...(patch.y2 !== undefined ? {y2: patch.y2} : {}),
      ...(patch.width !== undefined ? {width: patch.width} : {}),
      ...(patch.height !== undefined ? {height: patch.height} : {}),
      ...(patch.rotation !== undefined ? {rotation: patch.rotation} : {}),
      ...(patch.points !== undefined ? {points: patch.points} : {}),
      ...(patch.doorType !== undefined ? {doorType: patch.doorType} : {}),
      ...(patch.amenityType !== undefined ? {amenityType: patch.amenityType} : {}),
      ...(patch.capacity !== undefined ? {capacity: patch.capacity} : {}),
      ...(patch.label !== undefined ? {label: patch.label} : {}),
      ...(patch.color !== undefined ? {color: patch.color} : {}),
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action: 'venueLayoutElement:update',
      targetType: 'venueLayoutElements',
      targetId: args.elementId,
      metadata: {kind: element.kind},
    });
  },
});

export const deleteElement = mutation({
  args: {elementId: v.id('venueLayoutElements')},
  handler: async (ctx, args) => {
    const userId = await getCallerUserId(ctx as unknown as QueryCtx);
    const element = await ctx.db.get(args.elementId);
    if (!element) throw new Error('Element not found');
    await requireOwnedTemplate(ctx, element.layoutId, userId);

    await ctx.db.delete(args.elementId);
    await writeAuditLog(ctx, {
      actorId: userId,
      action: 'venueLayoutElement:delete',
      targetType: 'venueLayoutElements',
      targetId: args.elementId,
      metadata: {kind: element.kind},
    });
  },
});
