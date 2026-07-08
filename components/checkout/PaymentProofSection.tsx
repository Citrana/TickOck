'use client';

import {useState} from 'react';
import {useMutation} from 'convex/react';
import {useTranslations} from 'next-intl';
import {Link} from '@/lib/navigation';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';
import Button from '@/components/ui/Button';

export type OrderResult = {
  ticketIds: Id<'tickets'>[];
  paymentId: Id<'payments'> | null;
};

type Props = {
  order: OrderResult;
  isFree: boolean;
  isManual: boolean;
  paymentMethodChoice: 'manual' | 'cash';
  totalPrice: number;
  currency: string;
};

// Shared post-purchase success / manual-payment-proof flow, used by both the
// quantity-based checkout and the seat-map checkout — the steps after a
// ticket/order is created (pending_payment vs confirmed, proof upload,
// cash-on-arrival note) are identical regardless of how seats were chosen.
export default function PaymentProofSection({
  order,
  isFree,
  isManual,
  paymentMethodChoice,
  totalPrice,
  currency,
}: Props) {
  const t = useTranslations('checkout');
  const submitProof = useMutation(api.tickets.submitPaymentProof);
  const generateUploadUrl = useMutation(api.events.generateUploadUrl);

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofSubmitted, setProofSubmitted] = useState(false);
  const [proofError, setProofError] = useState('');

  async function handleProofUpload() {
    if (!referenceNumber.trim()) {
      setProofError(t('errors.referenceRequired'));
      return;
    }
    if (!proofFile) {
      setProofError(t('errors.proofRequired'));
      return;
    }
    if (!order.paymentId) return;
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
      const {storageId} = (await res.json()) as {storageId: Id<'_storage'>};
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

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">
          ✓
        </div>
        <h2 className="text-xl font-bold text-green-900">{t('orderPlaced')}</h2>
        <p className="mt-1 text-sm text-green-700">{t('orderPlacedMessage')}</p>
      </div>

      {!isFree && isManual && paymentMethodChoice === 'cash' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-medium text-amber-800">{t('cashPaymentMessage')}</p>
        </div>
      )}

      {!isFree && isManual && paymentMethodChoice === 'manual' && !proofSubmitted && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="font-semibold text-gray-900">{t('paymentInstructions')}</h3>
          <p className="mt-2 text-sm text-gray-600">{t('manualNextStep')}</p>
          <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {t('transferInstruction', {amount: totalPrice, currency})}
          </p>
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
            {proofError && <p className="text-xs text-red-600">{proofError}</p>}
            {proofFile && <p className="text-xs text-gray-500">Selected: {proofFile.name}</p>}
            <Button onClick={handleProofUpload} disabled={uploadingProof || !proofFile} className="w-full">
              {uploadingProof ? t('uploadingProof') : t('submitProof')}
            </Button>
          </div>
        </div>
      )}

      {proofSubmitted && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {t('proofUploaded')}
        </div>
      )}

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
