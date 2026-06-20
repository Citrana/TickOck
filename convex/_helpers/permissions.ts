// Every Convex mutation MUST call requirePermission before any DB write.
// Identity is derived server-side via getAuthUserId — never accept a userId arg.

import {getAuthUserId} from '@convex-dev/auth/server';
import {Id} from '../_generated/dataModel';
import {MutationCtx, QueryCtx} from '../_generated/server';

export type PermissionSlug =
  | 'events:create'
  | 'events:edit'
  | 'events:delete'
  | 'events:view'
  | 'events:approve'
  | 'tickets:create'
  | 'tickets:cancel'
  | 'tickets:read'
  | 'tickets:scan'
  | 'payments:confirm'
  | 'payments:reject'
  | 'payments:refund'
  | 'payments:view'
  | 'users:suspend'
  | 'users:ban'
  | 'users:view'
  | 'users:edit'
  | 'roles:create'
  | 'roles:assign'
  | 'roles:view'
  | 'staff:manage'
  | 'platform:configure'
  | 'auditlogs:view';

function slugMatches(granted: string[], required: PermissionSlug): boolean {
  return granted.includes('*') || granted.includes(required);
}

async function resolveCallerUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error('Unauthenticated');

  const user = await ctx.db.get(userId);
  if (!user) throw new Error('User not found');

  if (user.status === 'suspended' || user.status === 'banned') {
    throw new Error(`Account is ${user.status}`);
  }

  return user;
}

/**
 * Assert the authenticated caller has the given platform or event-scoped
 * permission. Throws if not. Returns the caller's userId for convenience so
 * mutations can pass it directly to writeAuditLog without a second lookup.
 *
 * Call from mutations:  const actorId = await requirePermission(ctx, 'events:edit');
 * Call with event scope: const actorId = await requirePermission(ctx, 'tickets:scan', eventId);
 */
export async function requirePermission(
  ctx: MutationCtx,
  permission: PermissionSlug,
  eventId?: Id<'events'>,
): Promise<Id<'users'>> {
  const user = await resolveCallerUser(ctx as unknown as QueryCtx);

  if (user.platformRoleId) {
    const role = await ctx.db.get(user.platformRoleId);
    if (role && slugMatches(role.permissionSlugs, permission)) {
      return user._id;
    }
  }

  if (eventId) {
    const event = await ctx.db.get(eventId);
    if (event && event.ownerId === user._id) {
      return user._id;
    }

    const staff = await ctx.db
      .query('eventStaff')
      .withIndex('by_eventId_and_userId', q =>
        q.eq('eventId', eventId).eq('userId', user._id),
      )
      .unique();

    if (staff && staff.isActive !== false && slugMatches(staff.permissionSlugs, permission)) {
      return user._id;
    }
  }

  throw new Error(`Forbidden: missing permission "${permission}"`);
}

/**
 * Read-only version for queries — checks the caller has the permission
 * without needing write access. Returns the caller's userId.
 */
export async function assertPermission(
  ctx: QueryCtx,
  permission: PermissionSlug,
  eventId?: Id<'events'>,
): Promise<Id<'users'>> {
  const user = await resolveCallerUser(ctx);

  if (user.platformRoleId) {
    const role = await ctx.db.get(user.platformRoleId);
    if (role && slugMatches(role.permissionSlugs, permission)) {
      return user._id;
    }
  }

  if (eventId) {
    const event = await ctx.db.get(eventId);
    if (event && event.ownerId === user._id) {
      return user._id;
    }

    const staff = await ctx.db
      .query('eventStaff')
      .withIndex('by_eventId_and_userId', q =>
        q.eq('eventId', eventId).eq('userId', user._id),
      )
      .unique();

    if (staff && staff.isActive !== false && slugMatches(staff.permissionSlugs, permission)) {
      return user._id;
    }
  }

  throw new Error(`Forbidden: missing permission "${permission}"`);
}

/**
 * Resolve the caller to a userId without any permission check.
 * Use this when you only need authentication (not authorization).
 */
export async function getCallerUserId(ctx: QueryCtx): Promise<Id<'users'>> {
  const user = await resolveCallerUser(ctx);
  return user._id;
}
