'use client';

import {Circle, Group, Text} from 'react-konva';
import {VenueSeat, SeatStatus, SEAT_RADIUS} from '../types';

type SeatShapeProps = {
  seat: VenueSeat;
  color: string;
  mode: 'edit' | 'select';
  isSelectedForEdit?: boolean;
  status?: SeatStatus;
  onClick?: () => void;
  onDragEnd?: (x: number, y: number) => void;
};

const STATUS_STYLE: Record<SeatStatus, {opacity: number; stroke: string}> = {
  available: {opacity: 1, stroke: '#1F2937'},
  selected: {opacity: 1, stroke: '#111827'},
  unavailable: {opacity: 0.3, stroke: '#9CA3AF'},
};

export default function SeatShape({
  seat,
  color,
  mode,
  isSelectedForEdit,
  status = 'available',
  onClick,
  onDragEnd,
}: SeatShapeProps) {
  const style = STATUS_STYLE[status];
  const draggable = mode === 'edit';
  const disabled = mode === 'select' && status === 'unavailable';

  return (
    <Group
      x={seat.x}
      y={seat.y}
      draggable={draggable}
      onClick={disabled ? undefined : onClick}
      onTap={disabled ? undefined : onClick}
      onDragEnd={e => onDragEnd?.(e.target.x(), e.target.y())}
      opacity={style.opacity}
    >
      <Circle
        radius={SEAT_RADIUS}
        fill={color}
        stroke={isSelectedForEdit || status === 'selected' ? '#111827' : style.stroke}
        strokeWidth={isSelectedForEdit || status === 'selected' ? 3 : 1}
      />
      <Text
        text={seat.seatLabel}
        fontSize={9}
        fill="#111827"
        width={SEAT_RADIUS * 2}
        height={SEAT_RADIUS * 2}
        offsetX={SEAT_RADIUS}
        offsetY={SEAT_RADIUS}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
    </Group>
  );
}
