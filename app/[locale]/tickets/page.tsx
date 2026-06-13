import {getTranslations} from 'next-intl/server';
import MyTicketsList from '@/components/tickets/MyTicketsList';

export default async function TicketsPage() {
  const t = await getTranslations('tickets');

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
      <MyTicketsList />
    </div>
  );
}
