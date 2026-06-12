import {getTranslations} from 'next-intl/server';
import {Link} from '@/lib/navigation';
import LanguageToggle from './LanguageToggle';

export default async function Navbar() {
  const t = await getTranslations('nav');

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="text-xl font-bold text-blue-600">
          TickOck
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="/events"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            {t('events')}
          </Link>
          <Link
            href="/tickets"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            {t('tickets')}
          </Link>
          <Link
            href="/account"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            {t('account')}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            {t('login')}
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t('register')}
          </Link>
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}
