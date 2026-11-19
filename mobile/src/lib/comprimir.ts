// Fotos más ligeras al subirlas: como mucho 1600 px por el lado largo y JPEG
// al 82 %. En la pantalla del móvil se ven igual y pesan una fracción (antes
// subían a tamaño completo, a veces de varios MB, y cada vez que alguien las
// veía se descargaban enteras). Solo web; si algo falla, se sube la original.

import { Platform } from 'react-native';

const LADO = 1600;
const CALIDAD = 0.82;
/** Las que ya son pequeñas se dejan como están. */
const LIGERA = 450 * 1024;

export async function comprimirFoto(
  uri: string,
  mime?: string,
): Promise<{ uri: string; mime: string }> {
  if (Platform.OS !== 'web' || typeof document === 'undefined')
    return { uri, mime: mime ?? 'image/jpeg' };
  // los GIF (animados) y los PNG pequeños, tal cual
  if (mime && /gif/i.test(mime)) return { uri, mime };
  try {
    const blob = await (await fetch(uri)).blob();
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new window.Image();
      i.onload = () => ok(i);
      i.onerror = mal;
      i.src = URL.createObjectURL(blob);
    });
    const largo = Math.max(img.naturalWidth, img.naturalHeight);
    if (blob.size <= LIGERA && largo <= LADO)
      return { uri, mime: mime ?? blob.type ?? 'image/jpeg' };
    const s = Math.min(1, LADO / largo);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF'; // (por si era un PNG con transparencia)
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const out = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', CALIDAD));
    if (!out || out.size >= blob.size) return { uri, mime: mime ?? blob.type ?? 'image/jpeg' };
    return { uri: URL.createObjectURL(out), mime: 'image/jpeg' };
  } catch {
    return { uri, mime: mime ?? 'image/jpeg' };
  }
}
