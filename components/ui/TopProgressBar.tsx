'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

type ProgressContextType = { start: () => void; done: () => void };

const ProgressBarContext = createContext<ProgressContextType>({ start: () => {}, done: () => {} });

export function useProgress() {
  return useContext(ProgressBarContext);
}

function RouteWatcher({ onNavigated }: { onNavigated: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMounted = useRef(false);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    onNavigated();
  }, [pathname, searchParams, onNavigated]);

  return null;
}

export function TopProgressBar({ children }: { children?: React.ReactNode }) {
  const [state, setState] = useState<'idle' | 'running' | 'completing'>('idle');
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setState('running');
  }, []);

  const done = useCallback(() => {
    setState(prev => {
      if (prev === 'idle') return 'idle';
      return 'completing';
    });
    hideTimer.current = setTimeout(() => setState('idle'), 500);
  }, []);

  // Intercept clicks on internal anchor tags
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;
      if (
        href.startsWith('http') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        anchor.getAttribute('target') === '_blank'
      ) return;

      start();
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [start]);

  const isVisible = state !== 'idle';
  const isCompleting = state === 'completing';

  return (
    <ProgressBarContext.Provider value={{ start, done }}>
      <Suspense>
        <RouteWatcher onNavigated={done} />
      </Suspense>

      <div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[9999] h-[3px] w-full"
      >
        <div
          className="h-full origin-left"
          style={{
            background: 'linear-gradient(to right, #1d4ed8, #3b82f6, #60a5fa)',
            boxShadow: '0 0 8px rgba(59, 130, 246, 0.6)',
            transform: isCompleting ? 'scaleX(1)' : isVisible ? 'scaleX(0.85)' : 'scaleX(0)',
            opacity: isCompleting ? 0 : 1,
            transition: isCompleting
              ? 'transform 0.25s ease, opacity 0.35s ease 0.1s'
              : isVisible
                ? 'transform 8s cubic-bezier(0.05, 0.8, 0.05, 1)'
                : 'none',
          }}
        />
      </div>

      {children}
    </ProgressBarContext.Provider>
  );
}
