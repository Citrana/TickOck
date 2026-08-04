/// <reference types="vite/client" />
import {convexTest} from 'convex-test';
import {expect, test, vi} from 'vitest';
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

/**
 * Covers: tickets.purchase rejects buying after the event has ended.
 * Business logic:
 * - Event end = event.date (the calendar day) + endTime ("HH:mm"), read as
 *   wall-clock local time in event.timezone and converted to a UTC
 *   instant — or +24h from UTC midnight if endTime isn't set.
 * - Seeded event uses the default timezone 'America/Toronto'; on
 *   2024-06-01 that's EDT (UTC-4), so endTime '12:00' local is 16:00 UTC —
 *   4 hours later than the UTC clock time would naively suggest.
 * - The check runs alongside the existing `status === 'live'` check,
 *   before any inventory reservation or ticket/payment rows are
 *   written — a purchase attempt after the cutoff leaves everything
 *   unchanged.
 */
test('purchase rejects buying after the event has ended', async () => {
  const t = convexTest(schema, modules);

  const eventDate = new Date('2024-06-01T00:00:00.000Z').getTime();

  const {userId, eventId, tierId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'ended-owner@example.com'});
    const userId = await seedUser(ctx, {email: 'ended-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId, {date: eventDate, endTime: '12:00'});
    const tierId = await seedTier(ctx, eventId);
    return {userId, eventId, tierId};
  });

  vi.useFakeTimers();
  try {
    // 16:01 UTC = 12:01 EDT — one minute after the real (timezone-aware) end
    vi.setSystemTime(eventDate + 16 * 3_600_000 + 60_000);

    const asBuyer = t.withIdentity({subject: userId});
    await expect(
      asBuyer.mutation(api.tickets.purchase, {eventId, tierId, quantity: 1}),
    ).rejects.toThrow('This event has ended');
  } finally {
    vi.useRealTimers();
  }

  await t.run(async ctx => {
    const tier = await ctx.db.get(tierId);
    expect(tier?.quantitySold).toBe(0);
  });
});

/**
 * Covers: tickets.purchase correctly reads endTime in the event's own
 * timezone rather than treating it as UTC.
 * Business logic:
 * - Seeded event uses timezone 'America/Toronto' (EDT, UTC-4 on
 *   2024-06-01) with endTime '12:00' local, i.e. 16:00 UTC.
 * - At 15:59 UTC (11:59am Toronto) the event has NOT ended yet, even
 *   though naive UTC math (event.date + 12h = 12:00 UTC) would have
 *   incorrectly treated it as already over 4 hours earlier — this is the
 *   regression guarded against.
 */
test('purchase succeeds before the event has ended in its own timezone', async () => {
  const t = convexTest(schema, modules);

  const eventDate = new Date('2024-06-01T00:00:00.000Z').getTime();

  const {userId, eventId, tierId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'tz-owner@example.com'});
    const userId = await seedUser(ctx, {email: 'tz-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId, {date: eventDate, endTime: '12:00'});
    const tierId = await seedTier(ctx, eventId);
    return {userId, eventId, tierId};
  });

  vi.useFakeTimers();
  try {
    // 15:59 UTC = 11:59am EDT — one minute before the real (timezone-aware) end
    vi.setSystemTime(eventDate + 15 * 3_600_000 + 59 * 60_000);

    const asBuyer = t.withIdentity({subject: userId});
    await expect(
      asBuyer.mutation(api.tickets.purchase, {eventId, tierId, quantity: 1}),
    ).resolves.toBeDefined();
  } finally {
    vi.useRealTimers();
  }

  await t.run(async ctx => {
    const tier = await ctx.db.get(tierId);
    expect(tier?.quantitySold).toBe(1);
  });
});

/**
 * Covers: tickets.cancel happy path.
 * Business logic:
 * - Only the ticket's own buyer may cancel it — no owner/staff
 *   override exists here (unlike checkIn).
 * - Requires event.cancellationPolicy.allowed and (if set) that
 *   cutoffHours hasn't passed yet.
 * - On success: ticket flips to 'cancelled' and the reserved slot is
 *   returned to inventory (tier.quantitySold - 1).
 */
test('cancel cancels a confirmed ticket and returns the slot to inventory', async () => {
  const t = convexTest(schema, modules);

  const {buyerId, tierId, ticketId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'cancel-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'cancel-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId, {cancellationPolicy: {allowed: true}});
    const tierId = await seedTier(ctx, eventId, {quantitySold: 1});
    const ticketId = await seedTicket(ctx, eventId, tierId, buyerId, {status: 'confirmed'});
    return {buyerId, tierId, ticketId};
  });

  const asBuyer = t.withIdentity({subject: buyerId});
  await asBuyer.mutation(api.tickets.cancel, {ticketId});

  await t.run(async ctx => {
    const ticket = await ctx.db.get(ticketId);
    expect(ticket?.status).toBe('cancelled');

    const tier = await ctx.db.get(tierId);
    expect(tier?.quantitySold).toBe(0);
  });
});

/**
 * Covers: tickets.cancel rejects a caller who doesn't own the ticket.
 * Business logic:
 * - `ticket.userId !== userId` is checked before any status/policy
 *   logic — cancellation is strictly self-service by the buyer.
 */
test('cancel rejects a caller who does not own the ticket', async () => {
  const t = convexTest(schema, modules);

  const {strangerId, ticketId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'cancel-forbidden-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'cancel-forbidden-buyer@example.com'});
    const strangerId = await seedUser(ctx, {email: 'cancel-forbidden-stranger@example.com'});
    const eventId = await seedEvent(ctx, ownerId, {cancellationPolicy: {allowed: true}});
    const tierId = await seedTier(ctx, eventId, {quantitySold: 1});
    const ticketId = await seedTicket(ctx, eventId, tierId, buyerId, {status: 'confirmed'});
    return {strangerId, ticketId};
  });

  const asStranger = t.withIdentity({subject: strangerId});
  await expect(asStranger.mutation(api.tickets.cancel, {ticketId})).rejects.toThrow('Forbidden');
});

/**
 * Covers: tickets.cancel rejects a ticket that's already cancelled.
 * Business logic:
 * - Status guards run before the cancellationPolicy checks — cancel is
 *   not idempotent, a second attempt is a hard error.
 */
test('cancel rejects a ticket that is already cancelled', async () => {
  const t = convexTest(schema, modules);

  const {buyerId, ticketId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'already-cancelled-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'already-cancelled-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId, {cancellationPolicy: {allowed: true}});
    const tierId = await seedTier(ctx, eventId);
    const ticketId = await seedTicket(ctx, eventId, tierId, buyerId, {status: 'cancelled'});
    return {buyerId, ticketId};
  });

  const asBuyer = t.withIdentity({subject: buyerId});
  await expect(asBuyer.mutation(api.tickets.cancel, {ticketId})).rejects.toThrow(
    'Ticket is already cancelled',
  );
});

/**
 * Covers: tickets.cancel rejects a used ticket.
 * Business logic:
 * - A ticket that's already been scanned/checked in can never be
 *   cancelled, regardless of the event's cancellation policy.
 */
test('cancel rejects a used ticket', async () => {
  const t = convexTest(schema, modules);

  const {buyerId, ticketId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'used-cancel-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'used-cancel-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId, {cancellationPolicy: {allowed: true}});
    const tierId = await seedTier(ctx, eventId);
    const ticketId = await seedTicket(ctx, eventId, tierId, buyerId, {status: 'used'});
    return {buyerId, ticketId};
  });

  const asBuyer = t.withIdentity({subject: buyerId});
  await expect(asBuyer.mutation(api.tickets.cancel, {ticketId})).rejects.toThrow(
    'Used tickets cannot be cancelled',
  );
});

/**
 * Covers: tickets.cancel rejects an expired ticket.
 * Business logic:
 * - Same shape as the used-ticket guard — an expired ticket is a dead
 *   end, not cancellable.
 */
test('cancel rejects an expired ticket', async () => {
  const t = convexTest(schema, modules);

  const {buyerId, ticketId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'expired-cancel-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'expired-cancel-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId, {cancellationPolicy: {allowed: true}});
    const tierId = await seedTier(ctx, eventId);
    const ticketId = await seedTicket(ctx, eventId, tierId, buyerId, {status: 'expired'});
    return {buyerId, ticketId};
  });

  const asBuyer = t.withIdentity({subject: buyerId});
  await expect(asBuyer.mutation(api.tickets.cancel, {ticketId})).rejects.toThrow(
    'Expired tickets cannot be cancelled',
  );
});

/**
 * Covers: tickets.cancel rejects when the event's policy disallows
 * cancellations entirely.
 * Business logic:
 * - `cancellationPolicy.allowed === false` blocks cancellation
 *   regardless of ticket status — checked before the cutoffHours math.
 */
test('cancel rejects when the event does not allow cancellations', async () => {
  const t = convexTest(schema, modules);

  const {buyerId, tierId, ticketId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'no-cancel-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'no-cancel-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId, {cancellationPolicy: {allowed: false}});
    const tierId = await seedTier(ctx, eventId, {quantitySold: 1});
    const ticketId = await seedTicket(ctx, eventId, tierId, buyerId, {status: 'confirmed'});
    return {buyerId, tierId, ticketId};
  });

  const asBuyer = t.withIdentity({subject: buyerId});
  await expect(asBuyer.mutation(api.tickets.cancel, {ticketId})).rejects.toThrow(
    'This event does not allow cancellations',
  );

  await t.run(async ctx => {
    const ticket = await ctx.db.get(ticketId);
    expect(ticket?.status).toBe('confirmed');
    const tier = await ctx.db.get(tierId);
    expect(tier?.quantitySold).toBe(1);
  });
});

/**
 * Covers: tickets.cancel rejects once the cancellation cutoff has passed.
 * Business logic:
 * - When cutoffHours is set, cancellation closes at
 *   `eventStart - cutoffHours * 3_600_000`, where eventStart is
 *   event.date + startTime read as wall-clock local time in
 *   event.timezone and converted to a UTC instant — same convention as
 *   the event-end-time check on purchase.
 * - Seeded event uses the defaults startTime '18:00' and timezone
 *   'America/Toronto'; on 2024-06-01 that's EDT (UTC-4), so the real
 *   start is event.date + 22h UTC, and the 24h cutoff boundary is
 *   event.date - 2h.
 */
test('cancel rejects once the cancellation cutoff has passed', async () => {
  const t = convexTest(schema, modules);

  const eventDate = new Date('2024-06-01T00:00:00.000Z').getTime();

  const {buyerId, tierId, ticketId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'cutoff-passed-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'cutoff-passed-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId, {
      date: eventDate,
      cancellationPolicy: {allowed: true, cutoffHours: 24},
    });
    const tierId = await seedTier(ctx, eventId, {quantitySold: 1});
    const ticketId = await seedTicket(ctx, eventId, tierId, buyerId, {status: 'confirmed'});
    return {buyerId, tierId, ticketId};
  });

  vi.useFakeTimers();
  try {
    // 1h after the cutoff boundary (event.date - 2h) — inside the 24h cutoff window
    vi.setSystemTime(eventDate - 1 * 3_600_000);

    const asBuyer = t.withIdentity({subject: buyerId});
    await expect(asBuyer.mutation(api.tickets.cancel, {ticketId})).rejects.toThrow(
      'Cancellations close 24 hours before the event',
    );
  } finally {
    vi.useRealTimers();
  }

  await t.run(async ctx => {
    const ticket = await ctx.db.get(ticketId);
    expect(ticket?.status).toBe('confirmed');
    const tier = await ctx.db.get(tierId);
    expect(tier?.quantitySold).toBe(1);
  });
});

/**
 * Covers: tickets.cancel succeeds before the cancellation cutoff.
 * Business logic:
 * - Positive control for the cutoffHours boundary — proves it's a
 *   real window, not an always-blocking check.
 */
test('cancel succeeds before the cancellation cutoff', async () => {
  const t = convexTest(schema, modules);

  const eventDate = new Date('2024-06-01T00:00:00.000Z').getTime();

  const {buyerId, tierId, ticketId} = await t.run(async ctx => {
    const ownerId = await seedUser(ctx, {email: 'cutoff-open-owner@example.com'});
    const buyerId = await seedUser(ctx, {email: 'cutoff-open-buyer@example.com'});
    const eventId = await seedEvent(ctx, ownerId, {
      date: eventDate,
      cancellationPolicy: {allowed: true, cutoffHours: 24},
    });
    const tierId = await seedTier(ctx, eventId, {quantitySold: 1});
    const ticketId = await seedTicket(ctx, eventId, tierId, buyerId, {status: 'confirmed'});
    return {buyerId, tierId, ticketId};
  });

  vi.useFakeTimers();
  try {
    // 7 days before the event — well outside the 24h cutoff window
    vi.setSystemTime(eventDate - 7 * 24 * 3_600_000);

    const asBuyer = t.withIdentity({subject: buyerId});
    await asBuyer.mutation(api.tickets.cancel, {ticketId});
  } finally {
    vi.useRealTimers();
  }

  await t.run(async ctx => {
    const ticket = await ctx.db.get(ticketId);
    expect(ticket?.status).toBe('cancelled');
    const tier = await ctx.db.get(tierId);
    expect(tier?.quantitySold).toBe(0);
  });
});
