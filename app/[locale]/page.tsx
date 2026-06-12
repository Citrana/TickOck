import {getTranslations} from 'next-intl/server';
import {Link} from '@/lib/navigation';

export default async function HomePage() {
  const t = await getTranslations('events');

  return (
    <div className="py-12 text-center">
      <h1 className="text-4xl font-bold text-gray-900">TickOck</h1>
      <p className="mt-4 text-lg text-gray-600">{t('title')}</p>
      <Link
        href="/events"
        className="mt-8 inline-block rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
      >
        {t('title')}
      </Link>
    </div>
  );
}
