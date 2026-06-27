'use client';

import {useState} from 'react';
import Image from 'next/image';
import {useQuery, useMutation} from 'convex/react';
import {useTranslations} from 'next-intl';
import {Link} from '@/lib/navigation';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';
import Button from '@/components/ui/Button';

type Props = {eventId: string | undefined};

type OrderResult = {
  ticketIds: Id<'tickets'>[];
  paymentId: Id<'payments'> | null;
};

export default function CheckoutForm({eventId}: Props) {
  const t = useTranslations('checkout');
  const event = useQuery(
    api.events.get,
    eventId ? {eventId: eventId as Id<'events'>} : 'skip',
  );

  const purchase = useMutation(api.tickets.purchase);
  const submitProof = useMutation(api.tickets.submitPaymentProof);
  const generateUploadUrl = useMutation(api.events.generateUploadUrl);

  const [selectedTierId, setSelectedTierId] = useState<Id<'ticketTiers'> | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Payment method choice (for manual payment events)
  const [paymentMethodChoice, setPaymentMethodChoice] = useState<'manual' | 'cash'>('manual');

  // Post-order state
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofSubmitted, setProofSubmitted] = useState(false);
  const [proofError, setProofError] = useState('');

  // Loading skeleton
  if (event === undefined) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-2/3 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-48 animate-pulse rounded-2xl bg-gray-100" />
        <div className="h-32 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  if (!eventId || event === null) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-semibold text-gray-900">{t('eventNotFound')}</p>
        <Link
          href="/events"
          className="mt-6 inline-block text-sm font-medium text-gray-600 underline underline-offset-2"
        >
          ← Browse events
        </Link>
      </div>
    );
  }

  if (event.status !== 'live') {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-semibold text-gray-900">{t('eventNotLive')}</p>
        <Link href="/events" className="mt-6 inline-block text-sm font-medium text-gray-600 underline underline-offset-2">
          ← Browse events
        </Link>
      </div>
    );
  }

  if (event.tiers.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-500">{t('noTiersAvailable')}</p>
      </div>
    );
  }

  const selectedTier = event.tiers.find(t => t._id === selectedTierId) ?? null;
  const totalPrice = selectedTier ? selectedTier.price * quantity : 0;
  const isFree = selectedTier?.price === 0;
  const isManual = event.paymentMode === 'manual';

  const formattedDate = new Date(event.date).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  async function handlePlaceOrder() {
    if (!selectedTierId) {
      setError(t('errors.tierRequired'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const result = await purchase({
        eventId: event!._id,
        tierId: selectedTierId,
        quantity,
        ...(isManual && !isFree ? {paymentMethod: paymentMethodChoice} : {}),
      });
      setOrder(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProofUpload() {
    if (!referenceNumber.trim()) {
      setProofError(t('errors.referenceRequired'));
      return;
    }
    if (!proofFile) {
      setProofError(t('errors.proofRequired'));
      return;
    }
    if (!order?.paymentId) return;
    setProofError('');
    setUploadingProof(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {'Content-Type': proofFile.type},
        body: proofFile,
      });
      if (!res.ok) throw new Error('Upload failed');
      const {storageId} = await res.json() as {storageId: Id<'_storage'>};
      await submitProof({paymentId: order.paymentId, storageId, referenceNumber: referenceNumber.trim()});
      setProofSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('reference number has already been used')) {
        setProofError(t('errors.referenceDuplicate'));
      } else {
        setProofError(t('errors.proofFailed'));
      }
    } finally {
      setUploadingProof(false);
    }
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (order) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">
            ✓
          </div>
          <h2 className="text-xl font-bold text-green-900">{t('orderPlaced')}</h2>
          <p className="mt-1 text-sm text-green-700">{t('orderPlacedMessage')}</p>
        </div>

        {/* Cash payment confirmation */}
        {!isFree && isManual && paymentMethodChoice === 'cash' && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-medium text-amber-800">{t('cashPaymentMessage')}</p>
          </div>
        )}

        {/* Manual bank-transfer proof upload */}
        {!isFree && isManual && paymentMethodChoice === 'manual' && !proofSubmitted && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="font-semibold text-gray-900">{t('paymentInstructions')}</h3>
            <p className="mt-2 text-sm text-gray-600">{t('manualNextStep')}</p>
            {selectedTier && (
              <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {t('transferInstruction', {
                  amount: totalPrice,
                  currency: selectedTier.currency,
                })}
              </p>
            )}
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('referenceLabel')}
                  <span className="ml-1 text-xs font-normal text-gray-400">{t('referenceHint')}</span>
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={e => setReferenceNumber(e.target.value)}
                  placeholder={t('referencePlaceholder')}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>
              <label className="block text-sm font-medium text-gray-700">
                {t('proofLabel')}
                <span className="ml-1 text-xs font-normal text-gray-400">{t('proofHint')}</span>
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={e => setProofFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-800 hover:file:bg-gray-200"
              />
              {proofError && (
                <p className="text-xs text-red-600">{proofError}</p>
              )}
              {proofFile && (
                <p className="text-xs text-gray-500">
                  Selected: {proofFile.name}
                </p>
              )}
              <Button
                onClick={handleProofUpload}
                disabled={uploadingProof || !proofFile}
                className="w-full"
              >
                {uploadingProof ? t('uploadingProof') : t('submitProof')}
              </Button>
            </div>
          </div>
        )}

        {/* Proof submitted */}
        {proofSubmitted && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
            {t('proofUploaded')}
          </div>
        )}

        {/* Free ticket confirmation */}
        {isFree && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
            {t('freeOrderMessage')}
          </div>
        )}

        <Link
          href="/tickets"
          className="block w-full rounded-xl bg-gray-900 py-3 text-center text-sm font-semibold text-white hover:bg-gray-700"
        >
          {t('viewTickets')}
        </Link>
      </div>
    );
  }

  // ── Order form ────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Event header */}
      <div className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-4">
        {event.coverImageUrl && (
          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl">
            <Image
              src={event.coverImageUrl}
              alt={event.title}
              fill
              className="object-cover"
            />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 leading-snug">{event.title}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {formattedDate} · {event.venue.name}, {event.venue.city}
          </p>
        </div>
      </div>

      {/* Tier selection */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold text-gray-900">{t('selectTier')}</h2>
        <div className="mt-3 space-y-2">
          {event.tiers.map(tier => {
            const available = tier.quantity - tier.quantitySold;
            const isSelected = selectedTierId === tier._id;
            const isSoldOut = available === 0;

            return (
              <button
                key={tier._id}
                type="button"
                disabled={isSoldOut}
                onClick={() => {
                  setSelectedTierId(tier._id);
                  setError('');
                }}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : isSoldOut
                      ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                      : 'border-gray-200 bg-white text-gray-900 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{tier.name}</p>
                    {tier.description && (
                      <p className={`mt-0.5 text-xs ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                        {tier.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">
                      {tier.price === 0
                        ? t('free')
                        : `${tier.price} ${tier.currency}`}
                    </p>
                    {!isSoldOut ? (
                      <p className={`text-xs ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                        {available} {t('remaining')}
                      </p>
                    ) : (
                      <p className="text-xs text-red-500">{t('soldOut')}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quantity */}
      {selectedTier && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-900">{t('quantityLabel')}</h2>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-lg leading-none hover:bg-gray-50"
            >
              −
            </button>
            <span className="w-10 text-center text-lg font-semibold text-gray-900">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() =>
                setQuantity(q =>
                  Math.min(10, q + 1, selectedTier.quantity - selectedTier.quantitySold),
                )
              }
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-lg leading-none hover:bg-gray-50"
            >
              +
            </button>
            <span className="text-sm text-gray-400">
              {selectedTier.price > 0 && `${selectedTier.price} ${selectedTier.currency} ${t('perTicket')}`}
            </span>
          </div>
        </div>
      )}

      {/* Order summary */}
      {selectedTier && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-900">{t('orderSummary')}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <dt>
                {selectedTier.name} × {quantity}
              </dt>
              <dd>
                {totalPrice === 0
                  ? t('free')
                  : `${totalPrice} ${selectedTier.currency}`}
              </dd>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2 font-semibold text-gray-900">
              <dt>{t('total')}</dt>
              <dd>
                {totalPrice === 0
                  ? t('free')
                  : `${totalPrice} ${selectedTier.currency}`}
              </dd>
            </div>
          </dl>

          {/* Manual payment method choice + note */}
          {isManual && !isFree && (
            <>
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-gray-700">{t('paymentMethodLabel')}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethodChoice('manual')}
                    className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                      paymentMethodChoice === 'manual'
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {t('methodBankTransfer')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethodChoice('cash')}
                    className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                      paymentMethodChoice === 'cash'
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {t('methodCash')}
                  </button>
                </div>
              </div>
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {t('manualPaymentNote')}
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <Button
        onClick={handlePlaceOrder}
        disabled={!selectedTierId || submitting}
        className="w-full py-3 text-base"
      >
        {submitting ? t('submitting') : t('confirmOrder')}
      </Button>
    </div>
  );
}
