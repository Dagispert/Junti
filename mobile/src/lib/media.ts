import { Platform } from 'react-native';

/** Extensión de archivo a partir del tipo MIME. */
export function extensionFor(mime: string | undefined, fallback: string): string {
  if (!mime) return fallback;
  const sub = mime.split('/')[1]?.split(';')[0] ?? '';
  return (
    {
      jpeg: 'jpg',
      quicktime: 'mov',
      'x-m4a': 'm4a',
      mp4: 'mp4',
      webm: 'webm',
      mpeg: 'mp3',
      ogg: 'ogg',
      png: 'png',
    }[sub] ??
    (sub || fallback)
  );
}

/**
 * Fotograma de portada de un vídeo (como imagen JPEG en «data:»). En la web se
 * saca con un lienzo; en el móvil nativo aún no, y se usa un fondo neutro.
 */
export async function videoPoster(uri: string): Promise<string | undefined> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    video.src = uri;
    const done = (value?: string) => {
      video.removeAttribute('src');
      video.load();
      resolve(value);
    };
    const timer = setTimeout(() => done(undefined), 8000);
    video.addEventListener('loadeddata', () => {
      video.currentTime = Math.min(0.5, (video.duration || 1) / 3);
    });
    video.addEventListener('seeked', () => {
      clearTimeout(timer);
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        const scale = Math.min(1, 1080 / Math.max(w, h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
        done(canvas.toDataURL('image/jpeg', 0.82));
      } catch {
        done(undefined);
      }
    });
    video.addEventListener('error', () => {
      clearTimeout(timer);
      done(undefined);
    });
  });
}

/** Duración en segundos (el selector la da en segundos en la web y en milisegundos en el móvil). */
export function secondsOf(duration: number | null | undefined): number | undefined {
  if (!duration) return undefined;
  return duration > 1000 ? duration / 1000 : duration;
}
