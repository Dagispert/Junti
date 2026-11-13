import { geoContains, geoEquirectangular, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

import { localHour, skyPhase } from '@/lib/geo';

import type { GlobeMapProps, GlobeMemory, GlobePerson } from './globe-map.types';

export type { GlobeMemory, GlobePerson } from './globe-map.types';

// Un pequeño planeta de dibujo animado: países en verdes con sus fronteras, mar
// turquesa, playas, árboles, nubes que flotan, una casita y una chincheta con
// foto en la ciudad de cada persona, y arcos con luces que viajan entre ellas.
// Todo se dibuja aquí con three.js a partir de Natural Earth (dominio público):
// no depende de ningún servicio de mapas.

const BASE = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
const R = 1;
const DEG = Math.PI / 180;

const PAL = {
  ocean: '#58C3D6',
  oceanDeep: '#3FAFC8',
  shallow: '#93DFE7',
  sand: '#F3E2AE',
  greens: ['#8CCB5B', '#9DD36A', '#7FC04F', '#A9D86F', '#94C85E', '#86C258'],
  home: '#C7E36E',
  ice: '#F4F8FA',
  border: 'rgba(255,255,255,0.75)',
  arc: '#FF8A3D',
};

// ── Datos del mundo (una sola vez) ──

type World = {
  countries: FeatureCollection<Geometry, { name: string }>;
  borders: ReturnType<typeof mesh>;
  land: ReturnType<typeof feature>;
};
let worldPromise: Promise<World> | null = null;
function loadWorld(): Promise<World> {
  worldPromise ??= fetch(`${BASE}/world-110m.json`)
    .then((r) => r.json())
    .then((topo: Topology) => {
      const obj = topo.objects.countries as GeometryCollection<{ name: string }>;
      return {
        countries: feature(topo, obj) as unknown as FeatureCollection<Geometry, { name: string }>,
        borders: mesh(topo, obj, (a, b) => a !== b),
        land: feature(topo, topo.objects.land),
      };
    })
    .catch((e) => {
      worldPromise = null;
      throw e;
    });
  return worldPromise;
}

/** Posición en la esfera, coherente con cómo three.js envuelve la textura. */
function toVec(lat: number, lng: number, r = R) {
  const phi = (lng + 180) * DEG;
  const cl = Math.cos(lat * DEG);
  return new THREE.Vector3(
    -Math.cos(phi) * cl * r,
    Math.sin(lat * DEG) * r,
    Math.sin(phi) * cl * r,
  );
}
/** Giro que pone un punto de frente a la cámara. */
function facing(lat: number, lng: number) {
  return { yaw: Math.PI / 2 - (lng + 180) * DEG, pitch: lat * DEG };
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Pinta el mapa (mar, costas, países y fronteras) con una proyección dada. */
function paintMap(
  ctx: CanvasRenderingContext2D,
  world: World,
  homeIds: Set<string>,
  proj: ReturnType<typeof geoEquirectangular>,
  W: number,
  H: number,
  k: number,
) {
  const path = geoPath(proj, ctx);

  // El mar va por latitudes (igual en el mundo entero que en un trozo ampliado).
  const top = proj([0, 90])?.[1] ?? 0;
  const bottom = proj([0, -90])?.[1] ?? H;
  const sea = ctx.createLinearGradient(0, top, 0, bottom);
  sea.addColorStop(0, PAL.oceanDeep);
  sea.addColorStop(0.5, PAL.ocean);
  sea.addColorStop(1, PAL.oceanDeep);
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, W, H);

  // Aguas poco profundas y playas alrededor de las costas.
  ctx.lineJoin = 'round';
  ctx.beginPath();
  path(world.land as never);
  ctx.strokeStyle = PAL.shallow;
  ctx.lineWidth = 22 * k;
  ctx.stroke();
  ctx.strokeStyle = PAL.sand;
  ctx.lineWidth = 7 * k;
  ctx.stroke();

  for (const c of world.countries.features) {
    const name = c.properties?.name ?? '';
    const id = String(c.id ?? name);
    ctx.beginPath();
    path(c as never);
    ctx.fillStyle = /Antarctica|Greenland/.test(name)
      ? PAL.ice
      : homeIds.has(id)
        ? PAL.home
        : PAL.greens[hash(id) % PAL.greens.length];
    ctx.fill();
  }
  ctx.beginPath();
  path(world.borders as never);
  ctx.strokeStyle = PAL.border;
  ctx.lineWidth = 2.2 * k;
  ctx.setLineDash([7 * k, 5 * k]);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** La «piel» del planeta, pintada en un lienzo. Devuelve también una máscara de tierra. */
function paintTexture(world: World, homeIds: Set<string>, size: number) {
  const W = size;
  const H = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const proj = geoEquirectangular()
    .scale(W / (2 * Math.PI))
    .translate([W / 2, H / 2]);
  paintMap(ctx, world, homeIds, proj, W, H, W / 4096);

  // Máscara de tierra (sin hielo) para plantar árboles.
  const mask = document.createElement('canvas');
  mask.width = 720;
  mask.height = 360;
  const m = mask.getContext('2d')!;
  const mp = geoPath(
    geoEquirectangular()
      .scale(720 / (2 * Math.PI))
      .translate([360, 180]),
    m,
  );
  m.fillStyle = '#000';
  m.fillRect(0, 0, 720, 360);
  for (const c of world.countries.features) {
    if (/Antarctica|Greenland/.test(c.properties?.name ?? '')) continue;
    m.beginPath();
    mp(c as never);
    m.fillStyle = '#fff';
    m.fill();
  }
  const pixels = m.getImageData(0, 0, 720, 360).data;
  const isLand = (lat: number, lng: number) => {
    const x = Math.floor(((lng + 180) / 360) * 720) % 720;
    const y = Math.floor(((90 - lat) / 180) * 360);
    return pixels[(y * 720 + x) * 4] > 128;
  };
  return { canvas, isLand };
}

/**
 * Un trozo del planeta en alta resolución (para cuando se acerca la cámara):
 * se pinta solo esa región y se pone encima como un «parche» curvo, para que
 * al ampliar un país no se vea borroso.
 */
type Region = { lat0: number; lat1: number; lng0: number; lng1: number };
function makeDetail(world: World, homeIds: Set<string>, r: Region, maxTex: number) {
  const spanLng = r.lng1 - r.lng0;
  const spanLat = r.lat1 - r.lat0;
  const W = Math.min(2048, maxTex);
  const s = W / (spanLng * DEG);
  const H = Math.min(maxTex, Math.round(s * spanLat * DEG));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const proj = geoEquirectangular()
    .scale(s)
    .translate([-r.lng0 * DEG * s, r.lat1 * DEG * s]);
  // Grosor de líneas: algo más finas, en proporción, que en el mundo entero.
  const ppd = W / spanLng;
  paintMap(ctx, world, homeIds, proj, W, H, Math.min(3, (ppd / (4096 / 360)) * 0.45));
  // Bordes que se difuminan: el parche se funde con el resto del planeta.
  ctx.globalCompositeOperation = 'destination-in';
  const fade = Math.min(W, H) * 0.18;
  const gx = ctx.createLinearGradient(0, 0, W, 0);
  gx.addColorStop(0, 'rgba(0,0,0,0)');
  gx.addColorStop(fade / W, 'rgba(0,0,0,1)');
  gx.addColorStop(1 - fade / W, 'rgba(0,0,0,1)');
  gx.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gx;
  ctx.fillRect(0, 0, W, H);
  const gy = ctx.createLinearGradient(0, 0, 0, H);
  gy.addColorStop(0, 'rgba(0,0,0,0)');
  gy.addColorStop(fade / H, 'rgba(0,0,0,1)');
  gy.addColorStop(1 - fade / H, 'rgba(0,0,0,1)');
  gy.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gy;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(
      R * 1.0006,
      48,
      48,
      (r.lng0 + 180) * DEG,
      spanLng * DEG,
      (90 - r.lat1) * DEG,
      spanLat * DEG,
    ),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0, transparent: true }),
  );
  return mesh;
}

// ── Chinchetas (HTML encima del lienzo) ──

const CSS = `
.jglobe{position:relative;width:100%;height:100%;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
.jglobe canvas{display:block;width:100%;height:100%}
.jpin{position:absolute;left:0;top:0;cursor:pointer;font-family:Inter,system-ui,sans-serif;will-change:transform,opacity;transition:opacity .25s}
.jpin-in{position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);
  animation:jpin-in .8s cubic-bezier(.2,1.5,.4,1) both;animation-delay:var(--d,0s)}
.jpin-card{width:42px;height:42px;border-radius:50%;border:3px solid #fff;overflow:hidden;
  box-shadow:0 8px 18px rgba(20,40,30,.32);display:flex;align-items:center;justify-content:center;
  transition:transform .4s cubic-bezier(.2,1.5,.4,1)}
.jpin:hover .jpin-card,.jpin.is-focus .jpin-card{transform:scale(1.18) translateY(-2px)}
.jpin-card img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
.jpin-card span{color:#fff;font-size:18px;font-weight:700}
.jpin-tip{width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #fff;margin-top:-1px}
.jpin-label{position:absolute;top:100%;margin-top:3px;white-space:nowrap;display:flex;flex-direction:column;align-items:center;
  background:rgba(255,255,255,.94);color:#1D1F22;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;
  box-shadow:0 3px 10px rgba(20,40,30,.18)}
.jpin-more{display:none;align-items:center;gap:4px;font-weight:500;color:#6B7076;font-size:10px}
.jpin.is-focus .jpin-more{display:flex}
.jpin.is-focus .jpin-label{border-radius:10px;padding:3px 9px}
.jpin-sky{width:9px;height:9px;border-radius:50%}
.jclu{position:absolute;left:0;top:0;cursor:pointer;will-change:transform,opacity;transition:opacity .25s}
.jclu-in{display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);animation:jmem-pop .45s cubic-bezier(.2,1.5,.4,1) both}
.jclu-faces{display:flex;padding:3px;background:#fff;border-radius:999px;box-shadow:0 8px 18px rgba(20,40,30,.32)}
.jclu-faces div{width:30px;height:30px;border-radius:50%;overflow:hidden;margin-left:-10px;border:2px solid #fff;background:#23262B;
  display:flex;align-items:center;justify-content:center;color:#fff;font:700 13px Inter,system-ui,sans-serif}
.jclu-faces div:first-child{margin-left:0}
.jclu-faces img{width:100%;height:100%;object-fit:cover;display:block}
.jclu-n{min-width:30px;height:30px;margin-left:-8px;border-radius:999px;background:#1D1F22;color:#fff;
  font:700 12px Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;border:2px solid #fff}
.jclu-label{margin-top:4px;white-space:nowrap;background:rgba(255,255,255,.94);color:#1D1F22;font:600 11px Inter,system-ui,sans-serif;
  padding:2px 9px;border-radius:999px;box-shadow:0 3px 10px rgba(20,40,30,.18)}
@keyframes jmem-pop{0%{opacity:0;transform:translate(-50%,-100%) scale(.6)}100%{opacity:1;transform:translate(-50%,-100%) scale(1)}}
.jmem{position:absolute;left:0;top:0;cursor:pointer;will-change:transform,opacity;transition:opacity .25s}
.jmem-in{transform:translate(-50%,-50%);animation:jmem-in .7s cubic-bezier(.2,1.6,.4,1) both;animation-delay:var(--d,0s)}
.jmem-b{width:38px;height:38px;border-radius:50%;border:3px solid #fff;overflow:hidden;background:#F3E2AE;
  box-shadow:0 8px 16px rgba(20,40,30,.3);display:flex;align-items:center;justify-content:center;font-size:17px;
  transition:transform .35s cubic-bezier(.2,1.5,.4,1)}
.jmem:hover .jmem-b,.jmem.is-focus .jmem-b{transform:scale(1.25)}
.jmem-b img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
.jmem-n{position:absolute;right:-6px;top:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#E2703A;
  color:#fff;font:700 11px Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;border:2px solid #fff}
@keyframes jmem-in{0%{opacity:0;transform:translate(-50%,-50%) scale(0)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes jpin-in{0%{opacity:0;transform:translate(-50%,-160%) scale(.5)}100%{opacity:1;transform:translate(-50%,-100%)}}
`;
function injectCss() {
  if (document.getElementById('junti-globe-css')) return;
  const el = document.createElement('style');
  el.id = 'junti-globe-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

const SKY: Record<string, string> = {
  night: 'linear-gradient(#0B1230,#2A3466)',
  dawn: 'linear-gradient(#FFB38A,#8A86D4)',
  day: 'linear-gradient(#4FB0EE,#BDE3FA)',
  dusk: 'linear-gradient(#F48C4E,#5E4594)',
};
const clock = (tz: string) => {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    }).format(Date.now());
  } catch {
    return '';
  }
};

function pinElement(p: GlobePerson, index: number, onSelect: (id: string) => void) {
  const el = document.createElement('div');
  el.className = 'jpin';
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `${p.isMe ? 'Tú' : p.name}${p.city ? `, ${p.city}` : ''}`);
  const inner = document.createElement('div');
  inner.className = 'jpin-in';
  inner.style.setProperty('--d', `${0.5 + index * 0.16}s`);
  const card = document.createElement('div');
  card.className = 'jpin-card';
  card.style.background = p.photo ? '#23262B' : p.color;
  if (p.photo) {
    const img = document.createElement('img');
    img.src = p.photo;
    img.alt = '';
    card.appendChild(img);
  } else {
    const s = document.createElement('span');
    s.textContent = p.name[0] ?? '·';
    card.appendChild(s);
  }
  const tip = document.createElement('div');
  tip.className = 'jpin-tip';
  const label = document.createElement('div');
  label.className = 'jpin-label';
  const sky = document.createElement('div');
  sky.className = 'jpin-sky';
  sky.style.background = SKY[skyPhase(localHour(p.tz))];
  // Solo el nombre; la hora y el sitio, al tocarla.
  const name = document.createElement('span');
  name.textContent = p.isMe ? 'Tú' : p.name.split(' ')[0];
  const more = document.createElement('div');
  more.className = 'jpin-more';
  const when = document.createElement('span');
  when.textContent = `${clock(p.tz)} · ${p.city ?? p.country ?? ''}`;
  more.append(sky, when);
  label.append(name, more);
  inner.append(card, tip, label);
  el.appendChild(inner);
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onSelect(p.id);
  });
  return el;
}

/** Agrupa recuerdos cercanos (misma ciudad, ~15 km) en una sola burbuja. */
function clusterMemories(list: GlobeMemory[]) {
  const groups: { lat: number; lng: number; items: GlobeMemory[] }[] = [];
  for (const m of list) {
    const g = groups.find((x) => Math.abs(x.lat - m.lat) < 0.15 && Math.abs(x.lng - m.lng) < 0.15);
    if (g) g.items.push(m);
    else groups.push({ lat: m.lat, lng: m.lng, items: [m] });
  }
  return groups;
}

function memoryElement(items: GlobeMemory[], index: number, onTap: (ids: string[]) => void) {
  const el = document.createElement('div');
  el.className = 'jmem';
  el.setAttribute('role', 'button');
  el.setAttribute(
    'aria-label',
    `${items.length} ${items.length === 1 ? 'recuerdo' : 'recuerdos'}${items[0].title ? `: ${items[0].title}` : ''}`,
  );
  const inner = document.createElement('div');
  inner.className = 'jmem-in';
  inner.style.setProperty('--d', `${0.8 + index * 0.08}s`);
  const b = document.createElement('div');
  b.className = 'jmem-b';
  const photo = items.find((m) => m.photo)?.photo;
  if (photo) {
    const img = document.createElement('img');
    img.src = photo;
    img.alt = '';
    b.appendChild(img);
  } else {
    // Un recuerdo sin foto: un lápiz de línea (el mismo trazo que los iconos de la app).
    b.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/></svg>';
  }
  inner.appendChild(b);
  if (items.length > 1) {
    const n = document.createElement('div');
    n.className = 'jmem-n';
    n.textContent = String(items.length);
    inner.appendChild(n);
  }
  el.appendChild(inner);
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onTap(items.map((m) => m.id));
  });
  return el;
}

/** Varias personas tan juntas que se pisan: una sola chincheta con sus caras. */
function clusterElement(list: GlobePerson[], onTap: () => void) {
  const el = document.createElement('div');
  el.className = 'jclu';
  el.setAttribute('role', 'button');
  const countries = [...new Set(list.map((p) => p.country).filter(Boolean))];
  const where = countries.length === 1 ? countries[0] : (list[0].city ?? '');
  el.setAttribute('aria-label', `${list.length} personas${where ? ` en ${where}` : ''}. Acercar`);
  const inner = document.createElement('div');
  inner.className = 'jclu-in';
  const faces = document.createElement('div');
  faces.className = 'jclu-faces';
  for (const p of list.slice(0, 3)) {
    const f = document.createElement('div');
    if (p.photo) {
      const img = document.createElement('img');
      img.src = p.photo;
      img.alt = '';
      f.appendChild(img);
    } else {
      f.style.background = p.color;
      f.textContent = p.name[0] ?? '·';
    }
    faces.appendChild(f);
  }
  if (list.length > 3) {
    const n = document.createElement('div');
    n.className = 'jclu-n';
    n.textContent = `+${list.length - 3}`;
    faces.appendChild(n);
  }
  const label = document.createElement('div');
  label.className = 'jclu-label';
  label.textContent = `${where || 'Aquí'} · ${list.length}`;
  inner.append(faces, label);
  el.appendChild(inner);
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onTap();
  });
  return el;
}

// ── Elementos 3D ──

function makeTrees(isLand: (lat: number, lng: number) => boolean, count: number) {
  const group = new THREE.Group();
  const round = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.012, 0),
    new THREE.MeshStandardMaterial({ color: '#4E9E3E', flatShading: true, roughness: 0.9 }),
    count,
  );
  const pine = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.009, 0.03, 6),
    new THREE.MeshStandardMaterial({ color: '#2F7F3A', flatShading: true, roughness: 0.9 }),
    count,
  );
  const up = new THREE.Vector3(0, 1, 0);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  let rn = 0;
  let pn = 0;
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let tries = 0; tries < count * 12 && rn + pn < count; tries++) {
    const lat = Math.asin(rand() * 2 - 1) / DEG;
    const lng = rand() * 360 - 180;
    if (Math.abs(lat) > 72 || !isLand(lat, lng)) continue;
    const isPine = Math.abs(lat) > 45 ? rand() < 0.8 : rand() < 0.25;
    const pos = toVec(lat, lng, R + (isPine ? 0.013 : 0.009));
    q.setFromUnitVectors(up, pos.clone().normalize());
    const k = 0.7 + rand() * 0.6;
    s.set(k, k * (isPine ? 1 : 0.85), k);
    m.compose(pos, q, s);
    if (isPine) pine.setMatrixAt(pn++, m);
    else round.setMatrixAt(rn++, m);
  }
  round.count = rn;
  pine.count = pn;
  group.add(round, pine);
  return group;
}

function makeHouse(lat: number, lng: number, color: string) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(0.022, 0.018, 0.022),
    new THREE.MeshStandardMaterial({ color: '#FFF8EC', roughness: 0.8 }),
  );
  wall.position.y = 0.009;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.019, 0.014, 4),
    new THREE.MeshStandardMaterial({ color, flatShading: true }),
  );
  roof.position.y = 0.025;
  roof.rotation.y = Math.PI / 4;
  g.add(wall, roof);
  const pos = toVec(lat, lng, R);
  g.position.copy(pos);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
  return g;
}

function makeClouds(n: number) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', flatShading: true, roughness: 1 });
  const geo = new THREE.IcosahedronGeometry(0.035, 1);
  let seed = 3;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < puffs; j++) {
      const p = new THREE.Mesh(geo, mat);
      p.position.set((j - puffs / 2) * 0.035, rand() * 0.015, (rand() - 0.5) * 0.03);
      p.scale.setScalar(0.8 + rand() * 0.7);
      cloud.add(p);
    }
    const lat = (rand() * 2 - 1) * 65;
    const lng = rand() * 360 - 180;
    const pos = toVec(lat, lng, R * 1.2);
    cloud.position.copy(pos);
    cloud.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
    group.add(cloud);
  }
  return group;
}

/** Halo de atmósfera alrededor del planeta. */
function makeHalo() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.12, 64, 64),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      uniforms: { color: { value: new THREE.Color('#BDEBFF') } },
      vertexShader: `varying vec3 vN; varying vec3 vP;
        void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vP = mv.xyz; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 color; varying vec3 vN; varying vec3 vP;
        void main(){ float f = pow(0.72 - dot(vN, normalize(-vP)), 2.4); gl_FragColor = vec4(color, clamp(f, 0.0, 1.0) * 0.9); }`,
    }),
  );
}

type ArcObj = {
  curve: THREE.CatmullRomCurve3;
  tube: THREE.Mesh;
  comet: THREE.Group;
  offset: number;
};

function makeArc(a: GlobePerson, b: GlobePerson, i: number): ArcObj | null {
  const va = toVec(a.lat, a.lng).normalize();
  const vb = toVec(b.lat, b.lng).normalize();
  const angle = va.angleTo(vb);
  // Mismo sitio o justo en las antípodas: no hay un arco único que dibujar.
  if (!Number.isFinite(angle) || angle < 0.01 || angle > Math.PI - 0.01) return null;
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= 48; k++) {
    const t = k / 48;
    const v = new THREE.Vector3().copy(va).lerp(vb, t).normalize();
    // Interpolación esférica real, para seguir la curvatura del planeta.
    const s = Math.sin(angle);
    v.copy(va)
      .multiplyScalar(Math.sin((1 - t) * angle) / s)
      .add(vb.clone().multiplyScalar(Math.sin(t * angle) / s));
    v.multiplyScalar(R * (1.01 + Math.sin(Math.PI * t) * (0.06 + angle * 0.12)));
    pts.push(v);
  }
  if (pts.some((p) => !Number.isFinite(p.x + p.y + p.z))) return null;
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 96, 0.0032, 6, false),
    new THREE.MeshBasicMaterial({ color: PAL.arc, transparent: true, opacity: 0.9 }),
  );
  const comet = new THREE.Group();
  comet.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 12, 12),
      new THREE.MeshBasicMaterial({ color: '#FFFFFF' }),
    ),
  );
  comet.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 12, 12),
      new THREE.MeshBasicMaterial({
        color: '#FFC27A',
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    ),
  );
  return { curve, tube, comet, offset: i * 0.37 };
}

function arcPairs(people: GlobePerson[]) {
  const me = people.find((p) => p.isMe);
  const pairs: [GlobePerson, GlobePerson][] = [];
  for (let i = 0; i < people.length; i++)
    for (let j = i + 1; j < people.length; j++) {
      const a = people[i];
      const b = people[j];
      if (me && a !== me && b !== me && pairs.length >= 6) continue;
      pairs.push(b === me ? [b, a] : [a, b]);
    }
  return pairs;
}

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export function GlobeMap({
  people,
  height,
  interactive = true,
  focusId = null,
  onSelect,
  rounded,
  transparent,
  memories = [],
  onMemories,
  focusPoint = null,
  hidePeople = false,
  distScale = 1,
  shiftY = 0,
}: GlobeMapProps) {
  const frameRef = useRef({ distScale, shiftY });
  frameRef.current = { distScale, shiftY };
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{
    setPeople: (p: GlobePerson[]) => void;
    focus: (id: string | null) => void;
    setMemories: (m: GlobeMemory[]) => void;
    focusAt: (lat: number, lng: number) => void;
    showPeople: (show: boolean) => void;
  } | null>(null);
  const memoriesRef = useRef(memories);
  memoriesRef.current = memories;
  const memoriesCb = useRef(onMemories);
  memoriesCb.current = onMemories;
  const peopleRef = useRef(people);
  peopleRef.current = people;
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const key = people.map((p) => `${p.id}:${p.lat},${p.lng}:${p.photo ? 1 : 0}`).join('|');

  useEffect(() => {
    injectCss();
    const root = host.current!;
    let disposed = false;
    let frame = 0;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    root.appendChild(renderer.domElement);
    const pinLayer = document.createElement('div');
    pinLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    root.appendChild(pinLayer);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    scene.add(new THREE.HemisphereLight('#FFFFFF', '#6E9AA8', 1.25));
    const sun = new THREE.DirectionalLight('#FFF3DC', 1.9);
    sun.position.set(-3, 3, 4);
    scene.add(sun);

    const world = new THREE.Group();
    world.rotation.order = 'XYZ';
    scene.add(world);
    scene.add(makeHalo());
    const clouds = makeClouds(14);
    world.add(clouds);
    const earthMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      roughness: 0.9,
      metalness: 0,
    });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 96), earthMat);
    world.add(earth);
    const people3d = new THREE.Group();
    world.add(people3d);

    // Cámara: rotación del planeta (yaw/pitch) y distancia, con objetivo suave.
    const view = { yaw: 2.2, pitch: 0.3, dist: interactive ? 9 : 3.6 };
    const target = { yaw: 0, pitch: 0.35, dist: 3.4 };
    let pins: { id: string; el: HTMLDivElement; pos: THREE.Vector3 }[] = [];
    let mems: { ids: string[]; el: HTMLDivElement; pos: THREE.Vector3 }[] = [];
    let peopleVisible = true;
    let arcs: ArcObj[] = [];
    let lastTouch = -1e9;
    let focused: string | null = null;
    let worldData: World | null = null;
    let homeKey = '';
    let homeSet = new Set<string>();
    // Grupos de personas que se pisan en pantalla.
    const clusters = new Map<string, HTMLDivElement>();
    // Parche de alta resolución para cuando la cámara se acerca.
    let detail: THREE.Mesh | null = null;
    let detailAt = { lat: 999, lng: 999, span: 0 };
    let detailTime = 0;
    // Paseo en reposo cuando el grupo está tan repartido que no cabe de una vez.
    let overview = { lat: 25, lng: -20, spread: 0 };
    let tourOrder: GlobePerson[] = [];
    let tourIdx = -1;
    let tourAt = 0;
    const started = performance.now();

    function centerOf(list: GlobePerson[]) {
      if (!list.length) return { lat: 25, lng: -20, spread: 0 };
      const v = new THREE.Vector3();
      for (const p of list) v.add(toVec(p.lat, p.lng).normalize());
      v.normalize();
      const lat = Math.asin(v.y) / DEG;
      // Inverso de toVec para la longitud.
      const phi = Math.atan2(v.z, -v.x);
      const lng = ((phi / DEG + 360) % 360) - 180;
      let spread = 0;
      for (const p of list) spread = Math.max(spread, v.angleTo(toVec(p.lat, p.lng).normalize()));
      return { lat, lng, spread };
    }
    /** Lo cerca que hay que estar para que quepan todos: más cerca si estáis juntos. */
    const fitDist = (spread: number) => Math.min(4.2, Math.max(1.45, 1 + spread * 5.2));
    function aimOverview() {
      const c = centerOf(peopleRef.current);
      overview = c;
      tourOrder = [...peopleRef.current].sort((a, b) => a.lng - b.lng);
      const f = facing(c.lat, c.lng);
      target.yaw = f.yaw;
      target.pitch = Math.max(-0.9, Math.min(0.9, f.pitch * (c.spread < 0.5 ? 1 : 0.8)));
      target.dist = fitDist(c.spread);
    }
    /** Acercarse a un grupo de personas para verlas por separado. */
    function zoomTo(list: GlobePerson[]) {
      const c = centerOf(list);
      const f = facing(c.lat, c.lng);
      focused = 'cluster';
      target.yaw = nearestYaw(f.yaw);
      target.pitch = Math.max(-1.25, Math.min(1.25, f.pitch));
      target.dist = Math.max(1.3, Math.min(2.6, 1 + c.spread * 4.5));
      lastTouch = -1e9;
    }
    function nearestYaw(y: number) {
      // Gira por el camino más corto.
      while (y - view.yaw > Math.PI) y -= Math.PI * 2;
      while (y - view.yaw < -Math.PI) y += Math.PI * 2;
      return y;
    }

    function setPeople(list: GlobePerson[]) {
      pins.forEach((p) => p.el.remove());
      clusters.forEach((el) => el.remove());
      clusters.clear();
      pins = list.map((p, i) => {
        const el = pinElement(p, i, (id) => selectRef.current?.(id));
        el.style.pointerEvents = interactive ? 'auto' : 'none';
        pinLayer.appendChild(el);
        return { id: p.id, el, pos: toVec(p.lat, p.lng, R * 1.004) };
      });
      people3d.clear();
      for (const p of list) people3d.add(makeHouse(p.lat, p.lng, p.isMe ? '#FF8A3D' : '#E2564A'));
      arcs.forEach((a) => world.remove(a.tube, a.comet));
      arcs = arcPairs(list)
        .map(([a, b], i) => makeArc(a, b, i))
        .filter(Boolean) as ArcObj[];
      arcs.forEach((a) => world.add(a.tube, a.comet));
      paint(list);
    }

    function paint(list: GlobePerson[]) {
      if (!worldData) return;
      const homes = new Set<string>();
      for (const p of list) {
        const c = worldData.countries.features.find((f) => geoContains(f as never, [p.lng, p.lat]));
        if (c) homes.add(String(c.id ?? c.properties?.name));
      }
      const k = [...homes].sort().join(',');
      if (k === homeKey && earthMat.map) return;
      homeKey = k;
      homeSet = homes;
      detailAt = { lat: 999, lng: 999, span: 0 }; // repintar el parche con las casas nuevas
      const size = Math.min(4096, renderer.capabilities.maxTextureSize);
      const { canvas, isLand } = paintTexture(worldData, homes, size);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      earthMat.map?.dispose();
      earthMat.map = tex;
      earthMat.needsUpdate = true;
      if (!world.getObjectByName('trees')) {
        const trees = makeTrees(isLand, 1000);
        trees.name = 'trees';
        world.add(trees);
      }
    }

    loadWorld()
      .then((w) => {
        if (disposed) return;
        worldData = w;
        paint(peopleRef.current);
      })
      .catch(() => {
        earthMat.color.set(PAL.ocean);
      });

    aimOverview();
    if (!interactive) {
      view.yaw = target.yaw;
      view.pitch = target.pitch;
      view.dist = target.dist;
    } else {
      view.yaw = target.yaw + 2.4;
    }
    setPeople(peopleRef.current);

    function setMemories(list: GlobeMemory[]) {
      mems.forEach((m) => m.el.remove());
      mems = clusterMemories(list).map((g, i) => {
        const el = memoryElement(g.items, i, (ids) => memoriesCb.current?.(ids));
        pinLayer.appendChild(el);
        return { ids: g.items.map((m) => m.id), el, pos: toVec(g.lat, g.lng, R * 1.01) };
      });
    }
    setMemories(memoriesRef.current);

    api.current = {
      setMemories,
      showPeople: (show) => {
        peopleVisible = show;
        people3d.visible = show;
        arcs.forEach((a) => {
          a.tube.visible = show;
          a.comet.visible = show;
        });
      },
      focusAt: (lat, lng) => {
        focused = 'point';
        const f = facing(lat, lng);
        target.yaw = nearestYaw(f.yaw);
        target.pitch = Math.max(-1.2, Math.min(1.2, f.pitch));
        target.dist = 2.1;
        lastTouch = -1e9;
      },
      setPeople: (list) => {
        setPeople(list);
        if (!focused) aimOverview();
      },
      focus: (id) => {
        focused = id;
        pins.forEach((p) => p.el.classList.toggle('is-focus', p.id === id));
        const p = peopleRef.current.find((x) => x.id === id);
        if (p) {
          const f = facing(p.lat, p.lng);
          target.yaw = nearestYaw(f.yaw);
          target.pitch = Math.max(-1.2, Math.min(1.2, f.pitch));
          target.dist = Math.min(2.1, Math.max(1.5, view.dist));
        } else {
          aimOverview();
          target.yaw = nearestYaw(target.yaw);
        }
        lastTouch = -1e9;
      },
    };

    // ── Gestos: arrastrar para girar (con inercia), pellizcar o rueda para acercar ──
    const pointers = new Map<number, { x: number; y: number }>();
    let vel = { yaw: 0, pitch: 0 };
    let pinch = 0;
    const onDown = (e: PointerEvent) => {
      if (!interactive) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      (e.target as Element).setPointerCapture?.(e.pointerId);
      lastTouch = performance.now();
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      lastTouch = performance.now();
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) target.dist = Math.max(1.3, Math.min(6, target.dist * (pinch / d)));
        view.dist = target.dist;
        pinch = d;
        return;
      }
      const speed = 0.0048 * (view.dist / 3.4);
      vel = { yaw: (e.clientX - prev.x) * speed, pitch: (e.clientY - prev.y) * speed };
      view.yaw += vel.yaw;
      view.pitch = Math.max(-1.25, Math.min(1.25, view.pitch + vel.pitch));
      target.yaw = view.yaw;
      target.pitch = view.pitch;
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
    };
    const onWheel = (e: WheelEvent) => {
      if (!interactive) return;
      e.preventDefault();
      lastTouch = performance.now();
      target.dist = Math.max(1.3, Math.min(6, target.dist * (1 + e.deltaY * 0.0012)));
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    let sphereTick = -1;
    const proj = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const w = root.clientWidth;
      const h = root.clientHeight;
      if (!w || !h) return; // pantalla oculta: no se dibuja
      const shift = frameRef.current.shiftY;
      if (
        renderer.domElement.width !== Math.round(w * renderer.getPixelRatio()) ||
        camera.userData.shift !== shift ||
        camera.userData.h !== h
      ) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // Mover el planeta arriba o abajo sin recortarlo: se desplaza la «ventana» de la cámara.
        if (shift) camera.setViewOffset(w, h, 0, -shift * h, w, h);
        else camera.clearViewOffset();
        camera.userData.shift = shift;
        camera.userData.h = h;
        camera.updateProjectionMatrix();
      }
      const t = (now - started) / 1000;
      const dragging = pointers.size > 0;
      const idle = now - lastTouch > 3500;

      if (!dragging) {
        // Inercia tras soltar, y luego vuelta suave al objetivo.
        view.yaw += vel.yaw;
        view.pitch = Math.max(-1.25, Math.min(1.25, view.pitch + vel.pitch));
        vel.yaw *= 0.93;
        vel.pitch *= 0.93;
        if (Math.abs(vel.yaw) + Math.abs(vel.pitch) < 0.0004) {
          if (idle || focused) {
            const k = interactive && t < 3.5 ? 0.035 : 0.05;
            view.yaw += (target.yaw - view.yaw) * k;
            view.pitch += (target.pitch - view.pitch) * k;
          }
        } else {
          target.yaw = view.yaw;
          target.pitch = view.pitch;
        }
        view.dist += (target.dist - view.dist) * (interactive && t < 3.5 ? 0.03 : 0.06);
        // Al alejarse de un grupo ampliado, se vuelve a la vista de todos.
        if (focused === 'cluster' && target.dist > 2.9) focused = null;
        if (idle && !focused) {
          if (overview.spread > 1.15 && tourOrder.length > 1) {
            // Tan repartidos que no se os ve a todos a la vez: el planeta va
            // girando de uno a otro para que todos salgan en algún momento.
            if (now - tourAt > 5200) {
              tourAt = now;
              tourIdx = (tourIdx + 1) % tourOrder.length;
              const p = tourOrder[tourIdx];
              const f = facing(p.lat, p.lng);
              target.yaw = nearestYaw(f.yaw);
              target.pitch = Math.max(-0.8, Math.min(0.8, f.pitch * 0.7));
              target.dist = 3.6;
            }
          } else {
            // Si cabéis todos, el planeta se mece despacio alrededor de vuestras ciudades.
            target.yaw += Math.sin(t * 0.25) * 0.0009;
          }
        }
      }

      world.rotation.set(view.pitch, view.yaw, 0);
      clouds.rotation.y = t * 0.02;
      // De cerca, las nubes se interpondrían entre la cámara y el suelo.
      clouds.visible = view.dist > 1.95;
      // En vertical el campo de visión horizontal es estrecho: se aleja la cámara para que quepa.
      const fit = Math.max(1, 1.35 / camera.aspect);
      camera.position.set(
        0,
        0,
        view.dist * (fit > 1 ? 0.62 + fit * 0.38 : 1) * frameRef.current.distScale,
      );
      camera.lookAt(0, 0, 0);
      world.updateMatrixWorld();

      // De cerca, un parche nítido de la zona que se ve (se repinta al pararse).
      const close = view.dist < 2.35;
      if (detail) detail.visible = close;
      if (close && worldData) {
        const settled =
          pointers.size === 0 &&
          Math.abs(target.yaw - view.yaw) + Math.abs(target.pitch - view.pitch) < 0.03 &&
          Math.abs(target.dist - view.dist) < 0.08;
        const lat = Math.max(-75, Math.min(75, view.pitch / DEG));
        let lng = (Math.PI / 2 - view.yaw) / DEG - 180;
        lng = ((((lng + 180) % 360) + 360) % 360) - 180;
        const span = Math.max(14, Math.min(60, (view.dist - 1) * 42));
        const moved =
          Math.abs(lat - detailAt.lat) > detailAt.span * 0.22 ||
          Math.abs(lng - detailAt.lng) > (detailAt.span * 0.22) / Math.cos(lat * DEG) ||
          Math.abs(span - detailAt.span) > detailAt.span * 0.35;
        if (settled && moved && now - detailTime > 500) {
          detailTime = now;
          const lngSpan = Math.min(120, span / Math.max(0.25, Math.cos(lat * DEG)));
          const region = {
            lat0: Math.max(-85, lat - span / 2),
            lat1: Math.min(85, lat + span / 2),
            lng0: Math.max(-180, lng - lngSpan / 2),
            lng1: Math.min(180, lng + lngSpan / 2),
          };
          if (detail) {
            world.remove(detail);
            detail.geometry.dispose();
            const old = detail.material as THREE.MeshStandardMaterial;
            old.map?.dispose();
            old.dispose();
          }
          detail = makeDetail(worldData, homeSet, region, renderer.capabilities.maxTextureSize);
          world.add(detail);
          detailAt = { lat, lng, span };
        }
      }
      // Dónde se ve el planeta (centro y radio en píxeles), para que la guía
      // pueda señalar su contorno exacto.
      if (Math.floor(t * 10) !== sphereTick) {
        sphereTick = Math.floor(t * 10);
        const c = new THREE.Vector3(0, 0, 0).project(camera);
        const edge = new THREE.Vector3()
          .setFromMatrixColumn(camera.matrixWorld, 0)
          .multiplyScalar(R)
          .project(camera);
        const cx = (c.x * 0.5 + 0.5) * w;
        const cy = (-c.y * 0.5 + 0.5) * h;
        const r = Math.abs((edge.x - c.x) * 0.5 * w);
        root.dataset.sphere = `${cx.toFixed(0)} ${cy.toFixed(0)} ${r.toFixed(0)}`;
      }

      // Arcos: se dibujan al empezar y luego una luz los recorre sin parar.
      // De cerca se aclaran, para no tapar el mapa.
      const arcAlpha = Math.max(0.25, Math.min(0.9, (view.dist - 1.3) / 1.2));
      arcs.forEach((a, i) => {
        (a.tube.material as THREE.MeshBasicMaterial).opacity = arcAlpha;
        const grow = interactive ? ease((t - 1.6 - i * 0.15) / 1.2) : 1;
        const g = a.tube.geometry as THREE.BufferGeometry;
        g.setDrawRange(0, Math.floor((g.index?.count ?? 0) * grow));
        const k = ((t * 0.28 + a.offset) % 1.25) / 1;
        a.comet.visible = peopleVisible && grow >= 1 && k <= 1;
        if (a.comet.visible) {
          try {
            a.comet.position.copy(a.curve.getPointAt(Math.min(1, Math.max(0, k))));
          } catch {
            a.comet.visible = false;
          }
        }
      });

      // Chinchetas: se proyectan sobre la pantalla y se ocultan al pasar por detrás.
      camera.getWorldDirection(camDir);
      const placed: { p: (typeof pins)[number]; x: number; y: number; vis: number }[] = [];
      for (const p of pins) {
        proj.copy(p.pos).applyMatrix4(world.matrixWorld);
        const facingCam = proj
          .clone()
          .normalize()
          .dot(camera.position.clone().sub(proj).normalize());
        proj.project(camera);
        placed.push({
          p,
          x: (proj.x * 0.5 + 0.5) * w,
          y: (-proj.y * 0.5 + 0.5) * h,
          vis: Math.max(0, Math.min(1, (facingCam - 0.05) * 5)),
        });
      }
      // Las que se pisan se juntan en una; de muy cerca, se abren en abanico.
      const groups: (typeof placed)[] = [];
      for (const it of placed) {
        const g =
          peopleVisible && it.vis > 0.4
            ? groups.find(
                (gr) => gr[0].vis > 0.4 && Math.hypot(gr[0].x - it.x, gr[0].y - it.y) < 50,
              )
            : undefined;
        if (g) g.push(it);
        else groups.push([it]);
      }
      const fan = view.dist < 1.5;
      const used = new Set<string>();
      for (const g of groups) {
        if (g.length > 1 && fan) {
          // Ya no se puede acercar más (misma ciudad): se reparten alrededor.
          g.forEach((it, i) => {
            const a = (i / g.length) * Math.PI * 2 - Math.PI / 2;
            it.x += Math.cos(a) * 34;
            it.y += Math.sin(a) * 26;
          });
        }
        if (g.length > 1 && !fan) {
          const ids = g.map((it) => it.p.id).sort();
          const k = ids.join(',');
          used.add(k);
          let el = clusters.get(k);
          if (!el) {
            const list = ids
              .map((id) => peopleRef.current.find((x) => x.id === id))
              .filter((x): x is GlobePerson => !!x);
            el = clusterElement(list, () => zoomTo(list));
            pinLayer.appendChild(el);
            clusters.set(k, el);
          }
          const x = g.reduce((a, it) => a + it.x, 0) / g.length;
          const y = g.reduce((a, it) => a + it.y, 0) / g.length;
          const vis = Math.max(...g.map((it) => it.vis));
          el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
          el.style.opacity = vis.toFixed(2);
          el.style.zIndex = '120';
          el.style.pointerEvents = interactive ? 'auto' : 'none';
          for (const it of g) {
            it.p.el.style.opacity = '0';
            it.p.el.style.pointerEvents = 'none';
          }
          continue;
        }
        for (const { p, x, y, vis } of g) {
          p.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(0.75 + vis * 0.25).toFixed(3)})`;
          p.el.style.opacity = vis.toFixed(2);
          p.el.style.zIndex = String(Math.round(vis * 100));
          p.el.style.pointerEvents = interactive && vis > 0.5 && peopleVisible ? 'auto' : 'none';
        }
      }
      for (const [k, el] of clusters) {
        if (used.has(k)) continue;
        el.remove();
        clusters.delete(k);
      }
      for (const m of mems) {
        proj.copy(m.pos).applyMatrix4(world.matrixWorld);
        const facingCam = proj
          .clone()
          .normalize()
          .dot(camera.position.clone().sub(proj).normalize());
        proj.project(camera);
        const x = (proj.x * 0.5 + 0.5) * w;
        const y = (-proj.y * 0.5 + 0.5) * h;
        const vis = Math.max(0, Math.min(1, (facingCam - 0.05) * 5));
        m.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        m.el.style.opacity = vis.toFixed(2);
        // Por encima de las chinchetas de personas: son más pequeñas y si no, quedarían tapadas.
        m.el.style.zIndex = String(101 + Math.round(vis * 90));
        m.el.style.pointerEvents = interactive && vis > 0.5 ? 'auto' : 'none';
      }
      if (!peopleVisible) {
        for (const p of pins) p.el.style.opacity = '0';
        for (const el of clusters.values()) el.style.opacity = '0';
      }
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((m) => m.dispose());
      });
      earthMat.map?.dispose();
      renderer.dispose();
      root.innerHTML = '';
      api.current = null;
    };
  }, [interactive]);

  useEffect(() => {
    api.current?.setPeople(peopleRef.current);
  }, [key]);

  const memKey = memories.map((m) => `${m.id}:${m.photo ? 1 : 0}`).join('|');
  useEffect(() => {
    api.current?.setMemories(memoriesRef.current);
  }, [memKey]);
  useEffect(() => {
    api.current?.showPeople(!hidePeople);
  }, [hidePeople]);
  const hadPoint = useRef(false);
  useEffect(() => {
    if (focusPoint && !focusId) {
      hadPoint.current = true;
      api.current?.focusAt(focusPoint.lat, focusPoint.lng);
    } else if (!focusPoint && !focusId && hadPoint.current) {
      hadPoint.current = false;
      api.current?.focus(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPoint?.lat, focusPoint?.lng]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (!focusId) return;
    }
    api.current?.focus(focusId);
  }, [focusId]);

  return (
    <div
      ref={host}
      className="jglobe"
      style={{
        height: height ?? '100%',
        borderRadius: rounded ? 26 : 0,
        background: transparent
          ? 'transparent'
          : 'radial-gradient(circle at 50% 42%, #FFFFFF 0%, #EEF3F2 55%, #E4ECEC 100%)',
        pointerEvents: interactive ? 'auto' : 'none',
      }}
    />
  );
}
