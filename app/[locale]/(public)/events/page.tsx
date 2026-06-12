import {getTranslations} from 'next-intl/server';

export default async function EventsPage() {
  const t = await getTranslations('events');

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
      <div className="mt-6">
        <input
          type="search"
          placeholder={t('search')}
          className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <p className="mt-8 text-gray-500">{t('noEvents')}</p>
    </div>
  );
}
