'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      if (process.env.NODE_ENV === 'development') {
        console.error('SW registration failed:', err);
      }
    });
  }, []);

  return null;
}
