import { useEffect, useMemo, useRef, useState } from 'react';

import { Hand } from '@/constants/theme';
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
      if (!stop.current && !ended.current) t.current += dt;
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
      if (key !== lastSub) {
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

  // Subtítulo: la frase en curso, palabra a palabra según avanza la voz.
  const shown = useMemo(() => {
    if (!sub) return null;
    const sentences = sub.text.match(/[^.?!…]+[.?!…»]*/g) ?? [sub.text];
    const at = Math.floor(sub.text.length * Math.min(1, sub.k * 1.04));
    let pos = 0;
    for (const s of sentences) {
      if (at <= pos + s.length) {
        const said = Math.max(1, at - pos);
        return { said: s.slice(0, said).trimStart(), rest: s.slice(said) };
      }
      pos += s.length;
    }
    return { said: sentences[sentences.length - 1].trim(), rest: '' };
  }, [sub]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
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
            bottom: 'max(32px, 4vh)',
            textAlign: 'center',
            fontFamily: Hand,
            fontSize: 'clamp(22px, 3.4vh, 30px)',
            lineHeight: 1.15,
            color: sub?.day ? '#1D1F22' : '#F3F1E7',
            pointerEvents: 'none',
          }}>
          {shown.said}
          <span style={{ color: 'transparent' }}>{shown.rest}</span>
        </div>
      )}
    </div>
  );
}
