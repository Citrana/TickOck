import {v} from 'convex/values';
import {mutation, query, QueryCtx} from './_generated/server';
import {getAuthUserId} from '@convex-dev/auth/server';
import {getCallerUserId, requirePermission} from './_helpers/permissions';
import {writeAuditLog} from './_helpers/audit';

// ---------------------------------------------------------------------------
// Permission presets for event staff roles
// ---------------------------------------------------------------------------

export const STAFF_PRESETS = {
  co_organizer: [
    'tickets:read',
    'tickets:scan',
    'payments:view',
    'payments:confirm',
    'payments:reject',
  ],
  scanner: ['tickets:read', 'tickets:scan'],
  finance: [
    'tickets:read',
    'payments:view',
    'payments:confirm',
    'payments:reject',
  ],
} as const;

export type StaffPreset = keyof typeof STAFF_PRESETS;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Returns the current user's access level for an event (owner or staff).
 * Returns null if the user has no access.
 */
export const getMyAccess = query({
  args: {eventId: v.id('events')},
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const event = await ctx.db.get(args.eventId);
    if (!event) return null;

    if (event.ownerId === userId) {
      return {isOwner: true, permissionSlugs: ['*'] as string[]};
    }

    const staff = await ctx.db
      .query('eventStaff')
      .withIndex('by_eventId_and_userId', q =>
        q.eq('eventId', args.eventId).eq('userId', userId),
      )
      .unique();

    if (!staff || staff.isActive === false) return null;
    return {isOwner: false, permissionSlugs: staff.permissionSlugs};
  },
});

/**
 * Returns all staff members for an event, enriched with user details.
 * Only the event owner or a platform admin with staff:manage may call this.
 */
export const listByEvent = query({
  args: {eventId: v.id('events')},
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const event = await ctx.db.get(args.eventId);
    if (!event || event.ownerId !== userId) {
      // Allow platform users with staff:manage permission
      if (!userId) return [];
      const user = await ctx.db.get(userId);
      if (!user?.platformRoleId) return [];
      const role = await ctx.db.get(user.platformRoleId);
      const hasAccess =
        role?.permissionSlugs.includes('*') ||
        role?.permissionSlugs.includes('staff:manage');
      if (!hasAccess) return [];
    }

    const staff = await ctx.db
      .query('eventStaff')
      .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
      .collect();

    return await Promise.all(
      staff.map(async member => {
        const user = await ctx.db.get(member.userId);
        return {
          ...member,
          isActive: member.isActive ?? true,
          userName: user?.name ?? null,
          userEmail: user?.email ?? '—',
          userStatus: user?.status ?? 'unknown',
        };
      }),
    );
  },
});

/**
 * Returns all events where the current user has a staff role (any status).
 * Includes inactive assignments so the user can see their full history.
 */
export const getMyStaffEvents = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const staffRecords = await ctx.db
      .query('eventStaff')
      .withIndex('by_userId', q => q.eq('userId', userId))
      .collect();

    const results = await Promise.all(
      staffRecords.map(async (record) => {
        const event = await ctx.db.get(record.eventId);
        if (!event) return null;
        return {
          staffId: record._id,
          isActive: record.isActive ?? true,
          permissionSlugs: record.permissionSlugs,
          eventId: event._id,
          title: event.title,
          date: event.date,
          status: event.status,
          venue: event.venue,
          coverImageUrl: event.coverImageStorageId
            ? await ctx.storage.getUrl(event.coverImageStorageId)
            : null,
        };
      }),
    );

    return results
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.date - a.date);
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Add a user as event staff by email address. Only the event owner may call
 * this. The target user must already have an account.
 */
export const addStaff = mutation({
  args: {
    eventId: v.id('events'),
    email: v.string(),
    permissionSlugs: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const callerId = await getCallerUserId(ctx as unknown as QueryCtx);

    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error('Event not found');
    if (event.ownerId !== callerId) {
      await requirePermission(ctx, 'staff:manage');
    }

    // Look up the target user by email
    const normEmail = args.email.toLowerCase().trim();
    const target = await ctx.db
      .query('users')
      .withIndex('by_email', q => q.eq('email', normEmail))
      .unique();
    if (!target) throw new Error('No user found with that email address');
    if (target._id === event.ownerId) {
      throw new Error('The event owner cannot be added as staff');
    }
    if (target.status === 'banned' || target.status === 'suspended') {
      throw new Error('This user account is not active');
    }

    // Prevent duplicates
    const existing = await ctx.db
      .query('eventStaff')
      .withIndex('by_eventId_and_userId', q =>
        q.eq('eventId', args.eventId).eq('userId', target._id),
      )
      .unique();
    if (existing) {
      if (existing.isActive === false) {
        throw new Error('This user is a deactivated staff member. Reactivate them from the team list.');
      }
      throw new Error('This user is already a staff member for this event');
    }

    // Validate permission slugs (only allow event-scoped slugs)
    const allowed = new Set([
      'tickets:read',
      'tickets:scan',
      'payments:view',
      'payments:confirm',
      'payments:reject',
    ]);
    for (const slug of args.permissionSlugs) {
      if (!allowed.has(slug)) {
        throw new Error(`Invalid permission: ${slug}`);
      }
    }

    await ctx.db.insert('eventStaff', {
      eventId: args.eventId,
      userId: target._id,
      permissionSlugs: args.permissionSlugs,
    });

    await writeAuditLog(ctx, {
      actorId: callerId,
      action: 'staff:manage',
      targetType: 'eventStaff',
      targetId: args.eventId,
      metadata: {addedUserId: target._id, email: args.email},
    });
  },
});

/**
 * Deactivate a staff member — preserves the record for audit history but
 * immediately revokes all event-scoped access. Only the event owner may call
 * this. Staff records are never hard-deleted.
 */
export const deactivateStaff = mutation({
  args: {staffId: v.id('eventStaff')},
  handler: async (ctx, args) => {
    const callerId = await getCallerUserId(ctx as unknown as QueryCtx);

    const member = await ctx.db.get(args.staffId);
    if (!member) throw new Error('Staff member not found');

    const event = await ctx.db.get(member.eventId);
    if (!event) throw new Error('Event not found');
    if (event.ownerId !== callerId) {
      await requirePermission(ctx, 'staff:manage');
    }

    if (member.isActive === false) throw new Error('Staff member is already deactivated');

    await ctx.db.patch(args.staffId, {isActive: false});

    await writeAuditLog(ctx, {
      actorId: callerId,
      action: 'staff:deactivate',
      targetType: 'eventStaff',
      targetId: args.staffId,
      metadata: {deactivatedUserId: member.userId, eventId: member.eventId},
    });
  },
});

/**
 * Reactivate a previously deactivated staff member. Restores their existing
 * permissions without needing to re-add them.
 */
export const reactivateStaff = mutation({
  args: {staffId: v.id('eventStaff')},
  handler: async (ctx, args) => {
    const callerId = await getCallerUserId(ctx as unknown as QueryCtx);

    const member = await ctx.db.get(args.staffId);
    if (!member) throw new Error('Staff member not found');

    const event = await ctx.db.get(member.eventId);
    if (!event) throw new Error('Event not found');
    if (event.ownerId !== callerId) {
      await requirePermission(ctx, 'staff:manage');
    }

    if (member.isActive !== false) throw new Error('Staff member is already active');

    await ctx.db.patch(args.staffId, {isActive: true});

    await writeAuditLog(ctx, {
      actorId: callerId,
      action: 'staff:reactivate',
      targetType: 'eventStaff',
      targetId: args.staffId,
      metadata: {reactivatedUserId: member.userId, eventId: member.eventId},
    });
  },
});

/**
 * Update a staff member's permissions. Only the event owner may call this.
 */
export const updatePermissions = mutation({
  args: {
    staffId: v.id('eventStaff'),
    permissionSlugs: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const callerId = await getCallerUserId(ctx as unknown as QueryCtx);

    const member = await ctx.db.get(args.staffId);
    if (!member) throw new Error('Staff member not found');

    const event = await ctx.db.get(member.eventId);
    if (!event) throw new Error('Event not found');
    if (event.ownerId !== callerId) {
      await requirePermission(ctx, 'staff:manage');
    }

    const allowed = new Set([
      'tickets:read',
      'tickets:scan',
      'payments:view',
      'payments:confirm',
      'payments:reject',
    ]);
    for (const slug of args.permissionSlugs) {
      if (!allowed.has(slug)) {
        throw new Error(`Invalid permission: ${slug}`);
      }
    }

    await ctx.db.patch(args.staffId, {permissionSlugs: args.permissionSlugs});

    await writeAuditLog(ctx, {
      actorId: callerId,
      action: 'staff:manage',
      targetType: 'eventStaff',
      targetId: args.staffId,
      metadata: {userId: member.userId, permissions: args.permissionSlugs.join(',')},
    });
  },
});
