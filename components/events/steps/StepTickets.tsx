'use client';

import {useTranslations} from 'next-intl';
import {EventFormData, FormTier, CURRENCIES} from '@/types/eventForm';
import {Id} from '@/convex/_generated/dataModel';
import FormField from '@/components/ui/FormField';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import ColorPicker from '@/components/ui/ColorPicker';
import VenueLayoutAttachPanel from '../VenueLayoutAttachPanel';

type Props = {
  data: EventFormData;
  onChange: (patch: Partial<EventFormData>) => void;
  errors: Partial<Record<keyof EventFormData, string>>;
  savedEventId?: Id<'events'>;
};

const DEFAULT_TIER_COLOR = '#2563EB';

function TierCard({
  tier,
  index,
  showColor,
  onUpdate,
  onRemove,
}: {
  tier: FormTier;
  index: number;
  showColor: boolean;
  onUpdate: (patch: Partial<FormTier>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('eventCreate.tickets');

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">
          {t('tierNumber', {n: index + 1})}
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={tier.priceLocked}
          className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('removeTierButton')}
        </button>
      </div>

      {tier.priceLocked && (
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {t('priceLockedNotice')}
        </div>
      )}

      <div className="space-y-4">
        <FormField label={t('tierNameLabel')} required>
          <Input
            type="text"
            value={tier.name}
            onChange={e => onUpdate({name: e.target.value})}
            placeholder={t('tierNamePlaceholder')}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <FormField label={t('currencyLabel')} required>
            <Select
              value={tier.currency}
              onChange={e => onUpdate({currency: e.target.value})}
            >
              {CURRENCIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label={t('priceLabel')} required>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={tier.price}
              onChange={e => onUpdate({price: e.target.value})}
              placeholder="0.00"
              disabled={tier.priceLocked}
            />
          </FormField>

          <FormField label={t('quantityLabel')} required>
            <Input
              type="number"
              min="1"
              value={tier.quantity}
              onChange={e => onUpdate({quantity: e.target.value})}
              placeholder="100"
            />
          </FormField>
        </div>

        {showColor && (
          <FormField label={t('colorLabel')} hint={t('colorHint')}>
            <ColorPicker
              value={tier.color ?? DEFAULT_TIER_COLOR}
              onChange={color => onUpdate({color})}
            />
          </FormField>
        )}

        <FormField label={t('tierDescriptionLabel')}>
          <Textarea
            value={tier.description}
            onChange={e => onUpdate({description: e.target.value})}
            placeholder={t('tierDescriptionPlaceholder')}
            rows={2}
          />
        </FormField>
      </div>
    </div>
  );
}

const TIER_ERROR_KEYS: Record<string, string> = {
  required: 'tickets.errorRequired',
  incomplete: 'tickets.errorIncomplete',
  venueLayoutTemplateRequired: 'tickets.errorVenueLayoutTemplateRequired',
};

export default function StepTickets({data, onChange, errors, savedEventId}: Props) {
  const t = useTranslations('eventCreate');

  const totalTickets = data.tiers.reduce((sum, tier) => {
    const qty = parseInt(tier.quantity, 10);
    return sum + (isNaN(qty) ? 0 : qty);
  }, 0);

  function addTier() {
    const newTier: FormTier = {
      tempId: crypto.randomUUID(),
      name: '',
      price: '',
      currency: 'USD',
      quantity: '',
      description: '',
      priceLocked: false,
      color: data.seatMapEnabled ? DEFAULT_TIER_COLOR : undefined,
    };
    onChange({tiers: [...data.tiers, newTier]});
  }

  function updateTier(tempId: string, patch: Partial<FormTier>) {
    onChange({
      tiers: data.tiers.map(t => (t.tempId === tempId ? {...t, ...patch} : t)),
    });
  }

  function removeTier(tempId: string) {
    onChange({tiers: data.tiers.filter(t => t.tempId !== tempId)});
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t('tickets.heading')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('tickets.subheading')}</p>
      </div>

      {errors.tiers && (
        <p className="text-sm text-red-600">
          {t(TIER_ERROR_KEYS[errors.tiers] ?? TIER_ERROR_KEYS.required)}
        </p>
      )}

      {data.tiers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
          {t('tickets.empty')}
        </p>
      ) : (
        <div className="space-y-4">
          {data.tiers.map((tier, i) => (
            <TierCard
              key={tier.tempId}
              tier={tier}
              index={i}
              showColor={data.seatMapEnabled}
              onUpdate={patch => updateTier(tier.tempId, patch)}
              onRemove={() => removeTier(tier.tempId)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addTier}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900"
      >
        <span>+</span>
        {t('tickets.addTierButton')}
      </button>

      {totalTickets > 0 && (
        <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">
          {t('tickets.totalTickets', {count: totalTickets})}
        </div>
      )}

      <VenueLayoutAttachPanel data={data} onChange={onChange} savedEventId={savedEventId} />
    </div>
  );
}
