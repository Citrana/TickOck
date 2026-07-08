'use client';

const SWATCHES = [
  '#DC2626', '#EA580C', '#D97706', '#CA8A04',
  '#65A30D', '#16A34A', '#0D9488', '#0891B2',
  '#2563EB', '#4F46E5', '#7C3AED', '#C026D3',
  '#DB2777', '#71717A', '#1F2937',
];

type ColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
};

export default function ColorPicker({value, onChange}: ColorPickerProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {SWATCHES.map(color => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`h-6 w-6 rounded-full ring-offset-1 transition-transform hover:scale-110 ${
              value.toLowerCase() === color.toLowerCase() ? 'ring-2 ring-gray-900' : ''
            }`}
            style={{backgroundColor: color}}
            aria-label={color}
          />
        ))}
      </div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-24 rounded-md border border-gray-300 px-2 py-1 text-xs font-mono text-gray-700"
      />
    </div>
  );
}
