// Geografía de Junti: ciudades, distancias, husos horarios y la posición del sol.

/** Una ciudad elegida en el buscador. Nunca guardamos ubicaciones más precisas que esto. */
export type Place = { name: string; region?: string; country?: string; lat: number; lng: number };

const RAD = Math.PI / 180;

/**
 * Busca ciudades y pueblos por nombre con el buscador gratuito de Open-Meteo
 * (datos de GeoNames). Solo se le envía lo que la persona escribe.
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=es&format=json`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('El buscador de ciudades no responde ahora mismo.');
  const data = (await response.json()) as {
    results?: {
      name: string;
      admin1?: string;
      country?: string;
      latitude: number;
      longitude: number;
    }[];
  };
  return (data.results ?? []).map((r) => ({
    name: r.name,
    region: r.admin1 && r.admin1 !== r.name ? r.admin1 : undefined,
    country: r.country,
    // Redondeo a ~1 km: basta para el mapa y no dice más de lo necesario.
    lat: Math.round(r.latitude * 100) / 100,
    lng: Math.round(r.longitude * 100) / 100,
  }));
}

/** Distancia en kilómetros sobre la superficie de la Tierra. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Fecha y hora de reloj en una zona horaria. */
function wallClock(tz: string, at: number) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).formatToParts(at);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return {
      year: get('year'),
      month: get('month'),
      day: get('day'),
      hour: get('hour') % 24,
      minute: get('minute'),
    };
  } catch {
    const d = new Date(at);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
    };
  }
}

/** Hora local con decimales (8.5 = 08:30). */
export function localHour(tz: string, at: number = Date.now()): number {
  const c = wallClock(tz, at);
  return c.hour + c.minute / 60;
}

/** Diferencia con UTC, en minutos. */
export function utcOffsetMinutes(tz: string, at: number = Date.now()): number {
  const c = wallClock(tz, at);
  const asUtc = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute);
  return Math.round((asUtc - Math.floor(at / 60_000) * 60_000) / 60_000);
}

/** Punto de la Tierra que tiene el sol justo encima en este instante (aproximado). */
export function subsolarPoint(at: number = Date.now()): { lat: number; lng: number } {
  const d = new Date(at);
  const dayOfYear = (at - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86_400_000;
  const lat = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
  const utcHours = d.getUTCHours() + d.getUTCMinutes() / 60;
  const lng = (((12 - utcHours) * 15 + 540) % 360) - 180;
  return { lat, lng };
}

/** Altura del sol: >0 de día, <0 de noche (es el coseno del ángulo cenital). */
export function sunHeight(lat: number, lng: number, sun: { lat: number; lng: number }): number {
  return (
    Math.sin(lat * RAD) * Math.sin(sun.lat * RAD) +
    Math.cos(lat * RAD) * Math.cos(sun.lat * RAD) * Math.cos((lng - sun.lng) * RAD)
  );
}

export type SkyPhase = 'night' | 'dawn' | 'day' | 'dusk';

export function skyPhase(hour: number): SkyPhase {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 18) return 'day';
  if (hour >= 18 && hour < 21) return 'dusk';
  return 'night';
}

/** "9.024 km" */
export function formatKm(km: number): string {
  // Con punto de millar también en cifras de cuatro dígitos («9.490 km»).
  return `${String(Math.round(km / 10) * 10).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} km`;
}
