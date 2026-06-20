'use client';

import {useEffect, useRef, useState} from 'react';
import jsQR from 'jsqr';
import {useMutation} from 'convex/react';
import {useTranslations} from 'next-intl';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';
import {parseConvexError} from '@/lib/errors';

type Props = {
  eventId: Id<'events'>;
  onClose: () => void;
};

type ScannerStatus =
  | {phase: 'requesting'}
  | {phase: 'scanning'}
  | {phase: 'processing'}
  | {phase: 'success'; buyerName: string; tierName: string}
  | {phase: 'error'; message: string}
  | {phase: 'denied'}
  | {phase: 'unsupported'};

export default function QrScannerOverlay({eventId, onClose}: Props) {
  const t = useTranslations('manage.checkin');
  const checkInMutation = useMutation(api.tickets.checkIn);

  const [status, setStatus] = useState<ScannerStatus>({phase: 'requesting'});

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lockRef = useRef(false);
  const frameCountRef = useRef(0);

  function stopScanLoop() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function startScanLoop() {
    function tick() {
      rafRef.current = requestAnimationFrame(tick);

      frameCountRef.current += 1;
      if (frameCountRef.current % 6 !== 0) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data.startsWith('TOCK:') && !lockRef.current) {
        handleScan(code.data);
      }
    }

    frameCountRef.current = 0;
    tick();
  }

  async function handleScan(data: string) {
    lockRef.current = true;
    stopScanLoop();
    setStatus({phase: 'processing'});

    try {
      const result = await checkInMutation({eventId, identifier: data});
      setStatus({phase: 'success', buyerName: result.buyerName, tierName: result.tierName});
      setTimeout(reset, 2000);
    } catch (err: unknown) {
      setStatus({phase: 'error', message: parseConvexError(err, t('errorGeneric'))});
      setTimeout(reset, 2500);
    }
  }

  function reset() {
    lockRef.current = false;
    setStatus({phase: 'scanning'});
    startScanLoop();
  }

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus({phase: 'unsupported'});
      return;
    }

    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({
        video: {facingMode: 'environment', width: {ideal: 1280}, height: {ideal: 720}},
      })
      .then(stream => {
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play().then(() => {
            if (!cancelled) {
              setStatus({phase: 'scanning'});
              startScanLoop();
            }
          });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setStatus({phase: 'denied'});
        } else {
          setStatus({phase: 'unsupported'});
        }
      });

    return () => {
      cancelled = true;
      stopScanLoop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-white">{t('scanner.title')}</span>
        <button
          onClick={onClose}
          aria-label={t('scanner.close')}
          className="rounded-lg p-2 text-white/70 hover:text-white"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Viewfinder */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Targeting square with dimmed surround */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-64 w-64 rounded-2xl border-4 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
        </div>

        {/* Phase overlays */}
        {(status.phase === 'requesting' || status.phase === 'processing') && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-black/70 px-6 py-5">
              <svg
                className="h-7 w-7 animate-spin text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <p className="text-sm text-white">
                {status.phase === 'requesting' ? t('scanner.requesting') : t('scanner.processing')}
              </p>
            </div>
          </div>
        )}

        {status.phase === 'success' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-green-600 px-6 py-5">
              <svg className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm font-semibold text-white">{t('scanner.successTitle')}</p>
              <p className="text-xs text-white/80">
                {status.buyerName} · {status.tierName}
              </p>
            </div>
          </div>
        )}

        {status.phase === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-red-600 px-6 py-5">
              <svg className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-center text-sm text-white">{status.message}</p>
            </div>
          </div>
        )}

        {(status.phase === 'denied' || status.phase === 'unsupported') && (
          <div className="absolute inset-0 flex items-center justify-center px-8">
            <div className="rounded-2xl bg-white/10 px-6 py-5 text-center">
              <p className="text-sm text-white">
                {status.phase === 'denied'
                  ? t('scanner.permissionDenied')
                  : t('scanner.unsupported')}
              </p>
              <button
                onClick={onClose}
                className="mt-4 rounded-lg bg-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/30"
              >
                {t('scanner.close')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom hint */}
      {status.phase === 'scanning' && (
        <div className="px-4 py-4 text-center">
          <p className="text-xs text-white/50">{t('scanner.hint')}</p>
        </div>
      )}
    </div>
  );
}
