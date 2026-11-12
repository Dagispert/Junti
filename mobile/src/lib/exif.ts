// La fecha en que se hizo una foto, leída de sus datos EXIF (si los tiene).
// Sirve para que un recuerdo se guarde en su fecha real sin tener que escribirla.

/** «2019:06:12 18:30:00» → milisegundos (hora local). */
function parseExifDate(value: string | undefined): number | undefined {
  const m = value && /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!m) return undefined;
  const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)).getTime();
  return t > Date.UTC(1990, 0, 1) && t < Date.now() + 86_400_000 ? t : undefined;
}

/** Lo que da expo-image-picker con «exif: true» (en el móvil). */
export function dateFromPickerExif(exif: Record<string, unknown> | null | undefined) {
  if (!exif) return undefined;
  const nested = (exif['{Exif}'] ?? {}) as Record<string, unknown>;
  const raw = (exif.DateTimeOriginal ??
    nested.DateTimeOriginal ??
    exif.DateTimeDigitized ??
    exif.DateTime) as string | undefined;
  return parseExifDate(raw);
}

/** Lee la fecha directamente del archivo JPEG (en la web, donde el selector no la da). */
export async function dateFromFile(uri: string): Promise<number | undefined> {
  try {
    const buffer = await (await fetch(uri)).arrayBuffer();
    const view = new DataView(buffer, 0, Math.min(buffer.byteLength, 256 * 1024));
    if (view.getUint16(0) !== 0xffd8) return undefined; // no es JPEG
    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset);
      const size = view.getUint16(offset + 2);
      if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) {
        return readTiff(view, offset + 10);
      }
      if ((marker & 0xff00) !== 0xff00) break;
      offset += 2 + size;
    }
  } catch {
    // sin fecha
  }
  return undefined;
}

function readTiff(view: DataView, start: number): number | undefined {
  const little = view.getUint16(start) === 0x4949;
  const u16 = (at: number) => view.getUint16(at, little);
  const u32 = (at: number) => view.getUint32(at, little);
  const text = (at: number, length: number) => {
    let s = '';
    for (let i = 0; i < length - 1 && at + i < view.byteLength; i++) {
      s += String.fromCharCode(view.getUint8(at + i));
    }
    return s;
  };
  const entries = (ifd: number) => {
    const list: { tag: number; value: number; count: number }[] = [];
    const n = u16(start + ifd);
    for (let i = 0; i < n; i++) {
      const at = start + ifd + 2 + i * 12;
      if (at + 12 > view.byteLength) break;
      list.push({ tag: u16(at), count: u32(at + 4), value: u32(at + 8) });
    }
    return list;
  };
  const ifd0 = entries(u32(start + 4));
  const exifPointer = ifd0.find((e) => e.tag === 0x8769);
  const fromExif = exifPointer ? entries(exifPointer.value) : [];
  const date =
    fromExif.find((e) => e.tag === 0x9003) ?? // DateTimeOriginal
    fromExif.find((e) => e.tag === 0x9004) ?? // DateTimeDigitized
    ifd0.find((e) => e.tag === 0x0132); // DateTime
  return date ? parseExifDate(text(start + date.value, date.count)) : undefined;
}
