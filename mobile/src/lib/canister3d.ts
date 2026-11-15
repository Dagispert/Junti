// El carrete en 3D. Con la luz del planeta (cielo + sol cálido) y un reflejo
// de estudio suave: tapas de plástico negro brillante, el cuerpo de metal y la
// etiqueta satinada del color del mes, con el nombre del mes a lo largo, como
// los carretes de verdad. Un solo dibujante WebGL para todos (el navegador
// admite pocos a la vez): cada carrete se pinta en su propio lienzo 2D.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

let shared: THREE.WebGLRenderer | null = null;
let studio: THREE.Texture | null = null;
function renderer() {
  if (!shared) {
    shared = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    shared.outputColorSpace = THREE.SRGBColorSpace;
    shared.toneMapping = THREE.ACESFilmicToneMapping;
    shared.toneMappingExposure = 1.05;
    shared.setClearColor(0x000000, 0);
    const pm = new THREE.PMREMGenerator(shared);
    studio = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
  }
  return shared;
}

/** Los colores de cada mes (la etiqueta del carrete). */
export const MONTH_COLORS = [
  '#3D6FD1', // enero
  '#D9578E', // febrero
  '#5FA83F', // marzo
  '#F0A21A', // abril
  '#E8622C', // mayo
  '#18A7B8', // junio
  '#E2423A', // julio
  '#F7B518', // agosto
  '#7E5BD0', // septiembre
  '#C9672A', // octubre
  '#55705A', // noviembre
  '#2F8C76', // diciembre
];

/** Tinta clara u oscura según el color de la etiqueta. */
function inkFor(color: string) {
  const n = parseInt(color.slice(1), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.58 ? '#16130F' : '#FFFBF2';
}

// La etiqueta da casi toda la vuelta; queda a la vista el metal junto a la boca.
const LABEL_START = -Math.PI + 0.3;
const LABEL_LEN = Math.PI * 1.5 - 0.45;
const FRONT = 0.45; // el ángulo del cilindro que mira a la cámara

/** La etiqueta: el mes en grande a lo largo, el número de fotos y «JUNTI». */
function labelTexture(color: string, month: string, year: string, exposures: number) {
  const W = 1520,
    H = 800;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  x.fillStyle = color;
  x.fillRect(0, 0, W, H);
  // un brillo de imprenta: más claro arriba, un pelín más oscuro en los bordes
  const g = x.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(0,0,0,.18)');
  g.addColorStop(0.12, 'rgba(0,0,0,0)');
  g.addColorStop(0.9, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.2)');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  const ink = inkFor(color);
  const cx = W * ((FRONT - LABEL_START) / LABEL_LEN);
  // el texto corre a lo largo del carrete (de abajo arriba)
  const along = (text: string, u: number, size: number, weight: number, alpha = 1) => {
    x.save();
    x.translate(u, H / 2);
    x.rotate(-Math.PI / 2);
    x.font = `${weight} ${size}px "Helvetica Neue", Arial, system-ui, sans-serif`;
    const w = x.measureText(text).width;
    const fit = Math.min(1, (H * 0.86) / w);
    x.scale(fit, fit);
    x.globalAlpha = alpha;
    x.fillStyle = ink;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(text, 0, 0);
    x.restore();
  };
  along(month, cx - 40, 190, 800);
  along(String(exposures), cx + 170, 230, 800, 0.9);
  along(`JUNTI · ${year}`, cx - 210, 54, 700, 0.85);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export type CanisterPose = {
  /** distancia de la cámara (la entrada viene de lejos) */ dist: number;
  /** giro sobre su eje */ yaw: number;
  /** inclinación en pantalla (radianes; negativo = la tapa hacia la derecha) */ tilt: number;
  /** giro del eje del carrete (cuando sale la cinta) */ spin: number;
};

export type Canister = {
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, s: CanisterPose) => void;
  /** Dónde está la boca del carrete en el lienzo (0…1), para que salga de ahí la cinta. */
  mouth: (w?: number, h?: number, s?: CanisterPose) => { x: number; y: number };
  dispose: () => void;
};

export function makeCanister(
  color: string,
  month: string,
  year: string,
  exposures: number,
): Canister {
  const r0 = renderer();
  const scene = new THREE.Scene();
  scene.environment = studio;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  // La luz del planeta: cielo azulado + sol cálido.
  scene.add(new THREE.HemisphereLight('#B8CCFF', '#22325A', 0.55));
  const sun = new THREE.DirectionalLight('#FFF1D6', 2.2);
  sun.position.set(-3, 4, 5);
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#FFFFFF', 1.2);
  rim.position.set(4, 1, -2);
  scene.add(rim);

  const can = new THREE.Group();
  scene.add(can);
  const R = 0.5,
    HH = 1.5;

  // el cuerpo de metal (se ve junto a la boca)
  const metal = new THREE.MeshPhysicalMaterial({
    color: '#C9CCD1',
    metalness: 1,
    roughness: 0.22,
  });
  can.add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, HH, 64, 1, true), metal));
  // la etiqueta satinada
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(
      R + 0.004,
      R + 0.004,
      HH - 0.12,
      96,
      1,
      true,
      LABEL_START,
      LABEL_LEN,
    ),
    new THREE.MeshPhysicalMaterial({
      map: labelTexture(color, month, year, exposures),
      roughness: 0.32,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
    }),
  );
  can.add(label);

  // tapas de plástico negro, un poco más anchas que el cuerpo
  const plastic = new THREE.MeshPhysicalMaterial({
    side: THREE.DoubleSide,
    color: '#121212',
    roughness: 0.3,
    clearcoat: 0.8,
    clearcoatRoughness: 0.2,
  });
  const capProfile = (top: boolean) => {
    // perfil girado: borde redondeado, como las tapas a presión
    const p: THREE.Vector2[] = [];
    const s = top ? 1 : -1;
    p.push(new THREE.Vector2(0.001, s * 0.06));
    p.push(new THREE.Vector2(R + 0.02, s * 0.06));
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      p.push(new THREE.Vector2(R + 0.02 + Math.sin(a) * 0.035, s * (0.06 - (i / 8) * 0.12)));
    }
    p.push(new THREE.Vector2(R - 0.01, -s * 0.06));
    return top ? p : p.reverse();
  };
  for (const top of [true, false]) {
    const cap = new THREE.Mesh(new THREE.LatheGeometry(capProfile(top), 64), plastic);
    cap.position.y = (top ? 1 : -1) * (HH / 2 + 0.01);
    can.add(cap);
  }
  // el eje de la bobina: arriba asoma un tubo con su agujero; abajo, un tetón
  const spool = new THREE.Group();
  spool.position.y = HH / 2 + 0.07;
  can.add(spool);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 40, 1, true), plastic);
  tube.position.y = 0.06;
  spool.add(tube);
  const lipRing = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 10, 40), plastic);
  lipRing.rotation.x = Math.PI / 2;
  lipRing.position.y = 0.12;
  spool.add(lipRing);
  const hole = new THREE.Mesh(
    new THREE.CircleGeometry(0.13, 32),
    new THREE.MeshBasicMaterial({ color: '#050505' }),
  );
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = 0.1;
  spool.add(hole);
  // las dos muescas del eje (se ven girar cuando sale la cinta)
  const key = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.04), plastic);
  key.position.y = 0.09;
  spool.add(key);
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.08, 32), plastic);
  stub.position.y = -(HH / 2 + 0.1);
  can.add(stub);

  // la boca de felpa, a la derecha, y la lengüeta de la cinta
  const felt = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, HH - 0.16, 0.2),
    new THREE.MeshStandardMaterial({ color: '#191513', roughness: 1 }),
  );
  felt.position.set(R + 0.012, 0, 0);
  can.add(felt);
  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, HH * 0.72, 0.012),
    new THREE.MeshPhysicalMaterial({ color: '#4A3326', roughness: 0.4, clearcoat: 0.6 }),
  );
  lip.position.set(R + 0.07, 0, 0.03);
  can.add(lip);

  const world = new THREE.Vector3();
  const place = (w: number, h: number, s: CanisterPose) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    camera.position.set(0, s.dist * 0.12, s.dist);
    camera.lookAt(0, 0, 0);
    // de pie, un poco hacia la cámara, con la boca girada hacia nosotros
    can.rotation.set(0.14, s.yaw - FRONT, s.tilt, 'ZXY');
    spool.rotation.y = s.spin;
  };
  return {
    draw(ctx, w, h, s) {
      const r = r0;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.round(w * dpr),
        H = Math.round(h * dpr);
      if (r.domElement.width !== W || r.domElement.height !== H) r.setSize(W, H, false);
      place(w, h, s);
      r.render(scene, camera);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage(r.domElement, 0, 0, ctx.canvas.width, ctx.canvas.height);
    },
    mouth(w, h, s) {
      if (w && h && s) {
        place(w, h, s);
        can.updateMatrixWorld(true);
        camera.updateMatrixWorld(true);
      }
      lip.getWorldPosition(world);
      world.project(camera);
      return { x: (world.x + 1) / 2, y: (1 - world.y) / 2 };
    },
    dispose() {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mm = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mm) ? mm : mm ? [mm] : []).forEach((x) => {
          (x as THREE.MeshPhysicalMaterial).map?.dispose();
          x.dispose();
        });
      });
    },
  };
}
