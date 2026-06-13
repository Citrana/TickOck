'use client';

import Image from 'next/image';
import {useTranslations} from 'next-intl';
import {Link} from '@/lib/navigation';
import {Id} from '@/convex/_generated/dataModel';

type EventCardProps = {
  event: {
    _id: Id<'events'>;
    title: string;
    category?: string;
    date: number;
    venue: {name: string; city: string};
    coverImageUrl: string | null;
    minPrice: number | null;
    tierCurrency: string | null;
    totalAvailable: number;
    tierCount: number;
  };
};

export default function EventCard({event}: EventCardProps) {
  const t = useTranslations('events');
  const tCategories = useTranslations('eventCreate.basicInfo');

  const formattedDate = new Date(event.date).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const isSoldOut = event.totalAvailable === 0 && event.tierCount > 0;

  return (
    <Link
      href={`/events/${event._id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
    >
      {/* Cover image */}
      <div className="relative h-44 w-full overflow-hidden bg-gray-100">
        {event.coverImageUrl ? (
          <Image
            src={event.coverImageUrl}
            alt={event.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl text-gray-200">
            🎟
          </div>
        )}
        {event.category && (
          <span className="absolute left-3 top-3 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
            {tCategories(`categories.${event.category}` as Parameters<typeof tCategories>[0])}
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="line-clamp-2 font-semibold leading-snug text-gray-900">
          {event.title}
        </p>
        <p className="text-xs text-gray-500">
          {formattedDate} · {event.venue.city}
        </p>

        <div className="mt-auto flex items-center justify-between pt-3">
          {isSoldOut ? (
            <span className="text-sm font-medium text-red-600">{t('soldOut')}</span>
          ) : event.minPrice === null || event.tierCount === 0 ? null : event.minPrice === 0 ? (
            <span className="text-sm font-semibold text-green-700">{t('free')}</span>
          ) : (
            <span className="text-sm font-semibold text-gray-900">
              {t('from')} {event.minPrice} {event.tierCurrency}
            </span>
          )}
          {!isSoldOut && event.totalAvailable > 0 && (
            <span className="text-xs text-gray-400">
              {event.totalAvailable} {t('available')}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
