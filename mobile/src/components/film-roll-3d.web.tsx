import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Hand, HandBold } from '@/constants/theme';
import type { Moment } from '@/data/types';
import { makeCanister, MONTH_COLORS } from '@/lib/canister3d';

import { LIST_DIST, RollViewer } from './film-roll-viewer.web';

// Los carretes del mes: en la memoria solo se ve el carrete, flotando. Al
// tocarlo se abre a pantalla completa (ver film-roll-viewer).

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const W = 150;
const H = 180;

export function FilmRollGrid({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: HandBold, fontSize: 26, color: '#1D1F22' }}>Los carretes</Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          rowGap: 18,
        }}>
        {children}
      </View>
    </View>
  );
}

export function FilmRoll3D({
  moments,
  label,
  index = 0,
  groupId,
}: {
  moments: Moment[];
  label: string;
  index?: number;
  groupId?: string;
}) {
  const ordered = useMemo(() => [...moments].sort((a, b) => a.createdAt - b.createdAt), [moments]);
  const first = new Date(ordered[0]?.createdAt ?? Date.now());
  const color = MONTH_COLORS[first.getMonth()];
  const month = MESES[first.getMonth()];
  const year = String(first.getFullYear());
  const [viewing, setViewing] = useState<null | { x: number; y: number; w: number }>(null);
  const host = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  // Se pinta una vez, al verse (flota con CSS, sin redibujar).
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let done = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || done || !canvas.current) return;
        done = true;
        const can = makeCanister(color, month, year, ordered.length);
        const ctx = canvas.current.getContext('2d');
        if (ctx) can.draw(ctx, W, H, { dist: LIST_DIST, yaw: 0, tilt: -0.42, spin: 0 });
        can.dispose();
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [color, month, year, ordered.length]);

  const delay = `${-((index * 0.9) % 4.2)}s`;
  return (
    <>
      <button
        ref={host}
        type="button"
        aria-label={`Abrir el carrete de ${label}: ${ordered.length} fotos`}
        onClick={() => {
          // el carrete grande sale desde aquí mismo
          const r = canvas.current?.getBoundingClientRect();
          setViewing(r ? { x: r.left, y: r.top, w: r.width } : { x: 0, y: 0, w: 0 });
        }}
        style={{
          width: '48%',
          border: 0,
          padding: '6px 0 4px',
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          // se esconde al instante: el grande está justo encima, en su sitio
          opacity: viewing ? 0 : 1,
        }}>
        <div
          style={{
            width: W,
            height: H,
            animation: `jroll-float 4.2s ease-in-out ${delay} infinite`,
          }}>
          <canvas
            ref={canvas}
            width={W * 2}
            height={H * 2}
            style={{ width: W, height: H, display: 'block' }}
          />
        </div>
        <div
          aria-hidden
          style={{
            width: 74,
            height: 12,
            marginTop: -10,
            borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(0,0,0,.2), rgba(0,0,0,0))',
            animation: `jroll-shadow 4.2s ease-in-out ${delay} infinite`,
          }}
        />
        <div style={{ fontFamily: HandBold, fontSize: 21, color: '#1D1F22', marginTop: 4 }}>
          {label}
        </div>
        <div style={{ fontFamily: Hand, fontSize: 16, color: '#6B6A62' }}>
          {ordered.length} {ordered.length === 1 ? 'foto' : 'fotos'}
        </div>
      </button>
      {viewing && (
        <RollViewer
          moments={ordered}
          label={label}
          month={month}
          year={year}
          color={color}
          groupId={groupId}
          origin={viewing.w ? viewing : undefined}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}

if (typeof document !== 'undefined' && !document.getElementById('jroll-css')) {
  const s = document.createElement('style');
  s.id = 'jroll-css';
  s.textContent =
    '@keyframes jroll-float{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-7px) rotate(1.5deg)}}' +
    '@keyframes jroll-shadow{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.86);opacity:.7}}';
  document.head.appendChild(s);
}
