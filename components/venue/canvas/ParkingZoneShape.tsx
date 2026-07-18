'use client';

import {forwardRef} from 'react';
import Konva from 'konva';
import {Group, Rect, Text} from 'react-konva';
import {VenueElement} from '../types';

type ParkingZoneShapeProps = {
  element: VenueElement;
  selected: boolean;
  draggable: boolean;
  onClick?: () => void;
  onDragEnd?: (x: number, y: number) => void;
};

const ParkingZoneShape = forwardRef<Konva.Group, ParkingZoneShapeProps>(function ParkingZoneShape(
  {element, selected, draggable, onClick, onDragEnd},
  ref,
) {
  const width = element.width ?? 160;
  const height = element.height ?? 100;

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
        fill={element.color ?? '#94A3B8'}
        opacity={0.25}
        stroke={selected ? '#111827' : element.color ?? '#64748B'}
        strokeWidth={selected ? 3 : 2}
        cornerRadius={6}
        dash={[6, 5]}
      />
      <Text
        text={element.label ?? 'Parking'}
        x={-width / 2 + 10}
        y={-height / 2 + 10}
        fontSize={13}
        fontStyle="bold"
        fill="#111827"
        listening={false}
      />
      {element.capacity !== undefined && (
        <Text
          text={`Capacity ${element.capacity}`}
          x={-width / 2 + 10}
          y={-height / 2 + 30}
          fontSize={11}
          fill="#374151"
          listening={false}
        />
      )}
    </Group>
  );
});

export default ParkingZoneShape;
