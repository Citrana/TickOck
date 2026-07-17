/// <reference types="vite/client" />
import {convexTest} from 'convex-test';
import {expect, test} from 'vitest';
import {api} from '../_generated/api';
import schema from '../schema';
import {seedUser, seedEvent, seedTier} from './helpers';

const modules = import.meta.glob('../**/*.ts');

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
