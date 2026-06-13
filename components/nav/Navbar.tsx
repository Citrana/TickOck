import {getTranslations} from 'next-intl/server';
import {Link} from '@/lib/navigation';
import LanguageToggle from './LanguageToggle';

export default async function Navbar() {
  const t = await getTranslations('nav');

  return (
    <header>
      {/* Announcement bar */}
      <div className="bg-gray-900 px-4 py-2.5 text-center text-sm text-white">
        <span className="mr-1">{t('announcementText')}</span>
        <Link
          href="#demo"
          className="font-medium underline underline-offset-2 hover:text-gray-300"
        >
          {t('announcementCta')} →
        </Link>
      </div>

      {/* Main nav */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="text-xl font-extrabold text-gray-900">
            TickOck
          </Link>

          {/* Center nav links */}
          <nav className="hidden items-center gap-7 md:flex">
            <Link
              href="/events"
              className="text-sm text-gray-600 transition-colors hover:text-gray-900"
            >
              {t('events')}
            </Link>
            <Link
              href="#how"
              className="text-sm text-gray-600 transition-colors hover:text-gray-900"
            >
              {t('howItWorks')}
            </Link>
            <Link
              href="#pricing"
              className="text-sm text-gray-600 transition-colors hover:text-gray-900"
            >
              {t('pricing')}
            </Link>
            <Link
              href="/events/create"
              className="text-sm font-medium text-rose-600 transition-colors hover:text-rose-800"
            >
              {t('createEvent')}
            </Link>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/tickets"
              className="hidden text-sm text-gray-600 transition-colors hover:text-gray-900 lg:block"
            >
              {t('findTickets')}
            </Link>
            <Link
              href="/login"
              className="text-sm text-gray-600 transition-colors hover:text-gray-900"
            >
              {t('login')}
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-gray-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              {t('register')}
            </Link>
            <LanguageToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
