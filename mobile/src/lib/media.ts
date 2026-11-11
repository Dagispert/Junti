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
    // Safari en el iPhone solo decodifica vídeos que estén en la página, mudos y «en línea».
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.style.cssText =
      'position:fixed;left:-10000px;top:0;width:4px;height:4px;opacity:0;pointer-events:none';
    document.body.appendChild(video);
    let finished = false;
    const done = (value?: string) => {
      if (finished) return;
      finished = true;
      clearTimeout(giveUp);
      clearTimeout(nudge);
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
      resolve(value);
    };
    const capture = () => {
      if (!video.videoWidth || !video.videoHeight) return false;
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        const scale = Math.min(1, 1080 / Math.max(w, h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
        done(canvas.toDataURL('image/jpeg', 0.82));
        return true;
      } catch {
        return false;
      }
    };
    const giveUp = setTimeout(() => done(undefined), 9000);
    // Si en un momento no ha llegado ningún fotograma, se le da a reproducir (en silencio).
    const nudge = setTimeout(() => {
      video.play().catch(() => {});
    }, 1500);
    video.addEventListener('loadeddata', () => {
      try {
        video.currentTime = Math.min(0.3, (video.duration || 1) / 4);
      } catch {
        capture();
      }
    });
    video.addEventListener('seeked', () => {
      capture();
    });
    video.addEventListener('timeupdate', () => {
      if (video.currentTime > 0.05) capture();
    });
    video.addEventListener('error', () => done(undefined));
    video.src = uri;
    video.load();
  });
}

/** Duración en segundos (el selector la da en segundos en la web y en milisegundos en el móvil). */
export function secondsOf(duration: number | null | undefined): number | undefined {
  if (!duration) return undefined;
  return duration > 1000 ? duration / 1000 : duration;
}
