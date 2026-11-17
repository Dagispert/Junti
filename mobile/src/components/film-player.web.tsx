import { useEffect, useMemo, useRef, useState } from 'react';

import { Hand, HandBold } from '@/constants/theme';
import { accentDay, accentNight, DEFAULT_ACCENT } from '@/lib/accent';
import type { DatosPelicula, Plan } from '@/pelicula/guion';
import { FLASH, Pelicula } from '@/pelicula/pelicula';

// El reproductor de la película: la pinta fotograma a fotograma, lleva la voz
// de la narradora a cada tramo y pone los subtítulos.

export type FilmControl = { seek: (t: number) => void; time: () => number };

export function FilmPlayer({
  data,
  voice,
  paused,
  muted,
  onTime,
  onEnd,
  control,
}: {
  data: DatosPelicula;
  voice?: HTMLAudioElement | null;
  paused: boolean;
  muted?: boolean;
  onTime?: (t: number, total: number) => void;
  onEnd?: () => void;
  control?: { current: FilmControl | null };
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const film = useRef<Pelicula | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const t = useRef(0);
  const stop = useRef(paused);
  stop.current = paused;
  const ended = useRef(false);
  /** solo en las pruebas: la película parada en un segundo concreto */
  const congelado = useRef(false);
  const [sub, setSub] = useState<{ text: string; k: number; day: boolean } | null>(null);
  const cb = useRef({ onTime, onEnd });
  cb.current = { onTime, onEnd };

  useEffect(() => {
    if (!svgRef.current) return;
    film.current = new Pelicula(svgRef.current, data);
    setPlan(film.current.plan);
    t.current = 0;
    ended.current = false;
    film.current.pintar(0);
    // las pruebas automáticas pueden ir a cualquier segundo y quedarse ahí
    const w = window as unknown as { __juntiPruebas?: boolean; __pelicula?: unknown };
    if (w.__juntiPruebas)
      w.__pelicula = {
        plan: film.current.plan,
        ir: (x: number) => {
          congelado.current = true;
          t.current = x;
        },
      };
  }, [data]);

  useEffect(() => {
    if (control)
      control.current = {
        seek: (x) => {
          t.current = Math.max(0, x);
          ended.current = false;
        },
        time: () => t.current,
      };
  }, [control]);

  useEffect(() => {
    if (!plan) return;
    let raf = 0;
    let last = performance.now();
    let lastSub = '';
    let playing: Plan['voces'][number] | null = null;
    const dayAt = plan.calendario[0] + FLASH + 0.2;
    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (!stop.current && !ended.current && !congelado.current) t.current += dt;
      const time = Math.min(t.current, plan.total);
      film.current?.pintar(time);
      cb.current.onTime?.(time, plan.total);
      if (time >= plan.total && !ended.current) {
        ended.current = true;
        cb.current.onEnd?.();
      }
      // la voz y los subtítulos del tramo en curso
      const seg = plan.voces.find((v) => time >= v.a && time < v.b);
      if (voice) {
        if (stop.current || ended.current) {
          if (!voice.paused) voice.pause();
        } else {
          // Cada frase se coloca una sola vez, al empezar su tramo, y suena
          // entera hasta su final (sin perseguir a la película fotograma a
          // fotograma, que la hacía cortarse).
          if (seg && seg.voz.from != null && playing !== seg) {
            playing = seg;
            const at = seg.voz.from + Math.max(0, time - seg.a);
            // si ya viene sonando justo ahí (frases seguidas), no se toca
            if (Math.abs(voice.currentTime - at) > 0.15) voice.currentTime = at;
            if (voice.paused) voice.play().catch(() => {});
          } else if (playing && playing.voz.from != null) {
            const end = playing.voz.to ?? Infinity;
            const want = playing.voz.from + (time - playing.a);
            if (voice.currentTime >= end - 0.02) {
              // ¿La siguiente frase va justo detrás (en el audio y en la película)?
              // Entonces se sigue sin tocar nada: la voz no se para.
              const cur = playing;
              const next = plan.voces.find(
                (v) =>
                  v.voz.from != null &&
                  Math.abs(v.voz.from - end) < 0.06 &&
                  Math.abs(v.a - cur.b) < 0.06,
              );
              if (next) playing = next;
              else if (!voice.paused) voice.pause();
            } else {
              if (voice.paused && time < playing.b + 1.5) voice.play().catch(() => {});
              if (Math.abs(voice.currentTime - want) > 1.5) voice.currentTime = want;
              // La película sigue el reloj de la voz (así nunca se adelanta ni se queda atrás).
              else if (!voice.paused && voice.readyState >= 3) {
                t.current = playing.a + (voice.currentTime - playing.voz.from);
              }
            }
          }
        }
      }
      const key = seg ? `${seg.a}|${Math.floor(((time - seg.a) / (seg.b - seg.a)) * 40)}` : '';
      // (la película pone ella misma sus subtítulos, dentro del dibujo)
      if (film.current?.subtitulos) {
        if (lastSub) setSub(null);
        lastSub = '';
      } else if (key !== lastSub) {
        lastSub = key;
        setSub(
          seg
            ? {
                text: seg.voz.text,
                k: (time - seg.a) / (seg.b - seg.a),
                day: time >= dayAt && time < plan.final[0],
              }
            : null,
        );
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      voice?.pause();
    };
  }, [plan, voice]);

  useEffect(() => {
    if (voice) voice.muted = !!muted;
  }, [voice, muted]);

  // Subtítulo: la frase en curso, palabra a palabra según avanza la voz. Cada
  // palabra entra fundiendo; los nombres y las cifras, en el color del grupo;
  // sin el punto final (en pantalla no hace falta).
  const nombres = useMemo(
    () => new Set(data.people.map((p) => norm(p.name.split(' ')[0])).filter(Boolean)),
    [data],
  );
  const shown = useMemo(() => {
    if (!sub) return null;
    const sentences = sub.text.match(/[^.?!…]+[.?!…»]*/g) ?? [sub.text];
    const at = sub.text.length * Math.min(1, sub.k * 1.04);
    let pos = 0;
    let cur = sentences[sentences.length - 1],
      start = sub.text.length - cur.length;
    for (const s of sentences) {
      if (at <= pos + s.length) {
        cur = s;
        start = pos;
        break;
      }
      pos += s.length;
    }
    const words: { text: string; o: number; hi: boolean }[] = [];
    for (const m of cur.matchAll(/\S+/g)) {
      const ws = start + m.index!;
      const raw = m[0];
      const text = raw.replace(/\.$/, '').replace(/^\.+$/, '');
      if (!text) continue;
      const bare = norm(text.replace(/[^\p{L}\p{N}]/gu, ''));
      words.push({
        text,
        // entra en lo que se tarda en decir unas 5 letras (≈ 0,35 s)
        o: Math.max(0, Math.min(1, (at - ws) / 5)),
        hi: /\d/.test(text) || nombres.has(bare),
      });
    }
    return words;
  }, [sub, nombres]);
  const acento = sub?.day
    ? accentDay(data.accent ?? DEFAULT_ACCENT)
    : accentNight(data.accent ?? DEFAULT_ACCENT);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        containerType: 'size',
      }}>
      {/* El escenario: siempre 9:16 (el de Instagram, TikTok y los estados).
          Al exportar se graba solo esto, con sus subtítulos. */}
      <div
        data-rec-stage
        style={{
          position: 'relative',
          width: 'min(100cqw, calc(100cqh * 9 / 16))',
          height: 'min(100cqh, calc(100cqw * 16 / 9))',
          overflow: 'hidden',
          containerType: 'size',
        }}>
        <svg
          ref={svgRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
          preserveAspectRatio="xMidYMid meet"
        />
        {shown && (
          <div
            style={{
              position: 'absolute',
              left: '6%',
              right: '6%',
              bottom: '5cqh',
              textAlign: 'center',
              fontFamily: Hand,
              fontSize: 'clamp(18px, 4.6cqw, 34px)',
              lineHeight: 1.15,
              color: sub?.day ? '#1D1F22' : '#F3F1E7',
              colorScheme: 'only light',
              pointerEvents: 'none',
            }}>
            {/* Solo la letra, sin fondo: cada palabra aparece al decirla. */}
            {shown.map((w, i) => (
              <span
                key={i}
                style={{
                  opacity: w.o,
                  color: w.hi ? acento : undefined,
                  fontFamily: w.hi ? HandBold : undefined,
                }}>
                {w.text}
                {i < shown.length - 1 ? ' ' : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
