import { Platform } from 'react-native';
import { useEffect, useRef, useState } from 'react';

/** Una canción encontrada en el catálogo de iTunes (gratuito, sin clave). */
export type FoundSong = {
  title: string;
  artist: string;
  artwork?: string;
  preview?: string;
  link?: string;
};

export async function searchSongs(query: string, signal?: AbortSignal): Promise<FoundSong[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  // Primero el catálogo de España; si no tiene la canción, el catálogo general.
  let data = await query_(q, 'es', signal);
  if (!data.results?.length) data = await query_(q, '', signal);
  return (data.results ?? [])
    .filter((r) => r.trackName && r.artistName)
    .map((r) => ({
      title: r.trackName!,
      artist: r.artistName!,
      // La portada en más resolución (el catálogo sirve el tamaño que se pida).
      artwork: r.artworkUrl100?.replace('100x100bb', '600x600bb'),
      preview: r.previewUrl,
      link: r.trackViewUrl,
    }));
}

async function query_(q: string, country: string, signal?: AbortSignal) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=12${country ? `&country=${country}` : ''}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('El buscador de canciones no responde ahora mismo.');
  return (await response.json()) as {
    results?: {
      trackName?: string;
      artistName?: string;
      artworkUrl100?: string;
      previewUrl?: string;
      trackViewUrl?: string;
    }[];
  };
}

/** Buscar la canción en Spotify (abre su buscador; no hace falta cuenta para verlo). */
export function spotifyLink(title: string, artist: string): string {
  return `https://open.spotify.com/search/${encodeURIComponent(`${title} ${artist}`)}`;
}

/** Reproductor del fragmento de 30 segundos. Por ahora, solo en la versión web. */
export function usePreview(url?: string, loop = false) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(30);
  const available = Platform.OS === 'web' && typeof Audio !== 'undefined' && !!url;

  useEffect(() => {
    if (!available) return;
    const a = new Audio(url);
    a.preload = 'none';
    a.loop = loop;
    audio.current = a;
    const time = () => setPosition(a.currentTime);
    const meta = () => setDuration(a.duration || 30);
    const end = () => setPlaying(false);
    a.addEventListener('timeupdate', time);
    a.addEventListener('loadedmetadata', meta);
    a.addEventListener('ended', end);
    a.addEventListener('pause', end);
    a.addEventListener('play', () => setPlaying(true));
    return () => {
      a.pause();
      a.src = '';
      audio.current = null;
      setPlaying(false);
      setPosition(0);
    };
  }, [url, available, loop]);

  return {
    available,
    playing,
    position,
    duration,
    toggle: () => {
      const a = audio.current;
      if (!a) return;
      if (a.paused) a.play().catch(() => setPlaying(false));
      else a.pause();
    },
    /** Volumen de 0 a 1 (para bajar la música mientras habla la narradora). */
    volume: (v: number) => {
      if (audio.current) audio.current.volume = Math.max(0, Math.min(1, v));
    },
    restart: () => {
      const a = audio.current;
      if (a) a.currentTime = 0;
    },
  };
}

export const mmss = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
