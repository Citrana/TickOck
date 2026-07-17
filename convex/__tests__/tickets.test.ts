/// <reference types="vite/client" />
import {convexTest} from 'convex-test';
import {expect, test} from 'vitest';
import {api} from '../_generated/api';
import schema from '../schema';
import {seedUser, seedEvent, seedTier, seedTicket} from './helpers';

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

/**
 * Covers: tickets.checkIn rejects re-scanning an already-used ticket.
 * Business logic:
 * - Only the event owner or staff granted `tickets:scan` may check
 *   tickets in — `requirePermission(ctx, 'tickets:scan', eventId)`.
 * - Ticket is looked up by ticket number (or a "TOCK:<id>" QR
 *   identifier), scoped to the given event.
 * - Only `confirmed` tickets can be checked in; each other status
 *   (pending_payment, cancelled, used, expired) gets its own specific
 *   rejection message.
 * - A successful check-in flips status to `used` and stamps
 *   scannedBy/scannedAt, so scanning the same ticket again always hits
 *   the "already been used" branch and makes no further writes.
 */
test('checkIn rejects scanning the same ticket twice', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, eventId, ticketId, ticketNumber} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'scanner-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'scanner-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId);
    const ticketNumber = 'TEST-DOUBLESCAN';
    const ticketId = await seedTicket(ctx, eventId, tierId, buyerId, {ticketNumber});
    return {ownerId, eventId, ticketId, ticketNumber};
  });

  const asOwner = t.withIdentity({subject: ownerId});

  const first = await asOwner.mutation(api.tickets.checkIn, {eventId, identifier: ticketNumber});
  expect(first.ticketId).toBe(ticketId);

  const scannedAtAfterFirst = await t.run(async ctx => (await ctx.db.get(ticketId))?.scannedAt);

  await expect(
    asOwner.mutation(api.tickets.checkIn, {eventId, identifier: ticketNumber}),
  ).rejects.toThrow('This ticket has already been used');

  await t.run(async ctx => {
    const ticket = await ctx.db.get(ticketId);
    expect(ticket?.status).toBe('used');
    expect(ticket?.scannedAt).toBe(scannedAtAfterFirst);
  });
});

/**
 * Covers: tickets.checkIn rejects a ticket that belongs to a different event.
 * Business logic:
 * - Ticket lookup (by ticket number or "TOCK:<id>" QR identifier) is not
 *   scoped by event at the query level — ticketNumber is globally
 *   unique — so the same identifier could resolve to a ticket from any
 *   event.
 * - checkIn explicitly rejects afterward if `ticket.eventId !==
 *   args.eventId` ("This ticket is for a different event"), so a ticket
 *   valid for event A can never be checked in against event B's
 *   scanner, even by staff who has scan access to both events.
 */
test('checkIn rejects a ticket scanned against a different event', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, eventBId, ticketId, ticketNumber} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'two-events-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'cross-event-buyer@example.com'});
    const eventAId = await seedEvent(ctx, ownerId, {title: 'Event A'});
    const eventBId = await seedEvent(ctx, ownerId, {title: 'Event B'});
    const tierAId = await seedTier(ctx, eventAId);
    const ticketNumber = 'TEST-CROSSEVENT';
    const ticketId = await seedTicket(ctx, eventAId, tierAId, buyerId, {ticketNumber});
    return {ownerId, eventBId, ticketId, ticketNumber};
  });

  const asOwner = t.withIdentity({subject: ownerId});

  await expect(
    asOwner.mutation(api.tickets.checkIn, {eventId: eventBId, identifier: ticketNumber}),
  ).rejects.toThrow('This ticket is for a different event');

  await t.run(async ctx => {
    const ticket = await ctx.db.get(ticketId);
    expect(ticket?.status).toBe('confirmed');
  });
});
