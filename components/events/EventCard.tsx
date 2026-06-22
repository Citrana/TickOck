'use client';

import Image from 'next/image';
import {useTranslations} from 'next-intl';
import {Link} from '@/lib/navigation';
import {Id} from '@/convex/_generated/dataModel';

type EventCardProps = {
  event: {
    _id: Id<'events'>;
    title: string;
    date: number;
    startTime?: string;
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

  const formattedDate = new Date(event.date).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Link href={`/events/${event._id}`} className="group block">
      {/* Cover image */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gray-100">
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
      </div>

      {/* Card body */}
      <div className="mt-4">
        <p className="text-lg font-bold leading-snug text-gray-900">
          {event.title}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          {event.venue.name}, {event.venue.city}
        </p>
        <p className="text-sm text-gray-500">
          {formattedDate}{event.startTime ? ` ${event.startTime}` : ''}
        </p>
        <span className="mt-3 inline-block border-b border-gray-900 pb-0.5 text-sm font-bold text-gray-900">
          {t('seeEvent')}
        </span>
      </div>
    </Link>
  );
}
