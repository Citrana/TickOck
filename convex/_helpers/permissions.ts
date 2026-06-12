// Every Convex mutation MUST call requirePermission before any DB write.

import {Id} from '../_generated/dataModel';
import {MutationCtx} from '../_generated/server';

export type PermissionSlug =
  | 'tickets:create'
  | 'tickets:cancel'
  | 'tickets:read'
  | 'events:create'
  | 'events:edit'
  | 'events:delete'
  | 'payments:confirm'
  | 'admin:access';

export async function requirePermission(
  ctx: MutationCtx,
  userId: Id<'users'>,
  permission: PermissionSlug,
  eventId?: Id<'events'>,
): Promise<void> {
  // 1. Check platform-level role
  const platformRole = await ctx.db
    .query('roles')
    .withIndex('by_user', q => q.eq('userId', userId))
    .first();

  if (platformRole?.role === 'admin') return;

  // 2. Check event-scoped staff permissions
  if (eventId) {
    const staffEntry = await ctx.db
      .query('eventStaff')
      .withIndex('by_user', q => q.eq('userId', userId))
      .filter(q => q.eq(q.field('eventId'), eventId))
      .first();

    if (staffEntry?.permissions.includes(permission)) return;
  }

  throw new Error(`Forbidden: missing permission "${permission}"`);
}
