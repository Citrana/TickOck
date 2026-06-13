'use client';

import {useState} from 'react';
import {useQuery, useMutation} from 'convex/react';
import {api} from '@/convex/_generated/api';
import {type Id} from '@/convex/_generated/dataModel';
import {useTranslations} from 'next-intl';
import Image from 'next/image';
import EventStatusBadge from '@/components/events/EventStatusBadge';

export default function PendingEventsList() {
  const t = useTranslations('admin.events');
  const events = useQuery(api.events.listPendingApproval);
  const approve = useMutation(api.events.approve);
  const reject = useMutation(api.events.reject);

  const [rejectionInputs, setRejectionInputs] = useState<Record<string, string>>({});
  const [showRejectForm, setShowRejectForm] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const handleApprove = async (eventId: Id<'events'>) => {
    setProcessing(eventId);
    try {
      await approve({eventId});
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (eventId: Id<'events'>) => {
    const reason = rejectionInputs[eventId] ?? '';
    setProcessing(eventId);
    try {
      await reject({eventId, reason: reason.trim() || undefined});
      setShowRejectForm(null);
      setRejectionInputs(prev => {
        const next = {...prev};
        delete next[eventId];
        return next;
      });
    } finally {
      setProcessing(null);
    }
  };

  if (events === undefined) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-gray-400">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
        {t('loading')}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
        <p className="text-sm font-medium text-gray-500">{t('empty')}</p>
        <p className="mt-1 text-xs text-gray-400">{t('emptySubtitle')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {events.map(event => (
        <div
          key={event._id}
          className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
        >
          <div className="flex gap-5 p-5">
            {/* Cover image */}
            <div className="relative h-24 w-36 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100">
              {event.coverImageUrl ? (
                <Image
                  src={event.coverImageUrl}
                  alt={event.title}
                  fill
                  className="object-cover"
                  sizes="144px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-300">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Event info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900 leading-tight">{event.title}</h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {t('by')} {event.ownerName ?? event.ownerEmail ?? t('unknownOwner')}
                    {event.ownerEmail && event.ownerName && (
                      <span className="ml-1 text-gray-400">({event.ownerEmail})</span>
                    )}
                  </p>
                </div>
                <EventStatusBadge status={event.status} />
              </div>

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
                <span>
                  <span className="font-medium text-gray-700">{t('date')}:</span>{' '}
                  {new Date(event.date).toLocaleDateString()}
                </span>
                <span>
                  <span className="font-medium text-gray-700">{t('venue')}:</span>{' '}
                  {event.venue.name}, {event.venue.city}
                </span>
                <span>
                  <span className="font-medium text-gray-700">{t('tiers')}:</span>{' '}
                  {event.tierCount}
                </span>
                <span>
                  <span className="font-medium text-gray-700">{t('totalTickets')}:</span>{' '}
                  {event.totalTickets}
                </span>
              </div>

              {/* Fee evidence */}
              {event.feeEvidenceUrl && (
                <a
                  href={event.feeEvidenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:text-rose-700"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z" />
                  </svg>
                  {t('viewFeeEvidence')}
                </a>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
            {showRejectForm === event._id ? (
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    {t('rejectionReason')}
                  </label>
                  <input
                    type="text"
                    value={rejectionInputs[event._id] ?? ''}
                    onChange={e =>
                      setRejectionInputs(prev => ({...prev, [event._id]: e.target.value}))
                    }
                    placeholder={t('rejectionPlaceholder')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <button
                  onClick={() => handleReject(event._id)}
                  disabled={processing === event._id}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {processing === event._id ? t('processing') : t('confirmReject')}
                </button>
                <button
                  onClick={() => setShowRejectForm(null)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t('cancel')}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(event._id)}
                  disabled={processing === event._id}
                  className="btn-ticket inline-flex items-center gap-1.5 bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {processing === event._id ? t('processing') : t('approve')}
                </button>
                <button
                  onClick={() => setShowRejectForm(event._id)}
                  disabled={processing === event._id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  {t('reject')}
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
