import {query} from './_generated/server';
import {getAuthUserId} from '@convex-dev/auth/server';

// Super-admin / admin only: returns all events (up to 500) enriched with
// owner name and tier count. Filtering is done client-side.
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
