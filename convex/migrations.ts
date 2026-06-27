import {internalMutation} from './_generated/server';

/**
 * One-time migration: lowercase all emails in the `users` table and the
 * `authAccounts` table so that case-insensitive auth works for existing accounts.
 *
 * Run once via:  npx convex run migrations:normalizeEmails
 */
export const normalizeEmails = internalMutation({
  args: {},
  handler: async ctx => {
    // 1. Normalize users.email
    const users = await ctx.db.query('users').collect();
    let usersPatched = 0;
    for (const user of users) {
      const normalized = user.email.toLowerCase().trim();
      if (normalized !== user.email) {
        await ctx.db.patch(user._id, {email: normalized});
        usersPatched++;
      }
    }

    // 2. Normalize authAccounts.providerAccountId (and emailVerified) for the
    //    Password provider — that is where the email is used as the account key.
    const accounts = await ctx.db.query('authAccounts').collect();
    let accountsPatched = 0;
    for (const account of accounts) {
      if (account.provider !== 'password') continue;

      const normalizedId = account.providerAccountId.toLowerCase().trim();
      const normalizedVerified =
        account.emailVerified != null
          ? account.emailVerified.toLowerCase().trim()
          : undefined;

      const needsPatch =
        normalizedId !== account.providerAccountId ||
        (account.emailVerified != null &&
          normalizedVerified !== account.emailVerified);

      if (needsPatch) {
        await ctx.db.patch(account._id, {
          providerAccountId: normalizedId,
          ...(account.emailVerified != null
            ? {emailVerified: normalizedVerified}
            : {}),
        });
        accountsPatched++;
      }
    }

    return {usersPatched, accountsPatched};
  },
});

/**
 * One-time migration: activate all accounts that are still pending_verification.
 * Use while email verification is not yet operational.
 *
 * Run once via:  npx convex run migrations:activateAllUsers
 */
export const activateAllUsers = internalMutation({
  args: {},
  handler: async ctx => {
    const users = await ctx.db
      .query('users')
      .filter(q => q.eq(q.field('status'), 'pending_verification'))
      .collect();

    for (const user of users) {
      await ctx.db.patch(user._id, {status: 'active'});
    }

    return {activated: users.length};
  },
});
