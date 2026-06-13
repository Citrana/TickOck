'use client';

import {useState} from 'react';
import {useQuery} from 'convex/react';
import {useTranslations} from 'next-intl';
import {Link} from '@/lib/navigation';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';
import {useCurrentUser} from '@/hooks/useCurrentUser';
import EventStatusBadge from '@/components/events/EventStatusBadge';
import SalesOverview from './SalesOverview';
import PaymentsPanel from './PaymentsPanel';
import AttendeesPanel from './AttendeesPanel';
import StaffPanel from './StaffPanel';

type Props = {eventId: Id<'events'>};

type Tab = 'overview' | 'payments' | 'attendees' | 'staff';
const TABS: Tab[] = ['overview', 'payments', 'attendees', 'staff'];

export default function ManageDashboard({eventId}: Props) {
  const t = useTranslations('manage');
  const tEvent = useTranslations('eventDetail');
  const {user} = useCurrentUser();

  const event = useQuery(api.events.get, {eventId});
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Loading skeleton
  if (event === undefined || user === null) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-1/2 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-48 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-500">{tEvent('notFound')}</p>
        <Link href="/events/my" className="mt-4 inline-block text-sm text-gray-500 underline">
          {t('backToEvent')}
        </Link>
      </div>
    );
  }

  // Only the event owner or event staff may access the dashboard
  const isOwner = user._id === event.ownerId;
  if (!isOwner) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-500">{t('accessDenied')}</p>
        <Link href={`/events/${eventId}`} className="mt-4 inline-block text-sm text-gray-500 underline">
          {t('backToEvent')}
        </Link>
      </div>
    );
  }

  const canEdit = event.status === 'draft' || event.status === 'rejected';
  const formattedDate = new Date(event.date).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/events/${eventId}`}
          className="text-xs font-medium text-gray-400 hover:text-gray-700"
        >
          {t('backToEvent')}
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold text-gray-900">{event.title}</h1>
              <EventStatusBadge status={event.status} />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {formattedDate} · {event.venue.name}, {event.venue.city}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/events/${eventId}`}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tEvent('browseEvents')}
            </Link>
            {canEdit && (
              <Link
                href={`/events/${eventId}/edit`}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              >
                {tEvent('editButton')}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <div className="-mb-px flex gap-0.5 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-gray-900 text-gray-900'
                  : 'border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {t(`tabs.${tab}` as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>
      </div>

      {/* Panel */}
      <div>
        {activeTab === 'overview' && <SalesOverview eventId={eventId} />}
        {activeTab === 'payments' && <PaymentsPanel eventId={eventId} />}
        {activeTab === 'attendees' && <AttendeesPanel eventId={eventId} />}
        {activeTab === 'staff' && <StaffPanel eventId={eventId} />}
      </div>
    </div>
  );
}
