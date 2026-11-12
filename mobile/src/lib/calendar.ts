import type { EventKind, GroupEvent } from '@/data/types';
import { Cake, Heart, PartyPopper, Pin, Plane, Users, type LucideIcon } from 'lucide-react-native';

// Cada tipo: su icono de línea, su nombre y un color suave (solo para el
// billete del evento y el punto del calendario).
export const KINDS: Record<
  EventKind,
  { icon: LucideIcon; label: string; color: string; yearly: boolean }
> = {
  birthday: { icon: Cake, label: 'Cumpleaños', color: '#F4B6C8', yearly: true },
  anniversary: { icon: Heart, label: 'Aniversario', color: '#F7C9A9', yearly: true },
  trip: { icon: Plane, label: 'Viaje', color: '#B9DDF2', yearly: false },
  reunion: { icon: Users, label: 'Reencuentro', color: '#CDE7B0', yearly: false },
  celebration: { icon: PartyPopper, label: 'Celebración', color: '#F6E19A', yearly: false },
  other: { icon: Pin, label: 'Otro', color: '#E3E0EA', yearly: false },
};

const DAY = 86_400_000;

/** «2026-11-11» ↔ fecha local a medianoche. */
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Cuándo cae el evento a partir de «from» (para los anuales, la próxima vez). */
export function occurrence(e: GroupEvent, from: Date = today()): Date {
  const start = fromISO(e.startsOn);
  if (!e.yearly) return start;
  const at = (y: number) => {
    const last = new Date(y, start.getMonth() + 1, 0).getDate();
    return new Date(y, start.getMonth(), Math.min(start.getDate(), last));
  };
  const thisYear = at(from.getFullYear());
  return thisYear < from ? at(from.getFullYear() + 1) : thisYear;
}

/** Días que faltan (0 = hoy). Para un viaje en curso, 0 mientras dure. */
export function daysUntil(e: GroupEvent, from: Date = today()): number {
  const occ = occurrence(e, from);
  if (!e.yearly && e.endsOn && occ <= from && fromISO(e.endsOn) >= from) return 0;
  return Math.round((occ.getTime() - from.getTime()) / DAY);
}

/** ¿Ocurre el evento en este día? (incluye los días intermedios de un viaje) */
export function happensOn(e: GroupEvent, day: Date): boolean {
  if (e.yearly) {
    const occ = occurrence(e, day);
    return occ.getTime() === day.getTime();
  }
  const start = fromISO(e.startsOn);
  const end = e.endsOn ? fromISO(e.endsOn) : start;
  return day >= start && day <= end;
}

export function countdown(days: number): string {
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  if (days < 7) return `Dentro de ${days} días`;
  if (days < 14) return 'La semana que viene';
  if (days < 60) return `Faltan ${days} días`;
  const months = Math.round(days / 30);
  return `Dentro de ${months} ${months === 1 ? 'mes' : 'meses'}`;
}

export function longDate(d: Date, withYear = false): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(d);
}

/** Próximos eventos de un grupo, ordenados por cercanía. */
export function upcoming(
  events: GroupEvent[],
  limit = 10,
  within = 400,
): { event: GroupEvent; days: number }[] {
  return events
    .map((event) => ({ event, days: daysUntil(event) }))
    .filter((x) => x.days >= 0 && x.days <= within)
    .sort((a, b) => a.days - b.days)
    .slice(0, limit);
}
