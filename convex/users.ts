import {v} from 'convex/values';
import {internalQuery, query} from './_generated/server';
import {getAuthUserId} from '@convex-dev/auth/server';

// ---------------------------------------------------------------------------
// Internal queries
// ---------------------------------------------------------------------------

export const getUserById = internalQuery({
  args: {userId: v.id('users')},
  handler: async (ctx, {userId}) => {
    return ctx.db.get(userId);
  },
});

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

/**
 * Returns the authenticated user joined with their platform role.
 * This is the data source for useCurrentUser() — the single source of truth
 * for auth state on the client.
 */
export const getCurrentUser = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const role = user.platformRoleId
      ? await ctx.db.get(user.platformRoleId)
      : null;

    return {...user, role};
  },
});
