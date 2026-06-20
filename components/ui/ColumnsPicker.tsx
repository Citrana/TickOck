'use client';

import {useState, useRef, useEffect} from 'react';

export type ColOption = {key: string; label: string};

type ColumnsPickerProps = {
  all: ColOption[];
  visible: string[];
  onChange: (keys: string[]) => void;
  buttonLabel: string;
};

export default function ColumnsPicker({all, visible, onChange, buttonLabel}: ColumnsPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggle(key: string) {
    const next = visible.includes(key)
      ? visible.filter(k => k !== key)
      : [...visible, key];
    if (next.length === 0) return;
    onChange(next);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
        </svg>
        {buttonLabel}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1.5 w-48 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          {all.map(col => (
            <label
              key={col.key}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={visible.includes(col.key)}
                onChange={() => toggle(col.key)}
                className="h-4 w-4 rounded border-gray-300 accent-gray-900"
              />
              <span className="text-sm text-gray-700">{col.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
