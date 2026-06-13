'use client';

import {useRef} from 'react';
import {useTranslations} from 'next-intl';
import Image from 'next/image';
import {EventFormData} from '@/types/eventForm';
import FormField from '@/components/ui/FormField';
import Input from '@/components/ui/Input';

type Props = {
  data: EventFormData;
  onChange: (patch: Partial<EventFormData>) => void;
  errors: Partial<Record<keyof EventFormData, string>>;
};

export default function StepSettings({data, onChange, errors}: Props) {
  const t = useTranslations('eventCreate');
  const fileRef = useRef<HTMLInputElement>(null);

  function handleCoverImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    onChange({coverImageFile: file, coverImagePreviewUrl: previewUrl, coverImageStorageId: null});
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t('settings.heading')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('settings.subheading')}</p>
      </div>

      {/* Cover image */}
      <FormField label={t('settings.coverImageLabel')} error={errors.coverImageFile?.toString()}>
        <div className="flex items-start gap-4">
          {data.coverImagePreviewUrl ? (
            <div className="relative h-24 w-40 overflow-hidden rounded-lg border border-gray-200">
              <Image
                src={data.coverImagePreviewUrl}
                alt=""
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex h-24 w-40 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
              {t('settings.coverImageEmpty')}
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {t('settings.coverImageButton')}
            </button>
            <p className="mt-1 text-xs text-gray-400">{t('settings.coverImageHint')}</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleCoverImage}
            />
          </div>
        </div>
      </FormField>

      {/* Visibility */}
      <FormField label={t('settings.visibilityLabel')} required>
        <div className="flex flex-wrap gap-3">
          {(['public', 'private', 'unlisted'] as const).map(v => (
            <label
              key={v}
              className={[
                'flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                data.visibility === v
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400',
              ].join(' ')}
            >
              <input
                type="radio"
                name="visibility"
                value={v}
                checked={data.visibility === v}
                onChange={() => onChange({visibility: v})}
                className="sr-only"
              />
              {t(`settings.visibility${v.charAt(0).toUpperCase() + v.slice(1)}`)}
            </label>
          ))}
        </div>
      </FormField>

      {/* Payment mode */}
      <FormField label={t('settings.paymentModeLabel')} required>
        <div className="flex flex-wrap gap-3">
          {(['online', 'manual'] as const).map(m => (
            <label
              key={m}
              className={[
                'flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                data.paymentMode === m
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400',
              ].join(' ')}
            >
              <input
                type="radio"
                name="paymentMode"
                value={m}
                checked={data.paymentMode === m}
                onChange={() => onChange({paymentMode: m})}
                className="sr-only"
              />
              {t(`settings.paymentMode${m.charAt(0).toUpperCase() + m.slice(1)}`)}
            </label>
          ))}
        </div>
      </FormField>

      {/* Cancellation policy */}
      <fieldset className="rounded-lg border border-gray-200 p-4">
        <legend className="px-1 text-sm font-medium text-gray-700">
          {t('settings.cancellationLabel')}
        </legend>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={data.cancellationAllowed}
            onClick={() => onChange({cancellationAllowed: !data.cancellationAllowed})}
            className={[
              'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
              data.cancellationAllowed ? 'bg-gray-900' : 'bg-gray-200',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
                data.cancellationAllowed ? 'translate-x-5' : 'translate-x-0',
              ].join(' ')}
            />
          </button>
          <span className="text-sm text-gray-700">
            {data.cancellationAllowed
              ? t('settings.cancellationOn')
              : t('settings.cancellationOff')}
          </span>
        </div>

        {data.cancellationAllowed && (
          <div className="mt-4 max-w-xs">
            <FormField
              label={t('settings.cancellationCutoffLabel')}
              hint={t('settings.cancellationCutoffHint')}
            >
              <Input
                type="number"
                min="1"
                max="720"
                value={data.cancellationCutoffHours}
                onChange={e => onChange({cancellationCutoffHours: e.target.value})}
              />
            </FormField>
          </div>
        )}
      </fieldset>
    </div>
  );
}
