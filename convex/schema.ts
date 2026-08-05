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

  // Platform-wide on/off switches for functionality (e.g. venue layout
  // design). A key with no row here defaults to enabled — see
  // _helpers/featureFlags.ts::isFeatureEnabled.
  featureFlags: defineTable({
    key: v.string(),
    enabled: v.boolean(),
    updatedBy: v.id('users'),
    updatedAt: v.number(),
  }).index('by_key', ['key']),

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
    // Venue layout / seating add-on
    seatMapEnabled: v.optional(v.boolean()),
    venueLayoutSnapshotId: v.optional(v.id('venueLayoutTemplates')),
    venueLayoutFeeTotal: v.optional(v.number()),
    venueLayoutFeeCurrency: v.optional(v.string()),
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
    // Color shown on the seat-map canvas — only set when the event uses a
    // venue layout, since non-seat-map tiers have no visual representation.
    color: v.optional(v.string()),
    // Bridge to the seat/GA category (a venueLayoutTiers row) this tier is
    // mapped to, when the event uses a venue layout. Price/quantity remain
    // authoritative here — venueLayoutTiers is just a named color category.
    venueLayoutTierId: v.optional(v.id('venueLayoutTiers')),
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
    ticketNumber: v.optional(v.string()),
    qrSignature: v.optional(v.string()),
    scannedBy: v.optional(v.id('users')),
    scannedAt: v.optional(v.number()),
    // Set only for tickets purchased against a specific seat on a venue layout.
    seatId: v.optional(v.id('venueLayoutSeats')),
    createdAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_eventId', ['eventId'])
    .index('by_tierId', ['tierId'])
    .index('by_eventId_and_userId', ['eventId', 'userId'])
    .index('by_ticketNumber', ['ticketNumber'])
    .index('by_seatId', ['seatId']),

  payments: defineTable({
    ticketId: v.id('tickets'),
    eventId: v.id('events'),
    userId: v.id('users'),
    amount: v.number(),
    currency: v.string(),
    method: v.union(v.literal('online'), v.literal('manual'), v.literal('cash')),
    status: v.union(
      v.literal('pending'),
      v.literal('confirmed'),
      v.literal('rejected'),
      v.literal('refunded'),
    ),
    evidenceUrl: v.optional(v.string()),
    referenceNumber: v.optional(v.string()),
    // Which of the event's manual payment destinations the buyer claims to
    // have paid — set when they submit (or resubmit) proof.
    paymentAccountId: v.optional(v.id('eventPaymentDestinations')),
    confirmedBy: v.optional(v.id('users')),
    confirmedAt: v.optional(v.number()),
    rejectedBy: v.optional(v.id('users')),
    rejectedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
  })
    .index('by_ticketId', ['ticketId'])
    .index('by_userId', ['userId'])
    .index('by_eventId', ['eventId'])
    .index('by_status', ['status'])
    .index('by_referenceNumber_and_eventId', ['referenceNumber', 'eventId']),

  eventStaff: defineTable({
    eventId: v.id('events'),
    userId: v.id('users'),
    permissionSlugs: v.array(v.string()),
    isActive: v.optional(v.boolean()),
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

  // Named manual-payment destinations for an event (e.g. mobile money
  // numbers) — buyers pick one when submitting payment proof. Never hard
  // deleted, only soft-deactivated, so past payments keep a valid reference.
  eventPaymentDestinations: defineTable({
    eventId: v.id('events'),
    name: v.string(),
    phone: v.string(),
    note: v.optional(v.string()),
    isActive: v.boolean(),
    displayOrder: v.number(),
    createdAt: v.number(),
  }).index('by_eventId', ['eventId']),

  // Pricing rules — multiple rules, first matching rule per tier wins.
  // feeCategory distinguishes the platform fee from the venue-layout add-on
  // fee; each category's rules are ordered/matched independently via
  // displayOrder. Optional (not required) so pre-existing rows created
  // before this field existed still validate — treat a missing value as
  // 'platform' everywhere this is read.
  platformPricingRules: defineTable({
    label: v.string(),
    isActive: v.boolean(),
    feeCategory: v.optional(v.union(v.literal('platform'), v.literal('venue_layout'))),
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

  pushSubscriptions: defineTable({
    userId: v.id('users'),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_endpoint', ['endpoint']),

  // Email verification tokens — one active token per user at a time
  emailVerifications: defineTable({
    userId: v.id('users'),
    token: v.string(), // 64-char hex (32 bytes random)
    expiresAt: v.number(), // unix ms, 24 hours from creation
  })
    .index('by_token', ['token'])
    .index('by_userId', ['userId']),

  // ---------------------------------------------------------------------
  // Venue layout / seat map (paid add-on)
  // ---------------------------------------------------------------------

  // A reusable venue layout template OR, when isSnapshot is true, an
  // immutable copy attached to exactly one event (never edited afterward).
  venueLayoutTemplates: defineTable({
    ownerId: v.id('users'),
    name: v.string(),
    description: v.optional(v.string()),
    backgroundImageStorageId: v.optional(v.id('_storage')),
    canvasWidth: v.number(),
    canvasHeight: v.number(),
    status: v.union(v.literal('draft'), v.literal('published')),
    isSnapshot: v.boolean(),
    snapshotOfTemplateId: v.optional(v.id('venueLayoutTemplates')),
    snapshotEventId: v.optional(v.id('events')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_ownerId', ['ownerId'])
    .index('by_snapshotEventId', ['snapshotEventId']),

  venueLayoutSections: defineTable({
    layoutId: v.id('venueLayoutTemplates'),
    name: v.string(),
    kind: v.union(v.literal('seated'), v.literal('ga')),
    // Free-form generator hint ('grid'|'curve'|'round-table'|'ga-zone'),
    // used only to re-open a section for editing — not authoritative.
    shape: v.optional(v.string()),
    x: v.number(),
    y: v.number(),
    rotation: v.optional(v.number()),
    gaCapacity: v.optional(v.number()),
    // Only used for kind:'ga' sections — a GA zone still has one price/tier,
    // it just isn't broken into individual seat rows. Seated sections price
    // per-seat instead, via venueLayoutSeats.tierId.
    tierId: v.optional(v.id('venueLayoutTiers')),
    displayOrder: v.number(),
  }).index('by_layoutId', ['layoutId']),

  // A named color category within a layout (e.g. "VIP" red, "General" blue).
  // Price lives on ticketTiers, linked via ticketTiers.venueLayoutTierId, so
  // the same layout shape can be reused across events at different prices
  // each time. price/currency are kept optional (rather than removed) only
  // so pre-existing rows from the old auto-derived-pricing flow still
  // validate against the schema — Convex rejects a schema push if any
  // stored document has a field the new schema doesn't declare, so dropping
  // these entirely would require migrating/deleting old rows first. New
  // code never reads or writes them.
  venueLayoutTiers: defineTable({
    layoutId: v.id('venueLayoutTemplates'),
    name: v.string(),
    color: v.string(),
    price: v.optional(v.number()),
    currency: v.optional(v.string()),
    displayOrder: v.number(),
  }).index('by_layoutId', ['layoutId']),

  // Individual seat/chair/table-seat. Kept in its own table (never an array
  // on venueLayoutTemplates) since a layout can have hundreds/thousands of
  // seats and Convex documents must stay small and cheap to rewrite.
  venueLayoutSeats: defineTable({
    layoutId: v.id('venueLayoutTemplates'),
    sectionId: v.id('venueLayoutSections'),
    tierId: v.optional(v.id('venueLayoutTiers')),
    rowLabel: v.optional(v.string()),
    seatLabel: v.string(),
    tableLabel: v.optional(v.string()),
    x: v.number(),
    y: v.number(),
    displayOrder: v.number(),
  })
    .index('by_layoutId', ['layoutId'])
    .index('by_sectionId', ['sectionId']),

  // Structural floor-plan elements (walls, doors, windows, parking, amenity
  // markers, colored zones) — kept in their own table, separate from seats/
  // sections, since they never carry inventory/pricing and must stay
  // editable on a live event's layout regardless of seat sales.
  venueLayoutElements: defineTable({
    layoutId: v.id('venueLayoutTemplates'),
    kind: v.union(
      v.literal('wall'),
      v.literal('door'),
      v.literal('window'),
      v.literal('parking'),
      v.literal('amenity'),
      v.literal('zone'),
      v.literal('stage'),
    ),
    // Wall: a line segment (x,y)-(x2,y2) — represents straight *and* angled
    // walls without needing a rotation transform.
    x: v.number(),
    y: v.number(),
    x2: v.optional(v.number()),
    y2: v.optional(v.number()),
    // Rect-based kinds (door, window, parking, zone, rectangle/circle stage):
    // box + rotation, set via the canvas's rotate handle.
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    rotation: v.optional(v.number()),
    // Stage only: which geometry variant it uses. Chosen once at creation —
    // never changed afterward, since switching would mean synthesizing or
    // discarding incompatible geometry (organizers delete and re-add instead).
    shape: v.optional(v.union(v.literal('rectangle'), v.literal('circle'), v.literal('polygon'))),
    // Polygon stage only: absolute canvas coordinates for each vertex,
    // individually draggable to reshape the outline.
    points: v.optional(v.array(v.object({x: v.number(), y: v.number()}))),
    doorType: v.optional(
      v.union(v.literal('main'), v.literal('emergency'), v.literal('staff')),
    ),
    amenityType: v.optional(
      v.union(
        v.literal('toilet'),
        v.literal('bar'),
        v.literal('first_aid'),
        v.literal('info'),
        v.literal('coat_check'),
        v.literal('smoking_area'),
        v.literal('atm'),
        v.literal('charging_station'),
        v.literal('wheelchair_access'),
        v.literal('lost_found'),
        v.literal('parking'),
      ),
    ),
    capacity: v.optional(v.number()), // parking only
    label: v.optional(v.string()),
    color: v.optional(v.string()),
    displayOrder: v.number(),
  })
    .index('by_layoutId', ['layoutId'])
    .index('by_layoutId_and_kind', ['layoutId', 'kind']),

  // Temporary per-seat reservations during checkout. Kept separate from
  // venueLayoutSeats because holds are high-churn and would otherwise
  // contend with canvas-rendering reads of seat positions.
  seatHolds: defineTable({
    eventId: v.id('events'),
    seatId: v.id('venueLayoutSeats'),
    userId: v.id('users'),
    status: v.union(
      v.literal('held'),
      v.literal('purchased'),
      v.literal('released'),
    ),
    expiresAt: v.number(),
    ticketId: v.optional(v.id('tickets')),
    createdAt: v.number(),
  })
    .index('by_seatId', ['seatId'])
    .index('by_eventId_and_status', ['eventId', 'status'])
    .index('by_userId', ['userId'])
    .index('by_status_and_expiresAt', ['status', 'expiresAt']),
});
