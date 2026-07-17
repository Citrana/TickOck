/// <reference types="vite/client" />
import {convexTest} from 'convex-test';
import {expect, test} from 'vitest';
import {api} from '../_generated/api';
import schema from '../schema';
import {seedUser, seedEvent, seedTier, seedTicket} from './helpers';

const modules = import.meta.glob('../**/*.ts');

/**
 * Covers: eventStaff.addStaff grants a scoped permission that actually
 * authorizes the staff member elsewhere in the app.
 * Business logic:
 * - Only the event owner (or a platform user with `staff:manage`) may
 *   add staff — `event.ownerId === callerId` short-circuits the
 *   `requirePermission` fallback.
 * - Target user is looked up by email (`by_email` index); the owner
 *   cannot add themselves, and banned/suspended users can't be added.
 * - permissionSlugs are validated against an explicit allow-list of
 *   event-scoped slugs — anything else is rejected before the insert.
 * - The resulting eventStaff row is exactly what `requirePermission`'s
 *   event-scoped fallback checks: once added with `tickets:scan`, that
 *   user can call tickets.checkIn for this event despite not being the
 *   owner.
 */
test('addStaff creates a staff record whose granted permission authorizes checkIn', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, staffUserId, eventId, ticketNumber, ticketId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'staff-owner@example.com'});
    const staffUserId = await seedUser(ctx, {email: 'staff-member@example.com'});
    const buyerId = await seedUser(ctx, {email: 'staff-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId);
    const ticketNumber = 'TEST-STAFFSCAN';
    const ticketId = await seedTicket(ctx, eventId, tierId, buyerId, {ticketNumber});
    return {ownerId, staffUserId, eventId, ticketNumber, ticketId};
  });

  const asOwner = t.withIdentity({subject: ownerId});
  await asOwner.mutation(api.eventStaff.addStaff, {
    eventId,
    email: 'staff-member@example.com',
    permissionSlugs: ['tickets:scan'],
  });

  await t.run(async ctx => {
    const staff = await ctx.db
      .query('eventStaff')
      .withIndex('by_eventId_and_userId', q =>
        q.eq('eventId', eventId).eq('userId', staffUserId),
      )
      .unique();
    expect(staff?.permissionSlugs).toEqual(['tickets:scan']);
    expect(staff?.isActive).not.toBe(false);
  });

  const asStaff = t.withIdentity({subject: staffUserId});
  const result = await asStaff.mutation(api.tickets.checkIn, {eventId, identifier: ticketNumber});
  expect(result.ticketId).toBe(ticketId);
});
