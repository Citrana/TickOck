import {v} from 'convex/values';
import {mutation, query} from './_generated/server';
import {requirePermission} from './_helpers/permissions';
import {writeAuditLog} from './_helpers/audit';

const categoryValidator = v.union(v.literal('platform'), v.literal('venue_layout'));

// Returns all active rules for one fee category, sorted by priority
// (displayOrder ascending). Rows created before feeCategory existed have no
// value stored — treat that as 'platform' so old data keeps working.
export const listActive = query({
  args: {category: categoryValidator},
  handler: async (ctx, args) => {
    const rules = await ctx.db
      .query('platformPricingRules')
      .withIndex('by_isActive', q => q.eq('isActive', true))
      .collect();
    return rules
      .filter(r => (r.feeCategory ?? 'platform') === args.category)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  },
});

// Returns all rules (active + inactive) for one fee category, for admin UI.
export const listAll = query({
  args: {category: categoryValidator},
  handler: async (ctx, args) => {
    const rules = await ctx.db.query('platformPricingRules').collect();
    return rules
      .filter(r => (r.feeCategory ?? 'platform') === args.category)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  },
});

// Creates a new pricing rule within one fee category. displayOrder is
// computed per-category so "first match wins" ordering for one category is
// never affected by rules that belong to the other.
export const createRule = mutation({
  args: {
    category: categoryValidator,
    label: v.string(),
    ticketPriceMin: v.optional(v.number()),
    ticketPriceMax: v.optional(v.number()),
    totalTicketsMin: v.optional(v.number()),
    totalTicketsMax: v.optional(v.number()),
    feeType: v.union(v.literal('percentage'), v.literal('flat_per_ticket')),
    feeValue: v.number(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const actorId = await requirePermission(ctx, 'platform:configure');
    const {category, ...ruleFields} = args;

    const existing = await ctx.db.query('platformPricingRules').collect();
    const maxOrder = existing
      .filter(r => (r.feeCategory ?? 'platform') === category)
      .reduce((m, r) => Math.max(m, r.displayOrder), -1);

    const id = await ctx.db.insert('platformPricingRules', {
      ...ruleFields,
      feeCategory: category,
      isActive: true,
      displayOrder: maxOrder + 1,
    });

    await writeAuditLog(ctx, {
      actorId,
      action: 'platform:configure',
      targetType: 'platformPricingRules',
      targetId: id,
      metadata: {op: 'create', label: args.label, category},
    });

    return id;
  },
});

// Toggles a rule active/inactive.
export const toggleRule = mutation({
  args: {
    ruleId: v.id('platformPricingRules'),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const actorId = await requirePermission(ctx, 'platform:configure');

    const rule = await ctx.db.get(args.ruleId);
    if (!rule) throw new Error('Rule not found');

    await ctx.db.patch(args.ruleId, {isActive: args.isActive});

    await writeAuditLog(ctx, {
      actorId,
      action: 'platform:configure',
      targetType: 'platformPricingRules',
      targetId: args.ruleId,
      metadata: {op: 'toggle', isActive: args.isActive},
    });
  },
});

// Permanently removes a rule.
export const removeRule = mutation({
  args: {
    ruleId: v.id('platformPricingRules'),
  },
  handler: async (ctx, args) => {
    const actorId = await requirePermission(ctx, 'platform:configure');

    const rule = await ctx.db.get(args.ruleId);
    if (!rule) throw new Error('Rule not found');

    await ctx.db.delete(args.ruleId);

    await writeAuditLog(ctx, {
      actorId,
      action: 'platform:configure',
      targetType: 'platformPricingRules',
      targetId: args.ruleId,
      metadata: {op: 'delete', label: rule.label},
    });
  },
});
