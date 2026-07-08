'use client';

import {Group, Rect, Text} from 'react-konva';
import {VenueSection} from '../types';

type SectionShapeProps = {
  section: VenueSection;
  selected: boolean;
  draggable: boolean;
  onClick?: () => void;
  onDragEnd?: (x: number, y: number) => void;
};

// Renders a section's label anchor only — seats belonging to the section are
// rendered separately at their own absolute canvas coordinates (see
// LayoutCanvas), so dragging this anchor repositions where new generated
// seats will be placed without silently detaching existing seats' stored
// positions from what's drawn on screen.
export default function SectionShape({
  section,
  selected,
  draggable,
  onClick,
  onDragEnd,
}: SectionShapeProps) {
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
        x={-16}
        y={-32}
        width={140}
        height={24}
        fill={selected ? '#EEF2FF' : 'transparent'}
        stroke={selected ? '#6366F1' : 'transparent'}
        cornerRadius={4}
      />
      <Text text={section.name} x={-16} y={-28} fontSize={13} fontStyle="bold" fill="#374151" />
    </Group>
  );
}
