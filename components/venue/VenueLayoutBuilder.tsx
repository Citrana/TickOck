'use client';

import {useEffect, useRef, useState} from 'react';
import dynamic from 'next/dynamic';
import {useQuery, useMutation} from 'convex/react';
import {useTranslations} from 'next-intl';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';
import Button from '@/components/ui/Button';
import ToolsSidebar from './sidebar/ToolsSidebar';
import TierLegend from './sidebar/TierLegend';
import PropertiesPanel from './sidebar/PropertiesPanel';
import {MAX_SEATS_PER_CALL} from '@/lib/venueGenerators';

// Konva touches HTMLCanvasElement at import time — must never run during SSR.
const LayoutCanvas = dynamic(() => import('./canvas/LayoutCanvas'), {ssr: false});

type VenueLayoutBuilderProps = {
  layoutId: Id<'venueLayoutTemplates'>;
  // When set, this layout is being built for one specific event that already
  // has priced ticket tiers — the tier legend shows those real tiers
  // read-only instead of letting the organizer define a separate price.
  forEventId?: Id<'events'>;
};

export default function VenueLayoutBuilder({layoutId, forEventId}: VenueLayoutBuilderProps) {
  const t = useTranslations('venueLayout.builder');
  const template = useQuery(api.venueLayout.getTemplate, {layoutId});
  const forEvent = useQuery(api.events.get, forEventId ? {eventId: forEventId} : 'skip');

  const addSection = useMutation(api.venueLayout.addSection);
  const updateSection = useMutation(api.venueLayout.updateSection);
  const deleteSection = useMutation(api.venueLayout.deleteSection);
  const addTier = useMutation(api.venueLayout.addTier);
  const updateTier = useMutation(api.venueLayout.updateTier);
  const deleteTier = useMutation(api.venueLayout.deleteTier);
  const bulkInsertSeats = useMutation(api.venueLayout.bulkInsertSeats);
  const updateSeatPosition = useMutation(api.venueLayout.updateSeatPosition);
  const updateSeatLabel = useMutation(api.venueLayout.updateSeatLabel);
  const assignSeatsToTier = useMutation(api.venueLayout.assignSeatsToTier);
  const deleteSeats = useMutation(api.venueLayout.deleteSeats);
  const updateTemplateMeta = useMutation(api.venueLayout.updateTemplateMeta);
  const ensureShadowTiersForEvent = useMutation(api.venueLayout.ensureShadowTiersForEvent);

  const [selectedSectionId, setSelectedSectionId] = useState<Id<'venueLayoutSections'> | null>(null);
  const [selectedSeatId, setSelectedSeatId] = useState<Id<'venueLayoutSeats'> | null>(null);

  const syncedRef = useRef(false);
  useEffect(() => {
    if (!forEventId || syncedRef.current) return;
    syncedRef.current = true;
    ensureShadowTiersForEvent({layoutId, eventId: forEventId});
  }, [forEventId, layoutId, ensureShadowTiersForEvent]);

  if (template === undefined || (forEventId && forEvent === undefined)) {
    return <div className="h-96 animate-pulse rounded-2xl bg-gray-100" />;
  }
  if (template === null) {
    return <p className="py-20 text-center text-gray-500">{t('notFound')}</p>;
  }
  if (forEventId && (!forEvent || forEvent.tiers.length === 0)) {
    return <p className="py-20 text-center text-gray-500">{t('noEventTiers')}</p>;
  }

  const selectedSection = template.sections.find(s => s._id === selectedSectionId) ?? null;
  const selectedSeat = template.seats.find(s => s._id === selectedSeatId) ?? null;

  async function handleAddSection(params: {
    name: string;
    kind: 'seated' | 'ga';
    gaCapacity?: number;
    tierId?: Id<'venueLayoutTiers'>;
  }) {
    const id = await addSection({
      layoutId,
      name: params.name,
      kind: params.kind,
      shape: params.kind === 'ga' ? 'ga-zone' : undefined,
      x: 40 + Math.random() * 60,
      y: 40 + Math.random() * 60,
      gaCapacity: params.gaCapacity,
      tierId: params.tierId,
    });
    setSelectedSectionId(id);
    setSelectedSeatId(null);
  }

  async function handleGenerateSeats(
    sectionId: Id<'venueLayoutSections'>,
    _shape: string,
    seats: {x: number; y: number; rowLabel?: string; seatLabel: string; tableLabel?: string; displayOrder: number}[],
    tierId?: Id<'venueLayoutTiers'>,
  ) {
    for (let i = 0; i < seats.length; i += MAX_SEATS_PER_CALL) {
      const chunk = seats.slice(i, i + MAX_SEATS_PER_CALL).map(s => ({...s, tierId}));
      await bulkInsertSeats({layoutId, sectionId, seats: chunk});
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <input
          value={template.name}
          onChange={e => updateTemplateMeta({layoutId, name: e.target.value})}
          className="text-xl font-bold text-gray-900 focus:outline-none"
        />
        <span className="text-xs text-gray-400">{t('autosaved')}</span>
      </div>

      <div className="flex gap-4">
        <ToolsSidebar
          tiers={template.tiers}
          selectedSection={selectedSection}
          onAddSection={handleAddSection}
          onGenerateSeats={handleGenerateSeats}
        />

        <div className="flex-1 space-y-4">
          <LayoutCanvas
            canvasWidth={template.canvasWidth}
            canvasHeight={template.canvasHeight}
            sections={template.sections}
            tiers={template.tiers}
            seats={template.seats}
            mode="edit"
            selectedSectionId={selectedSectionId}
            selectedSeatId={selectedSeatId}
            onSectionClick={id => {
              setSelectedSectionId(id);
              setSelectedSeatId(null);
            }}
            onSectionDragEnd={(id, x, y) => updateSection({sectionId: id, x, y})}
            onSeatClick={id => {
              setSelectedSeatId(id);
              setSelectedSectionId(null);
            }}
            onSeatDragEnd={(id, x, y) => updateSeatPosition({seatId: id, x, y})}
          />
          <TierLegend
            tiers={template.tiers}
            readOnly={!!forEventId}
            eventId={forEventId}
            ticketTiers={forEvent?.tiers}
            onAdd={tier => addTier({layoutId, ...tier})}
            onUpdate={(tierId, patch) => updateTier({tierId, ...patch})}
            onDelete={tierId => deleteTier({tierId})}
          />
        </div>

        <PropertiesPanel
          tiers={template.tiers}
          selectedSection={selectedSection}
          selectedSeat={selectedSeat}
          onUpdateSection={(sectionId, patch) => updateSection({sectionId, ...patch})}
          onDeleteSection={sectionId => {
            deleteSection({sectionId});
            setSelectedSectionId(null);
          }}
          onUpdateSeat={(seatId, patch) => {
            if (patch.tierId !== undefined) {
              assignSeatsToTier({seatIds: [seatId], tierId: patch.tierId});
            }
            if (patch.seatLabel !== undefined || patch.rowLabel !== undefined) {
              updateSeatLabel({
                seatId,
                seatLabel: patch.seatLabel ?? selectedSeat!.seatLabel,
                rowLabel: patch.rowLabel,
              });
            }
          }}
          onDeleteSeat={seatId => {
            deleteSeats({seatIds: [seatId]});
            setSelectedSeatId(null);
          }}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => updateTemplateMeta({layoutId, status: 'published'})}
        >
          {t('publish')}
        </Button>
      </div>
    </div>
  );
}
