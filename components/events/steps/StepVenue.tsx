'use client';

import {useTranslations} from 'next-intl';
import {EventFormData, TIMEZONES} from '@/types/eventForm';
import FormField from '@/components/ui/FormField';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

type Props = {
  data: EventFormData;
  onChange: (patch: Partial<EventFormData>) => void;
  errors: Partial<Record<keyof EventFormData, string>>;
};

export default function StepVenue({data, onChange, errors}: Props) {
  const t = useTranslations('eventCreate');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t('venue.heading')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('venue.subheading')}</p>
      </div>

      <FormField
        label={t('venue.venueNameLabel')}
        required
        error={errors.venueName}
      >
        <Input
          type="text"
          value={data.venueName}
          onChange={e => onChange({venueName: e.target.value})}
          placeholder={t('venue.venueNamePlaceholder')}
        />
      </FormField>

      <FormField label={t('venue.venueAddressLabel')} required error={errors.venueAddress}>
        <Input
          type="text"
          value={data.venueAddress}
          onChange={e => onChange({venueAddress: e.target.value})}
          placeholder={t('venue.venueAddressPlaceholder')}
        />
      </FormField>

      <FormField label={t('venue.venueCityLabel')} required error={errors.venueCity}>
        <Input
          type="text"
          value={data.venueCity}
          onChange={e => onChange({venueCity: e.target.value})}
          placeholder={t('venue.venueCityPlaceholder')}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField label={t('venue.dateLabel')} required error={errors.date}>
          <Input
            type="date"
            value={data.date}
            onChange={e => onChange({date: e.target.value})}
          />
        </FormField>

        <FormField label={t('venue.timezoneLabel')} required error={errors.timezone}>
          <Select
            value={data.timezone}
            onChange={e => onChange({timezone: e.target.value})}
          >
            {TIMEZONES.map(tz => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField label={t('venue.startTimeLabel')} required error={errors.startTime}>
          <Input
            type="time"
            value={data.startTime}
            onChange={e => onChange({startTime: e.target.value})}
          />
        </FormField>

        <FormField label={t('venue.endTimeLabel')} error={errors.endTime}>
          <Input
            type="time"
            value={data.endTime}
            onChange={e => onChange({endTime: e.target.value})}
          />
        </FormField>
      </div>
    </div>
  );
}
