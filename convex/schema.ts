import {defineSchema, defineTable} from 'convex/server';
import {v} from 'convex/values';
import {authTables} from '@convex-dev/auth/server';

export default defineSchema({
  ...authTables,

  // roles must be declared before users because users references it
  roles: defineTable({
    name: v.string(),
    permissionSlugs: v.array(v.string()),
    isSystem: v.boolean(),
  }).index('by_name', ['name']),

  // Override authTables.users with our app-level fields.
  // Convex Auth manages credentials in authAccounts; this table holds
  // business-level user state only.
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    status: v.union(
      v.literal('active'),
      v.literal('suspended'),
      v.literal('pending_verification'),
      v.literal('banned'),
    ),
    // Human-readable reason surfaced to the user when they are suspended or banned.
    statusReason: v.optional(v.string()),
    platformRoleId: v.optional(v.id('roles')),
    createdAt: v.number(),
  })
    .index('by_email', ['email'])
    .index('by_platformRoleId', ['platformRoleId']),

  events: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    venue: v.object({
      name: v.string(),
      address: v.string(),
      city: v.string(),
    }),
    date: v.number(),
    startTime: v.string(),
    endTime: v.optional(v.string()),
    timezone: v.string(),
    coverImageStorageId: v.optional(v.id('_storage')),
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
    status: v.union(
      v.literal('draft'),
      v.literal('pending_approval'),
      v.literal('live'),
      v.literal('rejected'),
    ),
    ownerId: v.id('users'),
    // Per-event HMAC secret for QR signing — never a global secret
    hmacSecret: v.string(),
    // Platform fee charged to the event creator
    platformFeeTotal: v.optional(v.number()),
    platformFeeCurrency: v.optional(v.string()),
    platformFeeEvidenceStorageId: v.optional(v.id('_storage')),
    rejectionReason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_ownerId', ['ownerId'])
    .index('by_visibility', ['visibility'])
    .index('by_date', ['date'])
    .index('by_status', ['status'])
    .index('by_status_and_visibility', ['status', 'visibility']),

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

  // Speakers / guests for an event — separate table to avoid unbounded array growth
  eventSpeakers: defineTable({
    eventId: v.id('events'),
    name: v.string(),
    speakerTitle: v.optional(v.string()),
    bio: v.optional(v.string()),
    photoStorageId: v.optional(v.id('_storage')),
    displayOrder: v.number(),
  }).index('by_eventId', ['eventId']),

  // Platform fee rules — multiple rules, first matching rule per tier wins
  platformPricingRules: defineTable({
    label: v.string(),
    isActive: v.boolean(),
    // Optional condition: ticket unit price range (both inclusive)
    ticketPriceMin: v.optional(v.number()),
    ticketPriceMax: v.optional(v.number()),
    // Optional condition: total event ticket count range
    totalTicketsMin: v.optional(v.number()),
    totalTicketsMax: v.optional(v.number()),
    // Fee applied when this rule matches
    feeType: v.union(v.literal('percentage'), v.literal('flat_per_ticket')),
    feeValue: v.number(),
    currency: v.string(),
    displayOrder: v.number(),
  }).index('by_isActive', ['isActive']),

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

  // Email verification tokens — one active token per user at a time
  emailVerifications: defineTable({
    userId: v.id('users'),
    token: v.string(), // 64-char hex (32 bytes random)
    expiresAt: v.number(), // unix ms, 24 hours from creation
  })
    .index('by_token', ['token'])
    .index('by_userId', ['userId']),
});
