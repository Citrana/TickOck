'use client';

import {Circle, Group, Text} from 'react-konva';
import {VenueElement, AmenityType} from '../types';

type AmenityMarkerShapeProps = {
  element: VenueElement;
  selected: boolean;
  draggable: boolean;
  onClick?: () => void;
  onDragEnd?: (x: number, y: number) => void;
};

const MARKER_RADIUS = 14;

const AMENITY_STYLE: Record<AmenityType, {color: string; glyph: string}> = {
  toilet: {color: '#0891B2', glyph: 'WC'},
  bar: {color: '#7C3AED', glyph: 'BAR'},
  first_aid: {color: '#DC2626', glyph: '+'},
  info: {color: '#4B5563', glyph: 'i'},
  coat_check: {color: '#0D9488', glyph: 'CO'},
  smoking_area: {color: '#78716C', glyph: 'SM'},
  atm: {color: '#16A34A', glyph: '$'},
  charging_station: {color: '#CA8A04', glyph: 'CH'},
  wheelchair_access: {color: '#2563EB', glyph: 'WA'},
  lost_found: {color: '#DB2777', glyph: 'LF'},
};

// Rendered as a colored badge (glyph) + label rather than a rasterized icon —
// Konva can't render React icon components directly inside a Layer, and this
// avoids depending on hand-copied SVG path data for correctness.
export default function AmenityMarkerShape({
  element,
  selected,
  draggable,
  onClick,
  onDragEnd,
}: AmenityMarkerShapeProps) {
  const style = AMENITY_STYLE[element.amenityType ?? 'info'];

  return (
    <Group
      x={element.x}
      y={element.y}
      draggable={draggable}
      onClick={onClick}
      onTap={onClick}
      onDragEnd={e => onDragEnd?.(e.target.x(), e.target.y())}
    >
      <Circle
        radius={MARKER_RADIUS}
        fill={style.color}
        stroke={selected ? '#111827' : '#ffffff'}
        strokeWidth={selected ? 3 : 2}
      />
      <Text
        text={style.glyph}
        fontSize={9}
        fontStyle="bold"
        fill="#ffffff"
        width={MARKER_RADIUS * 2}
        height={MARKER_RADIUS * 2}
        offsetX={MARKER_RADIUS}
        offsetY={MARKER_RADIUS}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
      {element.label && (
        <Text
          text={element.label}
          x={-40}
          y={MARKER_RADIUS + 4}
          width={80}
          align="center"
          fontSize={11}
          fill="#374151"
          listening={false}
        />
      )}
    </Group>
  );
}
