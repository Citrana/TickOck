'use client';

import {useEffect} from 'react';
import {useAuthActions} from '@convex-dev/auth/react';
import {useTranslations} from 'next-intl';
import {usePathname} from '@/lib/navigation';
import {useCurrentUser} from '@/hooks/useCurrentUser';
import {useRouter} from '@/lib/navigation';

// Routes that are always accessible — the guard never redirects away from these.
const PUBLIC_PATHS = ['/login', '/register', '/verify-email', '/events'];

function isPublicPath(pathname: string): boolean {
  const strippedLocale = pathname.replace(/^\/(en|fr)/, '') || '/';
  return (
    strippedLocale === '/' ||
    PUBLIC_PATHS.some(
      p => strippedLocale === p || strippedLocale.startsWith(p + '/'),
    )
  );
}

/**
 * Placed in the root layout so it runs on every page.
 *
 * - Suspended or banned users are signed out and redirected to login with an
 *   appropriate error message surfaced via the URL.
 * - Pending-verification users can navigate freely; the status is surfaced
 *   through useCurrentUser() in individual pages/components.
 * - Unauthenticated users on protected routes are redirected by the middleware
 *   before they reach this component; this is a client-side safety net.
 */
export function AuthGuard() {
  const {user, isLoading} = useCurrentUser();
  const {signOut} = useAuthActions();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (isLoading || !user) return;
    if (isPublicPath(pathname)) return;

    if (user.status === 'suspended' || user.status === 'banned') {
      void signOut().then(() => {
        router.replace('/login');
      });
    }
  }, [user, isLoading, pathname, signOut, router]);

  // Render nothing — this component is purely a side-effect guard.
  // The suspended/banned UI is shown on the login page via URL params.
  return null;
}

/**
 * Banner shown inside protected pages when the user's email is unverified.
 * Import and render this wherever appropriate (e.g. account page).
 */
export function PendingVerificationBanner() {
  const {user} = useCurrentUser();
  const t = useTranslations('auth.pendingVerification');

  if (!user || user.status !== 'pending_verification') return null;

  return (
    <div className="rounded-md bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
      <strong>{t('title')}</strong>{' '}
      {t('description', {email: user.email})}
    </div>
  );
}
