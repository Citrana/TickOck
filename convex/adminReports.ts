import {v} from 'convex/values';
import {mutation, query} from './_generated/server';
import {getAuthUserId} from '@convex-dev/auth/server';
import {requirePermission} from './_helpers/permissions';
import {writeAuditLog} from './_helpers/audit';

// ---------------------------------------------------------------------------
// Events report
// ---------------------------------------------------------------------------

// Admin/super-admin: all events (up to 500), enriched with owner name + tier count.
// Filtering is client-side.
export const listAllEvents = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    if (!user?.platformRoleId) return [];

    const role = await ctx.db.get(user.platformRoleId);
    const canView =
      role?.permissionSlugs.includes('*') ||
      role?.permissionSlugs.includes('events:approve');
    if (!canView) return [];

    const events = await ctx.db.query('events').order('desc').take(500);

    return await Promise.all(
      events.map(async event => {
        const owner = await ctx.db.get(event.ownerId);
        const tiers = await ctx.db
          .query('ticketTiers')
          .withIndex('by_eventId', q => q.eq('eventId', event._id))
          .collect();

        return {
          _id: event._id,
          title: event.title,
          status: event.status,
          date: event.date,
          startTime: event.startTime,
          category: event.category ?? null,
          venue: event.venue,
          visibility: event.visibility,
          paymentMode: event.paymentMode,
          createdAt: event.createdAt,
          ownerName: owner?.name ?? owner?.email ?? null,
          tierCount: tiers.length,
        };
      }),
    );
  },
});

// ---------------------------------------------------------------------------
// Users report
// ---------------------------------------------------------------------------

// Admin/super-admin: all users (up to 1000), enriched with role name.
// Filtering is client-side.
export const listAllUsers = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    if (!user?.platformRoleId) return [];

    const role = await ctx.db.get(user.platformRoleId);
    const canView =
      role?.permissionSlugs.includes('*') || role?.permissionSlugs.includes('users:view');
    if (!canView) return [];

    const users = await ctx.db.query('users').order('desc').take(1000);

    return await Promise.all(
      users.map(async u => {
        const userRole = u.platformRoleId ? await ctx.db.get(u.platformRoleId) : null;
        return {
          _id: u._id,
          email: u.email,
          name: u.name ?? null,
          status: u.status,
          statusReason: u.statusReason ?? null,
          roleName: userRole?.name ?? null,
          createdAt: u.createdAt,
          isCurrentUser: u._id === userId,
        };
      }),
    );
  },
});

// Suspend or reactivate a user. Never deletes. Requires users:suspend permission.
export const setUserStatus = mutation({
  args: {
    userId: v.id('users'),
    status: v.union(v.literal('active'), v.literal('suspended')),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await requirePermission(ctx, 'users:suspend');

    if (actorId === args.userId) {
      throw new Error('Cannot change your own status');
    }

    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error('User not found');

    // Banned users require a different, more deliberate action
    if (target.status === 'banned') {
      throw new Error('Cannot change status of a banned user from this action');
    }

    await ctx.db.patch(args.userId, {
      status: args.status,
      statusReason: args.reason,
    });

    await writeAuditLog(ctx, {
      actorId,
      action: 'users:suspend',
      targetType: 'users',
      targetId: args.userId,
      metadata: {newStatus: args.status, reason: args.reason ?? null},
    });
  },
});
