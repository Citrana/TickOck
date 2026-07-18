'use client';

import {forwardRef} from 'react';
import Konva from 'konva';
import {Group, Rect} from 'react-konva';
import {VenueElement} from '../types';

type WindowShapeProps = {
  element: VenueElement;
  selected: boolean;
  draggable: boolean;
  onClick?: () => void;
  onDragEnd?: (x: number, y: number) => void;
};

const WindowShape = forwardRef<Konva.Group, WindowShapeProps>(function WindowShape(
  {element, selected, draggable, onClick, onDragEnd},
  ref,
) {
  const width = element.width ?? 40;
  const height = element.height ?? 6;

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
        fill="#BFDBFE"
        stroke={selected ? '#111827' : '#3B82F6'}
        strokeWidth={selected ? 3 : 1.5}
      />
    </Group>
  );
});

export default WindowShape;
