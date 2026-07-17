/// <reference types="vite/client" />
import {convexTest} from 'convex-test';
import {expect, test} from 'vitest';
import {api} from '../_generated/api';
import schema from '../schema';
import {seedUser} from './helpers';

const modules = import.meta.glob('../**/*.ts');

/**
 * Covers: events.create happy path — creating an event with a tier and speaker.
 * Business logic:
 * - Self-service: any active, non-suspended/banned user may create an
 *   event and becomes its owner — `events:create` is a declared
 *   permission slug but is never actually enforced here.
 * - A new event always starts as status 'draft', regardless of input.
 * - Generates a fresh per-event HMAC secret (never a global one), later
 *   used to sign that event's ticket QR codes.
 * - Ticket tiers and speakers are nested args reconciled in the same
 *   call, not separate mutations; on create there are no existing tiers
 *   to reconcile against, so submitted tiers are simply inserted.
 * - platformFeeTotal/Currency are computed client-side and persisted
 *   as-is — this mutation does not recompute or validate them.
 */
test('create inserts a draft event with its owner, tier, and speaker', async () => {
  const t = convexTest(schema, modules);

  const userId = await t.run(ctx => seedUser(ctx));

  const asOwner = t.withIdentity({subject: userId});
  const eventId = await asOwner.mutation(api.events.create, {
    title: 'Test Conference',
    venue: {name: 'Main Hall', address: '1 Main St', city: 'Montreal'},
    date: Date.now() + 1000 * 60 * 60 * 24,
    startTime: '18:00',
    timezone: 'America/Toronto',
    visibility: 'public',
    paymentMode: 'manual',
    cancellationPolicy: {allowed: false},
    tiers: [{name: 'General Admission', price: 50, currency: 'USD', quantity: 10}],
    speakers: [{name: 'Jane Doe', displayOrder: 0}],
  });

  expect(eventId).toBeDefined();

  await t.run(async ctx => {
    const event = await ctx.db.get(eventId);
    expect(event?.status).toBe('draft');
    expect(event?.ownerId).toBe(userId);
    expect(event?.title).toBe('Test Conference');
    expect(event?.hmacSecret).toEqual(expect.any(String));
    expect(event?.hmacSecret.length).toBeGreaterThan(0);

    const tiers = await ctx.db
      .query('ticketTiers')
      .withIndex('by_eventId', q => q.eq('eventId', eventId))
      .collect();
    expect(tiers).toHaveLength(1);
    expect(tiers[0].name).toBe('General Admission');
    expect(tiers[0].price).toBe(50);
    expect(tiers[0].quantitySold).toBe(0);

    const speakers = await ctx.db
      .query('eventSpeakers')
      .withIndex('by_eventId', q => q.eq('eventId', eventId))
      .collect();
    expect(speakers).toHaveLength(1);
    expect(speakers[0].name).toBe('Jane Doe');
  });
});
