'use client';

import {useQuery} from 'convex/react';
import {useTranslations} from 'next-intl';
import {Link} from '@/lib/navigation';
import {api} from '@/convex/_generated/api';
import TicketCard from './TicketCard';

export default function MyTicketsList() {
  const t = useTranslations('tickets');
  const tickets = useQuery(api.tickets.listMine, {});

  if (tickets === undefined) {
    return (
      <div className="mt-8 space-y-4">
        {Array.from({length: 3}).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="mt-16 text-center">
        <p className="text-4xl">🎟</p>
        <p className="mt-4 text-gray-500">{t('noTickets')}</p>
        <Link
          href="/events"
          className="mt-6 inline-block rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700"
        >
          {t('browseEvents')}
        </Link>
      </div>
    );
  }

  // Group tickets by event
  const grouped = new Map<string, typeof tickets>();
  for (const ticket of tickets) {
    const key = ticket.event?._id ?? 'unknown';
    const group = grouped.get(key) ?? [];
    group.push(ticket);
    grouped.set(key, group);
  }

  return (
    <div className="mt-8 space-y-10">
      {Array.from(grouped.values()).map(group => {
        const event = group[0].event;
        const eventTitle = event?.title ?? '—';

        return (
          <section key={event?._id ?? 'unknown'}>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-base font-bold text-gray-900 line-clamp-1">
                {eventTitle}
              </h2>
              <span className="ml-3 flex-shrink-0 text-xs text-gray-400">
                {group.length} ticket{group.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-3">
              {group.map(ticket => (
                <TicketCard key={ticket._id} ticket={ticket} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
