import { useState, useEffect } from 'react';
import { getVapidPublicKey, subscribePush, unsubscribePush } from '../lib/api';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

type State = 'idle' | 'subscribed' | 'denied' | 'unsupported' | 'loading';

export default function NotificationToggle() {
  const [state, setState] = useState<State>('idle');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    // Check if already subscribed
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => {
      if (sub) setState('subscribed');
    }).catch(() => {});
  }, []);

  const subscribe = async () => {
    setState('loading');
    try {
      const { publicKey } = await getVapidPublicKey();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      const keys = json.keys as { p256dh: string; auth: string };
      await subscribePush({ endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth });
      setState('subscribed');
    } catch (err: any) {
      if (Notification.permission === 'denied') setState('denied');
      else setState('idle');
    }
  };

  const unsubscribe = async () => {
    setState('loading');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setState('idle');
    } catch {
      setState('subscribed');
    }
  };

  if (state === 'unsupported') return null;

  return (
    <button
      onClick={state === 'subscribed' ? unsubscribe : subscribe}
      disabled={state === 'loading' || state === 'denied'}
      title={
        state === 'subscribed' ? 'Notificações ativas — clica para desativar' :
        state === 'denied' ? 'Notificações bloqueadas no browser' :
        'Ativar notificações de jogos'
      }
      className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all text-base ${
        state === 'subscribed'
          ? 'text-wc-gold bg-wc-gold/10 hover:bg-wc-gold/20'
          : state === 'denied'
          ? 'text-white/20 cursor-not-allowed'
          : 'text-white/40 hover:text-white hover:bg-white/6'
      }`}
    >
      {state === 'loading' ? '⏳' : state === 'subscribed' ? '🔔' : '🔕'}
    </button>
  );
}
