import { geoContains, geoEquirectangular, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

import { localHour, skyPhase } from '@/lib/geo';

import type { GlobeMapProps, GlobePerson } from './globe-map.types';

export type { GlobePerson } from './globe-map.types';

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
  const path = geoPath(proj, ctx);
  const k = W / 4096;

  const sea = ctx.createLinearGradient(0, 0, 0, H);
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

// ── Chinchetas (HTML encima del lienzo) ──

const CSS = `
.jglobe{position:relative;width:100%;height:100%;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
.jglobe canvas{display:block;width:100%;height:100%}
.jpin{position:absolute;left:0;top:0;cursor:pointer;font-family:Inter,system-ui,sans-serif;will-change:transform,opacity;transition:opacity .25s}
.jpin-in{position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);
  animation:jpin-in .8s cubic-bezier(.2,1.5,.4,1) both;animation-delay:var(--d,0s)}
.jpin-card{width:44px;height:52px;border-radius:11px;border:3px solid #fff;overflow:hidden;
  box-shadow:0 10px 20px rgba(20,40,30,.35);display:flex;align-items:center;justify-content:center;
  transition:transform .4s cubic-bezier(.2,1.5,.4,1)}
.jpin:hover .jpin-card,.jpin.is-focus .jpin-card{transform:scale(1.2) translateY(-3px)}
.jpin-card img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
.jpin-card span{color:#fff;font-size:19px;font-weight:700}
.jpin-tip{width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid #fff;margin-top:-1px}
.jpin-label{position:absolute;top:100%;margin-top:4px;white-space:nowrap;display:flex;gap:5px;align-items:center;
  background:rgba(255,255,255,.95);color:#1D1F22;font-size:11px;font-weight:600;padding:3px 9px 3px 3px;border-radius:999px;
  box-shadow:0 4px 12px rgba(20,40,30,.2)}
.jpin-label small{font-weight:500;color:#6B7076;font-size:10px}
.jpin-sky{width:14px;height:14px;border-radius:50%}
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
  const name = document.createElement('span');
  name.textContent = `${p.isMe ? 'Tú' : p.name.split(' ')[0]} · ${clock(p.tz)} `;
  const where = document.createElement('small');
  where.textContent = p.country ?? p.city ?? '';
  name.appendChild(where);
  label.append(sky, name);
  inner.append(card, tip, label);
  el.appendChild(inner);
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onSelect(p.id);
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
  if (angle < 0.01) return null;
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
}: GlobeMapProps) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{
    setPeople: (p: GlobePerson[]) => void;
    focus: (id: string | null) => void;
  } | null>(null);
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
    let arcs: ArcObj[] = [];
    let lastTouch = -1e9;
    let focused: string | null = null;
    let worldData: World | null = null;
    let homeKey = '';
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
    function aimOverview() {
      const c = centerOf(peopleRef.current);
      const f = facing(c.lat, c.lng);
      target.yaw = f.yaw;
      target.pitch = Math.max(-0.9, Math.min(0.9, f.pitch * 0.8));
      target.dist = Math.min(4.2, 2.9 + c.spread * 1.1);
    }
    function nearestYaw(y: number) {
      // Gira por el camino más corto.
      while (y - view.yaw > Math.PI) y -= Math.PI * 2;
      while (y - view.yaw < -Math.PI) y += Math.PI * 2;
      return y;
    }

    function setPeople(list: GlobePerson[]) {
      pins.forEach((p) => p.el.remove());
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

    api.current = {
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
          target.dist = 2.3;
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
        if (pinch) target.dist = Math.max(1.9, Math.min(6, target.dist * (pinch / d)));
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
      target.dist = Math.max(1.9, Math.min(6, target.dist * (1 + e.deltaY * 0.0012)));
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    const proj = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const w = root.clientWidth;
      const h = root.clientHeight;
      if (!w || !h) return; // pantalla oculta: no se dibuja
      if (renderer.domElement.width !== Math.round(w * renderer.getPixelRatio())) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
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
        // En reposo, el planeta se mece despacio alrededor de vuestras ciudades.
        if (idle && !focused) target.yaw += Math.sin(t * 0.25) * 0.0009;
      }

      world.rotation.set(view.pitch, view.yaw, 0);
      clouds.rotation.y = t * 0.02;
      // En vertical el campo de visión horizontal es estrecho: se aleja la cámara para que quepa.
      const fit = Math.max(1, 1.35 / camera.aspect);
      camera.position.set(0, 0, view.dist * (fit > 1 ? 0.62 + fit * 0.38 : 1));
      camera.lookAt(0, 0, 0);
      world.updateMatrixWorld();

      // Arcos: se dibujan al empezar y luego una luz los recorre sin parar.
      arcs.forEach((a, i) => {
        const grow = interactive ? ease((t - 1.6 - i * 0.15) / 1.2) : 1;
        const g = a.tube.geometry as THREE.BufferGeometry;
        g.setDrawRange(0, Math.floor((g.index?.count ?? 0) * grow));
        const k = ((t * 0.28 + a.offset) % 1.25) / 1;
        a.comet.visible = grow >= 1 && k <= 1;
        if (a.comet.visible) a.comet.position.copy(a.curve.getPointAt(Math.min(1, k)));
      });

      // Chinchetas: se proyectan sobre la pantalla y se ocultan al pasar por detrás.
      camera.getWorldDirection(camDir);
      for (const p of pins) {
        proj.copy(p.pos).applyMatrix4(world.matrixWorld);
        const facingCam = proj
          .clone()
          .normalize()
          .dot(camera.position.clone().sub(proj).normalize());
        proj.project(camera);
        const x = (proj.x * 0.5 + 0.5) * w;
        const y = (-proj.y * 0.5 + 0.5) * h;
        const vis = Math.max(0, Math.min(1, (facingCam - 0.05) * 5));
        p.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(0.75 + vis * 0.25).toFixed(3)})`;
        p.el.style.opacity = vis.toFixed(2);
        p.el.style.zIndex = String(Math.round(vis * 100));
        p.el.style.pointerEvents = interactive && vis > 0.5 ? 'auto' : 'none';
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
        background: 'radial-gradient(circle at 50% 42%, #FFFFFF 0%, #EEF3F2 55%, #E4ECEC 100%)',
        pointerEvents: interactive ? 'auto' : 'none',
      }}
    />
  );
}
