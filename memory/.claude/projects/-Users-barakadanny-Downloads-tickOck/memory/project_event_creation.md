---
name: project-event-creation
description: Event creation and management feature — schema, Convex functions, multi-step form, platform fee flow
metadata:
  type: project
---

Event creation feature implemented on the `auth` branch.

**Why:** Full event lifecycle — creator pays platform fee → admin approves → event goes live.

**How to apply:** When working on event management, tickets, or admin approval flows, this is the foundation.

## Schema additions
- `events` table: added `status` (draft/pending_approval/live/rejected), `venue` is now an object `{name, address, city}`, `coverImageStorageId` (replaces coverImage string), `platformFeeTotal`, `platformFeeEvidenceStorageId`, `rejectionReason`
- New `eventSpeakers` table: per-event speakers/guests with photo storage
- New `platformPricing` table: admin-set fee per ticket (one active row at a time)

## Convex modules
- `convex/events.ts` — create, update, submitForApproval, approve, reject, get, listMine, listLive, listPendingApproval, generateUploadUrl
- `convex/platformPricing.ts` — getActive (public), upsert (admin, requires `platform:configure` permission)
- Permissions added: `events:approve`, `platform:configure`

## UI
- New UI primitives: Input, Textarea, Select, FormField in `/components/ui/`
- Event form: `components/events/CreateEventForm.tsx` (6-step, handles file uploads + draft/submit)
- Step components: `components/events/steps/Step{BasicInfo,Venue,Settings,Speakers,Tickets,Review}.tsx`
- Routes: `/events/create` and `/events/[id]/edit` (both require auth via `convexAuthNextjsToken`)
- Navbar now shows "Create event" link

## Platform fee flow
1. Admin calls `platformPricing.upsert` to set rate (e.g. $0.50/ticket)
2. Creator fills form → step 6 shows calculated fee = rate × total tickets
3. Creator uploads payment screenshot → `submitForApproval` sets status to `pending_approval`
4. Admin calls `events.approve` or `events.reject` to go live or send back
