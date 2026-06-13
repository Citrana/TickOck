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

    if (!staff) return null;
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
          userName: user?.name ?? null,
          userEmail: user?.email ?? '—',
          userStatus: user?.status ?? 'unknown',
        };
      }),
    );
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
    const target = await ctx.db
      .query('users')
      .withIndex('by_email', q => q.eq('email', args.email))
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
    if (existing) throw new Error('This user is already a staff member for this event');

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
 * Remove a staff member from an event. Only the event owner may call this.
 */
export const removeStaff = mutation({
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

    await ctx.db.delete(args.staffId);

    await writeAuditLog(ctx, {
      actorId: callerId,
      action: 'staff:manage',
      targetType: 'eventStaff',
      targetId: args.staffId,
      metadata: {removedUserId: member.userId, eventId: member.eventId},
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
