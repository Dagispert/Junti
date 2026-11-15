import { router } from 'expo-router';
import { Play, Plus, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Hand, HandBold } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { GroupOrigin, Moment } from '@/data/types';
import { buildStory } from '@/lib/story';

import { Icon } from './icon';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createPortal } = require('react-dom') as {
  createPortal: (node: React.ReactNode, el: Element) => React.ReactNode;
};

// «Nuestra historia» como un diario de recuerdos, de papel rayado y pestañas
// de colores por años. En la memoria se ve cerrado, flotando. Al tocarlo crece
// desde su sitio y se abre la tapa en 3D; las hojas se pasan con el dedo (la
// hoja sigue al dedo y gira sobre el lomo) o tocando el borde, y las pestañas
// llevan a cada año. Dentro: dónde empezó todo, los recuerdos de cada año como
// polaroids pegadas con cinta, y las hojas en blanco de los años que faltan.

/** Los colores apagados de las pestañas (como las de un cuaderno). */
const TABS = [
  '#6F7A5E',
  '#5D74A6',
  '#C9A54A',
  '#7B8B6A',
  '#B5654F',
  '#8C6E9E',
  '#4F8A84',
  '#B08452',
];
const PAPER = '#FBF6EA';
const INK = '#2A2118';
const COVER = '#2F4A47';
const SPRING = 'cubic-bezier(.22,1.06,.36,1)';

type Page =
  | { kind: 'cover' }
  | { kind: 'intro' }
  | { kind: 'origin'; origins: GroupOrigin[] }
  | { kind: 'year'; year: number; memories: Moment[]; part: number }
  | { kind: 'gap'; from: number; to: number }
  | { kind: 'junti'; year: number };

/** Las hojas del diario, en orden, y sus pestañas (la primera hoja de cada año). */
function pagesOf(origins: GroupOrigin[], moments: Moment[]) {
  const { items } = buildStory(origins, moments);
  const pages: Page[] = [{ kind: 'cover' }, { kind: 'intro' }];
  const tabs: { page: number; label: string; color: string }[] = [];
  if (origins.length) {
    tabs.push({ page: pages.length, label: 'Inicio', color: TABS[0] });
    pages.push({ kind: 'origin', origins });
  }
  // los recuerdos, por años (como mucho tres polaroids por hoja)
  const byYear = new Map<number, Moment[]>();
  for (const it of items) {
    if (it.type === 'memory') byYear.set(it.year, [...(byYear.get(it.year) ?? []), it.moment]);
  }
  const seen = new Set<number>();
  for (const it of items) {
    if (it.type === 'gap') {
      pages.push({ kind: 'gap', from: it.gap.from, to: it.gap.to });
    } else if (it.type === 'memory' && !seen.has(it.year)) {
      seen.add(it.year);
      const list = byYear.get(it.year) ?? [];
      tabs.push({
        page: pages.length,
        label: String(it.year),
        color: TABS[tabs.length % TABS.length],
      });
      for (let i = 0; i < list.length; i += 3)
        pages.push({ kind: 'year', year: it.year, memories: list.slice(i, i + 3), part: i / 3 });
    }
  }
  const live = moments.filter((m) => !m.memory);
  const first = live.length
    ? new Date(Math.min(...live.map((m) => m.createdAt))).getFullYear()
    : new Date().getFullYear();
  tabs.push({ page: pages.length, label: 'Junti', color: TABS[tabs.length % TABS.length] });
  pages.push({ kind: 'junti', year: first });
  return { pages, tabs };
}

export function StoryBook({
  groupId,
  origins,
  moments,
}: {
  groupId: string;
  origins: GroupOrigin[];
  moments: Moment[];
}) {
  const { group } = useStore();
  const g = group(groupId);
  const book = useMemo(() => pagesOf(origins, moments), [origins, moments]);
  const since = useMemo(() => {
    const ys = [
      ...origins.map((o) => o.year).filter((y): y is number => !!y),
      ...moments.map((m) => new Date(m.createdAt).getFullYear()),
    ];
    return ys.length ? Math.min(...ys) : new Date().getFullYear();
  }, [origins, moments]);
  const memoryCount = moments.filter((m) => m.memory).length;
  const cover = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<DOMRect | null>(null);

  return (
    <>
      <button
        type="button"
        aria-label={`Abrir el diario de vuestra historia: ${memoryCount} recuerdos`}
        onClick={() => setOpen(cover.current?.getBoundingClientRect() ?? null)}
        style={{
          border: 0,
          background: 'transparent',
          padding: '4px 0 0',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
        }}>
        <div
          style={{ fontFamily: HandBold, fontSize: 30, color: '#1D1F22', alignSelf: 'flex-start' }}>
          Nuestra historia
        </div>
        <div style={{ animation: 'jbk-float 5s ease-in-out infinite', padding: '18px 0 10px' }}>
          <div
            style={{
              perspective: 900,
              opacity: open ? 0 : 1,
            }}>
            <div
              ref={cover}
              style={{
                transform: 'rotateY(-22deg) rotateX(8deg)',
                transformStyle: 'preserve-3d',
              }}>
              <ClosedBook name={g?.name ?? ''} since={since} tabs={book.tabs} w={170} />
            </div>
          </div>
        </div>
        <div
          aria-hidden
          style={{
            width: 170,
            height: 16,
            marginTop: -6,
            borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(0,0,0,.2), rgba(0,0,0,0))',
            animation: 'jbk-shadow 5s ease-in-out infinite',
          }}
        />
        <div style={{ fontFamily: Hand, fontSize: 18, color: '#6B6A62', marginTop: 6 }}>
          {memoryCount} {memoryCount === 1 ? 'recuerdo' : 'recuerdos'} · desde {since} · toca para
          abrirlo
        </div>
      </button>
      {open && (
        <BookViewer
          groupId={groupId}
          name={g?.name ?? ''}
          members={(g?.memberIds ?? []).map((id) => id)}
          since={since}
          book={book}
          origin={open}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

/** El diario cerrado: tapa de tela, la etiqueta escrita a mano y las pestañas asomando. */
function ClosedBook({
  name,
  since,
  tabs,
  w,
}: {
  name: string;
  since: number;
  tabs: { label: string; color: string }[];
  w: number;
}) {
  const h = w * 1.36;
  return (
    <div style={{ position: 'relative', width: w, height: h }}>
      {/* el canto de las hojas, por detrás */}
      <div
        style={{
          position: 'absolute',
          left: 6,
          top: 4,
          width: w,
          height: h - 4,
          borderRadius: '4px 10px 10px 4px',
          background: `repeating-linear-gradient(to right, ${PAPER} 0 2px, #E6DCC6 2px 3px)`,
          boxShadow: '0 10px 24px rgba(30,20,10,.25)',
        }}
      />
      {tabs.slice(0, 6).map((t, i) => (
        <div
          key={t.label}
          style={{
            ...tabStyle(t.color),
            position: 'absolute',
            right: -14,
            top: 14 + i * (h / 7),
            width: 22,
            height: h / 8,
          }}
        />
      ))}
      <CoverFace name={name} since={since} />
    </div>
  );
}

function CoverFace({ name, since }: { name: string; since: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '4px 10px 10px 4px',
        background: `${COVER} repeating-linear-gradient(45deg, rgba(255,255,255,.035) 0 2px, transparent 2px 5px)`,
        boxShadow: 'inset 6px 0 0 rgba(0,0,0,.18), inset -1px 0 0 rgba(255,255,255,.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backfaceVisibility: 'hidden',
      }}>
      {/* la etiqueta de papel, pegada */}
      <div
        style={{
          width: '72%',
          padding: '10% 6%',
          background: PAPER,
          borderRadius: 4,
          boxShadow: '0 2px 6px rgba(0,0,0,.25)',
          textAlign: 'center',
          transform: 'rotate(-2deg)',
        }}>
        <div
          style={{
            fontFamily: HandBold,
            fontSize: 'calc(1em + 0.6vw)',
            color: INK,
            lineHeight: 1.05,
          }}>
          Nuestra historia
        </div>
        <div style={{ fontFamily: Hand, fontSize: '0.85em', color: '#6B5640', marginTop: 4 }}>
          {name ? `${name} · ` : ''}desde {since}
        </div>
      </div>
    </div>
  );
}

const tabStyle = (color: string): React.CSSProperties => ({
  background: color,
  borderRadius: '0 6px 6px 0',
  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.12)',
});

function BookViewer({
  groupId,
  name,
  since,
  book,
  origin,
  onClose,
}: {
  groupId: string;
  name: string;
  members: string[];
  since: number;
  book: ReturnType<typeof pagesOf>;
  origin: DOMRect | null;
  onClose: () => void;
}) {
  const { user, group } = useStore();
  const members = (group(groupId)?.memberIds ?? []).map((id) => user(id).name.split(' ')[0]);
  const vw = window.innerWidth,
    vh = window.innerHeight;
  const W = Math.min(vw - 56, 360);
  const H = Math.min(W * 1.42, vh - 190);
  const n = book.pages.length;
  const [cur, setCur] = useState(0); // hojas pasadas
  const [drag, setDrag] = useState<null | { page: number; angle: number }>(null);
  const [shown, setShown] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; t: number } | null>(null);

  // Entrada: crece desde su sitio en la memoria y, al llegar, se abre la tapa.
  useEffect(() => {
    const el = wrap.current;
    if (el && origin && el.animate) {
      const to = el.getBoundingClientRect();
      el.animate(
        [
          {
            transformOrigin: 'top left',
            transform: `translate(${origin.left - to.left}px, ${origin.top - to.top}px) scale(${origin.width / to.width}) rotateY(-22deg)`,
          },
          { transformOrigin: 'top left', transform: 'none' },
        ],
        { duration: 650, easing: SPRING },
      );
    }
    backdrop.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], {
      duration: 400,
      fill: 'forwards',
    });
    const a = setTimeout(() => setShown(true), 60);
    const b = setTimeout(() => setCur(1), 620);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = () => {
    // se cierra la tapa y vuelve a su sitio
    setCur(0);
    setTimeout(
      () => {
        const el = wrap.current;
        if (el && origin && el.animate) {
          const to = el.getBoundingClientRect();
          el.animate(
            [
              { transformOrigin: 'top left', transform: 'none' },
              {
                transformOrigin: 'top left',
                transform: `translate(${origin.left - to.left}px, ${origin.top - to.top}px) scale(${origin.width / to.width}) rotateY(-22deg)`,
              },
            ],
            { duration: 480, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' },
          );
        }
        backdrop.current?.animate?.([{ opacity: 1 }, { opacity: 0 }], {
          duration: 480,
          fill: 'forwards',
        });
        setTimeout(onClose, 470);
      },
      Math.min(700, cur * 120 + 380),
    );
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leave();
      if (e.key === 'ArrowRight') setCur((c) => Math.min(n - 1, c + 1));
      if (e.key === 'ArrowLeft') setCur((c) => Math.max(1, c - 1));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  // ── Pasar hojas con el dedo: la hoja sigue al dedo y gira sobre el lomo ──
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    start.current = { x: e.clientX, t: performance.now() };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) < 6) return;
    if (dx < 0 && cur < n - 1) setDrag({ page: cur, angle: Math.max(-180, (dx / W) * 200) });
    else if (dx > 0 && cur > 1)
      setDrag({ page: cur - 1, angle: Math.min(0, -180 + (dx / W) * 200) });
  };
  const onUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const fast = Math.abs(dx) / Math.max(1, performance.now() - s.t) > 0.5;
    setDrag(null);
    if (Math.abs(dx) < 6) {
      // un toque: en el borde derecho, adelante; en el izquierdo, atrás
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const k = (e.clientX - r.left) / r.width;
      if (k > 0.6) setCur((c) => Math.min(n - 1, c + 1));
      else if (k < 0.4) setCur((c) => Math.max(1, c - 1));
      return;
    }
    if (dx < 0 && (dx < -W * 0.25 || fast)) setCur((c) => Math.min(n - 1, c + 1));
    else if (dx > 0 && (dx > W * 0.25 || fast)) setCur((c) => Math.max(1, c - 1));
  };
  const go = (fn: () => void) => {
    onClose();
    setTimeout(fn, 0);
  };
  const activeTab = [...book.tabs].reverse().find((t) => t.page <= Math.max(cur, 1));

  return createPortal(
    <div
      role="dialog"
      aria-label="El diario de vuestra historia"
      style={{ position: 'fixed', inset: 0, zIndex: 2900 }}>
      <div
        ref={backdrop}
        onClick={leave}
        style={{ position: 'absolute', inset: 0, background: '#EFE8DC', opacity: 0 }}
      />
      <div
        style={{
          position: 'absolute',
          left: (vw - W) / 2 - 8,
          top: Math.max(56, (vh - H) / 2 - 30),
          width: W,
          height: H,
        }}>
        <div ref={wrap} style={{ position: 'relative', width: W, height: H, perspective: 1600 }}>
          {/* las pestañas, a la derecha: llevan a cada año */}
          {book.tabs.map((t, i) => {
            const on = activeTab?.page === t.page;
            const slot = H / Math.max(7, book.tabs.length + 1);
            return (
              <button
                key={t.label + t.page}
                type="button"
                aria-label={`Ir a ${t.label}`}
                onClick={() => setCur(Math.max(1, t.page))}
                style={{
                  ...tabStyle(t.color),
                  position: 'absolute',
                  right: on ? -34 : -28,
                  top: 16 + i * slot,
                  width: 34,
                  height: slot - 6,
                  border: 0,
                  cursor: 'pointer',
                  transition: 'right .3s cubic-bezier(.22,1.06,.36,1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: 4,
                  zIndex: 0,
                }}>
                <span
                  style={{
                    writingMode: 'vertical-rl',
                    color: '#FFFFFF',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                  }}>
                  {t.label}
                </span>
              </button>
            );
          })}
          {/* el bloque de hojas, por detrás */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              left: 4,
              borderRadius: '4px 12px 12px 4px',
              background: `repeating-linear-gradient(to right, ${PAPER} 0 2px, #E6DCC6 2px 3px)`,
              boxShadow: '0 22px 50px rgba(30,20,10,.28)',
              zIndex: 1,
            }}
          />
          <div
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            style={{
              position: 'absolute',
              inset: 0,
              transformStyle: 'preserve-3d',
              zIndex: 2,
              touchAction: 'pan-y',
              userSelect: 'none',
            }}>
            {book.pages.map((p, i) => {
              const flipped = i < cur;
              const dragging = drag?.page === i;
              const angle = dragging ? drag.angle : flipped ? -180 : 0;
              // solo se pintan las hojas cercanas (las demás, ocultas)
              const near = Math.abs(i - cur) <= 2;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transformOrigin: 'left center',
                    transformStyle: 'preserve-3d',
                    transform: `rotateY(${angle}deg)`,
                    transition: dragging
                      ? 'none'
                      : 'transform .75s cubic-bezier(.3,.7,.2,1), opacity .2s',
                    zIndex: flipped ? i : n - i,
                    opacity: flipped && !dragging ? 0 : 1,
                    transitionDelay: flipped && !dragging ? '0s, .6s' : '0s',
                    visibility: near || dragging ? 'visible' : 'hidden',
                    pointerEvents: i === cur ? 'auto' : 'none',
                  }}>
                  {/* el anverso */}
                  <div style={{ ...face, ...(p.kind === 'cover' ? {} : paper) }}>
                    {p.kind === 'cover' ? (
                      <CoverFace name={name} since={since} />
                    ) : (
                      <PageBody
                        page={p}
                        num={i}
                        name={name}
                        since={since}
                        members={members}
                        visible={shown && i === cur}
                        groupId={groupId}
                        go={go}
                        authorName={(id) => user(id).name.split(' ')[0]}
                      />
                    )}
                    {/* la sombra de la hoja al girar */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        background: 'linear-gradient(to left, rgba(0,0,0,.18), rgba(0,0,0,0) 60%)',
                        opacity: Math.min(1, Math.abs(angle) / 90),
                        transition: dragging ? 'none' : 'opacity .75s',
                        borderRadius: 'inherit',
                      }}
                    />
                  </div>
                  {/* el reverso */}
                  <div
                    style={{
                      ...face,
                      transform: 'rotateY(180deg)',
                      background: p.kind === 'cover' ? '#E9DFCB' : '#F3ECDD',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div
          style={{
            textAlign: 'center',
            marginTop: 14,
            fontFamily: Hand,
            fontSize: 16,
            color: '#7A6A55',
          }}>
          {cur > 0 ? `${cur} / ${n - 1} · desliza para pasar la hoja` : ''}
        </div>
      </div>
      <button type="button" aria-label="Cerrar el diario" onClick={leave} style={closeBtn}>
        <Icon icon={X} size={20} color="#1D1F22" />
      </button>
      <div style={bar}>
        <button
          type="button"
          onClick={() => go(() => router.push({ pathname: '/historia', params: { groupId } }))}
          style={pill}>
          <Icon icon={Play} size={16} color="#FFFFFF" />
          Ver la historia narrada
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** Lo que va escrito en cada hoja. */
function PageBody({
  page,
  num,
  name,
  since,
  members,
  visible,
  groupId,
  go,
  authorName,
}: {
  page: Page;
  num: number;
  name: string;
  since: number;
  members: string[];
  visible: boolean;
  groupId: string;
  go: (fn: () => void) => void;
  authorName: (id: string) => string;
}) {
  const anim = (i: number): React.CSSProperties =>
    visible
      ? { animation: `jbk-in .55s cubic-bezier(.22,1.06,.36,1) ${0.15 + i * 0.12}s both` }
      : {};
  let body: React.ReactNode = null;
  if (page.kind === 'intro') {
    body = (
      <div style={{ paddingTop: 40, textAlign: 'center' }}>
        <div style={{ ...h(22), color: '#7A6A55', ...anim(0) }}>Este diario es de</div>
        <div style={{ ...hb(40), ...anim(1) }}>{name}</div>
        <div style={{ ...h(20), color: '#6B5640', marginTop: 8, padding: '0 10px', ...anim(2) }}>
          {members.join(', ')}
        </div>
        <Doodle kind="heart" style={{ margin: '26px auto 0', ...anim(3) }} />
        <div style={{ ...h(22), marginTop: 18, ...anim(4) }}>
          Desde {since}, juntos aunque lejos.
        </div>
        <div style={{ ...h(17), color: '#7A6A55', marginTop: 30, ...anim(5) }}>pasa la hoja →</div>
      </div>
    );
  } else if (page.kind === 'origin') {
    body = (
      <div>
        <div style={{ ...hb(34), ...anim(0) }}>Dónde empezó todo</div>
        {page.origins.map((o, i) => (
          <div key={o.id} style={{ marginTop: 18, ...anim(i + 1) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Doodle kind="pin" />
              <div style={{ ...hb(28) }}>
                {o.place}
                {o.year ? `, ${o.year}` : ''}
              </div>
            </div>
            {!!o.story && (
              <div style={{ ...h(21), marginTop: 4, lineHeight: '26px' }}>«{o.story}»</div>
            )}
          </div>
        ))}
      </div>
    );
  } else if (page.kind === 'year') {
    const spots = [
      { left: '4%', top: 70, rot: -4 },
      { left: '46%', top: 130, rot: 5 },
      { left: '10%', top: 250, rot: 3 },
    ];
    body = (
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, ...anim(0) }}>
          <span style={{ ...hb(42) }}>{page.year}</span>
          {page.part > 0 && <span style={{ ...h(18), color: '#7A6A55' }}>(sigue)</span>}
          <Doodle kind="star" style={{ marginLeft: 'auto' }} />
        </div>
        {page.memories.map((m, i) => (
          <button
            key={m.id}
            type="button"
            aria-label={m.text ?? 'Recuerdo'}
            onClick={() =>
              go(() => router.push({ pathname: '/moment/[id]', params: { id: m.id } }))
            }
            style={{
              position: 'absolute',
              left: spots[i].left,
              top: spots[i].top,
              border: 0,
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
              ...(visible
                ? { animation: `jbk-drop .6s cubic-bezier(.22,1.06,.36,1) ${0.2 + i * 0.15}s both` }
                : {}),
              ['--r' as string]: `${spots[i].rot}deg`,
              transform: `rotate(${spots[i].rot}deg)`,
            }}>
            <Polaroid
              moment={m}
              tape={TABS[(page.year + i) % TABS.length]}
              author={authorName(m.authorId)}
            />
          </button>
        ))}
      </div>
    );
  } else if (page.kind === 'gap') {
    const label = page.from === page.to ? `${page.from}` : `${page.from} y ${page.to}`;
    body = (
      <div>
        <div style={{ ...hb(32), ...anim(0) }}>
          ¿Qué pasó {page.from === page.to ? 'en' : 'entre'} {label}?
        </div>
        <div style={{ ...h(20), color: '#6B5640', marginTop: 6, ...anim(1) }}>
          Esta hoja está en blanco. ¿Quién se acuerda de algo?
        </div>
        <button
          type="button"
          onClick={() =>
            go(() =>
              router.push({
                pathname: '/publish',
                params: { groupId, memory: '1', year: String(page.from) },
              }),
            )
          }
          style={{ ...emptyPolaroid, ...anim(2) }}>
          <Icon icon={Plus} size={28} color="#7A6A55" />
          <span style={{ ...h(20), color: '#7A6A55' }}>Añadir un recuerdo</span>
        </button>
      </div>
    );
  } else if (page.kind === 'junti') {
    body = (
      <div style={{ textAlign: 'center', paddingTop: 30 }}>
        <div style={{ ...h(22), color: '#7A6A55', ...anim(0) }}>y en {page.year}…</div>
        <div style={{ ...hb(40), ...anim(1) }}>llegó Junti</div>
        <Doodle kind="camera" style={{ margin: '22px auto 0', ...anim(2) }} />
        <div style={{ ...h(22), marginTop: 18, lineHeight: '27px', padding: '0 6px', ...anim(3) }}>
          Desde entonces, lo que compartís se guarda en los carretes de cada mes.
        </div>
        <div style={{ ...h(20), color: '#7A6A55', marginTop: 22, ...anim(4) }}>continuará…</div>
      </div>
    );
  }
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: '22px 22px 22px 28px',
        overflow: 'hidden',
      }}>
      {body}
      <div style={{ position: 'absolute', bottom: 10, right: 16, ...h(14), color: '#A8957A' }}>
        {num}
      </div>
    </div>
  );
}

function Polaroid({ moment, tape, author }: { moment: Moment; tape: string; author: string }) {
  return (
    <div
      style={{
        position: 'relative',
        width: 128,
        padding: '8px 8px 26px',
        background: '#FFFFFF',
        boxShadow: '0 6px 14px rgba(40,25,10,.22)',
      }}>
      {/* la cinta que la sujeta */}
      <div
        style={{
          position: 'absolute',
          top: -9,
          left: '50%',
          width: 54,
          height: 18,
          marginLeft: -27,
          background: tape,
          opacity: 0.75,
          transform: 'rotate(-6deg)',
        }}
      />
      {moment.imageUri ? (
        <img
          src={moment.imageUri}
          alt=""
          draggable={false}
          style={{ width: 112, height: 112, objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div
          style={{
            width: 112,
            height: 112,
            background: '#F4ECDC',
            padding: 8,
            boxSizing: 'border-box',
            ...h(16),
            lineHeight: '18px',
            overflow: 'hidden',
            textAlign: 'left',
            color: INK,
          }}>
          {moment.text}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          left: 8,
          right: 8,
          bottom: 3,
          ...h(14),
          lineHeight: '15px',
          color: INK,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
        {moment.imageUri && moment.text ? moment.text : author}
      </div>
    </div>
  );
}

/** Dibujitos a mano para las hojas. */
function Doodle({
  kind,
  style,
}: {
  kind: 'heart' | 'pin' | 'star' | 'camera';
  style?: React.CSSProperties;
}) {
  const d = {
    heart: 'M24 40 C6 28 4 14 13 9 C19 6 23 10 24 14 C25 10 30 6 36 9 C45 14 42 28 24 40 Z',
    pin: 'M24 44 C14 30 10 24 10 18 A14 14 0 0 1 38 18 C38 24 34 30 24 44 Z M24 12 A6 6 0 1 0 24.1 12',
    star: 'M24 6 L29 19 L43 19 L32 28 L36 42 L24 34 L12 42 L16 28 L5 19 L19 19 Z',
    camera: 'M8 16 L16 16 L19 11 L29 11 L32 16 L40 16 L40 37 L8 37 Z M24 20 A7 7 0 1 0 24.1 20',
  }[kind];
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 48 48"
      style={{ display: 'block', ...style }}
      aria-hidden>
      <path
        d={d}
        fill="none"
        stroke={kind === 'heart' || kind === 'pin' ? '#C2543A' : INK}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 220,
          strokeDashoffset: 0,
          animation: 'jbk-ink 1.2s ease-out both',
        }}
      />
    </svg>
  );
}

const h = (size: number): React.CSSProperties => ({ fontFamily: Hand, fontSize: size, color: INK });
const hb = (size: number): React.CSSProperties => ({
  fontFamily: HandBold,
  fontSize: size,
  color: INK,
  lineHeight: 1.05,
});
const face: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
  borderRadius: '3px 12px 12px 3px',
  overflow: 'hidden',
};
const paper: React.CSSProperties = {
  background: `${PAPER} repeating-linear-gradient(to bottom, transparent 0 31px, rgba(90,120,160,.16) 31px 32px)`,
  backgroundPosition: '0 14px',
  boxShadow: 'inset 10px 0 14px -10px rgba(60,40,20,.28)',
};
const emptyPolaroid: React.CSSProperties = {
  marginTop: 34,
  marginLeft: 'auto',
  marginRight: 'auto',
  width: 170,
  height: 190,
  border: '2px dashed rgba(122,106,85,.5)',
  borderRadius: 6,
  background: 'rgba(255,255,255,.4)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  cursor: 'pointer',
  transform: 'rotate(-2deg)',
};
const closeBtn: React.CSSProperties = {
  position: 'fixed',
  top: 10,
  right: 12,
  width: 40,
  height: 40,
  borderRadius: 20,
  border: 0,
  background: 'rgba(255,255,255,.85)',
  boxShadow: '0 2px 8px rgba(0,0,0,.08)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  zIndex: 5,
};
const bar: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  padding: '16px 16px max(18px, env(safe-area-inset-bottom))',
  display: 'flex',
  justifyContent: 'center',
  zIndex: 5,
};
const pill: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  height: 46,
  padding: '0 22px',
  borderRadius: 23,
  border: 0,
  background: COVER,
  color: '#FFFFFF',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
};

if (typeof document !== 'undefined' && !document.getElementById('jbk-css')) {
  const s = document.createElement('style');
  s.id = 'jbk-css';
  s.textContent =
    '@keyframes jbk-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}' +
    '@keyframes jbk-shadow{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.9);opacity:.75}}' +
    '@keyframes jbk-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}' +
    '@keyframes jbk-drop{0%{opacity:0;transform:translateY(-28px) rotate(var(--r)) scale(1.06)}70%{opacity:1;transform:translateY(3px) rotate(var(--r))}100%{opacity:1;transform:rotate(var(--r))}}' +
    '@keyframes jbk-ink{from{stroke-dashoffset:220}to{stroke-dashoffset:0}}';
  document.head.appendChild(s);
}
