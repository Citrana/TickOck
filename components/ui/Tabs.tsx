'use client';

type Tab = {
  key: string;
  label: string;
};

type TabsProps = {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
};

export default function Tabs({tabs, active, onChange}: TabsProps) {
  return (
    <div className="flex gap-1 border-b border-gray-200">
      {tabs.map(tab => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            active === tab.key
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
