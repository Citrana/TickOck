import {getTranslations} from 'next-intl/server';
import EventsDiscovery from '@/components/events/EventsDiscovery';

export default async function EventsPage() {
  const t = await getTranslations('events');

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
      <EventsDiscovery />
    </div>
  );
}
