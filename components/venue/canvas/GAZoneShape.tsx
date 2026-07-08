'use client';

import {Group, Rect, Text} from 'react-konva';
import {VenueSection} from '../types';

type GAZoneShapeProps = {
  section: VenueSection;
  color: string;
  selected: boolean;
  draggable: boolean;
  onClick?: () => void;
  onDragEnd?: (x: number, y: number) => void;
  soldLabel?: string;
};

const ZONE_WIDTH = 220;
const ZONE_HEIGHT = 120;

export default function GAZoneShape({
  section,
  color,
  selected,
  draggable,
  onClick,
  onDragEnd,
  soldLabel,
}: GAZoneShapeProps) {
  return (
    <Group
      x={section.x}
      y={section.y}
      draggable={draggable}
      onClick={onClick}
      onTap={onClick}
      onDragEnd={e => onDragEnd?.(e.target.x(), e.target.y())}
    >
      <Rect
        width={ZONE_WIDTH}
        height={ZONE_HEIGHT}
        fill={color}
        opacity={0.35}
        stroke={selected ? '#111827' : color}
        strokeWidth={selected ? 3 : 2}
        cornerRadius={12}
        dash={[8, 6]}
      />
      <Text text={section.name} x={12} y={12} fontSize={14} fontStyle="bold" fill="#111827" />
      <Text
        text={`General admission · capacity ${section.gaCapacity ?? 0}${soldLabel ? ` · ${soldLabel}` : ''}`}
        x={12}
        y={34}
        width={ZONE_WIDTH - 24}
        fontSize={11}
        fill="#374151"
      />
    </Group>
  );
}
