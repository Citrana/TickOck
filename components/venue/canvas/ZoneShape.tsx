'use client';

import {forwardRef} from 'react';
import Konva from 'konva';
import {Group, Rect, Text} from 'react-konva';
import {VenueElement} from '../types';

type ZoneShapeProps = {
  element: VenueElement;
  selected: boolean;
  draggable: boolean;
  onClick?: () => void;
  onDragEnd?: (x: number, y: number) => void;
};

// Same visual family as GAZoneShape, but a freeform color/label with no tier
// link — used for VIP/general-admission/restricted areas that are purely
// visual annotations on the floor plan, not tied to seat inventory.
const ZoneShape = forwardRef<Konva.Group, ZoneShapeProps>(function ZoneShape(
  {element, selected, draggable, onClick, onDragEnd},
  ref,
) {
  const width = element.width ?? 200;
  const height = element.height ?? 140;
  const color = element.color ?? '#2563EB';

  return (
    <Group
      ref={ref}
      x={element.x}
      y={element.y}
      rotation={element.rotation ?? 0}
      draggable={draggable}
      onClick={onClick}
      onTap={onClick}
      onDragEnd={e => onDragEnd?.(e.target.x(), e.target.y())}
    >
      <Rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        fill={color}
        opacity={0.2}
        stroke={selected ? '#111827' : color}
        strokeWidth={selected ? 3 : 2}
        cornerRadius={10}
      />
      {element.label && (
        <Text
          text={element.label}
          x={-width / 2 + 10}
          y={-height / 2 + 10}
          fontSize={13}
          fontStyle="bold"
          fill="#111827"
          listening={false}
        />
      )}
    </Group>
  );
});

export default ZoneShape;
