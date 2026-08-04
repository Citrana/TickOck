// Platform-wide feature toggles. A flag with no row in `featureFlags` is
// treated as enabled, so adding a new key here never disables anything
// until an admin explicitly turns it off via featureFlags.setFlag.

import {QueryCtx} from '../_generated/server';

export type FeatureFlagKey = 'venue_layout_design';

export async function isFeatureEnabled(ctx: QueryCtx, key: FeatureFlagKey): Promise<boolean> {
  const flag = await ctx.db
    .query('featureFlags')
    .withIndex('by_key', q => q.eq('key', key))
    .unique();
  return flag?.enabled ?? true;
}

export async function requireFeatureEnabled(ctx: QueryCtx, key: FeatureFlagKey): Promise<void> {
  if (!(await isFeatureEnabled(ctx, key))) {
    throw new Error(`Feature "${key}" is currently disabled`);
  }
}
