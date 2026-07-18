'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Id} from '@/convex/_generated/dataModel';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import FormField from '@/components/ui/FormField';
import ColorPicker from '@/components/ui/ColorPicker';
import {VenueSection, VenueTier, VenueElementKind, DoorType, AmenityType, StageShapeKind} from '../types';
import {SeatDraft, generateGridRows, generateCurvedRows, generateRoundTable} from '@/lib/venueGenerators';

const SECTION_PRESETS = ['Floor', 'Balcony', 'VIP', 'Table Area'] as const;

type GeneratorKind = 'grid' | 'curve' | 'round-table';

export type AddElementParams = {
  kind: VenueElementKind;
  width?: number;
  height?: number;
  shape?: StageShapeKind;
  doorType?: DoorType;
  amenityType?: AmenityType;
  capacity?: number;
  label?: string;
  color?: string;
};

type ToolsSidebarProps = {
  tiers: VenueTier[];
  selectedSection: VenueSection | null;
  onAddSection: (params: {name: string; kind: 'seated' | 'ga'; gaCapacity?: number; tierId?: Id<'venueLayoutTiers'>}) => void;
  onGenerateSeats: (sectionId: Id<'venueLayoutSections'>, shape: string, seats: SeatDraft[], tierId?: Id<'venueLayoutTiers'>) => void;
  onAddElement: (params: AddElementParams) => void;
};

const DEFAULT_ZONE_COLOR = '#2563EB';

export default function ToolsSidebar({tiers, selectedSection, onAddSection, onGenerateSeats, onAddElement}: ToolsSidebarProps) {
  const t = useTranslations('venueLayout.builder');
  const [customName, setCustomName] = useState('');
  const [generator, setGenerator] = useState<GeneratorKind>('grid');
  const [rows, setRows] = useState('5');
  const [seatsPerRow, setSeatsPerRow] = useState('10');
  const [seatCount, setSeatCount] = useState('8');
  const [gaCapacity, setGaCapacity] = useState('100');
  const [generatorTierId, setGeneratorTierId] = useState<string>('');

  const [doorType, setDoorType] = useState<DoorType>('main');
  const [doorLabel, setDoorLabel] = useState('');
  const [amenityType, setAmenityType] = useState<AmenityType>('toilet');
  const [amenityLabel, setAmenityLabel] = useState('');
  const [parkingLabel, setParkingLabel] = useState('Parking');
  const [parkingCapacity, setParkingCapacity] = useState('20');
  const [zoneLabel, setZoneLabel] = useState('');
  const [zoneColor, setZoneColor] = useState(DEFAULT_ZONE_COLOR);
  const [stageShape, setStageShape] = useState<StageShapeKind>('rectangle');
  const [stageLabel, setStageLabel] = useState('Stage');
  const [stageColor, setStageColor] = useState('#1F2937');

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

      <div className="space-y-4 border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-900">{t('structure.heading')}</h3>

        <Button type="button" variant="secondary" onClick={() => onAddElement({kind: 'wall'})} className="w-full text-xs">
          {t('structure.addWall')}
        </Button>

        <Button type="button" variant="secondary" onClick={() => onAddElement({kind: 'window'})} className="w-full text-xs">
          {t('structure.addWindow')}
        </Button>

        <div className="space-y-2 rounded-lg border border-gray-100 p-3">
          <FormField label={t('structure.doorTypeLabel')}>
            <Select value={doorType} onChange={e => setDoorType(e.target.value as DoorType)}>
              <option value="main">{t('structure.doorTypeMain')}</option>
              <option value="emergency">{t('structure.doorTypeEmergency')}</option>
              <option value="staff">{t('structure.doorTypeStaff')}</option>
            </Select>
          </FormField>
          <Input
            value={doorLabel}
            onChange={e => setDoorLabel(e.target.value)}
            placeholder={t('structure.labelPlaceholder')}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => onAddElement({kind: 'door', doorType, label: doorLabel.trim() || undefined})}
            className="w-full text-xs"
          >
            {t('structure.addDoor')}
          </Button>
        </div>

        <div className="space-y-2 rounded-lg border border-gray-100 p-3">
          <FormField label={t('structure.amenityTypeLabel')}>
            <Select value={amenityType} onChange={e => setAmenityType(e.target.value as AmenityType)}>
              <option value="toilet">{t('structure.amenityToilet')}</option>
              <option value="bar">{t('structure.amenityBar')}</option>
              <option value="first_aid">{t('structure.amenityFirstAid')}</option>
              <option value="info">{t('structure.amenityInfo')}</option>
              <option value="coat_check">{t('structure.amenityCoatCheck')}</option>
              <option value="smoking_area">{t('structure.amenitySmokingArea')}</option>
              <option value="atm">{t('structure.amenityAtm')}</option>
              <option value="charging_station">{t('structure.amenityChargingStation')}</option>
              <option value="wheelchair_access">{t('structure.amenityWheelchairAccess')}</option>
              <option value="lost_found">{t('structure.amenityLostFound')}</option>
              <option value="parking">{t('structure.amenityParking')}</option>
            </Select>
          </FormField>
          <Input
            value={amenityLabel}
            onChange={e => setAmenityLabel(e.target.value)}
            placeholder={t('structure.labelPlaceholder')}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => onAddElement({kind: 'amenity', amenityType, label: amenityLabel.trim() || undefined})}
            className="w-full text-xs"
          >
            {t('structure.addAmenity')}
          </Button>
        </div>

        <div className="space-y-2 rounded-lg border border-gray-100 p-3">
          <Input
            value={parkingLabel}
            onChange={e => setParkingLabel(e.target.value)}
            placeholder={t('structure.labelPlaceholder')}
          />
          <FormField label={t('structure.capacityLabel')}>
            <Input
              type="number"
              min="0"
              value={parkingCapacity}
              onChange={e => setParkingCapacity(e.target.value)}
            />
          </FormField>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const capacity = parseInt(parkingCapacity, 10);
              onAddElement({
                kind: 'parking',
                label: parkingLabel.trim() || undefined,
                capacity: isNaN(capacity) ? undefined : capacity,
              });
            }}
            className="w-full text-xs"
          >
            {t('structure.addParking')}
          </Button>
        </div>

        <div className="space-y-2 rounded-lg border border-gray-100 p-3">
          <Input
            value={zoneLabel}
            onChange={e => setZoneLabel(e.target.value)}
            placeholder={t('structure.zoneNamePlaceholder')}
          />
          <FormField label={t('structure.colorLabel')}>
            <ColorPicker value={zoneColor} onChange={setZoneColor} />
          </FormField>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onAddElement({kind: 'zone', label: zoneLabel.trim() || undefined, color: zoneColor})}
            className="w-full text-xs"
          >
            {t('structure.addZone')}
          </Button>
        </div>

        <div className="space-y-2 rounded-lg border border-gray-100 p-3">
          <FormField label={t('structure.stageShapeLabel')}>
            <Select value={stageShape} onChange={e => setStageShape(e.target.value as StageShapeKind)}>
              <option value="rectangle">{t('structure.stageShapeRectangle')}</option>
              <option value="circle">{t('structure.stageShapeCircle')}</option>
              <option value="polygon">{t('structure.stageShapePolygon')}</option>
            </Select>
          </FormField>
          <Input
            value={stageLabel}
            onChange={e => setStageLabel(e.target.value)}
            placeholder={t('structure.zoneNamePlaceholder')}
          />
          <FormField label={t('structure.colorLabel')}>
            <ColorPicker value={stageColor} onChange={setStageColor} />
          </FormField>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              onAddElement({
                kind: 'stage',
                shape: stageShape,
                label: stageLabel.trim() || undefined,
                color: stageColor,
              })
            }
            className="w-full text-xs"
          >
            {t('structure.addStage')}
          </Button>
        </div>
      </div>
    </div>
  );
}
