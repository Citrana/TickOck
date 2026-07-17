import {MutationCtx} from '../_generated/server';
import {Id} from '../_generated/dataModel';
import {Doc} from '../_generated/dataModel';

export async function seedUser(
  ctx: MutationCtx,
  overrides?: Partial<Omit<Doc<'users'>, '_id' | '_creationTime'>>,
): Promise<Id<'users'>> {
  return ctx.db.insert('users', {
    email: `user-${Math.random().toString(36).slice(2)}@example.com`,
    status: 'active',
    createdAt: Date.now(),
    ...overrides,
  });
}

export async function seedEvent(
  ctx: MutationCtx,
  ownerId: Id<'users'>,
  overrides?: Partial<Omit<Doc<'events'>, '_id' | '_creationTime' | 'ownerId'>>,
): Promise<Id<'events'>> {
  return ctx.db.insert('events', {
    title: 'Test Conference',
    venue: {name: 'Main Hall', address: '1 Main St', city: 'Montreal'},
    date: Date.now() + 1000 * 60 * 60 * 24,
    startTime: '18:00',
    timezone: 'America/Toronto',
    visibility: 'public',
    paymentMode: 'manual',
    cancellationPolicy: {allowed: false},
    status: 'live',
    ownerId,
    hmacSecret: 'test-secret',
    createdAt: Date.now(),
    ...overrides,
  });
}

export async function seedTier(
  ctx: MutationCtx,
  eventId: Id<'events'>,
  overrides?: Partial<Omit<Doc<'ticketTiers'>, '_id' | '_creationTime' | 'eventId'>>,
): Promise<Id<'ticketTiers'>> {
  return ctx.db.insert('ticketTiers', {
    eventId,
    name: 'General Admission',
    price: 50,
    currency: 'USD',
    quantity: 10,
    quantitySold: 0,
    ...overrides,
  });
}
