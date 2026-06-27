'use client';

import {useEffect, useState} from 'react';
import {useMutation} from 'convex/react';
import {api} from '@/convex/_generated/api';
import {Bell, BellOff} from 'lucide-react';
import {useTranslations} from 'next-intl';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

type SubscriptionState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed';

export function PushNotificationSetup() {
  const t = useTranslations('pwa.notifications');
  const [state, setState] = useState<SubscriptionState>('unsubscribed');
  const [loading, setLoading] = useState(false);

  const saveSubscription = useMutation(api.pushNotifications.saveSubscription);
  const deleteSubscription = useMutation(api.pushNotifications.deleteSubscription);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      setState('unsupported');
      return;
    }

    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setState(sub ? 'subscribed' : 'unsubscribed');
      });
    });
  }, []);

  async function subscribe() {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState('denied');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const json = sub.toJSON();
      const keys = json.keys as {p256dh: string; auth: string};

      await saveSubscription({
        endpoint: sub.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: navigator.userAgent,
      });

      setState('subscribed');
    } catch {
      // user dismissed or browser error — stay unsubscribed
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deleteSubscription({endpoint: sub.endpoint});
        await sub.unsubscribe();
      }
      setState('unsubscribed');
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  if (state === 'unsupported') return null;

  return (
    <div className="flex items-center gap-2">
      {state === 'denied' ? (
        <span className="text-xs text-red-500">{t('permissionDenied')}</span>
      ) : state === 'subscribed' ? (
        <button
          onClick={unsubscribe}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          <BellOff className="h-3.5 w-3.5" />
          {t('disable')}
        </button>
      ) : (
        <button
          onClick={subscribe}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 transition hover:bg-orange-100 disabled:opacity-50"
        >
          <Bell className="h-3.5 w-3.5" />
          {t('enable')}
        </button>
      )}
    </div>
  );
}
