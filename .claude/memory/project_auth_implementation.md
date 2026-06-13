---
name: project-auth-implementation
description: Full auth flow implemented with @convex-dev/auth — Password provider, email verification tokens, session management, route protection
metadata:
  type: project
---

Auth flow fully implemented with `@convex-dev/auth` v0.0.94.

**Why:** Task requirement — replace TODO stubs with real Convex Auth.

**How to apply:** When working on auth, user management, or protected pages, rely on these patterns rather than reinventing them.

## Key files

- `convex/auth.ts` — Password provider; `createOrUpdateUser` creates user with `pending_verification`; `beforeSessionCreation` blocks `suspended`/`banned`
- `convex/emailVerification.ts` — `sendVerificationEmail` internalAction (Web Crypto, Resend optional via `RESEND_API_KEY`); `verify` public mutation
- `convex/users.ts` — `getCurrentUser` query (user + role join); `getUserById` internal query
- `convex/_helpers/permissions.ts` — uses `getAuthUserId(ctx)` from `@convex-dev/auth/server`; no longer uses `tokenIdentifier` index
- `hooks/useCurrentUser.ts` — single source of truth for auth state; returns `{ user, isAuthenticated, isLoading }`
- `components/providers/ConvexClientProvider.tsx` — `ConvexAuthNextjsProvider` client wrapper
- `components/auth/LoginForm.tsx` — `useAuthActions().signIn('password', { flow: 'signIn' })`
- `components/auth/RegisterForm.tsx` — `useAuthActions().signIn('password', { flow: 'signUp' })`
- `components/auth/AuthGuard.tsx` — signs out suspended/banned users on protected routes
- `app/[locale]/layout.tsx` — wraps with `ConvexAuthNextjsServerProvider` + `ConvexClientProvider`
- `app/[locale]/verify-email/page.tsx` — consumes verification token via `api.emailVerification.verify`
- `middleware.ts` — `convexAuthNextjsMiddleware` + `createIntlMiddleware` composition; protects all non-public routes

## Schema changes

- `users` table: removed `hashedPassword` and `tokenIdentifier`; added `statusReason?: string`
- Added `emailVerifications` table (token, userId, expiresAt)
- Added `authTables` from `@convex-dev/auth/server` (spread before users override)

## Email sending

Set `RESEND_API_KEY` in Convex deployment env to enable real emails. Without it, verification URLs are logged to the Convex dashboard console.

## Adding a second auth provider (e.g. Google OAuth)

Append to the `providers` array in `convex/auth.ts` — no other changes needed. [[project-tickock-init]]
