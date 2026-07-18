'use client';

import {useTranslations} from 'next-intl';
import {Id} from '@/convex/_generated/dataModel';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import FormField from '@/components/ui/FormField';
import ColorPicker from '@/components/ui/ColorPicker';
import {VenueSection, VenueSeat, VenueTier, VenueElement, DoorType, AmenityType} from '../types';

export type ElementPatch = Partial<{
  width: number;
  height: number;
  x2: number;
  y2: number;
  rotation: number;
  doorType: DoorType;
  amenityType: AmenityType;
  capacity: number;
  label: string;
  color: string;
}>;

type PropertiesPanelProps = {
  tiers: VenueTier[];
  selectedSection: VenueSection | null;
  selectedSeat: VenueSeat | null;
  selectedElement: VenueElement | null;
  onUpdateSection: (sectionId: Id<'venueLayoutSections'>, patch: Partial<{name: string; gaCapacity: number; tierId: Id<'venueLayoutTiers'> | undefined}>) => void;
  onDeleteSection: (sectionId: Id<'venueLayoutSections'>) => void;
  onUpdateSeat: (seatId: Id<'venueLayoutSeats'>, patch: Partial<{seatLabel: string; rowLabel: string; tierId: Id<'venueLayoutTiers'> | undefined}>) => void;
  onDeleteSeat: (seatId: Id<'venueLayoutSeats'>) => void;
  onUpdateElement: (elementId: Id<'venueLayoutElements'>, patch: ElementPatch) => void;
  onDeleteElement: (elementId: Id<'venueLayoutElements'>) => void;
};

export default function PropertiesPanel({
  tiers,
  selectedSection,
  selectedSeat,
  selectedElement,
  onUpdateSection,
  onDeleteSection,
  onUpdateSeat,
  onDeleteSeat,
  onUpdateElement,
  onDeleteElement,
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

  if (selectedElement) {
    const isRectStage = selectedElement.kind === 'stage' && selectedElement.shape !== 'polygon';
    const isPolygonStage = selectedElement.kind === 'stage' && selectedElement.shape === 'polygon';
    const isRect = selectedElement.kind === 'door' || selectedElement.kind === 'window'
      || selectedElement.kind === 'parking' || selectedElement.kind === 'zone' || isRectStage;

    return (
      <div className="w-64 shrink-0 space-y-3 rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900">{t(`elementHeading.${selectedElement.kind}`)}</h3>

        {selectedElement.kind !== 'wall' && (
          <FormField label={t('elementLabelField')}>
            <Input
              value={selectedElement.label ?? ''}
              onChange={e => onUpdateElement(selectedElement._id, {label: e.target.value})}
            />
          </FormField>
        )}

        {selectedElement.kind === 'door' && (
          <FormField label={t('doorTypeField')}>
            <Select
              value={selectedElement.doorType ?? 'main'}
              onChange={e => onUpdateElement(selectedElement._id, {doorType: e.target.value as DoorType})}
            >
              <option value="main">{t('doorTypeMain')}</option>
              <option value="emergency">{t('doorTypeEmergency')}</option>
              <option value="staff">{t('doorTypeStaff')}</option>
            </Select>
          </FormField>
        )}

        {selectedElement.kind === 'amenity' && (
          <FormField label={t('amenityTypeField')}>
            <Select
              value={selectedElement.amenityType ?? 'info'}
              onChange={e => onUpdateElement(selectedElement._id, {amenityType: e.target.value as AmenityType})}
            >
              <option value="toilet">{t('amenityToilet')}</option>
              <option value="bar">{t('amenityBar')}</option>
              <option value="first_aid">{t('amenityFirstAid')}</option>
              <option value="info">{t('amenityInfo')}</option>
              <option value="coat_check">{t('amenityCoatCheck')}</option>
              <option value="smoking_area">{t('amenitySmokingArea')}</option>
              <option value="atm">{t('amenityAtm')}</option>
              <option value="charging_station">{t('amenityChargingStation')}</option>
              <option value="wheelchair_access">{t('amenityWheelchairAccess')}</option>
              <option value="lost_found">{t('amenityLostFound')}</option>
              <option value="parking">{t('amenityParking')}</option>
            </Select>
          </FormField>
        )}

        {selectedElement.kind === 'parking' && (
          <FormField label={t('capacityField')}>
            <Input
              type="number"
              min="0"
              value={selectedElement.capacity ?? 0}
              onChange={e =>
                onUpdateElement(selectedElement._id, {capacity: parseInt(e.target.value, 10) || 0})
              }
            />
          </FormField>
        )}

        {(selectedElement.kind === 'zone' || selectedElement.kind === 'parking' || selectedElement.kind === 'wall'
          || selectedElement.kind === 'stage') && (
          <FormField label={t('colorField')}>
            <ColorPicker
              value={selectedElement.color ?? '#2563EB'}
              onChange={color => onUpdateElement(selectedElement._id, {color})}
            />
          </FormField>
        )}

        {selectedElement.kind === 'wall' && (() => {
          const x1 = selectedElement.x;
          const y1 = selectedElement.y;
          const x2 = selectedElement.x2 ?? x1;
          const y2 = selectedElement.y2 ?? y1;
          const length = Math.hypot(x2 - x1, y2 - y1);
          const angleDeg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

          function setLength(nextLength: number) {
            const angleRad = (angleDeg * Math.PI) / 180;
            onUpdateElement(selectedElement!._id, {
              x2: x1 + nextLength * Math.cos(angleRad),
              y2: y1 + nextLength * Math.sin(angleRad),
            });
          }

          function setAngle(nextAngleDeg: number) {
            const angleRad = (nextAngleDeg * Math.PI) / 180;
            onUpdateElement(selectedElement!._id, {
              x2: x1 + length * Math.cos(angleRad),
              y2: y1 + length * Math.sin(angleRad),
            });
          }

          return (
            <div className="grid grid-cols-2 gap-2">
              <FormField label={t('lengthField')}>
                <Input
                  type="number"
                  min="1"
                  value={Math.round(length)}
                  onChange={e => setLength(parseInt(e.target.value, 10) || 1)}
                />
              </FormField>
              <FormField label={t('angleField')}>
                <Input
                  type="number"
                  value={Math.round(angleDeg)}
                  onChange={e => setAngle(parseInt(e.target.value, 10) || 0)}
                />
              </FormField>
            </div>
          );
        })()}

        {isRect && (
          <div className="grid grid-cols-2 gap-2">
            <FormField label={t('widthField')}>
              <Input
                type="number"
                min="1"
                value={selectedElement.width ?? 0}
                onChange={e => onUpdateElement(selectedElement._id, {width: parseInt(e.target.value, 10) || 1})}
              />
            </FormField>
            <FormField label={t('heightField')}>
              <Input
                type="number"
                min="1"
                value={selectedElement.height ?? 0}
                onChange={e => onUpdateElement(selectedElement._id, {height: parseInt(e.target.value, 10) || 1})}
              />
            </FormField>
          </div>
        )}

        {isRect && (
          <FormField label={t('angleField')}>
            <Input
              type="number"
              value={Math.round(selectedElement.rotation ?? 0)}
              onChange={e => onUpdateElement(selectedElement._id, {rotation: parseInt(e.target.value, 10) || 0})}
            />
          </FormField>
        )}

        {isRect && (
          <p className="text-xs text-gray-400">{t('rotateHint')}</p>
        )}

        {isPolygonStage && (
          <p className="text-xs text-gray-400">{t('polygonHint')}</p>
        )}

        <Button
          type="button"
          variant="ghost"
          className="w-full text-red-500"
          onClick={() => onDeleteElement(selectedElement._id)}
        >
          {t('deleteElement')}
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
