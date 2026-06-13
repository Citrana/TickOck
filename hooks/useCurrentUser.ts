'use client';

import {useQuery} from 'convex/react';
import {useConvexAuth} from '@convex-dev/auth/react';
import {api} from '@/convex/_generated/api';
import {type Doc} from '@/convex/_generated/dataModel';

export type CurrentUser = Doc<'users'> & {
  role: Doc<'roles'> | null;
};

/**
 * Single source of truth for auth state across the entire app.
 *
 * Returns the authenticated user with their platform role, or null when
 * unauthenticated. isLoading is true while the session is being established.
 */
export function useCurrentUser(): {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
} {
  const {isAuthenticated, isLoading: authLoading} = useConvexAuth();

  // Skip the query when we know the user isn't authenticated yet to avoid
  // a flash of "unauthenticated" state while the session resolves.
  const result = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : 'skip',
  );

  return {
    user: result ?? null,
    isAuthenticated,
    isLoading: authLoading || (isAuthenticated && result === undefined),
  };
}
