'use client';

import Image from 'next/image';
import {useQuery} from 'convex/react';
import {useTranslations} from 'next-intl';
import {Link} from '@/lib/navigation';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';
import {useCurrentUser} from '@/hooks/useCurrentUser';
import {useHasEventEnded} from '@/hooks/useHasEventEnded';
import EventStatusBadge from './EventStatusBadge';

type Props = {eventId: Id<'events'>};

export default function EventDetail({eventId}: Props) {
  const t = useTranslations('eventDetail');
  const event = useQuery(api.events.get, {eventId});
  const {user} = useCurrentUser();
  const hasEventEnded = useHasEventEnded(event);

  if (event === undefined) {
    return (
      <div className="space-y-4">
        <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
        <div className="h-8 w-2/3 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-4 w-1/3 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (event === null) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-semibold text-gray-900">{t('notFound')}</p>
        <p className="mt-2 text-sm text-gray-500">{t('notFoundDetail')}</p>
        <Link
          href="/events"
          className="mt-6 inline-block rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700"
        >
          {t('browseEvents')}
        </Link>
      </div>
    );
  }

  const isOwner = user?._id === event.ownerId;
  const canEdit = isOwner && (event.status === 'draft' || event.status === 'rejected');

  const formattedDate = new Date(event.date).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const totalTickets = event.tiers.reduce((s, t) => s + t.quantity, 0);
  const ticketsSold = event.tiers.reduce((s, t) => s + t.quantitySold, 0);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Cover image */}
      <div className="relative h-48 w-full overflow-hidden rounded-2xl bg-gray-100 sm:h-64">
        {event.coverImageUrl ? (
          <Image
            src={event.coverImageUrl}
            alt={event.title}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl text-gray-300">
            🎟
          </div>
        )}
      </div>

      {/* Header */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
              {event.title}
            </h1>
            {isOwner && <EventStatusBadge status={event.status} />}
          </div>
          {event.category && (
            <span className="mt-1 inline-block rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
              {event.category}
            </span>
          )}
          {!isOwner && event.status === 'live' && (
            <Link
              href={`/checkout?event=${event._id}`}
              className="btn-ticket mt-3 inline-block rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
            >
              {t('buyButton')}
            </Link>
          )}
        </div>

        {/* Owner actions */}
        {isOwner && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/events/${event._id}/manage`}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              {t('manageButton')}
            </Link>
            {canEdit && (
              <Link
                href={`/events/${event._id}/edit`}
                className="btn-ticket rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
              >
                {t('editButton')}
              </Link>
            )}
            {event.status === 'pending_approval' && (
              <span className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-700">
                {t('pendingReview')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Rejection reason */}
      {isOwner && event.status === 'rejected' && event.rejectionReason && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">{t('rejectedTitle')}</p>
          <p className="mt-1 text-sm text-red-700">{event.rejectionReason}</p>
          <Link
            href={`/events/${event._id}/edit`}
            className="mt-3 inline-block text-sm font-medium text-red-700 underline underline-offset-2 hover:text-red-900"
          >
            {t('fixAndResubmit')}
          </Link>
        </div>
      )}

      {/* Details grid */}
      <div className="mt-6 grid gap-4 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-2">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-medium text-gray-500">{t('date')}</dt>
            <dd className="mt-0.5 text-gray-900">{formattedDate}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">{t('time')}</dt>
            <dd className="mt-0.5 text-gray-900">
              {event.startTime}
              {event.endTime && ` – ${event.endTime}`}
              <span className="ml-1 text-gray-400">({event.timezone})</span>
            </dd>
          </div>
        </dl>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-medium text-gray-500">{t('venue')}</dt>
            <dd className="mt-0.5 text-gray-900">
              {event.venue.name}
              <br />
              <span className="text-gray-500">{event.venue.address}, {event.venue.city}</span>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">{t('visibility')}</dt>
            <dd className="mt-0.5 capitalize text-gray-900">{event.visibility}</dd>
          </div>
        </dl>
      </div>

      {/* Description */}
      {event.description && (
        <div className="mt-6">
          <h2 className="text-lg font-bold text-gray-900">{t('about')}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
            {event.description}
          </p>
        </div>
      )}

      {/* Ticket tiers */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{t('tickets')}</h2>
          {isOwner && (
            <p className="text-xs text-gray-500">
              {ticketsSold} / {totalTickets} {t('sold')}
            </p>
          )}
        </div>
        <div className="mt-3 space-y-3">
          {event.tiers.map(tier => (
            <div
              key={tier._id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
            >
              <div>
                <p className="font-semibold text-gray-900">{tier.name}</p>
                {tier.description && (
                  <p className="mt-0.5 text-xs text-gray-500">{tier.description}</p>
                )}
                {isOwner && (
                  <p className="mt-0.5 text-xs text-gray-400">
                    {tier.quantitySold} / {tier.quantity} {t('sold')}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900">
                  {tier.price === 0 ? t('free') : `${tier.price} ${tier.currency}`}
                </p>
                {!isOwner && event.status === 'live' && !hasEventEnded && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {tier.quantity - tier.quantitySold} {t('remaining')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Buy button for attendees */}
        {!isOwner && event.status === 'live' && !hasEventEnded && (
          <Link
            href={`/checkout?event=${event._id}`}
            className="btn-ticket mt-4 block rounded-xl bg-gray-900 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-gray-700"
          >
            {t('buyButton')}
          </Link>
        )}
      </div>

      {/* Speakers */}
      {event.speakers.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-900">{t('speakers')}</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {event.speakers.map(speaker => (
              <div
                key={speaker._id}
                className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-gray-100">
                  {speaker.photoUrl ? (
                    <Image
                      src={speaker.photoUrl}
                      alt={speaker.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xl text-gray-300">
                      👤
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{speaker.name}</p>
                  {speaker.speakerTitle && (
                    <p className="text-xs text-gray-500">{speaker.speakerTitle}</p>
                  )}
                  {speaker.bio && (
                    <p className="mt-1 text-xs leading-relaxed text-gray-600">{speaker.bio}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
