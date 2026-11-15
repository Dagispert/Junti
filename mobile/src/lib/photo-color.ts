import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// El color de fondo de una escena sale de su propia foto: se promedia la
// imagen en pequeño y se convierte en un tono plano y suave (pastel), para
// que la tinta oscura siga leyéndose encima. Fuera de la web no se calcula.

const cache = new Map<string, Promise<string | null>>();

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

/** Un tono plano a partir del color medio (y más vivo) de la foto. */
function flatten(data: Uint8ClampedArray): string {
  // Se pesan más los píxeles con color (los grises apenas cuentan).
  let r = 0,
    g = 0,
    b = 0,
    w = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    const k = 0.15 + s * (1 - Math.abs(l - 0.5) * 2);
    r += data[i] * k;
    g += data[i + 1] * k;
    b += data[i + 2] * k;
    w += k;
  }
  const [h, s] = rgbToHsl(r / w, g / w, b / w);
  const sat = Math.round(Math.min(0.42, s * 0.75 + 0.08) * 100);
  return `hsl(${Math.round(h)}, ${sat}%, 88%)`;
}

export function photoColor(uri: string): Promise<string | null> {
  const hit = cache.get(uri);
  if (hit) return hit;
  const job = new Promise<string | null>((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 24;
        const x = c.getContext('2d')!;
        x.drawImage(img, 0, 0, 24, 24);
        resolve(flatten(x.getImageData(0, 0, 24, 24).data));
      } catch {
        resolve(null); // la imagen no deja leerse (CORS)
      }
    };
    img.onerror = () => resolve(null);
    img.src = uri;
  });
  cache.set(uri, job);
  return job;
}

/** Los colores de varias fotos, según van llegando: { uri: color }. */
export function usePhotoColors(uris: (string | undefined)[]) {
  const [colors, setColors] = useState<Record<string, string>>({});
  const key = uris.filter(Boolean).join('|');
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let alive = true;
    for (const uri of new Set(uris.filter((u): u is string => !!u)))
      photoColor(uri).then((c) => alive && c && setColors((all) => ({ ...all, [uri]: c })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return colors;
}
