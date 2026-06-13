---
name: project-ticket-purchase-flow
description: Ticket purchase flow implementation — discovery, checkout, QR signing, my tickets
metadata:
  type: project
---

Implemented the full ticket purchase flow across Convex backend and Next.js frontend.

**Why:** Users needed to browse events, buy tickets, and view their orders with QR codes.

**How to apply:** All ticket/payment logic lives in convex/tickets.ts and convex/payments.ts. The QR helper is in convex/_helpers/qr.ts and must stay there (not inline). See [[project-event-creation]] for related context.

## Backend (Convex)

- `convex/_helpers/qr.ts` — `signTicketQr(ticketId, hmacSecret)` + `buildQrData()`. HMAC-SHA256 using Web Crypto API (V8 compatible). QR data format: `TOCK:{ticketId}:{hexSig}`.
- `convex/tickets.ts` — `purchase`, `submitPaymentProof`, `cancel`, `markUsed`, `listMine`, `listByEvent`.
- `convex/payments.ts` — `confirmPayment`, `rejectPayment`, `listByEvent`.
- `convex/events.ts` — `listLive` now accepts `{category?, city?, dateFrom?}` and returns enriched events (coverImageUrl, minPrice, tierCurrency, totalAvailable).

## Key decisions

- Free tickets (price=0) are confirmed immediately in `purchase`; no payment record created.
- One payment record per order (links to first ticket). Multi-ticket orders share same userId+eventId.
- `confirmPayment` activates all pending_payment tickets for that userId+eventId.
- `cancel` refunds inventory (decrements `quantitySold`) server-side with policy enforcement.
- `markUsed` requires `tickets:scan` permission scoped to the event.
- QR image rendered via `https://api.qrserver.com/v1/create-qr-code/` (added to next.config.mjs remotePatterns).

## Frontend

- `components/events/EventCard.tsx` — Event card for discovery grid.
- `components/events/EventsDiscovery.tsx` — Client filter bar (category/city/date) + event grid.
- `components/checkout/CheckoutForm.tsx` — Tier picker, quantity stepper, order summary, proof upload.
- `components/tickets/TicketCard.tsx` — Ticket status, collapsible QR code, cancel button.
- `components/tickets/MyTicketsList.tsx` — Grouped by event.
- Pages: `events/page.tsx`, `checkout/page.tsx`, `tickets/page.tsx` all updated.

## Translation keys added

`events.noEventsFiltered`, `events.clearFilters`, `events.filterCategory/City/Date`, `events.allCategories`, `events.free/soldOut/from/available`. Expanded `tickets.*` and `checkout.*` with full form labels, status strings, and error messages. All in both en.json and fr.json.
