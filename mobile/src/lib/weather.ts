import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  type LucideIcon,
  Moon,
  Sun,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';

// El tiempo que hace ahora en la ciudad de cada uno, con Open-Meteo (gratis,
// sin clave). Solo se envían las coordenadas de la ciudad, nunca quién es.
// Se guarda media hora en memoria.

export type Weather = { temp: number; icon: LucideIcon; label: string };

const TTL = 30 * 60_000;
const cache = new Map<string, { at: number; value: Promise<Weather | null> }>();

/** Códigos WMO de Open-Meteo → icono y palabra. */
function describe(code: number, day: boolean): { icon: LucideIcon; label: string } {
  if (code === 0) return { icon: day ? Sun : Moon, label: 'Despejado' };
  if (code <= 2) return { icon: day ? CloudSun : CloudMoon, label: 'Algo nublado' };
  if (code === 3) return { icon: Cloud, label: 'Nublado' };
  if (code === 45 || code === 48) return { icon: CloudFog, label: 'Niebla' };
  if (code >= 51 && code <= 57) return { icon: CloudDrizzle, label: 'Llovizna' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return { icon: CloudRain, label: 'Lluvia' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return { icon: CloudSnow, label: 'Nieve' };
  if (code >= 95) return { icon: CloudLightning, label: 'Tormenta' };
  return { icon: Cloud, label: 'Nublado' };
}

/** El tiempo ahora en unas coordenadas (con caché de media hora). */
export function fetchWeather(lat: number, lng: number): Promise<Weather | null> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const value = fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}` +
      '&current=temperature_2m,weather_code,is_day',
  )
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const c = d?.current;
      if (!c || typeof c.temperature_2m !== 'number') return null;
      return { temp: Math.round(c.temperature_2m), ...describe(c.weather_code, c.is_day === 1) };
    })
    .catch(() => null);
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** El tiempo en unas coordenadas (null mientras llega o si no hay datos). */
export function useWeather(lat?: number, lng?: number): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(null);
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    let alive = true;
    fetchWeather(lat, lng).then((w) => alive && setWeather(w));
    return () => {
      alive = false;
    };
  }, [lat, lng]);
  return weather;
}

/** El tiempo que hacía: temperatura y código WMO de aquella hora. */
export type PastWeather = { temp: number; code: number };

const past = new Map<string, Promise<{ temp: number[]; code: number[] } | null>>();

/**
 * El tiempo que hacía en unas coordenadas a una hora concreta del pasado (para
 * el cielo de cada escena del resumen). Lo reciente sale del pronóstico; lo
 * antiguo, del archivo histórico. Solo se envían las coordenadas de la ciudad
 * y la fecha. Null si no hay datos.
 */
export async function fetchWeatherAt(
  lat: number,
  lng: number,
  at: number,
): Promise<PastWeather | null> {
  const d = new Date(at);
  if (!isFinite(lat) || !isFinite(lng) || isNaN(d.getTime())) return null;
  const date = d.toISOString().slice(0, 10);
  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${date}`;
  let day = past.get(key);
  if (!day) {
    const age = Date.now() - at;
    // El archivo va unos días por detrás; el pronóstico guarda unos tres meses.
    const host =
      age > 80 * 86_400_000
        ? 'https://archive-api.open-meteo.com/v1/archive'
        : 'https://api.open-meteo.com/v1/forecast';
    day = fetch(
      `${host}?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}` +
        `&start_date=${date}&end_date=${date}&hourly=temperature_2m,weather_code&timezone=GMT`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const h = j?.hourly;
        if (!Array.isArray(h?.temperature_2m) || !Array.isArray(h?.weather_code)) return null;
        return { temp: h.temperature_2m as number[], code: h.weather_code as number[] };
      })
      .catch(() => null);
    past.set(key, day);
  }
  const data = await day;
  const hour = d.getUTCHours();
  const temp = data?.temp[hour];
  const code = data?.code[hour];
  return typeof temp === 'number' && typeof code === 'number' ? { temp, code } : null;
}
