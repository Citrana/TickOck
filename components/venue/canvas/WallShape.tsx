'use client';

import {Group, Line} from 'react-konva';
import {VenueElement} from '../types';

type WallShapeProps = {
  element: VenueElement;
  selected: boolean;
  draggable: boolean;
  onClick?: () => void;
  onDragEnd?: (dx: number, dy: number) => void;
};

const WALL_THICKNESS = 6;

// Modeled as a line segment (x,y)-(x2,y2) rather than a rotated rect — this
// represents straight *and* angled walls without needing rotation math or a
// rotate handle. Dragging the group reports its offset so both endpoints can
// be shifted by the same delta.
export default function WallShape({element, selected, draggable, onClick, onDragEnd}: WallShapeProps) {
  const x2 = element.x2 ?? element.x;
  const y2 = element.y2 ?? element.y;

  return (
    <Group
      draggable={draggable}
      onClick={onClick}
      onTap={onClick}
      onDragEnd={e => {
        onDragEnd?.(e.target.x(), e.target.y());
        e.target.position({x: 0, y: 0});
      }}
    >
      <Line
        points={[element.x, element.y, x2, y2]}
        stroke={selected ? '#111827' : element.color ?? '#374151'}
        strokeWidth={selected ? WALL_THICKNESS + 2 : WALL_THICKNESS}
        lineCap="round"
        hitStrokeWidth={16}
      />
    </Group>
  );
}
