'use client';

import {useState} from 'react';
import {useQuery, useMutation} from 'convex/react';
import {useTranslations} from 'next-intl';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';

type Props = {eventId: Id<'events'>};

type FilterStatus = 'all' | 'pending' | 'confirmed' | 'rejected';

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-500',
};

export default function PaymentsPanel({eventId}: Props) {
  const t = useTranslations('manage.payments');
  const payments = useQuery(api.payments.listByEvent, {eventId});
  const confirmPayment = useMutation(api.payments.confirmPayment);
  const rejectPayment = useMutation(api.payments.rejectPayment);

  const [filter, setFilter] = useState<FilterStatus>('all');
  const [rejecting, setRejecting] = useState<Id<'payments'> | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState<Id<'payments'> | null>(null);
  const [error, setError] = useState('');

  if (payments === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({length: 3}).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  const filtered =
    filter === 'all' ? payments : payments.filter(p => p.status === filter);

  const FILTERS: {key: FilterStatus; label: string}[] = [
    {key: 'all', label: t('filterAll')},
    {key: 'pending', label: t('filterPending')},
    {key: 'confirmed', label: t('filterConfirmed')},
    {key: 'rejected', label: t('filterRejected')},
  ];

  async function handleConfirm(paymentId: Id<'payments'>) {
    setError('');
    setProcessing(paymentId);
    try {
      await confirmPayment({paymentId});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(paymentId: Id<'payments'>) {
    setError('');
    setProcessing(paymentId);
    try {
      await rejectPayment({paymentId, reason: rejectReason || undefined});
      setRejecting(null);
      setRejectReason('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
              filter === f.key
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
            {f.key !== 'all' && (
              <span className="ml-1.5 text-[10px] opacity-70">
                {payments.filter(p => p.status === f.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          {filter === 'all' ? t('empty') : t('emptyFiltered')}
        </p>
      ) : (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {filtered.map(payment => {
            const isProcessing = processing === payment._id;
            const isRejectingThis = rejecting === payment._id;

            return (
              <div key={payment._id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* Buyer + amount */}
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                      {payment.userName || payment.userEmail}
                    </p>
                    {payment.userName && (
                      <p className="text-xs text-gray-400">{payment.userEmail}</p>
                    )}
                    <p className="mt-1 text-sm font-medium text-gray-700">
                      {payment.amount} {payment.currency}
                      <span className="ml-2 font-normal text-gray-400">
                        ({payment.method === 'manual' ? t('methodManual') : t('methodOnline')})
                      </span>
                    </p>
                  </div>

                  {/* Status + proof + actions */}
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[payment.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {t(`status${payment.status.charAt(0).toUpperCase()}${payment.status.slice(1)}` as Parameters<typeof t>[0])}
                    </span>

                    {payment.evidenceUrl && (
                      <a
                        href={payment.evidenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        {t('viewProof')}
                      </a>
                    )}
                  </div>
                </div>

                {/* Inline actions for pending */}
                {payment.status === 'pending' && !isRejectingThis && (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => handleConfirm(payment._id)}
                      disabled={isProcessing}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {isProcessing ? t('processing') : t('confirm')}
                    </button>
                    <button
                      onClick={() => setRejecting(payment._id)}
                      disabled={isProcessing}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {t('reject')}
                    </button>
                  </div>
                )}

                {/* Reject reason form */}
                {isRejectingThis && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      placeholder={t('rejectReasonPlaceholder')}
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
                    />
                    <button
                      onClick={() => handleReject(payment._id)}
                      disabled={isProcessing}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {isProcessing ? t('processing') : t('rejectTitle')}
                    </button>
                    <button
                      onClick={() => {
                        setRejecting(null);
                        setRejectReason('');
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
