import { getTranslations } from 'next-intl/server';

export default async function OfflinePage() {
  const t = await getTranslations('pwa');

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-6 text-6xl" aria-hidden="true">📶</div>
      <h1 className="text-2xl font-bold text-gray-900">{t('offlineTitle')}</h1>
      <p className="mt-3 max-w-sm text-sm text-gray-500">{t('offlineMessage')}</p>
    </div>
  );
}
