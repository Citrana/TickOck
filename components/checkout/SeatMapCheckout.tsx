'use client';

import {useEffect, useMemo, useState} from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import {useQuery, useMutation} from 'convex/react';
import {useTranslations} from 'next-intl';
import {api} from '@/convex/_generated/api';
import {Doc, Id} from '@/convex/_generated/dataModel';
import Button from '@/components/ui/Button';
import {parseConvexError} from '@/lib/errors';
import {EVENT_ENDED_ERROR} from '@/lib/eventTiming';
import {useHasEventEnded} from '@/hooks/useHasEventEnded';
import PaymentProofSection, {OrderResult} from './PaymentProofSection';
import {SeatStatus} from '@/components/venue/types';

const LayoutCanvas = dynamic(() => import('@/components/venue/canvas/LayoutCanvas'), {ssr: false});

type EventWithTiers = Doc<'events'> & {
  coverImageUrl: string | null;
  tiers: Doc<'ticketTiers'>[];
};

type Props = {event: EventWithTiers};

export default function SeatMapCheckout({event}: Props) {
  const t = useTranslations('checkout');
  const tSeat = useTranslations('venueLayout.checkout');

  const hasEventEnded = useHasEventEnded(event);

  const snapshot = useQuery(api.venueLayout.getSnapshotForEvent, {eventId: event._id});
  const availability = useQuery(api.seatHolds.getAvailability, {eventId: event._id});
  const holdSeats = useMutation(api.seatHolds.holdSeats);
  const releaseSeats = useMutation(api.seatHolds.releaseSeats);
  const purchaseSeats = useMutation(api.tickets.purchaseSeats);
  const purchase = useMutation(api.tickets.purchase);

  const isManual = event.paymentMode === 'manual';
  const [paymentMethodChoice, setPaymentMethodChoice] = useState<'manual' | 'cash'>('manual');
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [orderTotal, setOrderTotal] = useState({price: 0, currency: '', isFree: false});

  const [selectedSeatIds, setSelectedSeatIds] = useState<Set<Id<'venueLayoutSeats'>>>(new Set());
  const [holdIds, setHoldIds] = useState<Id<'seatHolds'>[] | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [gaQuantities, setGaQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const tierById = useMemo(
    () => new Map((snapshot?.tiers ?? []).map(tier => [tier._id, tier])),
    [snapshot],
  );
  const ticketTierByVenueLayoutTierId = useMemo(
    () => new Map(event.tiers.filter(t => t.venueLayoutTierId).map(t => [t.venueLayoutTierId!, t])),
    [event.tiers],
  );

  const seatById = useMemo(
    () => new Map((snapshot?.seats ?? []).map(seat => [seat._id, seat])),
    [snapshot],
  );

  const gaSections = useMemo(
    () => (snapshot?.sections ?? []).filter(s => s.kind === 'ga'),
    [snapshot],
  );

  if (snapshot === undefined || availability === undefined) {
    return <div className="h-96 animate-pulse rounded-2xl bg-gray-100" />;
  }
  if (snapshot === null) {
    return <p className="py-20 text-center text-gray-500">{t('noTiersAvailable')}</p>;
  }

  if (order) {
    return (
      <PaymentProofSection
        order={order}
        isFree={orderTotal.isFree}
        isManual={isManual}
        paymentMethodChoice={paymentMethodChoice}
        totalPrice={orderTotal.price}
        currency={orderTotal.currency}
        manualPaymentInstructions={event.manualPaymentInstructions}
      />
    );
  }

  if (hasEventEnded) {
    return <p className="py-20 text-center text-gray-500">{t('eventEnded')}</p>;
  }

  const seatAvailability: Record<string, SeatStatus> = {...(availability as Record<string, SeatStatus>)};

  function toggleSeat(seatId: Id<'venueLayoutSeats'>) {
    if (holdIds) return; // seats already held — must confirm or start over
    setError('');
    if (!selectedSeatIds.has(seatId)) {
      const seat = seatById.get(seatId);
      const tier = seat?.tierId ? ticketTierByVenueLayoutTierId.get(seat.tierId) : undefined;
      if (!tier) {
        setError(tSeat('seatPricingMissing'));
        return;
      }
    }
    setSelectedSeatIds(prev => {
      const next = new Set(prev);
      if (next.has(seatId)) next.delete(seatId);
      else next.add(seatId);
      return next;
    });
  }

  const selectedSeats = Array.from(selectedSeatIds)
    .map(id => seatById.get(id))
    .filter((s): s is Doc<'venueLayoutSeats'> => !!s);
  // Price always comes from the real ticketTiers (via the venueLayoutTierId
  // bridge) — venueLayoutTiers (tierById) is category/color only.
  const selectedTotal = selectedSeats.reduce((sum, seat) => {
    const tier = seat.tierId ? ticketTierByVenueLayoutTierId.get(seat.tierId) : undefined;
    return sum + (tier?.price ?? 0);
  }, 0);
  const selectedCurrency = selectedSeats[0]?.tierId
    ? ticketTierByVenueLayoutTierId.get(selectedSeats[0].tierId!)?.currency ?? ''
    : '';

  async function handleHoldSeats() {
    setError('');
    setSubmitting(true);
    try {
      const result = await holdSeats({eventId: event._id, seatIds: Array.from(selectedSeatIds)});
      setHoldIds(result.holdIds);
      setExpiresAt(result.expiresAt);
    } catch (err) {
      const parsed = parseConvexError(err, tSeat('genericError'));
      setError(parsed === EVENT_ENDED_ERROR ? t('errors.eventEnded') : parsed);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelHold() {
    if (holdIds) await releaseSeats({holdIds});
    setHoldIds(null);
    setExpiresAt(null);
    setSelectedSeatIds(new Set());
  }

  async function handleConfirmSeats() {
    if (!holdIds) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await purchaseSeats({
        eventId: event._id,
        holdIds,
        ...(isManual && selectedTotal > 0 ? {paymentMethod: paymentMethodChoice} : {}),
      });
      setOrderTotal({price: selectedTotal, currency: selectedCurrency, isFree: selectedTotal === 0});
      setOrder(result);
    } catch (err) {
      const parsed = parseConvexError(err, tSeat('genericError'));
      setError(parsed === EVENT_ENDED_ERROR ? t('errors.eventEnded') : parsed);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBuyGa(sectionId: Id<'venueLayoutSections'>) {
    const section = gaSections.find(s => s._id === sectionId);
    const tier = section?.tierId ? ticketTierByVenueLayoutTierId.get(section.tierId) : undefined;
    const quantity = gaQuantities[sectionId] ?? 1;
    if (!tier || quantity < 1) return;

    setSubmitting(true);
    setError('');
    try {
      const result = await purchase({
        eventId: event._id,
        tierId: tier._id,
        quantity,
        ...(isManual && tier.price > 0 ? {paymentMethod: paymentMethodChoice} : {}),
      });
      setOrderTotal({price: tier.price * quantity, currency: tier.currency, isFree: tier.price === 0});
      setOrder(result);
    } catch (err) {
      const parsed = parseConvexError(err, tSeat('genericError'));
      setError(parsed === EVENT_ENDED_ERROR ? t('errors.eventEnded') : parsed);
    } finally {
      setSubmitting(false);
    }
  }

  const secondsLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0;
  const holdExpired = holdIds !== null && secondsLeft === 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-4">
        {event.coverImageUrl && (
          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl">
            <Image src={event.coverImageUrl} alt={event.title} fill className="object-cover" />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 leading-snug">{event.title}</p>
          <p className="mt-0.5 text-xs text-gray-500">{event.venue.name}, {event.venue.city}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 space-y-3">
          <h2 className="font-semibold text-gray-900">{tSeat('selectSeats')}</h2>
          <LayoutCanvas
            canvasWidth={snapshot.canvasWidth}
            canvasHeight={snapshot.canvasHeight}
            sections={snapshot.sections}
            tiers={snapshot.tiers}
            seats={snapshot.seats}
            elements={snapshot.elements}
            mode="select"
            selectedSeatIds={selectedSeatIds}
            seatAvailability={seatAvailability}
            onSeatClick={toggleSeat}
          />
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            {event.tiers
              .filter(tier => tier.venueLayoutTierId)
              .map(tier => {
                const category = tierById.get(tier.venueLayoutTierId!);
                return (
                  <span key={tier._id} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{backgroundColor: category?.color ?? '#9CA3AF'}}
                    />
                    {tier.name} · {tier.price} {tier.currency}
                  </span>
                );
              })}
          </div>
        </div>

        <div className="w-full space-y-4 lg:w-80">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900">{tSeat('yourSeats')}</h2>
            {selectedSeats.length === 0 ? (
              <p className="mt-2 text-sm text-gray-400">{tSeat('noSeatsSelected')}</p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
                {selectedSeats.map(seat => {
                  const tier = seat.tierId ? ticketTierByVenueLayoutTierId.get(seat.tierId) : undefined;
                  const category = seat.tierId ? tierById.get(seat.tierId) : undefined;
                  return (
                    <li key={seat._id} className="flex justify-between">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{backgroundColor: category?.color ?? '#9CA3AF'}}
                        />
                        {tier?.name} · {seat.seatLabel}
                      </span>
                      <span>
                        {tier?.price ?? 0} {selectedCurrency}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-3 flex justify-between border-t border-gray-100 pt-2 text-sm font-semibold text-gray-900">
              <span>{t('total')}</span>
              <span>{selectedTotal === 0 && selectedSeats.length === 0 ? '—' : `${selectedTotal} ${selectedCurrency}`}</span>
            </div>

            {isManual && selectedTotal > 0 && !holdIds && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-gray-700">{t('paymentMethodLabel')}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethodChoice('manual')}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
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
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                      paymentMethodChoice === 'cash'
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {t('methodCash')}
                  </button>
                </div>
              </div>
            )}

            {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

            {!holdIds ? (
              <Button
                onClick={handleHoldSeats}
                disabled={selectedSeats.length === 0 || submitting}
                className="mt-4 w-full"
              >
                {submitting ? t('submitting') : tSeat('continueButton')}
              </Button>
            ) : (
              <div className="mt-4 space-y-2">
                <p className={`text-center text-xs font-medium ${holdExpired ? 'text-red-600' : 'text-amber-600'}`}>
                  {holdExpired ? tSeat('holdExpired') : tSeat('holdExpiring', {seconds: secondsLeft})}
                </p>
                <Button
                  onClick={handleConfirmSeats}
                  disabled={submitting || holdExpired}
                  className="w-full"
                >
                  {submitting ? t('submitting') : t('confirmOrder')}
                </Button>
                <Button type="button" variant="ghost" onClick={handleCancelHold} className="w-full">
                  {tSeat('changeSeats')}
                </Button>
              </div>
            )}
          </div>

          {gaSections.map(section => {
            const tier = section.tierId ? ticketTierByVenueLayoutTierId.get(section.tierId) : undefined;
            if (!tier) return null;
            const available = tier.quantity - tier.quantitySold;
            const quantity = gaQuantities[section._id] ?? 1;
            return (
              <div key={section._id} className="rounded-2xl border border-gray-200 bg-white p-5">
                <h3 className="font-semibold text-gray-900">{section.name}</h3>
                <p className="text-xs text-gray-500">{tier.price} {tier.currency} · {available} {t('remaining')}</p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setGaQuantities(prev => ({...prev, [section._id]: Math.max(1, quantity - 1)}))}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-lg leading-none hover:bg-gray-50"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-semibold text-gray-900">{quantity}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setGaQuantities(prev => ({...prev, [section._id]: Math.min(10, available, quantity + 1)}))
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-lg leading-none hover:bg-gray-50"
                  >
                    +
                  </button>
                </div>
                <Button
                  onClick={() => handleBuyGa(section._id)}
                  disabled={submitting || available === 0}
                  className="mt-3 w-full"
                >
                  {submitting ? t('submitting') : t('confirmOrder')}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
