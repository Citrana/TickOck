/// <reference types="vite/client" />
import {convexTest} from 'convex-test';
import {expect, test} from 'vitest';
import {api} from '../_generated/api';
import schema from '../schema';
import {seedUser, seedEvent} from './helpers';

const modules = import.meta.glob('../**/*.ts');

/**
 * Covers: eventPaymentDestinations.addDestination happy path — owner adds
 * a named manual-payment destination to their event.
 * Business logic:
 * - Gated by the same `requirePermission(ctx, 'events:edit', eventId)`
 *   used elsewhere on the event, so the owner (or a platform admin with
 *   events:edit) may call this.
 * - New destinations start `isActive: true` and get the next
 *   `displayOrder` (based on how many already exist for the event).
 */
test('addDestination creates an active destination as the owner', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, eventId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'dest-owner@example.com'});
    const eventId = await seedEvent(ctx, ownerId, {paymentMode: 'manual'});
    return {ownerId, eventId};
  });

  const asOwner = t.withIdentity({subject: ownerId});
  const destinationId = await asOwner.mutation(api.eventPaymentDestinations.addDestination, {
    eventId,
    name: "John's M-Pesa",
    phone: '0712345678',
    note: 'Paybill 400200',
  });

  await t.run(async ctx => {
    const destination = await ctx.db.get(destinationId);
    expect(destination?.name).toBe("John's M-Pesa");
    expect(destination?.phone).toBe('0712345678');
    expect(destination?.note).toBe('Paybill 400200');
    expect(destination?.isActive).toBe(true);
    expect(destination?.displayOrder).toBe(0);
  });
});

/**
 * Covers: eventPaymentDestinations.addDestination rejects a caller who is
 * neither the event owner nor holds events:edit access.
 */
test('addDestination rejects a caller who is not the event owner', async () => {
  const t = convexTest(schema, modules);

  const {strangerId, eventId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'dest-stranger-owner@example.com'});
    const strangerId = await seedUser(ctx, {email: 'dest-stranger@example.com'});
    const eventId = await seedEvent(ctx, ownerId, {paymentMode: 'manual'});
    return {strangerId, eventId};
  });

  const asStranger = t.withIdentity({subject: strangerId});
  await expect(
    asStranger.mutation(api.eventPaymentDestinations.addDestination, {
      eventId,
      name: 'Should not be allowed',
      phone: '0700000000',
    }),
  ).rejects.toThrow('Forbidden: missing permission "events:edit"');
});

/**
 * Covers: eventPaymentDestinations.updateDestination patches an existing
 * destination's fields.
 */
test('updateDestination patches name, phone, and note as the owner', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, eventId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'dest-update-owner@example.com'});
    const eventId = await seedEvent(ctx, ownerId, {paymentMode: 'manual'});
    return {ownerId, eventId};
  });

  const asOwner = t.withIdentity({subject: ownerId});
  const destinationId = await asOwner.mutation(api.eventPaymentDestinations.addDestination, {
    eventId,
    name: 'Old Name',
    phone: '0700000000',
  });

  await asOwner.mutation(api.eventPaymentDestinations.updateDestination, {
    destinationId,
    name: 'New Name',
    phone: '0711111111',
    note: 'Updated note',
  });

  await t.run(async ctx => {
    const destination = await ctx.db.get(destinationId);
    expect(destination?.name).toBe('New Name');
    expect(destination?.phone).toBe('0711111111');
    expect(destination?.note).toBe('Updated note');
  });
});

/**
 * Covers: eventPaymentDestinations.deactivateDestination /
 * reactivateDestination — the soft-lifecycle toggle.
 * Business logic:
 * - Destinations are never hard-deleted. Deactivating hides them from
 *   the buyer-facing `listActiveForCheckout`, while they remain visible
 *   (with their inactive state) in the owner-facing `listByEvent`.
 * - Reactivating restores buyer visibility.
 */
test('deactivateDestination hides it from checkout but keeps it in the management list; reactivate restores it', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, eventId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'dest-lifecycle-owner@example.com'});
    const eventId = await seedEvent(ctx, ownerId, {paymentMode: 'manual'});
    return {ownerId, eventId};
  });

  const asOwner = t.withIdentity({subject: ownerId});
  const destinationId = await asOwner.mutation(api.eventPaymentDestinations.addDestination, {
    eventId,
    name: 'Backup Till',
    phone: '0722222222',
  });

  await asOwner.mutation(api.eventPaymentDestinations.deactivateDestination, {destinationId});

  const activeAfterDeactivate = await asOwner.query(
    api.eventPaymentDestinations.listActiveForCheckout,
    {eventId},
  );
  expect(activeAfterDeactivate).toHaveLength(0);

  const managedAfterDeactivate = await asOwner.query(api.eventPaymentDestinations.listByEvent, {
    eventId,
  });
  expect(managedAfterDeactivate).toHaveLength(1);
  expect(managedAfterDeactivate[0].isActive).toBe(false);

  await asOwner.mutation(api.eventPaymentDestinations.reactivateDestination, {destinationId});

  const activeAfterReactivate = await asOwner.query(
    api.eventPaymentDestinations.listActiveForCheckout,
    {eventId},
  );
  expect(activeAfterReactivate).toHaveLength(1);
  expect(activeAfterReactivate[0].name).toBe('Backup Till');
});
