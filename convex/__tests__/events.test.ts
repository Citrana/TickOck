/// <reference types="vite/client" />
import {convexTest} from 'convex-test';
import {expect, test} from 'vitest';
import {api} from '../_generated/api';
import schema from '../schema';
import {Id} from '../_generated/dataModel';
import {seedUser, seedEvent, seedTier, seedTicket, seedSpeaker, seedRole} from './helpers';

const modules = import.meta.glob('../**/*.ts');

// update() requires the full eventWriteArgs payload every call (no partial
// updates) — this builds a valid base so each test only overrides what it's
// actually exercising.
function baseUpdateArgs(eventId: Id<'events'>) {
  return {
    eventId,
    title: 'Test Conference',
    venue: {name: 'Main Hall', address: '1 Main St', city: 'Montreal'},
    date: Date.now() + 1000 * 60 * 60 * 24,
    startTime: '18:00',
    timezone: 'America/Toronto',
    visibility: 'public' as const,
    paymentMode: 'manual' as const,
    cancellationPolicy: {allowed: false},
    tiers: [],
    speakers: [],
  };
}

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

/**
 * Covers: events.update happy path — owner edits basic fields.
 * Business logic:
 * - Only the event owner may update (a direct `event.ownerId !==
 *   callerId` comparison, not `requirePermission`).
 * - update patches nearly every event field but never touches
 *   `status` — status transitions only happen through
 *   submitForApproval/approve/reject.
 */
test('update patches event fields as the owner, leaving status untouched', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, eventId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'update-owner@example.com'});
    const eventId = await seedEvent(ctx, ownerId, {
      title: 'Old Title',
      description: 'Old description',
    });
    return {ownerId, eventId};
  });

  const asOwner = t.withIdentity({subject: ownerId});
  await asOwner.mutation(api.events.update, {
    ...baseUpdateArgs(eventId),
    title: 'New Title',
    description: 'New description',
  });

  await t.run(async ctx => {
    const event = await ctx.db.get(eventId);
    expect(event?.title).toBe('New Title');
    expect(event?.description).toBe('New description');
    expect(event?.status).toBe('live');
  });
});

/**
 * Covers: events.update rejects a caller who isn't the event owner and
 * holds no events:edit access.
 * Business logic:
 * - `update` goes through `requirePermission(ctx, 'events:edit',
 *   eventId)`, which allows the owner, a platform role with `events:edit`
 *   (or `*`) — used by admins assisting an organizer — or event staff
 *   granted `events:edit`. A caller with none of those is rejected with
 *   requirePermission's generic "missing permission" error, not an
 *   ownership-specific message.
 */
test('update rejects a caller who is not the event owner', async () => {
  const t = convexTest(schema, modules);

  const {strangerId, eventId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'not-owner-owner@example.com'});
    const strangerId = await seedUser(ctx, {email: 'not-owner-stranger@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    return {strangerId, eventId};
  });

  const asStranger = t.withIdentity({subject: strangerId});
  await expect(
    asStranger.mutation(api.events.update, baseUpdateArgs(eventId)),
  ).rejects.toThrow('Forbidden: missing permission "events:edit"');
});

/**
 * Covers: events.update allows a platform admin who isn't the event owner.
 * Business logic:
 * - A caller with a platform role granting `events:edit` (or `*`) may
 *   update any event, not just their own — this is how a platform admin
 *   assists an organizer who is stuck, mirroring the same bypass already
 *   in place for venue layouts (`venues:edit`).
 */
test('update allows a platform admin who is not the event owner', async () => {
  const t = convexTest(schema, modules);

  const {adminId, eventId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'admin-bypass-owner@example.com'});
    const roleId = await seedRole(ctx, {name: 'admin', permissionSlugs: ['events:edit']});
    const adminId = await seedUser(ctx, {
      email: 'admin-bypass-admin@example.com',
      platformRoleId: roleId,
    });
    const eventId = await seedEvent(ctx, ownerId);
    return {adminId, eventId};
  });

  const asAdmin = t.withIdentity({subject: adminId});
  await asAdmin.mutation(api.events.update, {
    ...baseUpdateArgs(eventId),
    title: 'Admin-Edited Title',
  });

  await t.run(async ctx => {
    const event = await ctx.db.get(eventId);
    expect(event?.title).toBe('Admin-Edited Title');
  });
});

/**
 * Covers: events.update adds a new ticket tier.
 * Business logic:
 * - reconcileTiers inserts any submitted tier that has no
 *   `existingId`, exactly like on create.
 */
test('update adds a new ticket tier', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, eventId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'add-tier-owner@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    return {ownerId, eventId};
  });

  const asOwner = t.withIdentity({subject: ownerId});
  await asOwner.mutation(api.events.update, {
    ...baseUpdateArgs(eventId),
    tiers: [{name: 'VIP', price: 100, currency: 'USD', quantity: 5}],
  });

  await t.run(async ctx => {
    const tiers = await ctx.db
      .query('ticketTiers')
      .withIndex('by_eventId', q => q.eq('eventId', eventId))
      .collect();
    expect(tiers).toHaveLength(1);
    expect(tiers[0].name).toBe('VIP');
    expect(tiers[0].price).toBe(100);
    expect(tiers[0].quantitySold).toBe(0);
  });
});

/**
 * Covers: events.update rejects changing the price of a tier that has
 * already sold tickets.
 * Business logic:
 * - reconcileTiers compares the submitted price against the tier's
 *   current price only when `existingId` is set; if they differ AND a
 *   ticket already exists for that tier (`by_tierId` index), it
 *   throws before patching anything.
 */
test('update rejects changing the price of a tier with sold tickets', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, eventId, tierId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'price-lock-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'price-lock-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId, {price: 50});
    await seedTicket(ctx, eventId, tierId, buyerId);
    return {ownerId, eventId, tierId};
  });

  const asOwner = t.withIdentity({subject: ownerId});
  await expect(
    asOwner.mutation(api.events.update, {
      ...baseUpdateArgs(eventId),
      tiers: [
        {existingId: tierId, name: 'General Admission', price: 75, currency: 'USD', quantity: 10},
      ],
    }),
  ).rejects.toThrow('Cannot change the price of tier');

  await t.run(async ctx => {
    const tier = await ctx.db.get(tierId);
    expect(tier?.price).toBe(50);
  });
});

/**
 * Covers: events.update allows changing a sold tier's quantity, since
 * only price and removal are locked once tickets are sold.
 * Business logic:
 * - reconcileTiers only guards price changes and removals against
 *   sold tickets — quantity is always patchable regardless of sales.
 */
test('update allows changing a sold tier quantity without touching its price', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, eventId, tierId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'qty-change-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'qty-change-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId, {price: 50, quantity: 10});
    await seedTicket(ctx, eventId, tierId, buyerId);
    return {ownerId, eventId, tierId};
  });

  const asOwner = t.withIdentity({subject: ownerId});
  await asOwner.mutation(api.events.update, {
    ...baseUpdateArgs(eventId),
    tiers: [
      {existingId: tierId, name: 'General Admission', price: 50, currency: 'USD', quantity: 20},
    ],
  });

  await t.run(async ctx => {
    const tier = await ctx.db.get(tierId);
    expect(tier?.quantity).toBe(20);
    expect(tier?.price).toBe(50);
  });
});

/**
 * Covers: events.update rejects removing a tier that has sold tickets.
 * Business logic:
 * - reconcileTiers deletes any existing tier omitted from the
 *   submitted array — unless a ticket has already been sold against
 *   it, in which case it throws before deleting anything.
 */
test('update rejects removing a tier with sold tickets', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, eventId, tierId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'removal-lock-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'removal-lock-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId);
    await seedTicket(ctx, eventId, tierId, buyerId);
    return {ownerId, eventId, tierId};
  });

  const asOwner = t.withIdentity({subject: ownerId});
  await expect(
    asOwner.mutation(api.events.update, {...baseUpdateArgs(eventId), tiers: []}),
  ).rejects.toThrow('Cannot remove tier');

  await t.run(async ctx => {
    const tier = await ctx.db.get(tierId);
    expect(tier).not.toBeNull();
  });
});

/**
 * Covers: events.update removes a tier with no sales when it's
 * omitted from the submitted array.
 * Business logic:
 * - With no tickets sold against it, an omitted tier is deleted
 *   outright — the sold-tickets guard only applies once inventory has
 *   actually moved.
 */
test('update removes a tier that has no sales', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, eventId, tierId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'clean-removal-owner@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId);
    return {ownerId, eventId, tierId};
  });

  const asOwner = t.withIdentity({subject: ownerId});
  await asOwner.mutation(api.events.update, {...baseUpdateArgs(eventId), tiers: []});

  await t.run(async ctx => {
    const tier = await ctx.db.get(tierId);
    expect(tier).toBeNull();
  });
});

/**
 * Covers: events.update reconciles speakers — add, update, and remove
 * in a single call.
 * Business logic:
 * - reconcileSpeakers has no sales-based locking (unlike tiers): any
 *   existing speaker omitted from the submitted array is deleted,
 *   entries with `existingId` are patched in place, and entries
 *   without `existingId` are inserted — all in the same
 *   reconciliation pass.
 */
test('update reconciles speakers: keeps+edits one, adds one, removes one', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, eventId, keptSpeakerId, removedSpeakerId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'speaker-reconcile-owner@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const keptSpeakerId = await seedSpeaker(ctx, eventId, {name: 'Original Name', displayOrder: 0});
    const removedSpeakerId = await seedSpeaker(ctx, eventId, {
      name: 'Departing Speaker',
      displayOrder: 1,
    });
    return {ownerId, eventId, keptSpeakerId, removedSpeakerId};
  });

  const asOwner = t.withIdentity({subject: ownerId});
  await asOwner.mutation(api.events.update, {
    ...baseUpdateArgs(eventId),
    speakers: [
      {existingId: keptSpeakerId, name: 'Updated Name', displayOrder: 0},
      {name: 'New Speaker', displayOrder: 1},
    ],
  });

  await t.run(async ctx => {
    const speakers = await ctx.db
      .query('eventSpeakers')
      .withIndex('by_eventId', q => q.eq('eventId', eventId))
      .collect();
    expect(speakers).toHaveLength(2);

    const kept = speakers.find(s => s._id === keptSpeakerId);
    expect(kept?.name).toBe('Updated Name');

    const removed = await ctx.db.get(removedSpeakerId);
    expect(removed).toBeNull();

    const added = speakers.find(s => s.name === 'New Speaker');
    expect(added).toBeDefined();
  });
});

/**
 * Covers: events.updatePaymentInstructions happy path — owner sets and
 * later changes the buyer-facing manual payment instructions.
 * Business logic:
 * - This is a narrow, dedicated mutation (not part of the full `update`
 *   payload) specifically so an owner can change payment details on a
 *   live event, not just while it's draft/rejected.
 * - Passing `undefined` clears the field back to unset.
 */
test('updatePaymentInstructions sets and updates the instructions as the owner', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, eventId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'pay-instr-owner@example.com'});
    const eventId = await seedEvent(ctx, ownerId, {paymentMode: 'manual'});
    return {ownerId, eventId};
  });

  const asOwner = t.withIdentity({subject: ownerId});
  await asOwner.mutation(api.events.updatePaymentInstructions, {
    eventId,
    manualPaymentInstructions: 'Bank: Equity Bank, Account: 1234567890',
  });

  await t.run(async ctx => {
    const event = await ctx.db.get(eventId);
    expect(event?.manualPaymentInstructions).toBe('Bank: Equity Bank, Account: 1234567890');
  });

  await asOwner.mutation(api.events.updatePaymentInstructions, {
    eventId,
    manualPaymentInstructions: undefined,
  });

  await t.run(async ctx => {
    const event = await ctx.db.get(eventId);
    expect(event?.manualPaymentInstructions).toBeUndefined();
  });
});

/**
 * Covers: events.updatePaymentInstructions rejects a caller who is
 * neither the event owner nor holds events:edit access.
 * Business logic:
 * - Goes through the same `requirePermission(ctx, 'events:edit',
 *   eventId)` gate as `update`, so a plain stranger (including one with
 *   unrelated event-staff permissions) is rejected.
 */
test('updatePaymentInstructions rejects a caller who is not the event owner', async () => {
  const t = convexTest(schema, modules);

  const {strangerId, eventId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'pay-instr-stranger-owner@example.com'});
    const strangerId = await seedUser(ctx, {email: 'pay-instr-stranger@example.com'});
    const eventId = await seedEvent(ctx, ownerId, {paymentMode: 'manual'});
    return {strangerId, eventId};
  });

  const asStranger = t.withIdentity({subject: strangerId});
  await expect(
    asStranger.mutation(api.events.updatePaymentInstructions, {
      eventId,
      manualPaymentInstructions: 'Should not be allowed',
    }),
  ).rejects.toThrow('Forbidden: missing permission "events:edit"');
});
