'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {Stage, Layer, Group, Transformer} from 'react-konva';
import Konva from 'konva';
import {Id} from '@/convex/_generated/dataModel';
import {
  VenueSection,
  VenueTier,
  VenueSeat,
  VenueElement,
  SeatStatus,
  CanvasMode,
  SEAT_RADIUS,
} from '../types';
import SectionShape from './SectionShape';
import SeatShape from './SeatShape';
import GAZoneShape from './GAZoneShape';
import WallShape from './WallShape';
import DoorShape from './DoorShape';
import WindowShape from './WindowShape';
import ParkingZoneShape from './ParkingZoneShape';
import AmenityMarkerShape from './AmenityMarkerShape';
import ZoneShape from './ZoneShape';
import StageShape from './StageShape';

const DEFAULT_TIER_COLOR = '#9CA3AF';
const GA_ZONE_WIDTH = 220;
const GA_ZONE_HEIGHT = 120;
const SECTION_LABEL_LEFT = 16;
const SECTION_LABEL_TOP = 32;
const SECTION_LABEL_WIDTH = 140;
const SECTION_LABEL_HEIGHT = 24;
const CONTENT_PADDING = 24;
const MIN_SELECT_SCALE = 0.5;
const MAX_SELECT_SCALE = 2;

// Element kinds rendered as a rotatable rect — the only ones the edit-mode
// rotate handle attaches to. Walls (line segments) and amenities (point
// markers) have no rotation field. A stage is rotatable only when it's a
// rectangle/circle — a polygon stage reshapes via vertex handles instead.
const ROTATABLE_KINDS = new Set(['door', 'window', 'parking', 'zone']);

function isRotatable(element: VenueElement): boolean {
  if (element.kind === 'stage') return element.shape !== 'polygon';
  return ROTATABLE_KINDS.has(element.kind);
}

type LayoutCanvasProps = {
  canvasWidth: number;
  canvasHeight: number;
  sections: VenueSection[];
  tiers: VenueTier[];
  seats: VenueSeat[];
  elements?: VenueElement[];
  mode: CanvasMode;
  selectedSectionId?: Id<'venueLayoutSections'> | null;
  selectedSeatId?: Id<'venueLayoutSeats'> | null;
  selectedSeatIds?: Set<Id<'venueLayoutSeats'>>;
  selectedElementId?: Id<'venueLayoutElements'> | null;
  seatAvailability?: Record<string, SeatStatus>;
  gaSold?: Record<string, number>;
  onSectionClick?: (sectionId: Id<'venueLayoutSections'>) => void;
  onSectionDragEnd?: (sectionId: Id<'venueLayoutSections'>, x: number, y: number) => void;
  onSeatClick?: (seatId: Id<'venueLayoutSeats'>) => void;
  onSeatDragEnd?: (seatId: Id<'venueLayoutSeats'>, x: number, y: number) => void;
  onElementClick?: (elementId: Id<'venueLayoutElements'>) => void;
  onElementDragEnd?: (
    elementId: Id<'venueLayoutElements'>,
    patch: {x: number; y: number; x2?: number; y2?: number; points?: {x: number; y: number}[]},
  ) => void;
  onElementTransformEnd?: (elementId: Id<'venueLayoutElements'>, rotation: number) => void;
  onStagePointDragEnd?: (elementId: Id<'venueLayoutElements'>, pointIndex: number, x: number, y: number) => void;
};

export default function LayoutCanvas({
  canvasWidth,
  canvasHeight,
  sections,
  tiers,
  seats,
  elements = [],
  mode,
  selectedSectionId,
  selectedSeatId,
  selectedSeatIds,
  selectedElementId,
  seatAvailability,
  gaSold,
  onSectionClick,
  onSectionDragEnd,
  onSeatClick,
  onSeatDragEnd,
  onElementClick,
  onElementDragEnd,
  onElementTransformEnd,
  onStagePointDragEnd,
}: LayoutCanvasProps) {
  const tierById = new Map(tiers.map(t => [t._id, t]));

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  const transformerRef = useRef<Konva.Transformer>(null);
  const elementNodeRefs = useRef<Map<string, Konva.Group>>(new Map());

  // Ids present before this component's first render should never "drop in"
  // — only markers placed during this session (added to the set below as
  // they're first seen) get the placement animation.
  const seenElementIds = useRef<Set<string>>(new Set(elements.map(el => el._id)));

  // Only the read-only "select" view needs to be responsive to its
  // container — the edit-mode builder must stay pinned at a fixed 1:1
  // pixel scale so onDragEnd's persisted coordinates match what's drawn.
  useEffect(() => {
    if (mode !== 'select') return;
    const node = containerRef.current;
    if (!node) return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [mode]);

  // Attach/detach the rotate handle to whichever rect-based structure
  // element is currently selected in edit mode.
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    const selectedElement = selectedElementId
      ? elements.find(el => el._id === selectedElementId)
      : undefined;
    const node =
      mode === 'edit' && selectedElement && isRotatable(selectedElement)
        ? elementNodeRefs.current.get(selectedElement._id)
        : undefined;

    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [mode, selectedElementId, elements]);

  // Runs after render, once the current elements have actually been drawn —
  // marks them "seen" so a later re-render (e.g. an unrelated selection
  // change) never replays the drop-in animation for markers already on screen.
  useEffect(() => {
    for (const element of elements) seenElementIds.current.add(element._id);
  }, [elements]);

  // Sections/seats keep their stored absolute x,y (edit mode relies on
  // that — onDragEnd persists coordinates relative to the Stage). In
  // read-only "select" mode nothing is dragged, so we can safely scale and
  // offset the whole layer to fit the actual content into the measured
  // container width instead of leaving it pinned at the authored canvas
  // size, which usually leaves the seat map tiny inside a lot of dead space.
  const layoutMetrics = useMemo<{
    scale: number;
    stageWidth: number;
    stageHeight: number;
    groupX: number;
    groupY: number;
  }>(() => {
    const fallback = {
      scale: 1,
      stageWidth: canvasWidth,
      stageHeight: canvasHeight,
      groupX: 0,
      groupY: 0,
    };
    if (mode !== 'select') return fallback;

    const xs: number[] = [];
    const ys: number[] = [];
    for (const section of sections) {
      if (section.kind === 'ga') {
        xs.push(section.x, section.x + GA_ZONE_WIDTH);
        ys.push(section.y, section.y + GA_ZONE_HEIGHT);
      } else {
        xs.push(section.x - SECTION_LABEL_LEFT, section.x - SECTION_LABEL_LEFT + SECTION_LABEL_WIDTH);
        ys.push(section.y - SECTION_LABEL_TOP, section.y - SECTION_LABEL_TOP + SECTION_LABEL_HEIGHT);
      }
    }
    for (const seat of seats) {
      xs.push(seat.x - SEAT_RADIUS, seat.x + SEAT_RADIUS);
      ys.push(seat.y - SEAT_RADIUS, seat.y + SEAT_RADIUS);
    }

    if (xs.length === 0) return fallback;

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);

    const availableWidth = containerWidth ?? canvasWidth;
    const rawScale = availableWidth / contentWidth;
    const scale = Math.min(MAX_SELECT_SCALE, Math.max(MIN_SELECT_SCALE, rawScale));

    return {
      scale,
      stageWidth: contentWidth * scale + CONTENT_PADDING * 2,
      stageHeight: contentHeight * scale + CONTENT_PADDING * 2,
      groupX: CONTENT_PADDING - minX * scale,
      groupY: CONTENT_PADDING - minY * scale,
    };
  }, [mode, sections, seats, canvasWidth, canvasHeight, containerWidth]);

  function renderElement(element: VenueElement) {
    const selected = selectedElementId === element._id;
    const draggable = mode === 'edit';
    const setRef = (node: Konva.Group | null) => {
      if (node) elementNodeRefs.current.set(element._id, node);
      else elementNodeRefs.current.delete(element._id);
    };

    switch (element.kind) {
      case 'wall':
        return (
          <WallShape
            key={element._id}
            element={element}
            selected={selected}
            draggable={draggable}
            onClick={() => onElementClick?.(element._id)}
            onDragEnd={(dx, dy) => {
              // WallShape reports how far the group moved; translate both
              // endpoints by that same delta so the wall keeps its shape.
              onElementDragEnd?.(element._id, {
                x: element.x + dx,
                y: element.y + dy,
                x2: (element.x2 ?? element.x) + dx,
                y2: (element.y2 ?? element.y) + dy,
              });
            }}
          />
        );
      case 'door':
        return (
          <DoorShape
            key={element._id}
            ref={setRef}
            element={element}
            selected={selected}
            draggable={draggable}
            onClick={() => onElementClick?.(element._id)}
            onDragEnd={(x, y) => onElementDragEnd?.(element._id, {x, y})}
          />
        );
      case 'window':
        return (
          <WindowShape
            key={element._id}
            ref={setRef}
            element={element}
            selected={selected}
            draggable={draggable}
            onClick={() => onElementClick?.(element._id)}
            onDragEnd={(x, y) => onElementDragEnd?.(element._id, {x, y})}
          />
        );
      case 'parking':
        return (
          <ParkingZoneShape
            key={element._id}
            ref={setRef}
            element={element}
            selected={selected}
            draggable={draggable}
            onClick={() => onElementClick?.(element._id)}
            onDragEnd={(x, y) => onElementDragEnd?.(element._id, {x, y})}
          />
        );
      case 'amenity':
        return (
          <AmenityMarkerShape
            key={element._id}
            ref={setRef}
            element={element}
            selected={selected}
            draggable={draggable}
            animateIn={!seenElementIds.current.has(element._id)}
            onClick={() => onElementClick?.(element._id)}
            onDragEnd={(x, y) => onElementDragEnd?.(element._id, {x, y})}
          />
        );
      case 'zone':
        return (
          <ZoneShape
            key={element._id}
            ref={setRef}
            element={element}
            selected={selected}
            draggable={draggable}
            onClick={() => onElementClick?.(element._id)}
            onDragEnd={(x, y) => onElementDragEnd?.(element._id, {x, y})}
          />
        );
      case 'stage':
        return (
          <StageShape
            key={element._id}
            ref={setRef}
            element={element}
            selected={selected}
            draggable={draggable}
            onClick={() => onElementClick?.(element._id)}
            onDragEnd={(x, y) => {
              if (element.shape === 'polygon') {
                // StageShape reports how far the group moved for a polygon;
                // translate the anchor and every vertex by that same delta,
                // in one consolidated patch (mirrors the wall case above).
                onElementDragEnd?.(element._id, {
                  x: element.x + x,
                  y: element.y + y,
                  points: (element.points ?? []).map(p => ({x: p.x + x, y: p.y + y})),
                });
              } else {
                onElementDragEnd?.(element._id, {x, y});
              }
            }}
            onPointDragEnd={(pointIndex, x, y) => onStagePointDragEnd?.(element._id, pointIndex, x, y)}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div ref={containerRef} className="w-full overflow-auto rounded-xl border border-gray-200 bg-gray-50">
      <Stage width={layoutMetrics.stageWidth} height={layoutMetrics.stageHeight}>
        <Layer listening={mode === 'edit'}>
          <Group
            x={layoutMetrics.groupX}
            y={layoutMetrics.groupY}
            scaleX={layoutMetrics.scale}
            scaleY={layoutMetrics.scale}
          >
            {elements.map(renderElement)}
            {mode === 'edit' && (
              <Transformer
                ref={transformerRef}
                rotateEnabled
                enabledAnchors={[]}
                rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                onTransformEnd={() => {
                  if (!selectedElementId) return;
                  const node = elementNodeRefs.current.get(selectedElementId);
                  if (!node) return;
                  onElementTransformEnd?.(selectedElementId, node.rotation());
                }}
              />
            )}
          </Group>
        </Layer>

        <Layer>
          <Group
            x={layoutMetrics.groupX}
            y={layoutMetrics.groupY}
            scaleX={layoutMetrics.scale}
            scaleY={layoutMetrics.scale}
          >
            {sections.map(section => {
              if (section.kind === 'ga') {
                const tier = section.tierId ? tierById.get(section.tierId) : undefined;
                const color = tier?.color ?? DEFAULT_TIER_COLOR;
                const sold = gaSold?.[section._id];
                return (
                  <GAZoneShape
                    key={section._id}
                    section={section}
                    color={color}
                    selected={selectedSectionId === section._id}
                    draggable={mode === 'edit'}
                    onClick={() => onSectionClick?.(section._id)}
                    onDragEnd={(x, y) => onSectionDragEnd?.(section._id, x, y)}
                    soldLabel={sold !== undefined ? `${sold} sold` : undefined}
                  />
                );
              }

              return (
                <SectionShape
                  key={section._id}
                  section={section}
                  selected={selectedSectionId === section._id}
                  draggable={mode === 'edit'}
                  onClick={() => onSectionClick?.(section._id)}
                  onDragEnd={(x, y) => onSectionDragEnd?.(section._id, x, y)}
                />
              );
            })}

            {seats.map(seat => {
              const tier = seat.tierId ? tierById.get(seat.tierId) : undefined;
              const status = mode === 'select' ? seatAvailability?.[seat._id] ?? 'available' : undefined;
              const isSelectedForEdit = mode === 'edit' && selectedSeatId === seat._id;
              const isSelectedInCart = mode === 'select' && selectedSeatIds?.has(seat._id);
              return (
                <SeatShape
                  key={seat._id}
                  seat={seat}
                  color={tier?.color ?? DEFAULT_TIER_COLOR}
                  mode={mode}
                  isSelectedForEdit={isSelectedForEdit}
                  status={isSelectedInCart ? 'selected' : status}
                  onClick={() => onSeatClick?.(seat._id)}
                  onDragEnd={(x, y) => onSeatDragEnd?.(seat._id, x, y)}
                />
              );
            })}
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
