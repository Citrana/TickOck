// Auth is handled entirely by @convex-dev/auth.
//
// Client-side auth actions (signIn, signOut): useAuthActions() from '@convex-dev/auth/react'
// Authenticated user + role:                  useCurrentUser() from '@/hooks/useCurrentUser'
// Server-side user ID in Convex functions:    getAuthUserId(ctx) from '@convex-dev/auth/server'
//
// This file is kept as a navigation aid — do not add business logic here.

export type {CurrentUser} from '@/hooks/useCurrentUser';
