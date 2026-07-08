'use client';

import {useMemo} from 'react';
import {Stage, Layer, Group} from 'react-konva';
import {Id} from '@/convex/_generated/dataModel';
import {VenueSection, VenueTier, VenueSeat, SeatStatus, CanvasMode, SEAT_RADIUS} from '../types';
import SectionShape from './SectionShape';
import SeatShape from './SeatShape';
import GAZoneShape from './GAZoneShape';

const DEFAULT_TIER_COLOR = '#9CA3AF';
const GA_ZONE_WIDTH = 220;
const GA_ZONE_HEIGHT = 120;
const SECTION_LABEL_LEFT = 16;
const SECTION_LABEL_TOP = 32;
const SECTION_LABEL_WIDTH = 140;
const SECTION_LABEL_HEIGHT = 24;

type LayoutCanvasProps = {
  canvasWidth: number;
  canvasHeight: number;
  sections: VenueSection[];
  tiers: VenueTier[];
  seats: VenueSeat[];
  mode: CanvasMode;
  selectedSectionId?: Id<'venueLayoutSections'> | null;
  selectedSeatId?: Id<'venueLayoutSeats'> | null;
  selectedSeatIds?: Set<Id<'venueLayoutSeats'>>;
  seatAvailability?: Record<string, SeatStatus>;
  gaSold?: Record<string, number>;
  onSectionClick?: (sectionId: Id<'venueLayoutSections'>) => void;
  onSectionDragEnd?: (sectionId: Id<'venueLayoutSections'>, x: number, y: number) => void;
  onSeatClick?: (seatId: Id<'venueLayoutSeats'>) => void;
  onSeatDragEnd?: (seatId: Id<'venueLayoutSeats'>, x: number, y: number) => void;
};

export default function LayoutCanvas({
  canvasWidth,
  canvasHeight,
  sections,
  tiers,
  seats,
  mode,
  selectedSectionId,
  selectedSeatId,
  selectedSeatIds,
  seatAvailability,
  gaSold,
  onSectionClick,
  onSectionDragEnd,
  onSeatClick,
  onSeatDragEnd,
}: LayoutCanvasProps) {
  const tierById = new Map(tiers.map(t => [t._id, t]));

  // Sections/seats keep their stored absolute x,y (edit mode relies on
  // that — onDragEnd persists coordinates relative to the Stage). In
  // read-only "select" mode nothing is dragged, so we can safely offset the
  // whole layer to center the actual content inside the fixed canvas size
  // instead of leaving it pinned wherever it happened to be authored.
  const {offsetX, offsetY} = useMemo(() => {
    if (mode !== 'select') return {offsetX: 0, offsetY: 0};

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

    if (xs.length === 0) return {offsetX: 0, offsetY: 0};

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      offsetX: Math.max(0, (canvasWidth - (maxX - minX)) / 2) - minX,
      offsetY: Math.max(0, (canvasHeight - (maxY - minY)) / 2) - minY,
    };
  }, [mode, sections, seats, canvasWidth, canvasHeight]);

  return (
    <div className="overflow-auto rounded-xl border border-gray-200 bg-gray-50">
      <Stage width={canvasWidth} height={canvasHeight}>
        <Layer>
          <Group x={offsetX} y={offsetY}>
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
