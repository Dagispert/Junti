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

function fetchWeather(lat: number, lng: number): Promise<Weather | null> {
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
