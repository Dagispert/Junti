// Los minijuegos en las historias (semana, mes): lo que necesita la animación
// de cada uno (las imágenes con enlace temporal; la película las copia luego
// en la página para poder exportarla).
//
// ⚠️ Cada minijuego nuevo tiene que tener aquí lo suyo, su tipo en
// pelicula/guion.ts (JuegoPieza), su animación en pelicula/mesa.ts y su
// fotograma en el carrete del mes (components/film-roll-viewer.web.tsx).

import { useEffect, useState } from 'react';

import type { Moment, Proposal, User } from '@/data/types';
import type { JuegoPieza } from '@/pelicula/guion';

import { MEDIA_BUCKET, supabase } from './supabase';

const firmar = async (paths: string[]) => {
  if (!paths.length) return new Map<string, string>();
  const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, 6 * 3600);
  return new Map(
    (data ?? []).filter((d) => d.signedUrl).map((d) => [d.path!, d.signedUrl as string]),
  );
};

/** ¿Es un minijuego (con su propia animación)? */
export const esMinijuego = (p: Proposal) =>
  p.game?.type === 'karaoke' || !!p.juego || !!p.zoom || !!p.dibujo;

/** Lo de cada minijuego (por id de la propuesta). */
export async function cargarJuegos(
  proposals: Proposal[],
  moments: Moment[],
  user: (id: string) => User,
): Promise<Record<string, JuegoPieza>> {
  const first = (id: string) => user(id).name.split(' ')[0];
  const out: Record<string, JuegoPieza> = {};
  const juegos = proposals.filter(esMinijuego);
  await Promise.all(
    juegos.map(async (p) => {
      const abierto = !p.endsAt || p.endsAt > Date.now();
      try {
        if (p.game?.type === 'karaoke') {
          const g = p.game;
          const voces = g.montaje?.voces ?? [
            ...new Set(moments.filter((m) => m.proposalId === p.id).map((m) => m.authorId)),
          ];
          const firmadas = await firmar(g.montaje?.poster ? [g.montaje.poster] : []);
          out[p.id] = {
            tipo: 'karaoke',
            cancion: g.song,
            artista: g.artist,
            portada: (g.montaje?.poster && firmadas.get(g.montaje.poster)) || g.artwork,
            voces: voces.map(first),
          };
        } else if (p.juego) {
          const voces = [
            ...new Set(
              moments
                .filter((m) => m.proposalId === p.id && m.voice)
                .sort((a, b) => a.sharedAt - b.sharedAt)
                .map((m) => m.authorId),
            ),
          ];
          out[p.id] = {
            tipo: 'cuento',
            inicio: p.juego.inicio,
            cierre: p.juego.cierre?.texto,
            voces: voces.map(first),
          };
        } else if (p.zoom) {
          const z = p.zoom;
          const [firmadas, { data: res }, sol] = await Promise.all([
            firmar([z.path]),
            supabase.from('juego_respuestas').select('user_id, acierto').eq('proposal_id', p.id),
            abierto
              ? Promise.resolve(null)
              : supabase
                  .rpc('solucion_zoom', { p: p.id })
                  .then(({ data }) => data as string | null),
          ]);
          out[p.id] = {
            tipo: 'zoom',
            foto: firmadas.get(z.path),
            cx: z.cx,
            cy: z.cy,
            abierto,
            solucion: sol ?? undefined,
            aciertos: (res ?? []).filter((r) => r.acierto).map((r) => first(r.user_id)),
            jugaron: (res ?? []).length,
          };
        } else if (p.dibujo) {
          // mientras está abierto solo se ve quién hizo cada paso (lo demás es secreto)
          const meta = p.dibujo.pasos;
          if (abierto) {
            out[p.id] = {
              tipo: 'dibujo',
              abierto,
              pasos: meta.map((m) => ({
                tipo: m.t === 'd' ? 'dibujo' : 'frase',
                quien: first(m.u),
              })),
            };
            return;
          }
          const { data } = await supabase
            .from('dibujo_pasos')
            .select('orden, user_id, tipo, texto, path')
            .eq('proposal_id', p.id)
            .order('orden');
          const filas = (data ?? []) as {
            orden: number;
            user_id: string;
            tipo: 'frase' | 'dibujo';
            texto: string | null;
            path: string | null;
          }[];
          const firmadas = await firmar(filas.filter((f) => f.path).map((f) => f.path!));
          out[p.id] = {
            tipo: 'dibujo',
            abierto,
            pasos: filas.map((f) => ({
              tipo: f.tipo,
              quien: first(f.user_id),
              texto: f.texto ?? undefined,
              img: f.path ? firmadas.get(f.path) : undefined,
            })),
          };
        }
      } catch {
        // sin sus datos, sale como un reto más
      }
    }),
  );
  return out;
}

/** Las imágenes de los minijuegos (para copiarlas en la página). */
export function imagenesDeJuegos(j: Record<string, JuegoPieza>): string[] {
  const out: string[] = [];
  for (const x of Object.values(j)) {
    if (x.tipo === 'karaoke' && x.portada) out.push(x.portada);
    if (x.tipo === 'zoom' && x.foto) out.push(x.foto);
    if (x.tipo === 'dibujo') for (const p of x.pasos) if (p.img) out.push(p.img);
  }
  return out;
}

/* ───────────── Los minijuegos en los carretes del mes ───────────── */

/** A dónde lleva tocar un minijuego. */
export function rutaJuego(p: Proposal): { pathname: string; params: Record<string, string> } {
  if (p.game?.type === 'karaoke')
    return { pathname: '/karaoke/[id]', params: { id: p.id, watch: '1' } };
  if (p.juego) return { pathname: '/cuento/[id]', params: { id: p.id } };
  if (p.zoom) return { pathname: '/zoom/[id]', params: { id: p.id } };
  return { pathname: '/dibujo/[id]', params: { id: p.id } };
}

/**
 * Cada minijuego como un fotograma más del carrete (un «momento» con id
 * «juego:…»): su imagen (sin destripar nada si sigue abierto) y su nombre.
 */
export function useFotogramasJuegos(proposals: Proposal[]): Moment[] {
  const juegos = proposals.filter(esMinijuego);
  const clave = juegos.map((p) => `${p.id}:${p.endsAt}:${p.game?.montaje?.path ?? ''}`).join('|');
  const [imgs, setImgs] = useState<Record<string, string>>({});
  useEffect(() => {
    let vivo = true;
    (async () => {
      const rutas = new Map<string, string>();
      const terminado = (p: Proposal) => !!p.endsAt && p.endsAt <= Date.now();
      for (const p of juegos) {
        if (p.game?.type === 'karaoke' && p.game.montaje?.poster)
          rutas.set(p.id, p.game.montaje.poster);
        if (p.zoom && terminado(p)) rutas.set(p.id, p.zoom.path);
      }
      const dibujos = juegos.filter((p) => p.dibujo && terminado(p)).map((p) => p.id);
      if (dibujos.length) {
        const { data } = await supabase
          .from('dibujo_pasos')
          .select('proposal_id, path')
          .in('proposal_id', dibujos)
          .eq('orden', 1);
        for (const d of data ?? []) if (d.path) rutas.set(d.proposal_id, d.path);
      }
      const firmadas = await firmar([...new Set(rutas.values())]);
      const out: Record<string, string> = {};
      for (const [id, path] of rutas) {
        const u = firmadas.get(path);
        if (u) out[id] = u;
      }
      if (vivo) setImgs(out);
    })().catch(() => {});
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return juegos.map((p) => {
    const nombre =
      p.game?.type === 'karaoke'
        ? `Karaoke: «${p.game.song}»`
        : p.juego
          ? `El cuento a trozos: «${p.juego.inicio}»`
          : p.zoom
            ? 'Zoom misterioso: ¿qué es?'
            : 'Dibujo a ciegas';
    const imagen = imgs[p.id] ?? (p.game?.type === 'karaoke' ? p.game.artwork : undefined);
    return {
      id: `juego:${p.id}`,
      groupId: p.groupId,
      authorId: p.createdBy ?? '',
      authorTz: 'UTC',
      createdAt: p.startsAt,
      sharedAt: p.startsAt,
      text: nombre,
      imageUri: imagen,
      proposalId: p.id,
      reactions: [],
      comments: [],
    } as unknown as Moment;
  });
}
