'use client';

import {useState} from 'react';
import Image from 'next/image';
import {useQuery, useMutation} from 'convex/react';
import {useTranslations} from 'next-intl';
import {Link} from '@/lib/navigation';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';
import Button from '@/components/ui/Button';
import PaymentProofSection, {OrderResult} from './PaymentProofSection';
import SeatMapCheckout from './SeatMapCheckout';

type Props = {eventId: string | undefined};

export default function CheckoutForm({eventId}: Props) {
  const t = useTranslations('checkout');
  const event = useQuery(
    api.events.get,
    eventId ? {eventId: eventId as Id<'events'>} : 'skip',
  );

  const purchase = useMutation(api.tickets.purchase);

  const [selectedTierId, setSelectedTierId] = useState<Id<'ticketTiers'> | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Payment method choice (for manual payment events)
  const [paymentMethodChoice, setPaymentMethodChoice] = useState<'manual' | 'cash'>('manual');

  // Post-order state
  const [order, setOrder] = useState<OrderResult | null>(null);

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

  if (event.seatMapEnabled && event.venueLayoutSnapshotId) {
    return <SeatMapCheckout event={event} />;
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

  // ── Success state ─────────────────────────────────────────────────────────
  if (order) {
    return (
      <PaymentProofSection
        order={order}
        isFree={isFree}
        isManual={isManual}
        paymentMethodChoice={paymentMethodChoice}
        totalPrice={totalPrice}
        currency={selectedTier?.currency ?? ''}
      />
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
