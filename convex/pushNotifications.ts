import {v} from 'convex/values';
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
} from './_generated/server';
import {getAuthUserId} from '@convex-dev/auth/server';
import {internal} from './_generated/api';
import {Id} from './_generated/dataModel';

// ---------------------------------------------------------------------------
// Public mutations — called from the client component
// ---------------------------------------------------------------------------

export const saveSubscription = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', q => q.eq('endpoint', args.endpoint))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        userId,
        p256dh: args.p256dh,
        auth: args.auth,
        ...(args.userAgent ? {userAgent: args.userAgent} : {}),
      });
    } else {
      await ctx.db.insert('pushSubscriptions', {
        userId,
        endpoint: args.endpoint,
        p256dh: args.p256dh,
        auth: args.auth,
        ...(args.userAgent ? {userAgent: args.userAgent} : {}),
        createdAt: Date.now(),
      });
    }
  },
});

export const deleteSubscription = mutation({
  args: {endpoint: v.string()},
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const sub = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', q => q.eq('endpoint', args.endpoint))
      .unique();

    if (sub && sub.userId === userId) {
      await ctx.db.delete(sub._id);
    }
  },
});

// ---------------------------------------------------------------------------
// Internal queries
// ---------------------------------------------------------------------------

export const getUserSubscriptions = internalQuery({
  args: {userId: v.id('users')},
  handler: async (ctx, args) => {
    return await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_userId', q => q.eq('userId', args.userId))
      .collect();
  },
});

export const getUpcomingEvents = internalQuery({
  args: {windowStart: v.number(), windowEnd: v.number()},
  handler: async (ctx, args) => {
    return await ctx.db
      .query('events')
      .withIndex('by_date', q => q.gte('date', args.windowStart))
      .filter(q =>
        q.and(
          q.lte(q.field('date'), args.windowEnd),
          q.eq(q.field('status'), 'live'),
        ),
      )
      .collect();
  },
});

export const getConfirmedTicketUsers = internalQuery({
  args: {eventId: v.id('events')},
  handler: async (ctx, args) => {
    const tickets = await ctx.db
      .query('tickets')
      .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
      .filter(q => q.eq(q.field('status'), 'confirmed'))
      .collect();

    const seen = new Set<string>();
    return tickets
      .filter(t => {
        if (seen.has(t.userId)) return false;
        seen.add(t.userId);
        return true;
      })
      .map(t => ({userId: t.userId as Id<'users'>}));
  },
});

// ---------------------------------------------------------------------------
// Internal mutation — removes a stale subscription (410 from push service)
// ---------------------------------------------------------------------------

export const removeSubscription = internalMutation({
  args: {endpoint: v.string()},
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', q => q.eq('endpoint', args.endpoint))
      .unique();
    if (sub) await ctx.db.delete(sub._id);
  },
});

// ---------------------------------------------------------------------------
// Internal action — delivers a push to all devices of one user
// Requires NEXT_APP_URL and PUSH_INTERNAL_SECRET Convex env vars
// ---------------------------------------------------------------------------

export const deliver = internalAction({
  args: {
    userId: v.id('users'),
    title: v.string(),
    body: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const subscriptions: Awaited<ReturnType<typeof ctx.runQuery<typeof internal.pushNotifications.getUserSubscriptions>>> =
      await ctx.runQuery(internal.pushNotifications.getUserSubscriptions, {
        userId: args.userId,
      });

    const appUrl = process.env.NEXT_APP_URL ?? 'http://localhost:3000';
    const secret = process.env.PUSH_INTERNAL_SECRET ?? '';

    for (const sub of subscriptions) {
      let status: number;
      try {
        const res = await fetch(`${appUrl}/api/push/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-push-secret': secret,
          },
          body: JSON.stringify({
            subscription: {
              endpoint: sub.endpoint,
              keys: {p256dh: sub.p256dh, auth: sub.auth},
            },
            title: args.title,
            body: args.body,
            url: args.url,
          }),
        });
        status = res.status;
      } catch {
        continue;
      }

      if (status === 410) {
        await ctx.runMutation(internal.pushNotifications.removeSubscription, {
          endpoint: sub.endpoint,
        });
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Internal action — 24h event reminders, triggered by cron
// ---------------------------------------------------------------------------

export const sendEventReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const windowStart = now + 23 * 3_600_000;
    const windowEnd = now + 25 * 3_600_000;

    const appUrl = process.env.NEXT_APP_URL ?? 'http://localhost:3000';
    const secret = process.env.PUSH_INTERNAL_SECRET ?? '';

    const events: Awaited<ReturnType<typeof ctx.runQuery<typeof internal.pushNotifications.getUpcomingEvents>>> =
      await ctx.runQuery(internal.pushNotifications.getUpcomingEvents, {
        windowStart,
        windowEnd,
      });

    for (const event of events) {
      const users: Awaited<ReturnType<typeof ctx.runQuery<typeof internal.pushNotifications.getConfirmedTicketUsers>>> =
        await ctx.runQuery(internal.pushNotifications.getConfirmedTicketUsers, {
          eventId: event._id,
        });

      for (const {userId} of users) {
        const subscriptions: Awaited<ReturnType<typeof ctx.runQuery<typeof internal.pushNotifications.getUserSubscriptions>>> =
          await ctx.runQuery(internal.pushNotifications.getUserSubscriptions, {
            userId,
          });

        for (const sub of subscriptions) {
          let status: number;
          try {
            const res = await fetch(`${appUrl}/api/push/send`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-push-secret': secret,
              },
              body: JSON.stringify({
                subscription: {
                  endpoint: sub.endpoint,
                  keys: {p256dh: sub.p256dh, auth: sub.auth},
                },
                title: 'Event tomorrow',
                body: `${event.title} is happening tomorrow!`,
                url: `/en/events/${event._id}`,
              }),
            });
            status = res.status;
          } catch {
            continue;
          }

          if (status === 410) {
            await ctx.runMutation(internal.pushNotifications.removeSubscription, {
              endpoint: sub.endpoint,
            });
          }
        }
      }
    }
  },
});
