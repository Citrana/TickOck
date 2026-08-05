// Blocks structural edits (event details, tiers, staff, venue layout) once
// a live event's end time has passed. Payment confirm/reject and ticket
// check-in stay open — those aren't gated by this helper.

import {QueryCtx} from '../_generated/server';
import {Doc, Id} from '../_generated/dataModel';
import {hasEventEnded, EVENT_ENDED_EDIT_ERROR} from '../../lib/eventTiming';

export function requireEventNotEnded(event: Doc<'events'>): void {
  if (event.status === 'live' && hasEventEnded(event)) {
    throw new Error(EVENT_ENDED_EDIT_ERROR);
  }
}

// For mutations that only have a venueLayoutTemplates id (sections, tiers,
// seats, elements) — a no-op for templates not yet locked to a specific
// event (isSnapshot false, or a draft never attached).
export async function requireLayoutEventNotEnded(
  ctx: QueryCtx,
  layoutId: Id<'venueLayoutTemplates'>,
): Promise<void> {
  const template = await ctx.db.get(layoutId);
  if (!template?.snapshotEventId) return;

  const event = await ctx.db.get(template.snapshotEventId);
  if (event) requireEventNotEnded(event);
}
