'use client';

import {useState} from 'react';
import Image from 'next/image';
import {useMutation, useQuery} from 'convex/react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {Link} from '@/lib/navigation';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';
import {parseConvexError} from '@/lib/errors';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';

type TicketStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'used' | 'expired';

type TicketCardProps = {
  ticket: {
    _id: Id<'tickets'>;
    status: TicketStatus;
    createdAt: number;
    ticketNumber?: string | null;
    qrData: string | null;
    event: {
      _id: Id<'events'>;
      title: string;
      date: number;
      startTime: string;
      venue: {name: string; city: string};
      coverImageUrl: string | null;
      cancellationPolicy: {allowed: boolean; cutoffHours?: number};
    } | null;
    tier: {name: string; price: number; currency: string} | null;
    payment: {
      _id: Id<'payments'>;
      status: string;
      amount: number;
      currency: string;
      method: string;
      evidenceUrl: string | null;
      rejectionReason: string | null;
    } | null;
  };
};

const STATUS_STYLES: Record<TicketStatus, string> = {
  pending_payment: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
  used: 'bg-blue-100 text-blue-800',
  expired: 'bg-red-100 text-red-700',
};

export default function TicketCard({ticket}: TicketCardProps) {
  const t = useTranslations('tickets');
  const cancelMutation = useMutation(api.tickets.cancel);
  const generateUploadUrl = useMutation(api.events.generateUploadUrl);
  const resubmitProof = useMutation(api.payments.resubmitPaymentProof);
  const resubmitCash = useMutation(api.payments.resubmitAsCash);

  const [cancelling, setCancelling] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const [showResubmit, setShowResubmit] = useState(false);
  const [resubmitMethod, setResubmitMethod] = useState<'manual' | 'cash'>(
    ticket.payment?.method === 'cash' ? 'cash' : 'manual',
  );
  const [resubmitFile, setResubmitFile] = useState<File | null>(null);
  const [resubmitRef, setResubmitRef] = useState('');
  const [resubmitDestinationId, setResubmitDestinationId] = useState('');
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState('');
  const [resubmitDone, setResubmitDone] = useState(false);

  const event = ticket.event;
  const tier = ticket.tier;
  const payment = ticket.payment;

  const destinations = useQuery(
    api.eventPaymentDestinations.listActiveForCheckout,
    showResubmit && resubmitMethod === 'manual' && event ? {eventId: event._id} : 'skip',
  );

  const formattedDate = event
    ? new Date(event.date).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

  const canCancel =
    ticket.status !== 'cancelled' &&
    ticket.status !== 'used' &&
    ticket.status !== 'expired' &&
    event?.cancellationPolicy.allowed === true;

  async function handleCancel() {
    if (!confirm(t('cancelConfirm'))) return;
    setCancelling(true);
    try {
      await cancelMutation({ticketId: ticket._id});
      toast.success(t('cancelSuccess'));
    } catch (err: unknown) {
      toast.error(parseConvexError(err, t('cancelFailed')));
    } finally {
      setCancelling(false);
    }
  }

  async function handleResubmit() {
    if (!resubmitDestinationId) {
      setResubmitError(t('errors.destinationRequired'));
      return;
    }
    if (!resubmitRef.trim()) {
      setResubmitError(t('errors.referenceRequired'));
      return;
    }
    if (!resubmitFile) {
      setResubmitError(t('errors.proofRequired'));
      return;
    }
    if (!payment?._id) return;
    setResubmitError('');
    setResubmitting(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {'Content-Type': resubmitFile.type},
        body: resubmitFile,
      });
      if (!res.ok) throw new Error('Upload failed');
      const {storageId} = await res.json() as {storageId: Id<'_storage'>};
      await resubmitProof({
        paymentId: payment._id,
        storageId,
        referenceNumber: resubmitRef.trim(),
        paymentAccountId: resubmitDestinationId as Id<'eventPaymentDestinations'>,
      });
      setResubmitDone(true);
      setShowResubmit(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('reference number has already been used')) {
        setResubmitError(t('errors.referenceDuplicate'));
      } else {
        setResubmitError(t('resubmitError'));
      }
    } finally {
      setResubmitting(false);
    }
  }

  async function handleResubmitCash() {
    if (!payment?._id) return;
    setResubmitError('');
    setResubmitting(true);
    try {
      await resubmitCash({paymentId: payment._id});
      setResubmitDone(true);
      setShowResubmit(false);
    } catch {
      setResubmitError(t('resubmitError'));
    } finally {
      setResubmitting(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border bg-white ${
        ticket.status === 'cancelled' || ticket.status === 'expired'
          ? 'border-gray-100 opacity-60'
          : 'border-gray-200'
      }`}
    >
      <div className="flex items-start gap-4 p-4">
        {/* Cover image */}
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100">
          {event?.coverImageUrl ? (
            <Image
              src={event.coverImageUrl}
              alt={event.title ?? ''}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-2xl text-gray-300">
              🎟
            </div>
          )}
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              {event ? (
                <Link
                  href={`/events/${event._id}`}
                  className="font-semibold text-gray-900 hover:underline line-clamp-1"
                >
                  {event.title}
                </Link>
              ) : (
                <p className="font-semibold text-gray-900">—</p>
              )}
              <p className="mt-0.5 text-xs text-gray-500">
                {formattedDate}
                {event && ` · ${event.startTime} · ${event.venue.city}`}
              </p>
            </div>
            <span
              className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[ticket.status]}`}
            >
              {t(`status.${ticket.status}` as Parameters<typeof t>[0])}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {tier && (
              <span>
                {t('tier')}: <span className="font-medium text-gray-700">{tier.name}</span>
              </span>
            )}
            {tier && (
              <span>
                {t('price')}:{' '}
                <span className="font-medium text-gray-700">
                  {tier.price === 0 ? 'Free' : `${tier.price} ${tier.currency}`}
                </span>
              </span>
            )}
          </div>

          {/* Pending payment note */}
          {ticket.status === 'pending_payment' && payment?.method === 'manual' && payment.status === 'pending' && (
            <p className="mt-2 text-xs text-amber-700">
              {payment.evidenceUrl ? t('awaitingConfirmation') : t('uploadProofButton')}
            </p>
          )}
        </div>
      </div>

      {/* QR code section */}
      {ticket.status === 'confirmed' && ticket.qrData && (
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowQr(v => !v)}
              className="text-xs font-medium text-gray-600 hover:text-gray-900"
            >
              {showQr ? '▲' : '▼'} {t('qrCode')}
            </button>
            <a
              href={`/api/ticket/${ticket._id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-gray-500 underline underline-offset-2 hover:text-gray-900"
            >
              {t('downloadPdf')}
            </a>
          </div>
          {ticket.ticketNumber && (
            <p className="mt-1 font-mono text-sm font-bold tracking-wider text-gray-900">
              {ticket.ticketNumber}
            </p>
          )}
          {showQr && (
            <div className="mt-3 flex flex-col items-center gap-2">
              <Image
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ticket.qrData)}`}
                alt="Ticket QR code"
                width={200}
                height={200}
                className="rounded-lg"
                unoptimized
              />
              <p className="max-w-[200px] break-all text-center font-mono text-[10px] text-gray-400">
                {ticket._id}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Rejection banner */}
      {ticket.status === 'pending_payment' && payment?.status === 'rejected' && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-3">
          <p className="text-xs font-semibold text-red-700">{t('paymentRejected')}</p>
          {payment.rejectionReason && (
            <p className="mt-0.5 text-xs text-red-600">
              {t('paymentRejectedReason', {reason: payment.rejectionReason})}
            </p>
          )}
          {!resubmitDone && (
            <button
              onClick={() => setShowResubmit(v => !v)}
              className="mt-2 text-xs font-medium text-red-700 underline underline-offset-2"
            >
              {showResubmit ? t('hideResubmit') : t('resubmitPayment')}
            </button>
          )}
          {resubmitDone && (
            <p className="mt-2 text-xs font-medium text-green-700">{t('resubmitSuccess')}</p>
          )}
        </div>
      )}

      {/* Resubmit form */}
      {ticket.status === 'pending_payment' && payment?.status === 'rejected' && showResubmit && !resubmitDone && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-3">
          {/* Method picker */}
          <div>
            <p className="mb-2 text-xs font-medium text-gray-700">{t('resubmitMethodLabel')}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setResubmitMethod('manual')}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  resubmitMethod === 'manual'
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                {t('resubmitMethodBankTransfer')}
              </button>
              <button
                type="button"
                onClick={() => setResubmitMethod('cash')}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  resubmitMethod === 'cash'
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                {t('resubmitMethodCash')}
              </button>
            </div>
          </div>

          {/* Bank transfer fields */}
          {resubmitMethod === 'manual' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  {t('resubmitDestinationLabel')}
                </label>
                <Select
                  value={resubmitDestinationId}
                  onChange={e => setResubmitDestinationId(e.target.value)}
                  className="mt-1"
                >
                  <option value="">{t('resubmitDestinationPlaceholder')}</option>
                  {destinations?.map(d => (
                    <option key={d._id} value={d._id}>
                      {d.name} — {d.phone}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  {t('resubmitReferenceLabel')}
                </label>
                <input
                  type="text"
                  value={resubmitRef}
                  onChange={e => setResubmitRef(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  {t('resubmitProofLabel')}
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={e => setResubmitFile(e.target.files?.[0] ?? null)}
                  className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-800 hover:file:bg-gray-200"
                />
              </div>
            </>
          )}

          {/* Cash note */}
          {resubmitMethod === 'cash' && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {t('resubmitCashNote')}
            </p>
          )}

          {resubmitError && (
            <p className="text-xs text-red-600">{resubmitError}</p>
          )}
          <Button
            onClick={resubmitMethod === 'cash' ? handleResubmitCash : handleResubmit}
            disabled={
              resubmitting ||
              (resubmitMethod === 'manual' && (!resubmitFile || !resubmitDestinationId))
            }
            className="w-full"
          >
            {resubmitting ? t('resubmitting') : t('resubmitPayment')}
          </Button>
        </div>
      )}

      {/* Actions */}
      {canCancel && (
        <div className="border-t border-gray-100 px-4 py-3">
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
          >
            {cancelling ? '…' : t('cancelButton')}
          </button>
        </div>
      )}
    </div>
  );
}
