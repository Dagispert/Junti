import { Platform } from 'react-native';

// Invitar con un enlace: …/Junti/join?code=XXXX. Si quien lo abre aún no ha
// entrado, la invitación se guarda y se usa en cuanto entre o cree su cuenta.

const KEY = 'junti-invitacion';
const web = Platform.OS === 'web' && typeof window !== 'undefined';

/** El enlace para compartir una invitación. */
export function inviteLink(code: string): string {
  const base = web
    ? `${window.location.origin}${window.location.pathname.startsWith('/Junti') ? '/Junti' : ''}`
    : 'https://dagispert.github.io/Junti';
  return `${base}/join?code=${encodeURIComponent(code)}`;
}

/** Al abrir la app desde un enlace de invitación, se apunta el código. */
export function rememberInvite() {
  if (!web) return;
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    if (url.pathname.endsWith('/join') && code) localStorage.setItem(KEY, code);
  } catch {
    // sin almacenamiento: habrá que escribir el código
  }
}

/** La invitación pendiente, si la hay (y la olvida). */
export function takeInvite(): string | null {
  if (!web) return null;
  try {
    const code = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    return code;
  } catch {
    return null;
  }
}

/** Copiar al portapapeles (web). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
