'use client';

import {forwardRef} from 'react';
import Konva from 'konva';
import {Group, Rect, Text} from 'react-konva';
import {VenueElement, DoorType} from '../types';

type DoorShapeProps = {
  element: VenueElement;
  selected: boolean;
  draggable: boolean;
  onClick?: () => void;
  onDragEnd?: (x: number, y: number) => void;
};

const DOOR_TYPE_COLOR: Record<DoorType, string> = {
  main: '#16A34A',
  emergency: '#DC2626',
  staff: '#D97706',
};

const DoorShape = forwardRef<Konva.Group, DoorShapeProps>(function DoorShape(
  {element, selected, draggable, onClick, onDragEnd},
  ref,
) {
  const width = element.width ?? 40;
  const height = element.height ?? 12;
  const color = DOOR_TYPE_COLOR[element.doorType ?? 'main'];

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
        opacity={0.85}
        stroke={selected ? '#111827' : color}
        strokeWidth={selected ? 3 : 1}
        cornerRadius={2}
      />
      {element.label && (
        <Text
          text={element.label}
          x={-width / 2}
          y={height / 2 + 2}
          fontSize={10}
          fill="#374151"
          listening={false}
        />
      )}
    </Group>
  );
});

export default DoorShape;
