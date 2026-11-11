import { Platform } from 'react-native';

import { supabase } from './supabase';

// Avisos en la versión web. En la app nativa esto se sustituirá por los avisos
// del sistema; por eso todo queda detrás de «Platform.OS === 'web'».

/** Ruta bajo la que se sirve la app (p. ej. "/Junti"); vacía en desarrollo. */
const BASE = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');

export type PushState =
  | 'unsupported' // este navegador no admite avisos
  | 'needs-install' // iPhone/iPad: hay que añadir la app a la pantalla de inicio
  | 'denied' // la persona los bloqueó en el navegador
  | 'off'
  | 'on';

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/** Enlaza el manifiesto y el icono para que la app se pueda añadir a la pantalla de inicio. */
export function setupInstallable(): void {
  if (!isWeb || document.querySelector('link[rel="manifest"]')) return;
  const add = (tag: string, attrs: Record<string, string>) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.head.appendChild(el);
  };
  add('link', { rel: 'manifest', href: `${BASE}/manifest.json` });
  add('link', { rel: 'apple-touch-icon', href: `${BASE}/apple-touch-icon.png` });
  add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
  add('meta', { name: 'apple-mobile-web-app-title', content: 'Junti' });
  add('meta', { name: 'theme-color', content: '#F6F6F7' });
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` });
  return navigator.serviceWorker.ready;
}

export async function pushState(): Promise<PushState> {
  if (!isWeb) return 'unsupported';
  if (isIos() && !isStandalone()) return 'needs-install';
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  try {
    const reg = await navigator.serviceWorker.getRegistration(`${BASE}/`);
    return (await reg?.pushManager.getSubscription()) ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

function decodeKey(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Pide permiso, suscribe este dispositivo y lo guarda. Lanza un error legible si no se puede. */
export async function enablePush(): Promise<void> {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'vapid_public')
    .limit(1);
  if (error) throw new Error(error.message);
  const publicKey = data?.[0]?.value;
  if (!publicKey) throw new Error('Los avisos todavía no están configurados en el servidor.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('No has dado permiso para recibir avisos.');

  const reg = await registration();
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeKey(publicKey),
    }));
  const json = subscription.toJSON();
  const saved = await supabase
    .from('push_subscriptions')
    .upsert(
      { endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      { onConflict: 'endpoint' },
    );
  if (saved.error) throw new Error(saved.error.message);
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration(`${BASE}/`);
  const subscription = await reg?.pushManager.getSubscription();
  if (!subscription) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
  await subscription.unsubscribe();
}
