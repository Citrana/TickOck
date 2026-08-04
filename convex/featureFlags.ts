import {v} from 'convex/values';
import {mutation, query, QueryCtx} from './_generated/server';
import {getCallerUserId, requirePermission} from './_helpers/permissions';
import {FeatureFlagKey} from './_helpers/featureFlags';
import {writeAuditLog} from './_helpers/audit';

// Source of truth for which flags exist — extend this array (and the
// FeatureFlagKey union in _helpers/featureFlags.ts) when adding a new one.
export const FEATURE_FLAG_KEYS: FeatureFlagKey[] = ['venue_layout_design'];

// Any authenticated user may read flag state — ordinary organizers need
// this to know whether to show/hide gated UI, not just platform admins.
export const list = query({
  args: {},
  handler: async ctx => {
    await getCallerUserId(ctx as unknown as QueryCtx);

    const rows = await ctx.db.query('featureFlags').collect();
    const byKey = new Map(rows.map(r => [r.key, r]));

    return FEATURE_FLAG_KEYS.map(key => ({
      key,
      enabled: byKey.get(key)?.enabled ?? true,
    }));
  },
});

export const setFlag = mutation({
  args: {
    key: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const actorId = await requirePermission(ctx, 'platform:configure');

    if (!FEATURE_FLAG_KEYS.includes(args.key as FeatureFlagKey)) {
      throw new Error(`Unknown feature flag "${args.key}"`);
    }

    const existing = await ctx.db
      .query('featureFlags')
      .withIndex('by_key', q => q.eq('key', args.key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled: args.enabled,
        updatedBy: actorId,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('featureFlags', {
        key: args.key,
        enabled: args.enabled,
        updatedBy: actorId,
        updatedAt: Date.now(),
      });
    }

    await writeAuditLog(ctx, {
      actorId,
      action: 'platform:configure',
      targetType: 'featureFlags',
      targetId: existing?._id ?? args.key,
      metadata: {key: args.key, enabled: args.enabled},
    });
  },
});
