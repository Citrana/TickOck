import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from '@convex-dev/auth/nextjs/server';
import {NextResponse} from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

const handleI18n = createIntlMiddleware(routing);

// Routes accessible without authentication.
const isPublicRoute = createRouteMatcher([
  '/:locale/login',
  '/:locale/register',
  '/:locale/verify-email',
  '/:locale/events',
  '/:locale/events/(.*)',
  '/:locale/(public)(.*)',
  '/:locale',
  '/',
  '/api/auth(.*)',
]);

export default convexAuthNextjsMiddleware(async (request, {convexAuth}) => {
  const isAuthenticated = await convexAuth.isAuthenticated();

  if (!isPublicRoute(request) && !isAuthenticated) {
    // Extract locale from the current URL to keep the redirect locale-aware.
    const locale =
      (request.nextUrl.pathname.split('/')[1] ?? '') || routing.defaultLocale;
    return nextjsMiddlewareRedirect(request, `/${locale}/login`);
  }

  // API routes must not receive a locale redirect — pass through unchanged.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Let next-intl handle locale detection, prefixing, and cookie management.
  return handleI18n(request);
});

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
