# TickOck

Bilingual (EN/FR) event ticketing platform.
Stack: Next.js 14 App Router · Convex · Tailwind · next-intl · npm

## Commands
- Dev: `npm run dev`
- Type check: `npm run typecheck`
- Lint: `npm run lint`
- Convex dev: `npx convex dev`

## Hard rules
- Never use `any` in TypeScript. Use proper types or `unknown`.
- Never write raw SQL or direct DB calls — all data goes through Convex functions.
- Every Convex mutation MUST call `_helpers/permissions.ts` before any DB write.
- AuditLog table is append-only — no update or delete mutations, ever.
- Never store a global HMAC secret — QR signing uses a per-event secret.
- Ticket PDF is generated on-demand via API route, never stored.
- All user-facing strings go in `/messages/en.json` and `/messages/fr.json` — no hardcoded UI text.

## Architecture decisions
- App Router only — no Pages Router patterns.
- Convex handles all backend logic — no standalone Express or separate API server.
- RBAC has two levels: platform roles (Convex `roles` table) and event-scoped staff (`eventStaff` table).
- Cancellation rules are enforced server-side in Convex, not client-side.
- Manual payment flow: screenshot upload → `pending` → owner confirms → ticket activates.

## Conventions
- Components are in `/components/{domain}/` — never dump into a flat `/components/` root.
- Shared primitives (buttons, inputs) live in `/components/ui/` only.
- Permission slugs follow `resource:action` format — e.g. `tickets:cancel`, `events:edit`.
- New features get their own Convex file — don't extend existing files beyond their domain.
- Every `test()` gets a JSDoc header comment directly above it: what it covers, plus a bulleted summary of the business rules the code under test enforces — so future changes have an immediate reference point without re-reading the implementation.

## Before writing code
- Scan the codebase first — check `/components/ui/`, `/lib/`, and `convex/_helpers/` for anything reusable before creating something new.
- If a new component or function is similar to an existing one, extend it — don't duplicate it.
- If something will be used in more than one place, make it reusable from the start.
- Tables, modals, forms, and data-fetching patterns must use the shared primitives in `/components/ui/`.

## Never do
- Don't install a new package without asking first.
- Don't create API routes that duplicate what a Convex function already does.
- Don't use `localStorage` for auth state — Convex Auth handles sessions.
- Don't add `console.log` to committed code.
- Don't create a new utility function if one already exists in `/lib/` that does the same thing.
- Don't build a one-off component for something that already exists or will clearly be reused.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
