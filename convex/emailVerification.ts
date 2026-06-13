import {v} from 'convex/values';
import {internalAction, internalMutation, internalQuery, mutation} from './_generated/server';
import {internal} from './_generated/api';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export const storeVerificationToken = internalMutation({
  args: {
    userId: v.id('users'),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, {userId, token, expiresAt}) => {
    // Replace any existing token for this user (one active token at a time).
    const existing = await ctx.db
      .query('emailVerifications')
      .withIndex('by_userId', q => q.eq('userId', userId))
      .first();
    if (existing) await ctx.db.delete(existing._id);

    await ctx.db.insert('emailVerifications', {userId, token, expiresAt});
  },
});

export const getUserEmail = internalQuery({
  args: {userId: v.id('users')},
  handler: async (ctx, {userId}) => {
    const user = await ctx.db.get(userId);
    return user ? {email: user.email} : null;
  },
});

// ---------------------------------------------------------------------------
// Send verification email (action — uses fetch for Resend; no Node built-ins)
// ---------------------------------------------------------------------------

export const sendVerificationEmail = internalAction({
  args: {userId: v.id('users')},
  handler: async (ctx, {userId}) => {
    // Web Crypto API is available in the Convex V8 runtime.
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    await ctx.runMutation(internal.emailVerification.storeVerificationToken, {
      userId,
      token,
      expiresAt,
    });

    const record = await ctx.runQuery(internal.emailVerification.getUserEmail, {
      userId,
    });
    if (!record) return;

    const siteUrl = process.env.SITE_URL ?? 'http://localhost:3000';
    // next-intl middleware adds the locale prefix on redirect automatically.
    const verificationUrl = `${siteUrl}/verify-email?token=${token}`;

    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.AUTH_EMAIL_FROM ?? 'TickOck <noreply@tickock.com>',
          to: record.email,
          subject: 'Verify your TickOck email address',
          html: `
            <p>Thanks for signing up for TickOck.</p>
            <p><a href="${verificationUrl}">Click here to verify your email address</a></p>
            <p>This link expires in 24 hours. If you did not create an account, you can ignore this email.</p>
          `,
        }),
      });
    } else {
      // Development fallback — log the URL so developers can test without Resend.
      // Set RESEND_API_KEY in production to enable real emails.
      console.log(
        `[EmailVerification] Verification URL for ${record.email}: ${verificationUrl}`,
      );
    }
  },
});

// ---------------------------------------------------------------------------
// Public mutation — called from the /verify-email Next.js page
// ---------------------------------------------------------------------------

export const verify = mutation({
  args: {token: v.string()},
  handler: async (ctx, {token}) => {
    const record = await ctx.db
      .query('emailVerifications')
      .withIndex('by_token', q => q.eq('token', token))
      .unique();

    if (!record) {
      return {success: false, error: 'invalid_token'} as const;
    }
    if (record.expiresAt < Date.now()) {
      await ctx.db.delete(record._id);
      return {success: false, error: 'token_expired'} as const;
    }

    await ctx.db.delete(record._id);
    await ctx.db.patch(record.userId, {status: 'active'});

    return {success: true} as const;
  },
});
