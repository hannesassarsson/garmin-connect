import { pushSubscribe, pushUnsubscribe } from './api';

const VAPID_PUBLIC =
  'BGx1Ej6HgdLbwsNzASeDQoXzflzzmlKONw0bj7a2rTXn74oJ4pHcDYhCzSX0AXhSGRmeu80va9u93KQLv3bYwV4';

export type PushState = 'unsupported' | 'needs-install' | 'off' | 'on' | 'denied';

const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

export function registerSw() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

export async function pushState(): Promise<PushState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    // iPhone visar bara push-stöd när appen ligger på hemskärmen.
    return /iPhone|iPad/.test(navigator.userAgent) && !standalone() ? 'needs-install' : 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
}

function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const raw = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function enablePush(key: string): Promise<PushState> {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) }));
  await pushSubscribe(key, sub.toJSON());
  return 'on';
}

export async function disablePush(key: string): Promise<PushState> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await pushUnsubscribe(key, sub.endpoint).catch(() => undefined);
    await sub.unsubscribe();
  }
  return 'off';
}
