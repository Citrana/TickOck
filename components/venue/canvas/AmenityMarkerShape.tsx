'use client';

import {forwardRef, useEffect, useRef} from 'react';
import Konva from 'konva';
import {Circle, Group, Rect, Text} from 'react-konva';
import {VenueElement} from '../types';
import {AMENITY_FALLBACK_VISUAL, AMENITY_ICON_REGISTRY, AmenityIconGlyph} from './amenityIcons';

type AmenityMarkerShapeProps = {
  element: VenueElement;
  selected: boolean;
  draggable: boolean;
  animateIn?: boolean;
  onClick?: () => void;
  onDragEnd?: (x: number, y: number) => void;
};

const MARKER_RADIUS = 14;
const ICON_SIZE = 18;
const SELECTION_RING_RADIUS = MARKER_RADIUS + 4;

const AmenityMarkerShape = forwardRef<Konva.Group, AmenityMarkerShapeProps>(function AmenityMarkerShape(
  {element, selected, draggable, animateIn, onClick, onDragEnd},
  ref,
) {
  const groupRef = useRef<Konva.Group | null>(null);
  const ringRef = useRef<Konva.Circle | null>(null);
  const visual = (element.amenityType ? AMENITY_ICON_REGISTRY[element.amenityType] : undefined) ?? AMENITY_FALLBACK_VISUAL;

  const setGroupRef = (node: Konva.Group | null) => {
    groupRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  // Scale-in from 0 when a marker is newly placed — only fires once, since
  // this effect runs on mount and a marker's key (element._id) never changes
  // for the component's lifetime.
  useEffect(() => {
    if (!animateIn) return;
    const node = groupRef.current;
    if (!node) return;

    node.scale({x: 0, y: 0});
    const tween = new Konva.Tween({
      node,
      scaleX: 1,
      scaleY: 1,
      duration: 0.28,
      easing: Konva.Easings.EaseOut,
    });
    tween.play();
    return () => tween.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pulse the selection ring only while this marker is selected, so at most
  // one animation loop runs regardless of how many markers are on the canvas.
  useEffect(() => {
    if (!selected) return;
    const ring = ringRef.current;
    if (!ring) return;

    const anim = new Konva.Animation(frame => {
      if (!frame) return;
      const pulse = Math.sin(frame.time * 0.003);
      const scale = 1 + 0.15 * (0.5 + pulse / 2);
      ring.scale({x: scale, y: scale});
      ring.opacity(0.4 + 0.6 * (1 - (0.5 + pulse / 2)));
    }, ring.getLayer());
    anim.start();
    return () => {
      anim.stop();
    };
  }, [selected]);

  return (
    <Group
      ref={setGroupRef}
      x={element.x}
      y={element.y}
      draggable={draggable}
      onClick={onClick}
      onTap={onClick}
      onDragEnd={e => onDragEnd?.(e.target.x(), e.target.y())}
    >
      {selected && (
        <Circle ref={ringRef} radius={SELECTION_RING_RADIUS} stroke="#111827" strokeWidth={2} listening={false} />
      )}
      {visual.kind === 'icon' ? (
        <>
          <Circle
            radius={MARKER_RADIUS}
            fill={visual.color}
            stroke={selected ? '#111827' : '#ffffff'}
            strokeWidth={selected ? 3 : 2}
          />
          <AmenityIconGlyph primitives={visual.icon} size={ICON_SIZE} color="#ffffff" />
        </>
      ) : (
        <>
          <Rect
            x={-MARKER_RADIUS}
            y={-MARKER_RADIUS}
            width={MARKER_RADIUS * 2}
            height={MARKER_RADIUS * 2}
            cornerRadius={5}
            fill={visual.color}
            stroke={selected ? '#111827' : '#ffffff'}
            strokeWidth={selected ? 3 : 2}
          />
          <Text
            text={visual.text}
            fontSize={14}
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
        </>
      )}
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
});

export default AmenityMarkerShape;
