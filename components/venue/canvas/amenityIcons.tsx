'use client';

import {Circle, Group, Line, Path, Rect} from 'react-konva';
import {AmenityType} from '../types';

// Mirrors lucide-react's own __iconNode tuple shape (see
// node_modules/lucide-react/dist/esm/icons/*.mjs) so new icons can be added
// by copy-pasting a lucide source array with minimal transformation.
export type IconPrimitive =
  | {type: 'path'; d: string}
  | {type: 'circle'; cx: number; cy: number; r: number}
  | {type: 'rect'; x: number; y: number; width: number; height: number; rx?: number}
  | {type: 'line'; x1: number; y1: number; x2: number; y2: number};

// Most amenity markers are a lucide icon on a colored circle. A few (e.g.
// parking) have no fitting line-style icon and are a plain text badge on a
// colored rounded rect instead — the registry lookup stays generic either
// way, only AmenityMarkerShape's render body switches on `kind`.
export type AmenityVisual =
  | {kind: 'icon'; color: string; icon: IconPrimitive[]}
  | {kind: 'badge'; color: string; text: string};

const ICON_VIEWBOX = 24;

export const AMENITY_ICON_REGISTRY: Record<AmenityType, AmenityVisual> = {
  toilet: {
    kind: 'icon',
    color: '#0891B2',
    icon: [
      {
        type: 'path',
        d: 'M7 12h13a1 1 0 0 1 1 1 5 5 0 0 1-5 5h-.598a.5.5 0 0 0-.424.765l1.544 2.47a.5.5 0 0 1-.424.765H5.402a.5.5 0 0 1-.424-.765L7 18',
      },
      {type: 'path', d: 'M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8'},
    ],
  },
  bar: {
    kind: 'icon',
    color: '#7C3AED',
    icon: [
      {type: 'path', d: 'M8 22h8'},
      {type: 'path', d: 'M7 10h10'},
      {type: 'path', d: 'M12 15v7'},
      {type: 'path', d: 'M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z'},
    ],
  },
  first_aid: {
    kind: 'icon',
    color: '#DC2626',
    icon: [
      {
        type: 'path',
        d: 'M4 9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a1 1 0 0 1 1 1v4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4a1 1 0 0 1 1-1h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-4a1 1 0 0 1-1-1V4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4a1 1 0 0 1-1 1z',
      },
    ],
  },
  info: {
    kind: 'icon',
    color: '#4B5563',
    icon: [
      {type: 'circle', cx: 12, cy: 12, r: 10},
      {type: 'path', d: 'M12 16v-4'},
      {type: 'path', d: 'M12 8h.01'},
    ],
  },
  coat_check: {
    kind: 'icon',
    color: '#0D9488',
    icon: [
      {
        type: 'path',
        d: 'M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z',
      },
    ],
  },
  smoking_area: {
    kind: 'icon',
    color: '#78716C',
    icon: [
      {type: 'path', d: 'M17 12H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h14'},
      {type: 'path', d: 'M18 8c0-2.5-2-2.5-2-5'},
      {type: 'path', d: 'M21 16a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1'},
      {type: 'path', d: 'M22 8c0-2.5-2-2.5-2-5'},
      {type: 'path', d: 'M7 12v4'},
    ],
  },
  atm: {
    kind: 'icon',
    color: '#16A34A',
    icon: [
      {type: 'path', d: 'M10 18v-7'},
      {
        type: 'path',
        d: 'M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z',
      },
      {type: 'path', d: 'M14 18v-7'},
      {type: 'path', d: 'M18 18v-7'},
      {type: 'path', d: 'M3 22h18'},
      {type: 'path', d: 'M6 18v-7'},
    ],
  },
  charging_station: {
    kind: 'icon',
    color: '#CA8A04',
    icon: [
      {type: 'path', d: 'm11 7-3 5h4l-3 5'},
      {type: 'path', d: 'M14.856 6H16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.935'},
      {type: 'path', d: 'M22 14v-4'},
      {type: 'path', d: 'M5.14 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.936'},
    ],
  },
  wheelchair_access: {
    kind: 'icon',
    color: '#2563EB',
    icon: [
      {type: 'circle', cx: 16, cy: 4, r: 1},
      {type: 'path', d: 'm18 19 1-7-6 1'},
      {type: 'path', d: 'm5 8 3-3 5.5 3-2.36 3.5'},
      {type: 'path', d: 'M4.24 14.5a5 5 0 0 0 6.88 6'},
      {type: 'path', d: 'M13.76 17.5a5 5 0 0 0-6.88-6'},
    ],
  },
  lost_found: {
    kind: 'icon',
    color: '#DB2777',
    icon: [
      {type: 'path', d: 'M12 22V12'},
      {type: 'path', d: 'M20.27 18.27 22 20'},
      {
        type: 'path',
        d: 'M21 10.498V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.729l7 4a2 2 0 0 0 2 .001l.98-.559',
      },
      {type: 'path', d: 'M3.29 7 12 12l8.71-5'},
      {type: 'path', d: 'm7.5 4.27 8.997 5.148'},
      {type: 'circle', cx: 18.5, cy: 16.5, r: 2.5},
    ],
  },
  parking: {
    kind: 'badge',
    color: '#4F46E5',
    text: 'P',
  },
};

// Used when an amenityType has no registry entry (legacy data / schema
// drift beyond what the exhaustive Record above can catch at compile time).
export const AMENITY_FALLBACK_VISUAL: AmenityVisual = {
  kind: 'icon',
  color: '#4B5563',
  icon: [
    {
      type: 'path',
      d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0',
    },
    {type: 'circle', cx: 12, cy: 10, r: 3},
  ],
};

type AmenityIconGlyphProps = {
  primitives: IconPrimitive[];
  size: number;
  color: string;
};

export function AmenityIconGlyph({primitives, size, color}: AmenityIconGlyphProps) {
  const scale = size / ICON_VIEWBOX;

  return (
    <Group scaleX={scale} scaleY={scale} offsetX={ICON_VIEWBOX / 2} offsetY={ICON_VIEWBOX / 2} listening={false}>
      {primitives.map((primitive, index) => {
        const strokeProps = {
          stroke: color,
          strokeWidth: 2,
          fill: 'none' as const,
          lineCap: 'round' as const,
          lineJoin: 'round' as const,
          listening: false,
        };
        switch (primitive.type) {
          case 'path':
            return <Path key={index} data={primitive.d} {...strokeProps} />;
          case 'circle':
            return <Circle key={index} x={primitive.cx} y={primitive.cy} radius={primitive.r} {...strokeProps} />;
          case 'rect':
            return (
              <Rect
                key={index}
                x={primitive.x}
                y={primitive.y}
                width={primitive.width}
                height={primitive.height}
                cornerRadius={primitive.rx}
                {...strokeProps}
              />
            );
          case 'line':
            return (
              <Line
                key={index}
                points={[primitive.x1, primitive.y1, primitive.x2, primitive.y2]}
                {...strokeProps}
              />
            );
        }
      })}
    </Group>
  );
}
