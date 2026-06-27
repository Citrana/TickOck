import {convexAuth} from '@convex-dev/auth/server';
import {Password} from '@convex-dev/auth/providers/Password';
import {ConvexError, type Value} from 'convex/values';

export const {auth, signIn, signOut, store, isAuthenticated} = convexAuth({
  providers: [
    // Email + password auth. OAuth can be added here later without refactoring
    // anything else — just append to this array and add the provider's env vars.
    Password({
      // Extract email and name from sign-up params. Building `result` with an
      // explicit Record<string, Value> type prevents TypeScript from inferring
      // `name?: undefined` on the branch where name is absent — undefined is
      // not a valid Convex Value and would break the index-signature check.
      profile(params) {
        const result: Record<string, Value> & {email: string} = {
          email: (params.email as string).toLowerCase().trim(),
          status: 'active',
          createdAt: 0,
        };
        if (typeof params.name === 'string') result.name = params.name;
        return result;
      },
    }),
  ],

  callbacks: {
    // Called for both sign-up (createAccount) and sign-in flows.
    // When existingUserId is set the user already exists — just return their ID.
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId) {
        return args.existingUserId;
      }

      const profile = args.profile as {email: string; name?: string};
      const userId = await ctx.db.insert('users', {
        email: profile.email,
        name: profile.name,
        status: 'active',
        createdAt: Date.now(),
      });

      return userId;
    },

    // Runs right before a session document is created — throwing here aborts
    // the sign-in without creating a session.
    async beforeSessionCreation(ctx, {userId}) {
      const user = await ctx.db.get(userId);
      if (!user) throw new ConvexError('User not found');

      if (user.status === 'suspended') {
        throw new ConvexError({
          code: 'ACCOUNT_SUSPENDED',
          reason: user.statusReason ?? null,
        });
      }
      if (user.status === 'banned') {
        throw new ConvexError({
          code: 'ACCOUNT_BANNED',
          reason: user.statusReason ?? null,
        });
      }
    },
  },
});
