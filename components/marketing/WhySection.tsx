'use client';

import {useState} from 'react';
import {Link} from '@/lib/navigation';

type Tab = {
  id: string;
  color: string;
  stripLabel: string;
  label: string;
  title: string;
  desc: string;
  cta: string;
  href: string;
};

type Props = {
  headline: string;
  tabs: Tab[];
};

export default function WhySection({headline, tabs}: Props) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? '');

  return (
    <div className="full-bleed bg-gray-900 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="mb-12 text-center text-4xl font-black text-white sm:text-5xl">
          {headline}
        </h2>

        {/* Desktop accordion — tabs stay in DOM for smooth CSS transitions */}
        <div className="hidden h-[480px] gap-3 lg:flex">
          {tabs.map(tab => {
            const isActive = tab.id === activeId;
            return (
              <div
                key={tab.id}
                onClick={isActive ? undefined : () => setActiveId(tab.id)}
                className={`${tab.color} relative overflow-hidden rounded-[2rem] transition-all duration-500 ease-in-out ${
                  isActive
                    ? 'flex-1'
                    : 'w-16 shrink-0 cursor-pointer hover:opacity-90'
                }`}
              >
                {/* ── Expanded card content ── */}
                <div
                  className={`absolute inset-0 grid grid-cols-2 transition-opacity duration-200 ${
                    isActive
                      ? 'opacity-100 delay-200'
                      : 'pointer-events-none opacity-0 delay-0'
                  }`}
                >
                  {/* Left: text */}
                  <div className="flex flex-col justify-center p-8 xl:p-10">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">
                      {tab.label}
                    </p>
                    <h3 className="mt-3 text-3xl font-black text-gray-900 xl:text-4xl">
                      {tab.title}
                    </h3>
                    <p className="mt-4 text-sm leading-relaxed text-gray-700 xl:text-base">
                      {tab.desc}
                    </p>
                    <div className="mt-8">
                      <Link
                        href={tab.href}
                        className="inline-block rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
                      >
                        {tab.cta}
                      </Link>
                    </div>
                  </div>

                  {/* Right: image placeholder with padding so it never touches borders */}
                  <div className="p-5 pl-0">
                    <div className="h-full w-full rounded-2xl bg-gray-300/50" />
                  </div>
                </div>

                {/* ── Collapsed strip content ── */}
                <div
                  className={`absolute inset-0 flex flex-col items-center py-5 transition-opacity duration-200 ${
                    !isActive
                      ? 'opacity-100 delay-200'
                      : 'pointer-events-none opacity-0 delay-0'
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-base font-black text-white">
                    +
                  </div>
                  <span
                    className="mt-3 flex-1 text-xs font-bold text-gray-900"
                    style={{writingMode: 'vertical-rl', transform: 'rotate(180deg)'}}
                  >
                    {tab.stripLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile: pill buttons + active card below */}
        <div className="lg:hidden">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveId(tab.id)}
                className={`${tab.color} flex-1 rounded-2xl px-4 py-3 text-left text-sm font-bold text-gray-900 transition-opacity ${
                  tab.id === activeId ? 'opacity-100' : 'opacity-50 hover:opacity-75'
                }`}
              >
                {tab.id === activeId ? '−' : '+'} {tab.stripLabel}
              </button>
            ))}
          </div>

          {tabs.map(tab =>
            tab.id === activeId ? (
              <div key={tab.id} className={`${tab.color} overflow-hidden rounded-2xl p-6`}>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">
                  {tab.label}
                </p>
                <h3 className="mt-2 text-2xl font-black text-gray-900">{tab.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-700">{tab.desc}</p>
                <Link
                  href={tab.href}
                  className="mt-5 inline-block rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
                >
                  {tab.cta}
                </Link>
                {/* Image with margin so it doesn't touch card borders */}
                <div className="m-1 mt-5 aspect-video rounded-xl bg-gray-300/50" />
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}
