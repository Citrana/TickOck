'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';

export function InstallPrompt() {
  const t = useTranslations('pwa');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    function handleBeforeInstallPrompt(e: BeforeInstallPromptEvent) {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setIsVisible(false);
      setDeferredPrompt(null);
    }
  }

  if (!isVisible) return null;

  return (
    <Button
      variant="secondary"
      onClick={handleInstall}
      aria-label={t('installTitle')}
      title={t('installDescription')}
      className="flex items-center gap-2"
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
      {t('install')}
    </Button>
  );
}
