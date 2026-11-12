import JSZip from 'jszip';

import type { Album, Group, Moment, User } from '@/data/types';

// Descargar la memoria de un grupo: un .zip con una carpeta por mes (fotos,
// vídeos y notas de voz con nombres que se entienden), una página «memoria.html»
// para verlo todo en el navegador sin la app, y los álbumes. Solo en la web.

const pad = (n: number) => String(n).padStart(2, '0');
const day = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const clean = (s: string) =>
  s
    .replace(/[\\/:*?"<>|\n\r]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const extOf = (blob: Blob, fallback: string) => {
  const t = blob.type;
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  if (t.includes('png')) return 'png';
  if (t.includes('webp')) return 'webp';
  if (t.includes('heic')) return 'heic';
  if (t.includes('quicktime')) return 'mov';
  if (t.includes('mp4')) return t.startsWith('audio') ? 'm4a' : 'mp4';
  if (t.includes('webm')) return 'webm';
  if (t.includes('mpeg')) return 'mp3';
  return fallback;
};

export async function exportMemory({
  group,
  moments,
  albums,
  user,
  onProgress,
}: {
  group: Group;
  moments: Moment[];
  albums: Album[];
  user: (id: string) => User;
  onProgress?: (done: number, total: number) => void;
}): Promise<void> {
  const zip = new JSZip();
  const list = [...moments].sort((a, b) => a.createdAt - b.createdAt);
  type Kind = 'photo' | 'video' | 'audio';
  const files = new Map<string, { name: string; kind: Kind }[]>(); // momento → archivos en el zip
  let done = 0;
  const total = list.length;

  for (const m of list) {
    const d = new Date(m.createdAt);
    const folder = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const base = `${day(m.createdAt)} ${clean(user(m.authorId).name)}${m.text ? ` - ${clean(m.text)}` : ''}`;
    const sources: { uri: string; fallback: string; kind: Kind }[] = [
      ...(m.videoUri ? [{ uri: m.videoUri, fallback: 'mp4', kind: 'video' as const }] : []),
      ...(m.photos ?? (m.imageUri && !m.videoUri ? [m.imageUri] : [])).map((uri) => ({
        uri,
        fallback: 'jpg',
        kind: 'photo' as const,
      })),
      ...(m.voice ? [{ uri: m.voice.uri, fallback: 'webm', kind: 'audio' as const }] : []),
    ];
    const names: { name: string; kind: Kind }[] = [];
    for (const [i, s] of sources.entries()) {
      try {
        const blob = await (await fetch(s.uri)).blob();
        const name = `${folder}/${base}${sources.length > 1 ? ` (${i + 1})` : ''}.${extOf(blob, s.fallback)}`;
        zip.file(name, blob);
        names.push({ name, kind: s.kind });
      } catch {
        // si un archivo no se puede descargar, se sigue con el resto
      }
    }
    files.set(m.id, names);
    onProgress?.(++done, total);
  }

  // La página para verlo todo sin la app.
  const fmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short' });
  const block = (m: Moment) => {
    const media = (files.get(m.id) ?? [])
      .map(({ name, kind }) =>
        kind === 'video'
          ? `<video src="${esc(name)}" controls playsinline></video>`
          : kind === 'audio'
            ? `<audio src="${esc(name)}" controls></audio>`
            : `<img src="${esc(name)}" alt="">`,
      )
      .join('');
    const comments = m.comments
      .map((c) => `<li><b>${esc(user(c.userId).name)}</b> ${esc(c.text)}</li>`)
      .join('');
    return `<article>
  <p class="meta"><b>${esc(user(m.authorId).name)}</b> · ${esc(fmt.format(m.createdAt))}${m.place ? ` · ${esc(m.place.name)}` : ''}${m.memory ? ' · recuerdo' : ''}</p>
  ${media}
  ${m.text ? `<p class="text">${esc(m.text)}</p>` : ''}
  ${m.reactions.length ? `<p class="meta">${m.reactions.map((r) => esc(r.emoji)).join(' ')}</p>` : ''}
  ${comments ? `<ul>${comments}</ul>` : ''}
</article>`;
  };
  const albumsHtml = albums
    .filter((a) => a.momentIds.length)
    .map(
      (a) =>
        `<h2>Álbum: ${esc(a.title)}</h2>${a.description ? `<p class="meta">${esc(a.description)}</p>` : ''}<p class="meta">${a.momentIds.length} momentos</p>`,
    )
    .join('');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(group.name)} · Junti</title>
<style>
body{font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1D1F22;background:#F6F6F7}
h1{font-weight:500;margin:0 0 4px}h2{font-weight:500;margin:40px 0 8px}
article{background:#fff;border-radius:20px;padding:16px;margin:16px 0}
img,video{width:100%;border-radius:12px;margin:8px 0;display:block}audio{width:100%;margin:8px 0}
.meta{color:#686C73;font-size:14px;margin:0}.text{font-size:17px;line-height:1.45}
ul{padding-left:18px;color:#3C3F44}
</style></head><body>
<h1>${esc(group.name)}</h1>
<p class="meta">La memoria del grupo, descargada de Junti el ${esc(new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(new Date()))} · ${list.length} momentos</p>
${albumsHtml}
<h2>Todos los momentos</h2>
${list.map(block).join('\n')}
</body></html>`;
  zip.file('memoria.html', html);

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${clean(group.name)} - Junti ${day(Date.now())}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
