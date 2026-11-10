const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Hora de reloj en una zona horaria concreta: "08:30". */
export function clockIn(tz: string, at: number = Date.now()): string {
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  }).format(at);
}

/** "ahora", "hace 5 min", "hace 2 h", "ayer", "12 oct". */
export function relative(at: number, now: number = Date.now()): string {
  const diff = now - at;
  if (diff < MIN) return 'ahora';
  if (diff < HOUR) return `hace ${Math.floor(diff / MIN)} min`;
  if (diff < DAY) return `hace ${Math.floor(diff / HOUR)} h`;
  if (diff < 2 * DAY) return 'ayer';
  if (diff < 7 * DAY) return `hace ${Math.floor(diff / DAY)} días`;
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
  }).format(at);
}

/** Clave y etiqueta de mes para agrupar la Memoria: "noviembre de 2026". */
export function monthOf(at: number): { key: string; label: string } {
  const d = new Date(at);
  const label = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(d);
  return {
    key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    label: label[0].toUpperCase() + label.slice(1),
  };
}

export function daysLeft(endsAt: number, now: number = Date.now()): number {
  return Math.ceil((endsAt - now) / DAY);
}
