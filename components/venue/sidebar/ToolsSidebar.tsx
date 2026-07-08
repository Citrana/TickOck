'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Id} from '@/convex/_generated/dataModel';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import FormField from '@/components/ui/FormField';
import {VenueSection, VenueTier} from '../types';
import {SeatDraft, generateGridRows, generateCurvedRows, generateRoundTable} from '@/lib/venueGenerators';

const SECTION_PRESETS = ['Floor', 'Balcony', 'VIP', 'Table Area'] as const;

type GeneratorKind = 'grid' | 'curve' | 'round-table';

type ToolsSidebarProps = {
  tiers: VenueTier[];
  selectedSection: VenueSection | null;
  onAddSection: (params: {name: string; kind: 'seated' | 'ga'; gaCapacity?: number; tierId?: Id<'venueLayoutTiers'>}) => void;
  onGenerateSeats: (sectionId: Id<'venueLayoutSections'>, shape: string, seats: SeatDraft[], tierId?: Id<'venueLayoutTiers'>) => void;
};

export default function ToolsSidebar({tiers, selectedSection, onAddSection, onGenerateSeats}: ToolsSidebarProps) {
  const t = useTranslations('venueLayout.builder');
  const [customName, setCustomName] = useState('');
  const [generator, setGenerator] = useState<GeneratorKind>('grid');
  const [rows, setRows] = useState('5');
  const [seatsPerRow, setSeatsPerRow] = useState('10');
  const [seatCount, setSeatCount] = useState('8');
  const [gaCapacity, setGaCapacity] = useState('100');
  const [generatorTierId, setGeneratorTierId] = useState<string>('');

  function addPreset(name: string) {
    onAddSection({name, kind: 'seated'});
  }

  function addCustomSeated() {
    if (!customName.trim()) return;
    onAddSection({name: customName.trim(), kind: 'seated'});
    setCustomName('');
  }

  function addGaZone() {
    const capacity = parseInt(gaCapacity, 10);
    onAddSection({
      name: customName.trim() || 'General Admission',
      kind: 'ga',
      gaCapacity: isNaN(capacity) ? 0 : capacity,
      tierId: generatorTierId ? (generatorTierId as Id<'venueLayoutTiers'>) : undefined,
    });
    setCustomName('');
  }

  function runGenerator() {
    if (!selectedSection || selectedSection.kind !== 'seated') return;
    const tierId = generatorTierId ? (generatorTierId as Id<'venueLayoutTiers'>) : undefined;
    let seats: SeatDraft[] = [];

    if (generator === 'grid') {
      seats = generateGridRows({
        rows: parseInt(rows, 10) || 1,
        seatsPerRow: parseInt(seatsPerRow, 10) || 1,
        startX: selectedSection.x,
        startY: selectedSection.y + 20,
        seatGap: 28,
        rowGap: 30,
      });
    } else if (generator === 'curve') {
      seats = generateCurvedRows({
        rows: parseInt(rows, 10) || 1,
        seatsPerRow: parseInt(seatsPerRow, 10) || 1,
        centerX: selectedSection.x + 150,
        centerY: selectedSection.y + 200,
        radiusStart: 120,
        radiusStep: 30,
        arcDegrees: 100,
      });
    } else {
      seats = generateRoundTable({
        tableLabel: `Table ${Math.floor(Math.random() * 900 + 100)}`,
        seatCount: parseInt(seatCount, 10) || 4,
        centerX: selectedSection.x + 60,
        centerY: selectedSection.y + 60,
        radius: 50,
      });
    }

    onGenerateSeats(selectedSection._id, generator, seats, tierId);
  }

  return (
    <div className="w-64 shrink-0 space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">{t('sections.heading')}</h3>
        <div className="grid grid-cols-2 gap-2">
          {SECTION_PRESETS.map(preset => (
            <Button key={preset} type="button" variant="secondary" onClick={() => addPreset(preset)} className="text-xs">
              {preset}
            </Button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            placeholder={t('sections.customNamePlaceholder')}
          />
        </div>
        <div className="mt-2 flex gap-2">
          <Button type="button" variant="secondary" onClick={addCustomSeated} className="flex-1 text-xs">
            {t('sections.addSeated')}
          </Button>
          <Button type="button" variant="secondary" onClick={addGaZone} className="flex-1 text-xs">
            {t('sections.addGa')}
          </Button>
        </div>
        <FormField label={t('sections.gaCapacityLabel')}>
          <Input type="number" min="1" value={gaCapacity} onChange={e => setGaCapacity(e.target.value)} />
        </FormField>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">{t('generators.heading')}</h3>
        {!selectedSection || selectedSection.kind !== 'seated' ? (
          <p className="text-xs text-gray-400">{t('generators.selectSectionHint')}</p>
        ) : (
          <div className="space-y-3">
            <FormField label={t('generators.typeLabel')}>
              <Select value={generator} onChange={e => setGenerator(e.target.value as GeneratorKind)}>
                <option value="grid">{t('generators.grid')}</option>
                <option value="curve">{t('generators.curvedRow')}</option>
                <option value="round-table">{t('generators.roundTable')}</option>
              </Select>
            </FormField>

            {generator !== 'round-table' ? (
              <div className="grid grid-cols-2 gap-2">
                <FormField label={t('generators.rowsLabel')}>
                  <Input type="number" min="1" value={rows} onChange={e => setRows(e.target.value)} />
                </FormField>
                <FormField label={t('generators.seatsPerRowLabel')}>
                  <Input type="number" min="1" value={seatsPerRow} onChange={e => setSeatsPerRow(e.target.value)} />
                </FormField>
              </div>
            ) : (
              <FormField label={t('generators.seatCountLabel')}>
                <Input type="number" min="1" value={seatCount} onChange={e => setSeatCount(e.target.value)} />
              </FormField>
            )}

            <FormField label={t('generators.tierLabel')}>
              <Select value={generatorTierId} onChange={e => setGeneratorTierId(e.target.value)}>
                <option value="">{t('generators.noTier')}</option>
                {tiers.map(tier => (
                  <option key={tier._id} value={tier._id}>{tier.name}</option>
                ))}
              </Select>
            </FormField>

            <Button type="button" onClick={runGenerator} className="w-full">
              {t('generators.generate')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
