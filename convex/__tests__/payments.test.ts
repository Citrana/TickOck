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

/**
 * Covers: tickets.submitPaymentProof happy path (no referenceNumber).
 * Business logic:
 * - Only the payment's own buyer may attach proof, and only while the
 *   payment is still 'pending' (not yet confirmed or rejected).
 * - Patches evidenceUrl from the given storageId; referenceNumber is
 *   only set if one was actually provided.
 */
test('submitPaymentProof attaches evidence to a pending payment', async () => {
  const t = convexTest(schema, modules);

  const {buyerId, eventId, tierId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'proof-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'proof-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId);
    return {buyerId, eventId, tierId};
  });

  const asBuyer = t.withIdentity({subject: buyerId});
  const {paymentId} = await asBuyer.mutation(api.tickets.purchase, {eventId, tierId, quantity: 1});

  const storageId = await t.run(async ctx => ctx.storage.store(new Blob(['fake-screenshot'])));

  await asBuyer.mutation(api.tickets.submitPaymentProof, {paymentId: paymentId!, storageId});

  await t.run(async ctx => {
    const payment = await ctx.db.get(paymentId!);
    expect(payment?.evidenceUrl).toEqual(expect.any(String));
    expect(payment?.evidenceUrl?.length).toBeGreaterThan(0);
    expect(payment?.referenceNumber).toBeUndefined();
  });
});

/**
 * Covers: tickets.submitPaymentProof rejects a caller who isn't the
 * payment owner.
 * Business logic:
 * - `payment.userId !== userId` is checked before status/dedupe/
 *   storage logic — attaching proof is strictly self-service.
 */
test('submitPaymentProof rejects a caller who is not the payment owner', async () => {
  const t = convexTest(schema, modules);

  const {strangerId, buyerId, eventId, tierId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'proof-forbidden-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'proof-forbidden-buyer@example.com'});
    const strangerId = await seedUser(ctx, {email: 'proof-forbidden-stranger@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId);
    return {strangerId, buyerId, eventId, tierId};
  });

  const asBuyer = t.withIdentity({subject: buyerId});
  const {paymentId} = await asBuyer.mutation(api.tickets.purchase, {eventId, tierId, quantity: 1});

  const storageId = await t.run(async ctx => ctx.storage.store(new Blob(['fake-screenshot'])));

  const asStranger = t.withIdentity({subject: strangerId});
  await expect(
    asStranger.mutation(api.tickets.submitPaymentProof, {paymentId: paymentId!, storageId}),
  ).rejects.toThrow('Forbidden');
});

/**
 * Covers: tickets.submitPaymentProof rejects a payment that's already
 * been processed.
 * Business logic:
 * - Proof can only be attached while status === 'pending' — once the
 *   owner has confirmed (or rejected) it, submitPaymentProof is no
 *   longer the right call (resubmitPaymentProof/resubmitAsCash handle
 *   the post-rejection case instead).
 */
test('submitPaymentProof rejects a payment that is already confirmed', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, buyerId, eventId, tierId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'proof-processed-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'proof-processed-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId);
    return {ownerId, buyerId, eventId, tierId};
  });

  const asBuyer = t.withIdentity({subject: buyerId});
  const {paymentId} = await asBuyer.mutation(api.tickets.purchase, {eventId, tierId, quantity: 1});

  const asOwner = t.withIdentity({subject: ownerId});
  await asOwner.mutation(api.payments.confirmPayment, {paymentId: paymentId!});

  const storageId = await t.run(async ctx => ctx.storage.store(new Blob(['fake-screenshot'])));

  await expect(
    asBuyer.mutation(api.tickets.submitPaymentProof, {paymentId: paymentId!, storageId}),
  ).rejects.toThrow('This payment has already been processed');
});

/**
 * Covers: tickets.submitPaymentProof rejects a referenceNumber that's
 * already used by another payment on the same event.
 * Business logic:
 * - `by_referenceNumber_and_eventId` dedupe exists to stop a buyer
 *   reusing someone else's payment reference as fake proof.
 */
test('submitPaymentProof rejects a referenceNumber already used on another payment for the same event', async () => {
  const t = convexTest(schema, modules);

  const {buyer1Id, buyer2Id, eventId, tierId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'proof-dup-owner@example.com'});
    const buyer1Id = await seedUser(ctx, {email: 'proof-dup-buyer1@example.com'});
    const buyer2Id = await seedUser(ctx, {email: 'proof-dup-buyer2@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId, {quantity: 20});
    return {buyer1Id, buyer2Id, eventId, tierId};
  });

  const asBuyer1 = t.withIdentity({subject: buyer1Id});
  const {paymentId: payment1Id} = await asBuyer1.mutation(api.tickets.purchase, {
    eventId,
    tierId,
    quantity: 1,
  });
  const storageId1 = await t.run(async ctx => ctx.storage.store(new Blob(['proof-1'])));
  await asBuyer1.mutation(api.tickets.submitPaymentProof, {
    paymentId: payment1Id!,
    storageId: storageId1,
    referenceNumber: 'REF-SHARED',
  });

  const asBuyer2 = t.withIdentity({subject: buyer2Id});
  const {paymentId: payment2Id} = await asBuyer2.mutation(api.tickets.purchase, {
    eventId,
    tierId,
    quantity: 1,
  });
  const storageId2 = await t.run(async ctx => ctx.storage.store(new Blob(['proof-2'])));

  await expect(
    asBuyer2.mutation(api.tickets.submitPaymentProof, {
      paymentId: payment2Id!,
      storageId: storageId2,
      referenceNumber: 'REF-SHARED',
    }),
  ).rejects.toThrow('This payment reference number has already been used for this event');
});

/**
 * Covers: tickets.submitPaymentProof allows resubmitting the same
 * referenceNumber onto the same payment.
 * Business logic:
 * - The dedupe lookup explicitly excludes a match on the payment's own
 *   id (`duplicate._id !== args.paymentId`), so a buyer re-uploading
 *   before the owner has reviewed isn't blocked by their own earlier
 *   reference number.
 */
test('submitPaymentProof allows resubmitting the same referenceNumber onto the same payment', async () => {
  const t = convexTest(schema, modules);

  const {buyerId, eventId, tierId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'proof-resubmit-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'proof-resubmit-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId);
    return {buyerId, eventId, tierId};
  });

  const asBuyer = t.withIdentity({subject: buyerId});
  const {paymentId} = await asBuyer.mutation(api.tickets.purchase, {eventId, tierId, quantity: 1});

  const storageId1 = await t.run(async ctx => ctx.storage.store(new Blob(['first-attempt'])));
  await asBuyer.mutation(api.tickets.submitPaymentProof, {
    paymentId: paymentId!,
    storageId: storageId1,
    referenceNumber: 'REF-SELF',
  });

  const storageId2 = await t.run(async ctx => ctx.storage.store(new Blob(['second-attempt'])));
  await asBuyer.mutation(api.tickets.submitPaymentProof, {
    paymentId: paymentId!,
    storageId: storageId2,
    referenceNumber: 'REF-SELF',
  });

  await t.run(async ctx => {
    const payment = await ctx.db.get(paymentId!);
    expect(payment?.referenceNumber).toBe('REF-SELF');
  });
});

/**
 * Covers: tickets.submitPaymentProof allows the same referenceNumber
 * across two different events.
 * Business logic:
 * - The dedupe index is scoped `by_referenceNumber_and_eventId` —
 *   per-event, not global — so the same reference number legitimately
 *   recurring across unrelated events (e.g. the same bank transfer
 *   reference format) is never blocked.
 */
test('submitPaymentProof allows the same referenceNumber across different events', async () => {
  const t = convexTest(schema, modules);

  const {buyerId, event1Id, event2Id, tier1Id, tier2Id} = await t.run(async ctx => {
    const owner1Id = await seedUser(ctx, {email: 'proof-cross-owner1@example.com'});
    const owner2Id = await seedUser(ctx, {email: 'proof-cross-owner2@example.com'});
    const buyerId = await seedUser(ctx, {email: 'proof-cross-buyer@example.com'});
    const event1Id = await seedEvent(ctx, owner1Id, {title: 'Event One'});
    const event2Id = await seedEvent(ctx, owner2Id, {title: 'Event Two'});
    const tier1Id = await seedTier(ctx, event1Id);
    const tier2Id = await seedTier(ctx, event2Id);
    return {buyerId, event1Id, event2Id, tier1Id, tier2Id};
  });

  const asBuyer = t.withIdentity({subject: buyerId});
  const {paymentId: payment1Id} = await asBuyer.mutation(api.tickets.purchase, {
    eventId: event1Id,
    tierId: tier1Id,
    quantity: 1,
  });
  const storageId1 = await t.run(async ctx => ctx.storage.store(new Blob(['event-1-proof'])));
  await asBuyer.mutation(api.tickets.submitPaymentProof, {
    paymentId: payment1Id!,
    storageId: storageId1,
    referenceNumber: 'REF-CROSS-EVENT',
  });

  const {paymentId: payment2Id} = await asBuyer.mutation(api.tickets.purchase, {
    eventId: event2Id,
    tierId: tier2Id,
    quantity: 1,
  });
  const storageId2 = await t.run(async ctx => ctx.storage.store(new Blob(['event-2-proof'])));

  await asBuyer.mutation(api.tickets.submitPaymentProof, {
    paymentId: payment2Id!,
    storageId: storageId2,
    referenceNumber: 'REF-CROSS-EVENT',
  });

  await t.run(async ctx => {
    const payment2 = await ctx.db.get(payment2Id!);
    expect(payment2?.referenceNumber).toBe('REF-CROSS-EVENT');
  });
});

/**
 * Covers: tickets.submitPaymentProof rejects when the uploaded file
 * can't be retrieved.
 * Business logic:
 * - `ctx.storage.getUrl` returning null (missing/deleted file) is
 *   treated as a hard failure before the payment is touched at all.
 */
test('submitPaymentProof rejects when the uploaded file cannot be retrieved', async () => {
  const t = convexTest(schema, modules);

  const {buyerId, eventId, tierId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'proof-storage-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'proof-storage-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId);
    return {buyerId, eventId, tierId};
  });

  const asBuyer = t.withIdentity({subject: buyerId});
  const {paymentId} = await asBuyer.mutation(api.tickets.purchase, {eventId, tierId, quantity: 1});

  const storageId = await t.run(async ctx => {
    const id = await ctx.storage.store(new Blob(['will-be-deleted']));
    await ctx.storage.delete(id);
    return id;
  });

  await expect(
    asBuyer.mutation(api.tickets.submitPaymentProof, {paymentId: paymentId!, storageId}),
  ).rejects.toThrow('Failed to retrieve uploaded file');
});
