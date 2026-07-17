/// <reference types="vite/client" />
import {convexTest} from 'convex-test';
import {expect, test} from 'vitest';
import {api} from '../_generated/api';
import schema from '../schema';
import {seedUser, seedEvent, seedTier} from './helpers';

const modules = import.meta.glob('../**/*.ts');

/**
 * Covers: payments.confirmPayment happy path on a multi-ticket order.
 * Business logic:
 * - Only the event owner (or a caller with payments:confirm) may
 *   confirm; requires payment.status === 'pending'.
 * - Patches the payment to 'confirmed' (confirmedBy/confirmedAt set).
 * - Activates the primary ticket (payment.ticketId) AND every other
 *   pending_payment ticket sharing the same eventId + userId, since a
 *   multi-ticket order shares one payment row across all its tickets —
 *   confirming the payment must confirm the whole order, not just one
 *   ticket. Each activated ticket is assigned a fresh ticketNumber.
 */
test('confirmPayment activates every ticket in a multi-ticket order', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, buyerId, eventId, tierId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'confirm-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'confirm-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId);
    return {ownerId, buyerId, eventId, tierId};
  });

  const asBuyer = t.withIdentity({subject: buyerId});
  const {ticketIds, paymentId} = await asBuyer.mutation(api.tickets.purchase, {
    eventId,
    tierId,
    quantity: 2,
  });
  expect(ticketIds).toHaveLength(2);

  const asOwner = t.withIdentity({subject: ownerId});
  await asOwner.mutation(api.payments.confirmPayment, {paymentId: paymentId!});

  await t.run(async ctx => {
    const payment = await ctx.db.get(paymentId!);
    expect(payment?.status).toBe('confirmed');
    expect(payment?.confirmedBy).toBe(ownerId);
    expect(payment?.confirmedAt).toEqual(expect.any(Number));

    for (const ticketId of ticketIds) {
      const ticket = await ctx.db.get(ticketId);
      expect(ticket?.status).toBe('confirmed');
      expect(ticket?.ticketNumber).toEqual(expect.any(String));
    }
  });
});

/**
 * Covers: payments.confirmPayment rejects a payment that isn't pending.
 * Business logic:
 * - `if (payment.status !== 'pending') throw ...` runs before any
 *   patch, so calling confirmPayment twice must be a no-op error on
 *   the second call — no re-generated ticketNumber, no changed
 *   confirmedAt.
 */
test('confirmPayment rejects confirming an already-confirmed payment', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, buyerId, eventId, tierId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'double-confirm-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'double-confirm-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId);
    return {ownerId, buyerId, eventId, tierId};
  });

  const asBuyer = t.withIdentity({subject: buyerId});
  const {ticketIds, paymentId} = await asBuyer.mutation(api.tickets.purchase, {
    eventId,
    tierId,
    quantity: 1,
  });

  const asOwner = t.withIdentity({subject: ownerId});
  await asOwner.mutation(api.payments.confirmPayment, {paymentId: paymentId!});

  const ticketNumberAfterFirst = await t.run(
    async ctx => (await ctx.db.get(ticketIds[0]))?.ticketNumber,
  );

  await expect(
    asOwner.mutation(api.payments.confirmPayment, {paymentId: paymentId!}),
  ).rejects.toThrow('Payment is not in a pending state');

  await t.run(async ctx => {
    const ticket = await ctx.db.get(ticketIds[0]);
    expect(ticket?.ticketNumber).toBe(ticketNumberAfterFirst);
  });
});

/**
 * Covers: payments.confirmPayment authorizes event staff granted
 * payments:confirm, not just the owner.
 * Business logic:
 * - When the caller isn't the event owner, confirmPayment falls back
 *   to `requirePermission(ctx, 'payments:confirm', payment.eventId)`.
 *   Passing eventId matters: it's what lets requirePermission check
 *   the eventStaff table fallback, not just platform roles — without
 *   it, a staff member granted payments:confirm via addStaff could
 *   never actually confirm anything, which would make the "finance"
 *   staff preset (eventStaff.ts's STAFF_PRESETS.finance) non-functional
 *   for its whole purpose.
 */
test('confirmPayment allows event staff granted payments:confirm', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, staffUserId, buyerId, eventId, tierId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'staff-confirm-owner@example.com'});
    const staffUserId = await seedUser(ctx, {email: 'staff-confirm-staff@example.com'});
    const buyerId = await seedUser(ctx, {email: 'staff-confirm-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId);
    return {ownerId, staffUserId, buyerId, eventId, tierId};
  });

  const asOwner = t.withIdentity({subject: ownerId});
  await asOwner.mutation(api.eventStaff.addStaff, {
    eventId,
    email: 'staff-confirm-staff@example.com',
    permissionSlugs: ['payments:confirm'],
  });

  const asBuyer = t.withIdentity({subject: buyerId});
  const {paymentId} = await asBuyer.mutation(api.tickets.purchase, {eventId, tierId, quantity: 1});

  const asStaff = t.withIdentity({subject: staffUserId});
  await asStaff.mutation(api.payments.confirmPayment, {paymentId: paymentId!});

  await t.run(async ctx => {
    const payment = await ctx.db.get(paymentId!);
    expect(payment?.status).toBe('confirmed');
    expect(payment?.confirmedBy).toBe(staffUserId);
  });
});

/**
 * Covers: payments.confirmPayment rejects a caller with no event access.
 * Business logic:
 * - A user who is neither the event owner nor granted payments:confirm
 *   (via staff or platform role) is rejected by requirePermission's
 *   Forbidden path — confirming payments is not self-service.
 */
test('confirmPayment rejects a caller with no permission on the event', async () => {
  const t = convexTest(schema, modules);

  const {strangerId, buyerId, eventId, tierId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'stranger-owner@example.com'});
    const strangerId = await seedUser(ctx, {email: 'stranger@example.com'});
    const buyerId = await seedUser(ctx, {email: 'stranger-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId);
    return {strangerId, buyerId, eventId, tierId};
  });

  const asBuyer = t.withIdentity({subject: buyerId});
  const {paymentId} = await asBuyer.mutation(api.tickets.purchase, {eventId, tierId, quantity: 1});

  const asStranger = t.withIdentity({subject: strangerId});
  await expect(
    asStranger.mutation(api.payments.confirmPayment, {paymentId: paymentId!}),
  ).rejects.toThrow('Forbidden: missing permission "payments:confirm"');
});

/**
 * Covers: payments.rejectPayment happy path — rejecting leaves the
 * ticket untouched.
 * Business logic:
 * - Only the event owner (or payments:reject) may reject; requires
 *   payment.status === 'pending'.
 * - Patches status to 'rejected' with rejectedBy/rejectedAt/
 *   rejectionReason — unlike confirmPayment, it never touches the
 *   ticket at all, so the ticket stays pending_payment until the buyer
 *   resubmits proof (resubmitPaymentProof/resubmitAsCash).
 */
test('rejectPayment marks the payment rejected without activating the ticket', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, buyerId, eventId, tierId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'reject-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'reject-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId);
    return {ownerId, buyerId, eventId, tierId};
  });

  const asBuyer = t.withIdentity({subject: buyerId});
  const {ticketIds, paymentId} = await asBuyer.mutation(api.tickets.purchase, {
    eventId,
    tierId,
    quantity: 1,
  });

  const asOwner = t.withIdentity({subject: ownerId});
  await asOwner.mutation(api.payments.rejectPayment, {
    paymentId: paymentId!,
    reason: 'Blurry screenshot',
  });

  await t.run(async ctx => {
    const payment = await ctx.db.get(paymentId!);
    expect(payment?.status).toBe('rejected');
    expect(payment?.rejectedBy).toBe(ownerId);
    expect(payment?.rejectedAt).toEqual(expect.any(Number));
    expect(payment?.rejectionReason).toBe('Blurry screenshot');

    const ticket = await ctx.db.get(ticketIds[0]);
    expect(ticket?.status).toBe('pending_payment');
    expect(ticket?.ticketNumber).toBeUndefined();
  });
});

/**
 * Covers: payments.rejectPayment rejects a payment that isn't pending.
 * Business logic:
 * - Same pending-state guard as confirmPayment — a payment can only be
 *   rejected once; a second attempt throws before touching anything.
 */
test('rejectPayment rejects rejecting an already-rejected payment', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, buyerId, eventId, tierId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'double-reject-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'double-reject-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId);
    return {ownerId, buyerId, eventId, tierId};
  });

  const asBuyer = t.withIdentity({subject: buyerId});
  const {paymentId} = await asBuyer.mutation(api.tickets.purchase, {eventId, tierId, quantity: 1});

  const asOwner = t.withIdentity({subject: ownerId});
  await asOwner.mutation(api.payments.rejectPayment, {paymentId: paymentId!});

  await expect(
    asOwner.mutation(api.payments.rejectPayment, {paymentId: paymentId!}),
  ).rejects.toThrow('Payment is not in a pending state');
});
