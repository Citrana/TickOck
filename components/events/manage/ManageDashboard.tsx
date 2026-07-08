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
import CheckInPanel from './CheckInPanel';
import SeatingPanel from './SeatingPanel';

type Props = {eventId: Id<'events'>};

type Tab = 'overview' | 'payments' | 'attendees' | 'staff' | 'checkin' | 'seating';
const OWNER_TABS: Tab[] = ['overview', 'payments', 'attendees', 'staff', 'checkin', 'seating'];

export default function ManageDashboard({eventId}: Props) {
  const t = useTranslations('manage');
  const tEvent = useTranslations('eventDetail');
  const {user} = useCurrentUser();

  const event = useQuery(api.events.get, {eventId});
  const myAccess = useQuery(api.eventStaff.getMyAccess, {eventId});
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Loading skeleton
  if (event === undefined || user === null || myAccess === undefined) {
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

  const isOwner = user._id === event.ownerId;
  const perms = myAccess?.permissionSlugs ?? [];
  const hasAnyAccess = isOwner || myAccess !== null;

  if (!hasAnyAccess) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-500">{t('accessDenied')}</p>
        <Link href={`/events/${eventId}`} className="mt-4 inline-block text-sm text-gray-500 underline">
          {t('backToEvent')}
        </Link>
      </div>
    );
  }

  // Build tab list based on permissions
  const hasAll = isOwner || perms.includes('*');
  const visibleTabs = OWNER_TABS.filter(tab => {
    if (tab === 'seating') return event.seatMapEnabled === true && (hasAll || isOwner);
    if (hasAll) return true;
    if (tab === 'overview') return true;
    if (tab === 'payments') return perms.some(p => p.startsWith('payments:'));
    if (tab === 'attendees') return perms.includes('tickets:read') || perms.includes('tickets:scan');
    if (tab === 'checkin') return perms.includes('tickets:scan');
    if (tab === 'staff') return false; // owner-only
    return false;
  });

  const canEdit = isOwner && (event.status === 'draft' || event.status === 'rejected');
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
        <div className="-mb-px flex gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleTabs.map(tab => (
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
        {activeTab === 'overview' && <SalesOverview eventId={eventId} isOwner={isOwner} />}
        {activeTab === 'payments' && <PaymentsPanel eventId={eventId} />}
        {activeTab === 'attendees' && <AttendeesPanel eventId={eventId} />}
        {activeTab === 'staff' && <StaffPanel eventId={eventId} />}
        {activeTab === 'checkin' && <CheckInPanel eventId={eventId} />}
        {activeTab === 'seating' && <SeatingPanel eventId={eventId} />}
      </div>
    </div>
  );
}
