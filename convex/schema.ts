import {defineSchema, defineTable} from 'convex/server';
import {v} from 'convex/values';

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
  }).index('by_email', ['email']),

  roles: defineTable({
    userId: v.id('users'),
    role: v.string(),
  }).index('by_user', ['userId']),

  events: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    date: v.number(),
    location: v.string(),
    organizerId: v.id('users'),
    // Per-event HMAC secret for QR signing — never a global secret
    hmacSecret: v.string(),
  }),

  eventStaff: defineTable({
    eventId: v.id('events'),
    userId: v.id('users'),
    permissions: v.array(v.string()),
  })
    .index('by_event', ['eventId'])
    .index('by_user', ['userId']),

  tickets: defineTable({
    eventId: v.id('events'),
    userId: v.id('users'),
    status: v.union(
      v.literal('active'),
      v.literal('pending'),
      v.literal('cancelled'),
    ),
    paymentProofStorageId: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_event', ['eventId']),

  // Append-only — no update or delete mutations allowed
  auditLog: defineTable({
    userId: v.id('users'),
    action: v.string(),
    resource: v.string(),
    resourceId: v.optional(v.string()),
    timestamp: v.number(),
  }),
});
