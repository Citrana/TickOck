import {getTranslations} from 'next-intl/server';

export default async function AccountPage() {
  const t = await getTranslations('dashboard');

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
      <p className="mt-2 text-gray-600">{t('welcome')}</p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-800">
          {t('recentOrders')}
        </h2>
        <div className="mt-2 rounded-md border border-gray-200 p-4 text-sm text-gray-500">
          —
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-gray-800">
          {t('upcomingEvents')}
        </h2>
        <div className="mt-2 rounded-md border border-gray-200 p-4 text-sm text-gray-500">
          —
        </div>
      </section>
    </div>
  );
}
