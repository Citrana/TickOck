import {defineSchema, defineTable} from 'convex/server';
import {v} from 'convex/values';

export default defineSchema({
  // roles must be declared before users because users references it
  roles: defineTable({
    name: v.string(),
    permissionSlugs: v.array(v.string()),
    isSystem: v.boolean(),
  }).index('by_name', ['name']),

  users: defineTable({
    email: v.string(),
    hashedPassword: v.string(),
    name: v.optional(v.string()),
    status: v.union(
      v.literal('active'),
      v.literal('suspended'),
      v.literal('pending_verification'),
      v.literal('banned'),
    ),
    platformRoleId: v.optional(v.id('roles')),
    // Stable identifier from the JWT provider, used to look up the user on each request.
    tokenIdentifier: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_email', ['email'])
    .index('by_tokenIdentifier', ['tokenIdentifier'])
    .index('by_platformRoleId', ['platformRoleId']),

  events: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    venue: v.string(),
    date: v.number(),
    startTime: v.string(),
    endTime: v.optional(v.string()),
    timezone: v.string(),
    coverImage: v.optional(v.string()),
    visibility: v.union(
      v.literal('public'),
      v.literal('private'),
      v.literal('unlisted'),
    ),
    paymentMode: v.union(v.literal('online'), v.literal('manual')),
    cancellationPolicy: v.object({
      allowed: v.boolean(),
      cutoffHours: v.optional(v.number()),
    }),
    ownerId: v.id('users'),
    // Per-event HMAC secret for QR signing — never a global secret
    hmacSecret: v.string(),
    createdAt: v.number(),
  })
    .index('by_ownerId', ['ownerId'])
    .index('by_visibility', ['visibility'])
    .index('by_date', ['date']),

  ticketTiers: defineTable({
    eventId: v.id('events'),
    name: v.string(),
    price: v.number(),
    currency: v.string(),
    quantity: v.number(),
    quantitySold: v.number(),
    description: v.optional(v.string()),
  }).index('by_eventId', ['eventId']),

  tickets: defineTable({
    eventId: v.id('events'),
    tierId: v.id('ticketTiers'),
    userId: v.id('users'),
    status: v.union(
      v.literal('pending_payment'),
      v.literal('confirmed'),
      v.literal('cancelled'),
      v.literal('used'),
      v.literal('expired'),
    ),
    qrSignature: v.optional(v.string()),
    scannedBy: v.optional(v.id('users')),
    scannedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_eventId', ['eventId'])
    .index('by_tierId', ['tierId'])
    .index('by_eventId_and_userId', ['eventId', 'userId']),

  payments: defineTable({
    ticketId: v.id('tickets'),
    eventId: v.id('events'),
    userId: v.id('users'),
    amount: v.number(),
    currency: v.string(),
    method: v.union(v.literal('online'), v.literal('manual')),
    status: v.union(
      v.literal('pending'),
      v.literal('confirmed'),
      v.literal('rejected'),
      v.literal('refunded'),
    ),
    evidenceUrl: v.optional(v.string()),
    confirmedBy: v.optional(v.id('users')),
    confirmedAt: v.optional(v.number()),
  })
    .index('by_ticketId', ['ticketId'])
    .index('by_userId', ['userId'])
    .index('by_eventId', ['eventId'])
    .index('by_status', ['status']),

  eventStaff: defineTable({
    eventId: v.id('events'),
    userId: v.id('users'),
    permissionSlugs: v.array(v.string()),
  })
    .index('by_eventId', ['eventId'])
    .index('by_userId', ['userId'])
    .index('by_eventId_and_userId', ['eventId', 'userId']),

  // Append-only — no update or delete mutations, ever
  auditLogs: defineTable({
    actorId: v.id('users'),
    actorRole: v.optional(v.string()),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    // JSON-serialised flexible metadata — avoids v.any() while keeping the field open
    metadata: v.optional(v.string()),
    ip: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_actorId', ['actorId'])
    .index('by_targetType_and_targetId', ['targetType', 'targetId'])
    .index('by_createdAt', ['createdAt']),
});
