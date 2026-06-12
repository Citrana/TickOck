'use client';

import {useLocale} from 'next-intl';
import {usePathname, useRouter} from '@/lib/navigation';

export default function LanguageToggle() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const nextLocale = locale === 'en' ? 'fr' : 'en';
  const label = locale === 'en' ? 'FR' : 'EN';

  const toggle = () => {
    router.replace(pathname, {locale: nextLocale});
  };

  return (
    <button
      onClick={toggle}
      className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      aria-label={`Switch to ${nextLocale === 'en' ? 'English' : 'French'}`}
    >
      {label}
    </button>
  );
}
