'use client';

import {useTranslations} from 'next-intl';
import {EventFormData, EVENT_CATEGORIES} from '@/types/eventForm';
import FormField from '@/components/ui/FormField';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';

type Props = {
  data: EventFormData;
  onChange: (patch: Partial<EventFormData>) => void;
  errors: Partial<Record<keyof EventFormData, string>>;
};

export default function StepBasicInfo({data, onChange, errors}: Props) {
  const t = useTranslations('eventCreate');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t('basicInfo.heading')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('basicInfo.subheading')}</p>
      </div>

      <FormField label={t('basicInfo.titleLabel')} required error={errors.title}>
        <Input
          type="text"
          value={data.title}
          onChange={e => onChange({title: e.target.value})}
          placeholder={t('basicInfo.titlePlaceholder')}
          maxLength={120}
        />
      </FormField>

      <FormField
        label={t('basicInfo.descriptionLabel')}
        hint={t('basicInfo.descriptionHint')}
        error={errors.description}
      >
        <Textarea
          value={data.description}
          onChange={e => onChange({description: e.target.value})}
          placeholder={t('basicInfo.descriptionPlaceholder')}
          rows={5}
        />
      </FormField>

      <FormField label={t('basicInfo.categoryLabel')} error={errors.category}>
        <Select
          value={data.category}
          onChange={e => onChange({category: e.target.value})}
        >
          <option value="">{t('basicInfo.categoryPlaceholder')}</option>
          {EVENT_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>
              {t(`basicInfo.categories.${cat}`)}
            </option>
          ))}
        </Select>
      </FormField>
    </div>
  );
}
