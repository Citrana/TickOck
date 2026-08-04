'use client';

import {useEffect, useRef, useState} from 'react';
import dynamic from 'next/dynamic';
import {useQuery, useMutation} from 'convex/react';
import {useTranslations} from 'next-intl';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';
import Button from '@/components/ui/Button';
import Banner from '@/components/ui/Banner';
import {useCurrentUser} from '@/hooks/useCurrentUser';
import ToolsSidebar, {AddElementParams} from './sidebar/ToolsSidebar';
import TierLegend from './sidebar/TierLegend';
import PropertiesPanel, {ElementPatch} from './sidebar/PropertiesPanel';
import {MAX_SEATS_PER_CALL} from '@/lib/venueGenerators';

// Konva touches HTMLCanvasElement at import time — must never run during SSR.
const LayoutCanvas = dynamic(() => import('./canvas/LayoutCanvas'), {ssr: false});

const DEFAULT_RECT_SIZE: Record<string, {width: number; height: number}> = {
  door: {width: 40, height: 12},
  window: {width: 40, height: 6},
  parking: {width: 160, height: 100},
  zone: {width: 200, height: 140},
};

const STAGE_DEFAULT_SIZE: Record<'rectangle' | 'circle', {width: number; height: number}> = {
  rectangle: {width: 240, height: 160},
  circle: {width: 200, height: 200},
};

// A default thrust-stage outline (wide back edge, tapered front) — organizers
// drag these 6 vertices into a plain rectangle, hexagon, or any other shape.
const STAGE_POLYGON_OFFSETS: {x: number; y: number}[] = [
  {x: 0, y: 0},
  {x: 240, y: 0},
  {x: 240, y: 110},
  {x: 180, y: 160},
  {x: 60, y: 160},
  {x: 0, y: 110},
];

type VenueLayoutBuilderProps = {
  layoutId: Id<'venueLayoutTemplates'>;
  // When set, this layout is being built for one specific event that already
  // has priced ticket tiers — the tier legend shows those real tiers
  // read-only instead of letting the organizer define a separate price.
  forEventId?: Id<'events'>;
};

export default function VenueLayoutBuilder({layoutId, forEventId}: VenueLayoutBuilderProps) {
  const t = useTranslations('venueLayout.builder');
  const {user} = useCurrentUser();
  const template = useQuery(api.venueLayout.getTemplate, {layoutId});
  const forEvent = useQuery(api.events.get, forEventId ? {eventId: forEventId} : 'skip');
  const featureFlags = useQuery(api.featureFlags.list);
  const featureDisabled = featureFlags?.find(f => f.key === 'venue_layout_design')?.enabled === false;

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
  const addElement = useMutation(api.venueLayoutElements.addElement);
  const updateElement = useMutation(api.venueLayoutElements.updateElement);
  const deleteElement = useMutation(api.venueLayoutElements.deleteElement);

  const [selectedSectionId, setSelectedSectionId] = useState<Id<'venueLayoutSections'> | null>(null);
  const [selectedSeatId, setSelectedSeatId] = useState<Id<'venueLayoutSeats'> | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<Id<'venueLayoutElements'> | null>(null);

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

  const isAssisting = user != null && user._id !== template.ownerId;

  const selectedSection = template.sections.find(s => s._id === selectedSectionId) ?? null;
  const selectedSeat = template.seats.find(s => s._id === selectedSeatId) ?? null;
  const selectedElement = template.elements.find(el => el._id === selectedElementId) ?? null;

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
    setSelectedElementId(null);
  }

  async function handleAddElement(params: AddElementParams) {
    const x = 40 + Math.random() * 100;
    const y = 40 + Math.random() * 100;
    const defaultSize = DEFAULT_RECT_SIZE[params.kind];

    let width = params.width ?? defaultSize?.width;
    let height = params.height ?? defaultSize?.height;
    let points: {x: number; y: number}[] | undefined;

    if (params.kind === 'stage') {
      if (params.shape === 'rectangle' || params.shape === 'circle') {
        width = width ?? STAGE_DEFAULT_SIZE[params.shape].width;
        height = height ?? STAGE_DEFAULT_SIZE[params.shape].height;
      } else if (params.shape === 'polygon') {
        points = STAGE_POLYGON_OFFSETS.map(p => ({x: x + p.x, y: y + p.y}));
      }
    }

    const id = await addElement({
      layoutId,
      kind: params.kind,
      x,
      y,
      ...(params.kind === 'wall' ? {x2: x + 240, y2: y} : {}),
      width,
      height,
      shape: params.shape,
      points,
      doorType: params.doorType,
      amenityType: params.amenityType,
      capacity: params.capacity,
      label: params.label,
      color: params.color,
    });
    setSelectedElementId(id);
    setSelectedSectionId(null);
    setSelectedSeatId(null);
  }

  function handleStagePointDragEnd(elementId: Id<'venueLayoutElements'>, pointIndex: number, x: number, y: number) {
    if (!template) return;
    const element = template.elements.find(el => el._id === elementId);
    if (!element?.points) return;
    const points = element.points.map((p, i) => (i === pointIndex ? {x, y} : p));
    updateElement({elementId, points});
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
      {isAssisting && <Banner>{t('assistBanner')}</Banner>}
      {featureDisabled && <Banner>{t('disabledNotice')}</Banner>}

      <div className="flex items-center justify-between">
        <input
          value={template.name}
          onChange={e => updateTemplateMeta({layoutId, name: e.target.value})}
          className="text-xl font-bold text-gray-900 focus:outline-none"
        />
        <span className="text-xs text-gray-400">{t('autosaved')}</span>
      </div>

      <div className="flex gap-4">
        {!featureDisabled && (
          <ToolsSidebar
            tiers={template.tiers}
            selectedSection={selectedSection}
            onAddSection={handleAddSection}
            onGenerateSeats={handleGenerateSeats}
            onAddElement={handleAddElement}
          />
        )}

        <div className="min-w-0 flex-1 space-y-4">
          <LayoutCanvas
            canvasWidth={template.canvasWidth}
            canvasHeight={template.canvasHeight}
            sections={template.sections}
            tiers={template.tiers}
            seats={template.seats}
            elements={template.elements}
            mode="edit"
            selectedSectionId={selectedSectionId}
            selectedSeatId={selectedSeatId}
            selectedElementId={selectedElementId}
            onSectionClick={id => {
              setSelectedSectionId(id);
              setSelectedSeatId(null);
              setSelectedElementId(null);
            }}
            onSectionDragEnd={(id, x, y) => updateSection({sectionId: id, x, y})}
            onSeatClick={id => {
              setSelectedSeatId(id);
              setSelectedSectionId(null);
              setSelectedElementId(null);
            }}
            onSeatDragEnd={(id, x, y) => updateSeatPosition({seatId: id, x, y})}
            onElementClick={id => {
              setSelectedElementId(id);
              setSelectedSectionId(null);
              setSelectedSeatId(null);
            }}
            onElementDragEnd={(id, patch) => updateElement({elementId: id, ...patch})}
            onElementTransformEnd={(id, rotation) => updateElement({elementId: id, rotation})}
            onStagePointDragEnd={handleStagePointDragEnd}
          />
          <TierLegend
            tiers={template.tiers}
            readOnly={!!forEventId || featureDisabled}
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
          selectedElement={selectedElement}
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
          onUpdateElement={(elementId, patch: ElementPatch) => updateElement({elementId, ...patch})}
          onDeleteElement={elementId => {
            deleteElement({elementId});
            setSelectedElementId(null);
          }}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={featureDisabled}
          onClick={() => updateTemplateMeta({layoutId, status: 'published'})}
        >
          {t('publish')}
        </Button>
      </div>
    </div>
  );
}
