/// <reference types="vite/client" />
import {convexTest} from 'convex-test';
import {expect, test} from 'vitest';
import {api} from '../_generated/api';
import schema from '../schema';
import {seedUser, seedEvent, seedTier} from './helpers';

const modules = import.meta.glob('../**/*.ts');

/**
 * Covers: tickets.purchase happy path — buying one ticket on a paid tier.
 * Business logic:
 * - Self-service: any active, non-suspended/banned user may buy — no
 *   `requirePermission` check, just `getCallerUserId`.
 * - Requires quantity in [1, 10], event.status === 'live', and the tier
 *   to belong to that event with enough unsold inventory.
 * - Reserves inventory up front by patching tier.quantitySold before any
 *   ticket rows are created.
 * - Free tiers (price === 0) auto-confirm; paid tiers start as
 *   pending_payment and wait for a separate confirmPayment step.
 * - One `payments` row covers the whole order, not one per ticket.
 * - Each ticket's QR is signed with the event's own per-event HMAC
 *   secret (never a global one).
 */
test('purchase creates a pending ticket and payment for a paid tier', async () => {
  const t = convexTest(schema, modules);

  const {userId, eventId, tierId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'owner@example.com'});
    const userId = await seedUser(ctx, {email: 'buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId);
    return {userId, eventId, tierId};
  });

  const asBuyer = t.withIdentity({subject: userId});
  const {ticketIds, paymentId} = await asBuyer.mutation(api.tickets.purchase, {
    eventId,
    tierId,
    quantity: 1,
  });

  expect(ticketIds).toHaveLength(1);
  expect(paymentId).not.toBeNull();

  await t.run(async ctx => {
    const ticket = await ctx.db.get(ticketIds[0]);
    expect(ticket?.status).toBe('pending_payment');
    expect(ticket?.userId).toBe(userId);
    expect(ticket?.eventId).toBe(eventId);
    expect(ticket?.tierId).toBe(tierId);
    expect(ticket?.qrSignature).toEqual(expect.any(String));
    expect(ticket?.qrSignature?.length).toBeGreaterThan(0);

    const payment = await ctx.db.get(paymentId!);
    expect(payment?.status).toBe('pending');
    expect(payment?.amount).toBe(50);
    expect(payment?.eventId).toBe(eventId);
    expect(payment?.userId).toBe(userId);

    const tier = await ctx.db.get(tierId);
    expect(tier?.quantitySold).toBe(1);
  });
});

/**
 * Covers: tickets.purchase rejects when a tier is sold out.
 * Business logic:
 * - Available inventory = tier.quantity - tier.quantitySold; the
 *   mutation throws before writing anything if the requested quantity
 *   exceeds what's available.
 * - The availability check runs before tier.quantitySold is patched and
 *   before any ticket/payment rows are inserted, so a rejected purchase
 *   leaves the tier and ticket count completely unchanged — no partial
 *   reservation, no orphaned rows.
 */
test('purchase rejects when the tier has no remaining inventory', async () => {
  const t = convexTest(schema, modules);

  const {userId, eventId, tierId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'owner2@example.com'});
    const userId = await seedUser(ctx, {email: 'buyer2@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId, {quantity: 5, quantitySold: 5});
    return {userId, eventId, tierId};
  });

  const asBuyer = t.withIdentity({subject: userId});
  await expect(
    asBuyer.mutation(api.tickets.purchase, {eventId, tierId, quantity: 1}),
  ).rejects.toThrow(/0 tickets? remaining/);

  await t.run(async ctx => {
    const tier = await ctx.db.get(tierId);
    expect(tier?.quantitySold).toBe(5);

    const tickets = await ctx.db
      .query('tickets')
      .withIndex('by_eventId_and_userId', q =>
        q.eq('eventId', eventId).eq('userId', userId),
      )
      .collect();
    expect(tickets).toHaveLength(0);
  });
});
