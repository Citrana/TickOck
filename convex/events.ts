import {v} from 'convex/values';
import {mutation, query, MutationCtx, QueryCtx} from './_generated/server';
import {Id} from './_generated/dataModel';
import {getCallerUserId, hasPlatformPermission, requirePermission} from './_helpers/permissions';
import {requireFeatureEnabled} from './_helpers/featureFlags';
import {requireEventNotEnded} from './_helpers/eventTiming';
import {writeAuditLog} from './_helpers/audit';
import {getAuthUserId} from '@convex-dev/auth/server';
import {copyLayout, deleteLayoutCascade} from './venueLayout';

// ---------------------------------------------------------------------------
// Shared validators
// ---------------------------------------------------------------------------

const venueValidator = v.object({
  name: v.string(),
  address: v.string(),
  city: v.string(),
});

const cancellationPolicyValidator = v.object({
  allowed: v.boolean(),
  cutoffHours: v.optional(v.number()),
});

const tierInputValidator = v.object({
  existingId: v.optional(v.id('ticketTiers')),
  name: v.string(),
  price: v.number(),
  currency: v.string(),
  quantity: v.number(),
  description: v.optional(v.string()),
  color: v.optional(v.string()),
});

const speakerInputValidator = v.object({
  existingId: v.optional(v.id('eventSpeakers')),
  name: v.string(),
  speakerTitle: v.optional(v.string()),
  bio: v.optional(v.string()),
  photoStorageId: v.optional(v.id('_storage')),
  displayOrder: v.number(),
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function generateHmacSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

type TierInput = {
  existingId?: Id<'ticketTiers'>;
  name: string;
  price: number;
  currency: string;
  quantity: number;
  description?: string;
  color?: string;
};

type SpeakerInput = {
  existingId?: Id<'eventSpeakers'>;
  name: string;
  speakerTitle?: string;
  bio?: string;
  photoStorageId?: Id<'_storage'>;
  displayOrder: number;
};

async function reconcileTiers(
  ctx: MutationCtx,
  eventId: Id<'events'>,
  submitted: TierInput[],
): Promise<void> {
  const existing = await ctx.db
    .query('ticketTiers')
    .withIndex('by_eventId', q => q.eq('eventId', eventId))
    .collect();

  const submittedIds = new Set<Id<'ticketTiers'>>(
    submitted.flatMap(t => (t.existingId ? [t.existingId] : [])),
  );

  for (const tier of existing) {
    if (!submittedIds.has(tier._id)) {
      const sold = await ctx.db
        .query('tickets')
        .withIndex('by_tierId', q => q.eq('tierId', tier._id))
        .first();
      if (sold) {
        throw new Error(
          `Cannot remove tier "${tier.name}" — tickets have already been sold for it.`,
        );
      }
      await ctx.db.delete(tier._id);
    }
  }

  for (const tier of submitted) {
    if (tier.existingId) {
      const existingTier = await ctx.db.get(tier.existingId);
      if (!existingTier) throw new Error('Ticket tier not found');

      if (tier.price !== existingTier.price) {
        const sold = await ctx.db
          .query('tickets')
          .withIndex('by_tierId', q => q.eq('tierId', tier.existingId!))
          .first();
        if (sold) {
          throw new Error(
            `Cannot change the price of tier "${tier.name}" — tickets have already been sold.`,
          );
        }
      }

      await ctx.db.patch(tier.existingId, {
        name: tier.name,
        price: tier.price,
        currency: tier.currency,
        quantity: tier.quantity,
        description: tier.description,
        color: tier.color,
      });
    } else {
      await ctx.db.insert('ticketTiers', {
        eventId,
        name: tier.name,
        price: tier.price,
        currency: tier.currency,
        quantity: tier.quantity,
        quantitySold: 0,
        description: tier.description,
        color: tier.color,
      });
    }
  }
}

/**
 * If the organizer chose a venue layout template for this event and it
 * hasn't been attached yet, deep-copy it into an immutable snapshot scoped
 * to this event. Idempotent: a no-op once the event already has a
 * snapshot, so re-saving the same event repeatedly (or resubmitting after
 * a rejection) never re-copies the layout.
 *
 * Ticket tiers are always organizer-owned now (reconciled via
 * reconcileTiers, same as any non-seat-map event) — this function never
 * creates/derives ticketTiers itself. If the organizer built this layout
 * from within this same event (event-scoped builder mode), some
 * ticketTiers may already be linked to the DRAFT template's shadow
 * categories (see ensureShadowTiersForEvent); those links are re-pointed
 * onto the snapshot's copies here so the checkout price bridge keeps
 * resolving correctly. Reused templates have no such links yet — the
 * organizer maps categories to tiers manually afterward.
 */
async function attachVenueLayoutIfNeeded(
  ctx: MutationCtx,
  eventId: Id<'events'>,
  venueLayoutTemplateId: Id<'venueLayoutTemplates'> | undefined,
  ownerId: Id<'users'>,
): Promise<void> {
  if (!venueLayoutTemplateId) return;

  const event = await ctx.db.get(eventId);
  if (!event || event.venueLayoutSnapshotId) return;

  await requireFeatureEnabled(ctx, 'venue_layout_design');

  const {layoutId: snapshotId, tierIdMap} = await copyLayout(ctx, venueLayoutTemplateId, {
    ownerId,
    isSnapshot: true,
    snapshotEventId: eventId,
  });

  const eventTiers = await ctx.db
    .query('ticketTiers')
    .withIndex('by_eventId', q => q.eq('eventId', eventId))
    .collect();
  for (const tier of eventTiers) {
    if (tier.venueLayoutTierId && tierIdMap.has(tier.venueLayoutTierId)) {
      await ctx.db.patch(tier._id, {venueLayoutTierId: tierIdMap.get(tier.venueLayoutTierId)!});
    }
  }

  await ctx.db.patch(eventId, {
    seatMapEnabled: true,
    venueLayoutSnapshotId: snapshotId,
  });
}

async function reconcileSpeakers(
  ctx: MutationCtx,
  eventId: Id<'events'>,
  submitted: SpeakerInput[],
): Promise<void> {
  const existing = await ctx.db
    .query('eventSpeakers')
    .withIndex('by_eventId', q => q.eq('eventId', eventId))
    .collect();

  const submittedIds = new Set<Id<'eventSpeakers'>>(
    submitted.flatMap(s => (s.existingId ? [s.existingId] : [])),
  );

  for (const speaker of existing) {
    if (!submittedIds.has(speaker._id)) {
      await ctx.db.delete(speaker._id);
    }
  }

  for (const speaker of submitted) {
    if (speaker.existingId) {
      await ctx.db.patch(speaker.existingId, {
        name: speaker.name,
        speakerTitle: speaker.speakerTitle,
        bio: speaker.bio,
        photoStorageId: speaker.photoStorageId,
        displayOrder: speaker.displayOrder,
      });
    } else {
      await ctx.db.insert('eventSpeakers', {
        eventId,
        name: speaker.name,
        speakerTitle: speaker.speakerTitle,
        bio: speaker.bio,
        photoStorageId: speaker.photoStorageId,
        displayOrder: speaker.displayOrder,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// File upload
// ---------------------------------------------------------------------------

// Returns a one-time pre-signed URL for uploading a file to Convex storage.
// The client POSTs the file to this URL and receives { storageId } in the response body.
export const generateUploadUrl = mutation({
  args: {},
  handler: async ctx => {
    await getCallerUserId(ctx as unknown as QueryCtx);
    return await ctx.storage.generateUploadUrl();
  },
});

// ---------------------------------------------------------------------------
// Shared event field args
// ---------------------------------------------------------------------------

const eventWriteArgs = {
  title: v.string(),
  description: v.optional(v.string()),
  category: v.optional(v.string()),
  venue: venueValidator,
  date: v.number(),
  startTime: v.string(),
  endTime: v.optional(v.string()),
  timezone: v.string(),
  coverImageStorageId: v.optional(v.id('_storage')),
  visibility: v.union(
    v.literal('public'),
    v.literal('private'),
    v.literal('unlisted'),
  ),
  paymentMode: v.union(v.literal('online'), v.literal('manual')),
  cancellationPolicy: cancellationPolicyValidator,
  tiers: v.array(tierInputValidator),
  speakers: v.array(speakerInputValidator),
  platformFeeTotal: v.optional(v.number()),
  platformFeeCurrency: v.optional(v.string()),
  venueLayoutTemplateId: v.optional(v.id('venueLayoutTemplates')),
  venueLayoutFeeTotal: v.optional(v.number()),
  venueLayoutFeeCurrency: v.optional(v.string()),
};

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

// Creates a new event as a draft. Caller becomes the owner automatically.
export const create = mutation({
  args: eventWriteArgs,
  handler: async (ctx, args) => {
    const ownerId = await getCallerUserId(ctx as unknown as QueryCtx);

    const eventId = await ctx.db.insert('events', {
      title: args.title,
      description: args.description,
      category: args.category,
      venue: args.venue,
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      timezone: args.timezone,
      coverImageStorageId: args.coverImageStorageId,
      visibility: args.visibility,
      paymentMode: args.paymentMode,
      cancellationPolicy: args.cancellationPolicy,
      status: 'draft',
      ownerId,
      hmacSecret: generateHmacSecret(),
      platformFeeTotal: args.platformFeeTotal,
      platformFeeCurrency: args.platformFeeCurrency,
      venueLayoutFeeTotal: args.venueLayoutFeeTotal,
      venueLayoutFeeCurrency: args.venueLayoutFeeCurrency,
      createdAt: Date.now(),
    });

    await reconcileTiers(ctx, eventId, args.tiers);
    await attachVenueLayoutIfNeeded(ctx, eventId, args.venueLayoutTemplateId, ownerId);

    for (const speaker of args.speakers) {
      await ctx.db.insert('eventSpeakers', {
        eventId,
        name: speaker.name,
        speakerTitle: speaker.speakerTitle,
        bio: speaker.bio,
        photoStorageId: speaker.photoStorageId,
        displayOrder: speaker.displayOrder,
      });
    }

    await writeAuditLog(ctx, {
      actorId: ownerId,
      action: 'events:create',
      targetType: 'events',
      targetId: eventId,
      metadata: {title: args.title, status: 'draft'},
    });

    return eventId;
  },
});

// Updates an event. Only the owner can update.
// Tier prices cannot change after the first ticket for that tier is sold.
export const update = mutation({
  args: {
    eventId: v.id('events'),
    ...eventWriteArgs,
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error('Event not found');
    const actorId = await requirePermission(ctx, 'events:edit', args.eventId);
    requireEventNotEnded(event);

    await ctx.db.patch(args.eventId, {
      title: args.title,
      description: args.description,
      category: args.category,
      venue: args.venue,
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      timezone: args.timezone,
      coverImageStorageId: args.coverImageStorageId,
      visibility: args.visibility,
      paymentMode: args.paymentMode,
      cancellationPolicy: args.cancellationPolicy,
      platformFeeTotal: args.platformFeeTotal,
      platformFeeCurrency: args.platformFeeCurrency,
      venueLayoutFeeTotal: args.venueLayoutFeeTotal,
      venueLayoutFeeCurrency: args.venueLayoutFeeCurrency,
    });

    await reconcileTiers(ctx, args.eventId, args.tiers);
    await attachVenueLayoutIfNeeded(ctx, args.eventId, args.venueLayoutTemplateId, event.ownerId);
    await reconcileSpeakers(ctx, args.eventId, args.speakers);

    await writeAuditLog(ctx, {
      actorId,
      action: 'events:edit',
      targetType: 'events',
      targetId: args.eventId,
      metadata: actorId === event.ownerId
        ? {title: args.title}
        : {title: args.title, onBehalfOf: event.ownerId},
    });
  },
});

// Attaches payment evidence and moves the event to pending_approval.
// Event must be in draft or rejected state.
export const submitForApproval = mutation({
  args: {
    eventId: v.id('events'),
    platformFeeEvidenceStorageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error('Event not found');
    const actorId = await requirePermission(ctx, 'events:edit', args.eventId);

    if (event.status !== 'draft' && event.status !== 'rejected') {
      throw new Error(
        'Event must be in draft or rejected status to submit for approval',
      );
    }

    const tier = await ctx.db
      .query('ticketTiers')
      .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
      .first();
    if (!tier) {
      throw new Error('Event must have at least one ticket tier before submitting');
    }

    await ctx.db.patch(args.eventId, {
      status: 'pending_approval',
      platformFeeEvidenceStorageId: args.platformFeeEvidenceStorageId,
      rejectionReason: undefined,
    });

    await writeAuditLog(ctx, {
      actorId,
      action: 'events:submit',
      targetType: 'events',
      targetId: args.eventId,
      metadata: actorId === event.ownerId
        ? {previousStatus: event.status}
        : {previousStatus: event.status, onBehalfOf: event.ownerId},
    });
  },
});

// Deletes an event that never went live — draft or rejected only. Cascades
// its ticket tiers, speakers, and (if attached) its private venue layout
// snapshot. Never touches payments/tickets/eventStaff since those can't
// exist for an event that hasn't been live.
export const remove = mutation({
  args: {eventId: v.id('events')},
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error('Event not found');
    if (event.status !== 'draft' && event.status !== 'rejected') {
      throw new Error('Only draft or rejected events can be deleted');
    }

    const actorId = await requirePermission(ctx, 'events:delete', args.eventId);

    const tiers = await ctx.db
      .query('ticketTiers')
      .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
      .collect();
    for (const tier of tiers) await ctx.db.delete(tier._id);

    const speakers = await ctx.db
      .query('eventSpeakers')
      .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
      .collect();
    for (const speaker of speakers) await ctx.db.delete(speaker._id);

    if (event.venueLayoutSnapshotId) {
      await deleteLayoutCascade(ctx, event.venueLayoutSnapshotId);
    }

    await ctx.db.delete(args.eventId);

    await writeAuditLog(ctx, {
      actorId,
      action: 'events:delete',
      targetType: 'events',
      targetId: args.eventId,
      metadata: {title: event.title, status: event.status},
    });
  },
});

// Admin-only: approve a pending event and make it live.
export const approve = mutation({
  args: {eventId: v.id('events')},
  handler: async (ctx, args) => {
    const actorId = await requirePermission(ctx, 'events:approve');

    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error('Event not found');
    if (event.status !== 'pending_approval') {
      throw new Error('Only pending_approval events can be approved');
    }

    await ctx.db.patch(args.eventId, {status: 'live', rejectionReason: undefined});

    await writeAuditLog(ctx, {
      actorId,
      action: 'events:approve',
      targetType: 'events',
      targetId: args.eventId,
      metadata: {title: event.title},
    });
  },
});

// Admin-only: reject a pending event with a reason. Owner can then resubmit.
export const reject = mutation({
  args: {
    eventId: v.id('events'),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await requirePermission(ctx, 'events:approve');

    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error('Event not found');
    if (event.status !== 'pending_approval') {
      throw new Error('Only pending_approval events can be rejected');
    }

    await ctx.db.patch(args.eventId, {
      status: 'rejected',
      rejectionReason: args.reason ?? '',
    });

    await writeAuditLog(ctx, {
      actorId,
      action: 'events:reject',
      targetType: 'events',
      targetId: args.eventId,
      metadata: {reason: args.reason ?? ''},
    });
  },
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// Fetches a single event with resolved image URLs, tiers, and speakers.
// Private/non-live events are only returned to the event owner.
export const get = query({
  args: {eventId: v.id('events')},
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) return null;

    const isPublicLive = event.status === 'live' && event.visibility !== 'private';
    if (!isPublicLive) {
      const userId = await getAuthUserId(ctx);
      if (userId !== event.ownerId && (!userId || !(await hasPlatformPermission(ctx, userId, 'events:edit')))) {
        return null;
      }
    }

    const [tiers, speakers] = await Promise.all([
      ctx.db
        .query('ticketTiers')
        .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
        .collect(),
      ctx.db
        .query('eventSpeakers')
        .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
        .order('asc')
        .collect(),
    ]);

    const coverImageUrl = event.coverImageStorageId
      ? await ctx.storage.getUrl(event.coverImageStorageId)
      : null;

    const speakersWithPhotos = await Promise.all(
      speakers.map(async s => ({
        ...s,
        photoUrl: s.photoStorageId ? await ctx.storage.getUrl(s.photoStorageId) : null,
      })),
    );

    const feeEvidenceUrl = event.platformFeeEvidenceStorageId
      ? await ctx.storage.getUrl(event.platformFeeEvidenceStorageId)
      : null;

    return {
      ...event,
      coverImageUrl,
      feeEvidenceUrl,
      tiers,
      speakers: speakersWithPhotos,
    };
  },
});

// Returns all events where the current user is the owner (any status).
export const listMine = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const events = await ctx.db
      .query('events')
      .withIndex('by_ownerId', q => q.eq('ownerId', userId))
      .order('desc')
      .take(50);

    return await Promise.all(
      events.map(async event => ({
        ...event,
        coverImageUrl: event.coverImageStorageId
          ? await ctx.storage.getUrl(event.coverImageStorageId)
          : null,
      })),
    );
  },
});

/**
 * Returns live public events for the discovery feed, optionally filtered by
 * category, city substring, or start date. Returns up to 20 results enriched
 * with cover image URL and minimum tier price.
 */
export const listLive = query({
  args: {
    category: v.optional(v.string()),
    city: v.optional(v.string()),
    dateFrom: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Fetch more than the limit so filters can narrow the set
    const events = await ctx.db
      .query('events')
      .withIndex('by_status_and_visibility', q =>
        q.eq('status', 'live').eq('visibility', 'public'),
      )
      .order('asc')
      .take(100);

    let filtered = events;

    if (args.category) {
      filtered = filtered.filter(e => e.category === args.category);
    }
    if (args.city) {
      const city = args.city.toLowerCase();
      filtered = filtered.filter(e => e.venue.city.toLowerCase().includes(city));
    }
    if (args.dateFrom !== undefined) {
      filtered = filtered.filter(e => e.date >= args.dateFrom!);
    }

    return await Promise.all(
      filtered.slice(0, 20).map(async event => {
        const [coverImageUrl, tiers] = await Promise.all([
          event.coverImageStorageId
            ? ctx.storage.getUrl(event.coverImageStorageId)
            : Promise.resolve(null),
          ctx.db
            .query('ticketTiers')
            .withIndex('by_eventId', q => q.eq('eventId', event._id))
            .take(20),
        ]);

        const prices = tiers.map(t => t.price);
        const minPrice = prices.length > 0 ? Math.min(...prices) : null;
        const tierCurrency = tiers[0]?.currency ?? null;
        const totalAvailable = tiers.reduce(
          (sum, t) => sum + (t.quantity - t.quantitySold),
          0,
        );

        return {
          ...event,
          coverImageUrl,
          minPrice,
          tierCurrency,
          totalAvailable,
          tierCount: tiers.length,
        };
      }),
    );
  },
});

/**
 * Returns aggregated sales stats for an event. Accessible to the event owner
 * and any event staff member.
 */
export const getStats = query({
  args: {eventId: v.id('events')},
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
      const hasStaffAccess = !!staff && staff.isActive !== false;

      if (!hasStaffAccess && !(await hasPlatformPermission(ctx, userId, 'events:edit'))) {
        return null;
      }
    }

    const [tiers, tickets, payments] = await Promise.all([
      ctx.db
        .query('ticketTiers')
        .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
        .collect(),
      ctx.db
        .query('tickets')
        .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
        .take(1000),
      ctx.db
        .query('payments')
        .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
        .take(1000),
    ]);

    const ticketCounts = {
      pending_payment: 0,
      confirmed: 0,
      cancelled: 0,
      used: 0,
      expired: 0,
    } as Record<string, number>;
    for (const t of tickets) ticketCounts[t.status] = (ticketCounts[t.status] ?? 0) + 1;

    let totalRevenue = 0;
    let pendingRevenue = 0;
    const paymentCounts = {pending: 0, confirmed: 0, rejected: 0, refunded: 0} as Record<string, number>;
    for (const p of payments) {
      paymentCounts[p.status] = (paymentCounts[p.status] ?? 0) + 1;
      if (p.status === 'confirmed') totalRevenue += p.amount;
      if (p.status === 'pending') pendingRevenue += p.amount;
    }

    const currency = tiers[0]?.currency ?? null;

    return {
      currency,
      totalRevenue,
      pendingRevenue,
      ticketCounts,
      paymentCounts,
      tiers: tiers.map(t => ({
        _id: t._id,
        name: t.name,
        price: t.price,
        currency: t.currency,
        quantity: t.quantity,
        quantitySold: t.quantitySold,
        available: t.quantity - t.quantitySold,
      })),
    };
  },
});

// Admin-only: returns all events awaiting approval, enriched with owner info.
export const listPendingApproval = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    if (!user?.platformRoleId) return [];

    const role = await ctx.db.get(user.platformRoleId);
    const canApprove =
      role?.permissionSlugs.includes('*') ||
      role?.permissionSlugs.includes('events:approve');
    if (!canApprove) return [];

    const events = await ctx.db
      .query('events')
      .withIndex('by_status', q => q.eq('status', 'pending_approval'))
      .order('desc')
      .take(50);

    return await Promise.all(
      events.map(async event => {
        const owner = await ctx.db.get(event.ownerId);
        const tiers = await ctx.db
          .query('ticketTiers')
          .withIndex('by_eventId', q => q.eq('eventId', event._id))
          .collect();
        const totalTickets = tiers.reduce((s, t) => s + t.quantity, 0);
        const coverImageUrl = event.coverImageStorageId
          ? await ctx.storage.getUrl(event.coverImageStorageId)
          : null;
        const feeEvidenceUrl = event.platformFeeEvidenceStorageId
          ? await ctx.storage.getUrl(event.platformFeeEvidenceStorageId)
          : null;
        return {
          ...event,
          coverImageUrl,
          feeEvidenceUrl,
          ownerName: owner?.name ?? null,
          ownerEmail: owner?.email ?? null,
          tierCount: tiers.length,
          totalTickets,
        };
      }),
    );
  },
});
