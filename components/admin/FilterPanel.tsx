'use client';

import React from 'react';

type Props = {
  open: boolean;
  title: string;
  closeLabel: string;
  clearLabel: string;
  onClose: () => void;
  onClear: () => void;
  children: React.ReactNode;
};

/**
 * Reusable slide-in filter panel. Renders from the right side with a backdrop.
 * Callers provide filter fields as children and handle their own filter state.
 */
export default function FilterPanel({
  open,
  title,
  closeLabel,
  clearLabel,
  onClose,
  onClear,
  children,
}: Props) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={[
          'fixed right-0 top-0 z-40 flex h-full w-80 flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        aria-modal="true"
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            aria-label={closeLabel}
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {children}
        </div>

        <div className="border-t border-gray-200 px-5 py-4">
          <button
            onClick={onClear}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {clearLabel}
          </button>
        </div>
      </div>
    </>
  );
}
