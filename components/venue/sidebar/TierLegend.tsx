'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Id, Doc} from '@/convex/_generated/dataModel';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import FormField from '@/components/ui/FormField';
import ColorPicker from '@/components/ui/ColorPicker';
import {Link} from '@/lib/navigation';
import {VenueTier} from '../types';

type TierLegendProps = {
  tiers: VenueTier[];
  onAdd: (tier: {name: string; color: string}) => void;
  onUpdate: (tierId: Id<'venueLayoutTiers'>, patch: Partial<{name: string; color: string}>) => void;
  onDelete: (tierId: Id<'venueLayoutTiers'>) => void;
  // Event-scoped mode: this layout is being built for one specific event
  // whose real, priced ticket tiers already exist — categories mirror them
  // automatically (see ensureShadowTiersForEvent), so editing/adding/
  // deleting categories directly here doesn't make sense.
  readOnly?: boolean;
  eventId?: Id<'events'>;
  ticketTiers?: Doc<'ticketTiers'>[];
};

const DEFAULT_COLOR = '#2563EB';

export default function TierLegend({
  tiers,
  onAdd,
  onUpdate,
  onDelete,
  readOnly,
  eventId,
  ticketTiers,
}: TierLegendProps) {
  const t = useTranslations('venueLayout.builder.tiers');
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);

  function submitNew() {
    if (!name.trim()) return;
    onAdd({name: name.trim(), color});
    setName('');
    setColor(DEFAULT_COLOR);
    setShowNew(false);
  }

  if (readOnly) {
    const priceByLinkedTier = new Map(
      (ticketTiers ?? [])
        .filter(t => t.venueLayoutTierId)
        .map(t => [t.venueLayoutTierId!, t]),
    );

    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">{t('heading')}</h3>
        <div className="space-y-2">
          {tiers.map(tier => {
            const linked = priceByLinkedTier.get(tier._id);
            return (
              <div key={tier._id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2">
                <span className="h-4 w-4 shrink-0 rounded-full" style={{backgroundColor: tier.color}} />
                <span className="flex-1 text-sm font-medium text-gray-900">{tier.name}</span>
                {linked && (
                  <span className="text-xs text-gray-500">{linked.price} {linked.currency}</span>
                )}
              </div>
            );
          })}
        </div>
        {eventId && (
          <Link
            href={`/events/${eventId}/edit`}
            className="inline-block text-xs font-medium text-gray-600 underline underline-offset-2"
          >
            {t('manageInTicketsStep')}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">{t('heading')}</h3>

      <div className="space-y-2">
        {tiers.map(tier => (
          <div key={tier._id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2">
            <span
              className="h-4 w-4 shrink-0 rounded-full"
              style={{backgroundColor: tier.color}}
            />
            <input
              value={tier.name}
              onChange={e => onUpdate(tier._id, {name: e.target.value})}
              className="min-w-0 flex-1 border-none bg-transparent text-sm font-medium text-gray-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => onDelete(tier._id)}
              className="text-xs text-red-500 hover:underline"
            >
              {t('remove')}
            </button>
          </div>
        ))}
      </div>

      {showNew ? (
        <div className="space-y-3 rounded-lg border border-gray-200 p-3">
          <FormField label={t('nameLabel')}>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('namePlaceholder')} />
          </FormField>
          <FormField label={t('colorLabel')}>
            <ColorPicker value={color} onChange={setColor} />
          </FormField>
          <div className="flex gap-2">
            <Button type="button" onClick={submitNew}>{t('save')}</Button>
            <Button type="button" variant="ghost" onClick={() => setShowNew(false)}>{t('cancel')}</Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="secondary" onClick={() => setShowNew(true)} className="w-full">
          {t('addTier')}
        </Button>
      )}
    </div>
  );
}
