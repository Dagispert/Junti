// El color del grupo como color de acento: ajustado para que se lea sobre
// fondo oscuro (más claro) o claro (más oscuro), y sus tintes suaves.

type HSL = [number, number, number];

function toHsl(hex: string): HSL {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0xc2477a;
  const r = ((n >> 16) & 255) / 255,
    g = ((n >> 8) & 255) / 255,
    b = (n & 255) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function toHex([h, s, l]: HSL): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return `#${[f(0), f(8), f(4)]
    .map((x) =>
      Math.round(x * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** Aviva un color apagado, pero un gris se queda gris (sin inventarle un tono). */
const keep = (s: number, min: number) => (s < 0.12 ? s : Math.max(s, min));

/** El acento sobre fondo oscuro: con luz suficiente para verse. */
export function accentNight(hex: string): string {
  const [h, s, l] = toHsl(hex);
  return toHex([h, keep(s, 0.45), Math.min(0.78, Math.max(l, 0.62))]);
}

/** El acento sobre fondo claro: lo bastante oscuro para leerse. */
export function accentDay(hex: string): string {
  const [h, s, l] = toHsl(hex);
  return toHex([h, keep(s, 0.4), Math.min(l, 0.46)]);
}

/** Un tinte muy suave del color (fondos de notas, círculos). */
export function accentTint(hex: string): string {
  const [h, s] = toHsl(hex);
  return toHex([h, Math.min(0.7, keep(s, 0.35)), 0.92]);
}

/** El color muy oscuro (contornos sobre el acento). */
export function accentDeep(hex: string): string {
  const [h, s] = toHsl(hex);
  return toHex([h, keep(s, 0.4), 0.25]);
}

/** El color por defecto si el grupo no tiene ninguno. */
export const DEFAULT_ACCENT = '#C2477A';
