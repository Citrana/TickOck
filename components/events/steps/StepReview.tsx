'use client';

import {useRef} from 'react';
import {useTranslations} from 'next-intl';
import {useQuery} from 'convex/react';
import {api} from '@/convex/_generated/api';
import {EventFormData} from '@/types/eventForm';
import FormField from '@/components/ui/FormField';
import {calculatePlatformFee, describeConditions, describeFee, FeeResult} from '@/lib/platformFee';

type Props = {
  data: EventFormData;
  onChange: (patch: Partial<EventFormData>) => void;
  errors: Partial<Record<keyof EventFormData, string>>;
  existingEventId?: string;
};

function FeeBreakdown({
  t,
  result,
  loading,
  emptyMessage,
}: {
  t: ReturnType<typeof useTranslations<'eventCreate'>>;
  result: FeeResult | null;
  loading: boolean;
  emptyMessage: string;
}) {
  if (loading) return <p className="text-sm text-gray-500">{t('review.feeLoading')}</p>;
  if (!result || result.breakdown.length === 0) {
    return <p className="text-sm text-gray-500">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {result.breakdown.map((item, i) => (
          <div key={i} className="rounded-lg bg-white/70 px-3 py-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-800">
                {item.tierName || t('review.unnamedTier')}
              </span>
              <span className="font-semibold text-gray-900">
                {item.matchedRule
                  ? `${item.fee.toFixed(2)} ${item.currency}`
                  : t('review.noRuleMatch')}
              </span>
            </div>
            {item.matchedRule && (
              <div className="mt-0.5 text-gray-500">
                {describeFee(item.matchedRule)} · {describeConditions(item.matchedRule)}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-orange-200 pt-2">
        <span className="text-sm font-semibold text-gray-900">{t('review.feeTotal')}</span>
        <span className="text-lg font-bold text-gray-900">
          {result.totalFee > 0
            ? `${result.totalFee.toFixed(2)} ${result.currency ?? ''}`
            : t('review.noFee')}
        </span>
      </div>
    </div>
  );
}

export default function StepReview({data, onChange, errors}: Props) {
  const t = useTranslations('eventCreate');
  const platformRules = useQuery(api.platformPricing.listActive, {category: 'platform'});
  const venueLayoutRules = useQuery(api.platformPricing.listActive, {category: 'venue_layout'});
  const screenshotRef = useRef<HTMLInputElement>(null);

  // Tiers are always organizer-entered now (seat-map or not).
  const feeResult =
    platformRules !== undefined ? calculatePlatformFee(data.tiers, platformRules) : null;

  const venueLayoutFeeResult =
    data.seatMapEnabled && venueLayoutRules !== undefined
      ? calculatePlatformFee(data.tiers, venueLayoutRules)
      : null;

  const platformFee = feeResult?.totalFee ?? 0;
  const venueLayoutFee = venueLayoutFeeResult?.totalFee ?? 0;
  const combinedTotal = platformFee + venueLayoutFee;
  const hasFee = combinedTotal > 0;
  const currency = feeResult?.currency ?? venueLayoutFeeResult?.currency ?? null;

  function handleScreenshot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    onChange({paymentScreenshotFile: file, paymentScreenshotStorageId: null});
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t('review.heading')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('review.subheading')}</p>
      </div>

      {/* Event summary */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">{t('review.summaryTitle')}</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">{t('review.eventTitle')}</dt>
            <dd className="font-medium text-gray-900">{data.title || '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">{t('review.eventDate')}</dt>
            <dd className="font-medium text-gray-900">
              {data.date ? `${data.date} · ${data.startTime}` : '—'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">{t('review.eventVenue')}</dt>
            <dd className="font-medium text-gray-900">
              {data.venueName ? `${data.venueName}, ${data.venueCity}` : '—'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">{t('review.tierCount')}</dt>
            <dd className="font-medium text-gray-900">{data.tiers.length}</dd>
          </div>
        </dl>
      </div>

      {/* Platform fee */}
      <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          {t('review.platformFeeTitle')}
        </h3>
        <FeeBreakdown
          t={t}
          result={feeResult}
          loading={platformRules === undefined}
          emptyMessage={
            platformRules && platformRules.length === 0
              ? t('review.noFeeConfigured')
              : t('review.noFee')
          }
        />
      </div>

      {/* Venue layout add-on fee */}
      {data.seatMapEnabled && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            {t('review.venueLayoutFeeTitle')}
          </h3>
          <FeeBreakdown
            t={t}
            result={venueLayoutFeeResult}
            loading={venueLayoutRules === undefined}
            emptyMessage={
              venueLayoutRules && venueLayoutRules.length === 0
                ? t('review.noVenueLayoutFeeConfigured')
                : t('review.noFee')
            }
          />
        </div>
      )}

      {/* Combined total */}
      {hasFee && (
        <div className="rounded-xl bg-gray-900 p-5 text-white">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t('review.combinedTotal')}</span>
            <span className="text-xl font-bold">
              {combinedTotal.toFixed(2)} {currency ?? ''}
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-300">
            {t('review.paymentInstructions', {
              amount: combinedTotal.toFixed(2),
              currency: currency ?? '',
            })}
          </p>
        </div>
      )}

      {/* Payment screenshot upload — only when there's an actual fee */}
      {hasFee && (
        <FormField
          label={t('review.screenshotLabel')}
          required
          error={errors.paymentScreenshotFile?.toString()}
          hint={t('review.screenshotHint')}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => screenshotRef.current?.click()}
              className={[
                'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                data.paymentScreenshotFile
                  ? 'border-green-300 bg-green-50 text-green-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              {data.paymentScreenshotFile
                ? t('review.screenshotUploaded')
                : t('review.screenshotButton')}
            </button>
            {data.paymentScreenshotFile && (
              <span className="text-sm text-gray-500">{data.paymentScreenshotFile.name}</span>
            )}
            <input
              ref={screenshotRef}
              type="file"
              accept="image/*,application/pdf"
              className="sr-only"
              onChange={handleScreenshot}
            />
          </div>
        </FormField>
      )}

      <div className="rounded-xl bg-rose-50 p-4 text-xs text-rose-700">
        {t('review.approvalNote')}
      </div>
    </div>
  );
}
