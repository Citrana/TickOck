'use client';

import {forwardRef} from 'react';
import Konva from 'konva';
import {Circle, Ellipse, Group, Line, Rect, Text} from 'react-konva';
import {VenueElement} from '../types';

type StageShapeProps = {
  element: VenueElement;
  selected: boolean;
  draggable: boolean;
  onClick?: () => void;
  // Rectangle/circle: absolute new center position (like other rect shapes).
  // Polygon: how far the shape moved — the caller translates every point by
  // the same delta (mirrors WallShape's convention).
  onDragEnd?: (x: number, y: number) => void;
  // Polygon only: one vertex handle was dragged to a new absolute position.
  onPointDragEnd?: (pointIndex: number, x: number, y: number) => void;
};

const DEFAULT_STAGE_COLOR = '#1F2937';

// Three geometry variants sharing one component: rectangle/circle rotate via
// the canvas's Transformer (ref forwarded, like Zone/Parking); polygon
// reshapes via draggable per-vertex handles instead (ref never attached, so
// it's never offered to the Transformer — rotation isn't meaningful for a
// freeform outline defined by absolute points).
const StageShape = forwardRef<Konva.Group, StageShapeProps>(function StageShape(
  {element, selected, draggable, onClick, onDragEnd, onPointDragEnd},
  ref,
) {
  const color = element.color ?? DEFAULT_STAGE_COLOR;

  if (element.shape === 'circle') {
    const width = element.width ?? 200;
    const height = element.height ?? 200;
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
        <Ellipse
          radiusX={width / 2}
          radiusY={height / 2}
          fill={color}
          opacity={0.4}
          stroke={selected ? '#111827' : color}
          strokeWidth={selected ? 3 : 2}
        />
        {element.label && (
          <Text
            text={element.label}
            x={-width / 2}
            y={-8}
            width={width}
            align="center"
            fontSize={13}
            fontStyle="bold"
            fill="#F9FAFB"
            listening={false}
          />
        )}
      </Group>
    );
  }

  if (element.shape === 'polygon') {
    const points = element.points ?? [];
    const flatPoints = points.flatMap(p => [p.x, p.y]);
    const centroidX = points.reduce((sum, p) => sum + p.x, 0) / (points.length || 1);
    const centroidY = points.reduce((sum, p) => sum + p.y, 0) / (points.length || 1);

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
          points={flatPoints}
          closed
          fill={color}
          opacity={0.4}
          stroke={selected ? '#111827' : color}
          strokeWidth={selected ? 3 : 2}
        />
        {element.label && (
          <Text
            text={element.label}
            x={centroidX - 60}
            y={centroidY - 8}
            width={120}
            align="center"
            fontSize={13}
            fontStyle="bold"
            fill="#F9FAFB"
            listening={false}
          />
        )}
        {draggable &&
          points.map((point, index) => (
            <Circle
              key={index}
              x={point.x}
              y={point.y}
              radius={5}
              fill="#ffffff"
              stroke="#111827"
              strokeWidth={1.5}
              draggable
              onDragEnd={e => onPointDragEnd?.(index, e.target.x(), e.target.y())}
            />
          ))}
      </Group>
    );
  }

  // Rectangle (default).
  const width = element.width ?? 240;
  const height = element.height ?? 160;
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
        opacity={0.4}
        stroke={selected ? '#111827' : color}
        strokeWidth={selected ? 3 : 2}
        cornerRadius={4}
      />
      {element.label && (
        <Text
          text={element.label}
          x={-width / 2}
          y={-8}
          width={width}
          align="center"
          fontSize={13}
          fontStyle="bold"
          fill="#F9FAFB"
          listening={false}
        />
      )}
    </Group>
  );
});

export default StageShape;
