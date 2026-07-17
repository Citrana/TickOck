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

/**
 * Covers: eventStaff.deactivateStaff revokes a staff member's access.
 * Business logic:
 * - deactivateStaff patches `isActive: false` on the eventStaff row; the
 *   record itself is never deleted (soft revoke, preserves audit
 *   history) — only the event owner (or staff:manage) may call it.
 * - requirePermission's event-scoped fallback requires
 *   `staff.isActive !== false` in addition to a matching permission
 *   slug, so a deactivated staff member fails permission checks
 *   immediately on their next call, even though permissionSlugs are
 *   untouched.
 */
test('deactivateStaff revokes access for a deactivated staff member', async () => {
  const t = convexTest(schema, modules);

  const {ownerId, staffUserId, eventId, ticketNumber, ticketId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'deactivate-owner@example.com'});
    const staffUserId = await seedUser(ctx, {email: 'deactivate-staff@example.com'});
    const buyerId = await seedUser(ctx, {email: 'deactivate-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId);
    const tierId = await seedTier(ctx, eventId);
    const ticketNumber = 'TEST-DEACTIVATED';
    const ticketId = await seedTicket(ctx, eventId, tierId, buyerId, {ticketNumber});
    return {ownerId, staffUserId, eventId, ticketNumber, ticketId};
  });

  const asOwner = t.withIdentity({subject: ownerId});
  await asOwner.mutation(api.eventStaff.addStaff, {
    eventId,
    email: 'deactivate-staff@example.com',
    permissionSlugs: ['tickets:scan'],
  });

  const staffId = await t.run(async ctx => {
    const staff = await ctx.db
      .query('eventStaff')
      .withIndex('by_eventId_and_userId', q =>
        q.eq('eventId', eventId).eq('userId', staffUserId),
      )
      .unique();
    return staff!._id;
  });

  await asOwner.mutation(api.eventStaff.deactivateStaff, {staffId});

  await t.run(async ctx => {
    const staff = await ctx.db.get(staffId);
    expect(staff?.isActive).toBe(false);
  });

  const asStaff = t.withIdentity({subject: staffUserId});
  await expect(
    asStaff.mutation(api.tickets.checkIn, {eventId, identifier: ticketNumber}),
  ).rejects.toThrow('Forbidden: missing permission "tickets:scan"');

  await t.run(async ctx => {
    const ticket = await ctx.db.get(ticketId);
    expect(ticket?.status).toBe('confirmed');
  });
});
