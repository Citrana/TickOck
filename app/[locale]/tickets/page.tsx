import {getTranslations} from 'next-intl/server';

export default async function TicketsPage() {
  const t = await getTranslations('tickets');

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
      <p className="mt-8 text-gray-500">{t('noTickets')}</p>
    </div>
  );
}
