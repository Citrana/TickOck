'use client';

import {ConvexAuthNextjsProvider} from '@convex-dev/auth/nextjs';
import {ConvexReactClient} from 'convex/react';
import {type ReactNode} from 'react';

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Client-side Convex provider. Wrap the server layout with this to give
 * all child components access to Convex queries, mutations, and auth state.
 *
 * Rendered inside ConvexAuthNextjsServerProvider (in the locale layout) so
 * that server components can read the auth token from cookies.
 */
export function ConvexClientProvider({children}: {children: ReactNode}) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
