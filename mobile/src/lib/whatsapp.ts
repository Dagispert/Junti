// Leer un chat exportado de WhatsApp («Exportar chat» con archivos): un .zip
// con el texto del chat y las fotos. De cada foto se saca cuándo se mandó,
// quién la mandó y, si la llevaba, su frase. Entiende los dos formatos:
//   iPhone:  [3/7/14, 18:22:11] Ana: ‎<adjunto: 00000012-PHOTO-2014-07-03-18-22-11.jpg>
//   Android: 03/07/14, 18:22 - Ana: IMG-20140703-WA0003.jpg (archivo adjunto)
//            Qué tarde más bonita   ← la frase, en la línea siguiente

import JSZip from 'jszip';

import { dateFromWhatsAppName } from './shared';

export type ChatPhoto = {
  /** nombre del archivo dentro del .zip */
  name: string;
  at: number;
  sender?: string;
  caption?: string;
  /** cómo sacarlo del .zip (se descomprime solo cuando se ve) */
  load: () => Promise<Blob>;
};

export type ChatImport = { title: string; photos: ChatPhoto[]; senders: string[] };

const PHOTO = /\.(jpe?g|png)$/i;
// las marcas invisibles que mete WhatsApp
const clean = (s: string) => s.replace(/[‎‏‪-‮⁦-⁩]/g, '').replace(/ /g, ' ');
const LINE =
  /^\[?(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?\s?m\.?)?\]?\s*(?:-\s*)?([^:]{1,60}):\s?([\s\S]*)$/i;
const ATTACH = /([\w-]+\.(?:jpe?g|png|webp|heic|mp4|mov|3gp|opus|pdf|vcf))/i;

type Msg = { d: number[]; time: number[]; ampm?: string; sender: string; text: string };

/** Abre el .zip exportado y devuelve sus fotos con su fecha, quién y la frase. */
export async function readChat(file: File): Promise<ChatImport> {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((f) => !f.dir);
  const txt = entries.find((f) => /\.txt$/i.test(f.name));
  const byName = new Map(entries.map((f) => [f.name.split('/').pop()!, f]));

  // 1) los mensajes del chat
  const msgs: Msg[] = [];
  if (txt) {
    const raw = clean(await txt.async('string'));
    for (const line of raw.split(/\r?\n/)) {
      const m = LINE.exec(line);
      if (m) {
        msgs.push({
          d: [+m[1], +m[2], +m[3]],
          time: [+m[4], +m[5], +(m[6] ?? 0)],
          ampm: m[7],
          sender: m[8].trim(),
          text: m[9],
        });
      } else if (msgs.length) msgs[msgs.length - 1].text += '\n' + line;
    }
  }
  // ¿día/mes o mes/día? Si algún primer número pasa de 12, es día/mes; si el segundo, mes/día.
  const dayFirst = msgs.some((m) => m.d[0] > 12 && m.d[0] < 32) || !msgs.some((m) => m.d[1] > 12);
  const dateOf = (m: Msg) => {
    let y: number, month: number, day: number;
    if (m.d[0] > 31)
      [y, month, day] = m.d; // año primero (2014-07-03)
    else {
      y = m.d[2];
      day = dayFirst ? m.d[0] : m.d[1];
      month = dayFirst ? m.d[1] : m.d[0];
    }
    if (y < 100) y += 2000;
    let h = m.time[0];
    if (m.ampm) {
      const pm = /p/i.test(m.ampm);
      if (pm && h < 12) h += 12;
      if (!pm && h === 12) h = 0;
    }
    return new Date(y, month - 1, day, h, m.time[1], m.time[2]).getTime();
  };

  // 2) cada foto mencionada en el chat, con su mensaje
  const photos: ChatPhoto[] = [];
  const seen = new Set<string>();
  for (const m of msgs) {
    const a = ATTACH.exec(m.text);
    if (!a || !PHOTO.test(a[1])) continue;
    const entry = byName.get(a[1]);
    if (!entry || seen.has(a[1])) continue;
    seen.add(a[1]);
    // la frase: lo que acompaña al adjunto, sin la marca de «adjunto»
    const caption = m.text
      .replace(/<[^>]*>/g, '')
      .replace(ATTACH, '')
      .replace(/\((archivo adjunto|file attached|fichier joint|arquivo anexado)\)/i, '')
      .replace(/^\s*[-:]\s*/, '')
      .trim();
    photos.push({
      name: a[1],
      at: dateOf(m),
      sender: m.sender,
      caption: caption && caption.length < 300 ? caption : undefined,
      load: () => entry.async('blob').then((b) => new Blob([b], { type: mime(a[1]) })),
    });
  }
  // 3) fotos del .zip que el chat no menciona: la fecha, de su nombre
  for (const [name, entry] of byName) {
    if (!PHOTO.test(name) || seen.has(name)) continue;
    const at = dateFromWhatsAppName(name) ?? entry.date?.getTime();
    if (!at) continue;
    photos.push({
      name,
      at,
      load: () => entry.async('blob').then((b) => new Blob([b], { type: mime(name) })),
    });
  }
  photos.sort((a, b) => a.at - b.at);
  const title = (txt?.name ?? file.name)
    .replace(/^.*\//, '')
    .replace(/\.(txt|zip)$/i, '')
    .replace(/^(_chat|WhatsApp Chat( with| con)?|Chat de WhatsApp con)\s*-?\s*/i, '')
    .trim();
  const senders = [...new Set(photos.map((p) => p.sender).filter(Boolean) as string[])];
  return { title, photos, senders };
}

const mime = (name: string) => (/\.png$/i.test(name) ? 'image/png' : 'image/jpeg');
