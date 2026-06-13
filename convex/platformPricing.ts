import {v} from 'convex/values';
import {mutation, query} from './_generated/server';
import {requirePermission} from './_helpers/permissions';
import {writeAuditLog} from './_helpers/audit';

// Returns the single active platform pricing rule, or null if none is configured.
export const getActive = query({
  args: {},
  handler: async ctx => {
    return await ctx.db
      .query('platformPricing')
      .withIndex('by_isActive', q => q.eq('isActive', true))
      .first();
  },
});

// Platform admin sets or replaces the active pricing rule.
// Deactivates any existing active rule before inserting the new one.
export const upsert = mutation({
  args: {
    name: v.string(),
    pricePerTicket: v.number(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const actorId = await requirePermission(ctx, 'platform:configure');

    // Deactivate all existing active pricing rules
    const existing = await ctx.db
      .query('platformPricing')
      .withIndex('by_isActive', q => q.eq('isActive', true))
      .take(20);
    for (const row of existing) {
      await ctx.db.patch(row._id, {isActive: false});
    }

    const id = await ctx.db.insert('platformPricing', {
      name: args.name,
      pricePerTicket: args.pricePerTicket,
      currency: args.currency,
      isActive: true,
    });

    await writeAuditLog(ctx, {
      actorId,
      action: 'platform:configure',
      targetType: 'platformPricing',
      targetId: id,
      metadata: {
        pricePerTicket: args.pricePerTicket,
        currency: args.currency,
      },
    });

    return id;
  },
});
