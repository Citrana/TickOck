'use client';

import {useRef} from 'react';
import {useTranslations} from 'next-intl';
import {useQuery} from 'convex/react';
import {api} from '@/convex/_generated/api';
import {EventFormData} from '@/types/eventForm';
import FormField from '@/components/ui/FormField';
import {calculatePlatformFee, describeConditions, describeFee} from '@/lib/platformFee';

type Props = {
  data: EventFormData;
  onChange: (patch: Partial<EventFormData>) => void;
  errors: Partial<Record<keyof EventFormData, string>>;
  existingEventId?: string;
};

export default function StepReview({data, onChange, errors}: Props) {
  const t = useTranslations('eventCreate');
  const rules = useQuery(api.platformPricing.listActive);
  const screenshotRef = useRef<HTMLInputElement>(null);

  const feeResult =
    rules !== undefined
      ? calculatePlatformFee(data.tiers, rules)
      : null;

  const hasFee = feeResult !== null && feeResult.totalFee > 0;
  const currency = feeResult?.currency ?? null;

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

        {rules === undefined ? (
          <p className="text-sm text-gray-500">{t('review.feeLoading')}</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-gray-500">{t('review.noFeeConfigured')}</p>
        ) : (
          <div className="space-y-3">
            {/* Per-tier breakdown */}
            <div className="space-y-1.5">
              {feeResult?.breakdown.map((item, i) => (
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

            {/* Total */}
            {feeResult && (
              <div className="flex items-center justify-between border-t border-orange-200 pt-2">
                <span className="text-sm font-semibold text-gray-900">{t('review.feeTotal')}</span>
                <span className="text-lg font-bold text-gray-900">
                  {feeResult.totalFee > 0
                    ? `${feeResult.totalFee.toFixed(2)} ${currency ?? ''}`
                    : t('review.noFee')}
                </span>
              </div>
            )}
          </div>
        )}

        {hasFee && (
          <p className="mt-3 text-xs text-gray-600">
            {t('review.paymentInstructions', {
              amount: feeResult!.totalFee.toFixed(2),
              currency: currency ?? '',
            })}
          </p>
        )}
      </div>

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
