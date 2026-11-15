import { useEffect, useRef, useState } from 'react';

// Fondo plano. Al cambiar de color, el nuevo entra como un círculo que crece
// desde el centro del contenido (como el flash de la animación «Rumbo a ti»)
// y tapa al anterior; nunca hay degradados.

type Layer = { id: number; color: string; open: boolean };

export function Backdrop({ color, originY = 0.45 }: { color: string; originY?: number }) {
  const [layers, setLayers] = useState<Layer[]>([{ id: 0, color, open: true }]);
  const next = useRef(1);
  useEffect(() => {
    setLayers((ls) =>
      ls[ls.length - 1]?.color === color
        ? ls
        : [...ls.slice(-1), { id: next.current++, color, open: false }],
    );
  }, [color]);
  // Abrir el círculo en el fotograma siguiente (para que haya transición).
  useEffect(() => {
    if (layers.every((l) => l.open)) return;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setLayers((ls) => ls.map((l) => ({ ...l, open: true })))),
    );
    return () => cancelAnimationFrame(raf);
  }, [layers]);
  return (
    <div
      aria-hidden
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {layers.map((l) => (
        <div
          key={l.id}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: l.color,
            clipPath: `circle(${l.open ? 150 : 0}% at 50% ${originY * 100}%)`,
            transition: l.id ? 'clip-path 820ms cubic-bezier(0.65, 0, 0.35, 1)' : 'none',
          }}
        />
      ))}
    </div>
  );
}
