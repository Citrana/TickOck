'use client';

import {useQuery} from 'convex/react';
import {useTranslations} from 'next-intl';
import Image from 'next/image';
import {Link} from '@/lib/navigation';
import {api} from '@/convex/_generated/api';
import EventStatusBadge from './EventStatusBadge';

type Props = {
  /** When true only the first 3 events are shown (for account page summary). */
  limit?: number;
};

export default function MyEventsList({limit}: Props) {
  const t = useTranslations('myEvents');
  const events = useQuery(api.events.listMine);

  if (events === undefined) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  const displayed = limit ? events.slice(0, limit) : events;

  if (displayed.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
        <p className="text-sm text-gray-500">{t('empty')}</p>
        <Link
          href="/events/create"
          className="mt-4 inline-block rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
        >
          {t('createFirst')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayed.map(event => {
        const date = new Date(event.date).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });

        const canEdit = event.status === 'draft' || event.status === 'rejected';

        return (
          <div
            key={event._id}
            className="flex gap-4 overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            {/* Cover image */}
            <div className="relative h-20 w-28 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
              {event.coverImageUrl ? (
                <Image
                  src={event.coverImageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="112px"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-2xl text-gray-300">
                  🎟
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex min-w-0 flex-1 flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">{event.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {date} · {event.venue.city}
                  </p>
                </div>
                <EventStatusBadge status={event.status} />
              </div>

              {/* Rejection reason */}
              {event.status === 'rejected' && event.rejectionReason && (
                <p className="mt-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                  <span className="font-medium">{t('rejected')}: </span>
                  {event.rejectionReason}
                </p>
              )}

              {/* Actions */}
              <div className="mt-3 flex items-center gap-2">
                <Link
                  href={`/events/${event._id}`}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  {t('actions.view')}
                </Link>
                {canEdit && (
                  <Link
                    href={`/events/${event._id}/edit`}
                    className="btn-ticket rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-700"
                  >
                    {t('actions.edit')}
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {limit && events.length > limit && (
        <Link
          href="/events/my"
          className="block rounded-xl border border-dashed border-gray-300 py-3 text-center text-sm font-medium text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
        >
          {t('viewAll', {count: events.length})}
        </Link>
      )}
    </div>
  );
}
