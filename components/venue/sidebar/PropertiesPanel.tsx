'use client';

import {useTranslations} from 'next-intl';
import {Id} from '@/convex/_generated/dataModel';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import FormField from '@/components/ui/FormField';
import {VenueSection, VenueSeat, VenueTier} from '../types';

type PropertiesPanelProps = {
  tiers: VenueTier[];
  selectedSection: VenueSection | null;
  selectedSeat: VenueSeat | null;
  onUpdateSection: (sectionId: Id<'venueLayoutSections'>, patch: Partial<{name: string; gaCapacity: number; tierId: Id<'venueLayoutTiers'> | undefined}>) => void;
  onDeleteSection: (sectionId: Id<'venueLayoutSections'>) => void;
  onUpdateSeat: (seatId: Id<'venueLayoutSeats'>, patch: Partial<{seatLabel: string; rowLabel: string; tierId: Id<'venueLayoutTiers'> | undefined}>) => void;
  onDeleteSeat: (seatId: Id<'venueLayoutSeats'>) => void;
};

export default function PropertiesPanel({
  tiers,
  selectedSection,
  selectedSeat,
  onUpdateSection,
  onDeleteSection,
  onUpdateSeat,
  onDeleteSeat,
}: PropertiesPanelProps) {
  const t = useTranslations('venueLayout.builder.properties');

  if (selectedSeat) {
    return (
      <div className="w-64 shrink-0 space-y-3 rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900">{t('seatHeading')}</h3>
        <FormField label={t('seatLabelField')}>
          <Input
            value={selectedSeat.seatLabel}
            onChange={e => onUpdateSeat(selectedSeat._id, {seatLabel: e.target.value})}
          />
        </FormField>
        {selectedSeat.rowLabel !== undefined && (
          <FormField label={t('rowLabelField')}>
            <Input
              value={selectedSeat.rowLabel ?? ''}
              onChange={e => onUpdateSeat(selectedSeat._id, {rowLabel: e.target.value})}
            />
          </FormField>
        )}
        <FormField label={t('tierField')}>
          <Select
            value={selectedSeat.tierId ?? ''}
            onChange={e =>
              onUpdateSeat(selectedSeat._id, {
                tierId: e.target.value ? (e.target.value as Id<'venueLayoutTiers'>) : undefined,
              })
            }
          >
            <option value="">{t('noTier')}</option>
            {tiers.map(tier => (
              <option key={tier._id} value={tier._id}>{tier.name}</option>
            ))}
          </Select>
        </FormField>
        <Button
          type="button"
          variant="ghost"
          className="w-full text-red-500"
          onClick={() => onDeleteSeat(selectedSeat._id)}
        >
          {t('deleteSeat')}
        </Button>
      </div>
    );
  }

  if (selectedSection) {
    return (
      <div className="w-64 shrink-0 space-y-3 rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900">{t('sectionHeading')}</h3>
        <FormField label={t('sectionNameField')}>
          <Input
            value={selectedSection.name}
            onChange={e => onUpdateSection(selectedSection._id, {name: e.target.value})}
          />
        </FormField>
        {selectedSection.kind === 'ga' && (
          <>
            <FormField label={t('gaCapacityField')}>
              <Input
                type="number"
                min="0"
                value={selectedSection.gaCapacity ?? 0}
                onChange={e =>
                  onUpdateSection(selectedSection._id, {gaCapacity: parseInt(e.target.value, 10) || 0})
                }
              />
            </FormField>
            <FormField label={t('tierField')}>
              <Select
                value={selectedSection.tierId ?? ''}
                onChange={e =>
                  onUpdateSection(selectedSection._id, {
                    tierId: e.target.value ? (e.target.value as Id<'venueLayoutTiers'>) : undefined,
                  })
                }
              >
                <option value="">{t('noTier')}</option>
                {tiers.map(tier => (
                  <option key={tier._id} value={tier._id}>{tier.name}</option>
                ))}
              </Select>
            </FormField>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          className="w-full text-red-500"
          onClick={() => onDeleteSection(selectedSection._id)}
        >
          {t('deleteSection')}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">
      {t('emptyState')}
    </div>
  );
}
