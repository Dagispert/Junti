// El carrete en 3D, con la piel del planeta: la misma luz (cielo + sol),
// materiales mates de pocos polígonos y sombreado plano. Un solo dibujante
// WebGL para todos los carretes (el navegador admite pocos a la vez): cada
// carrete tiene su escena y se pinta en su propio lienzo 2D.

import * as THREE from 'three';

let shared: THREE.WebGLRenderer | null = null;
function renderer() {
  if (!shared) {
    shared = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    shared.outputColorSpace = THREE.SRGBColorSpace;
    shared.setClearColor(0x000000, 0);
  }
  return shared;
}

/** Los colores de cada mes (el cuerpo del carrete). */
export const MONTH_COLORS = [
  '#5B7DB1', // enero
  '#B8648F', // febrero
  '#7BA05B', // marzo
  '#E0A33A', // abril
  '#D9663F', // mayo
  '#3FA7B5', // junio
  '#E05A4F', // julio
  '#F2B33D', // agosto
  '#8E6BB8', // septiembre
  '#C2703D', // octubre
  '#6E7F5C', // noviembre
  '#4E8D7C', // diciembre
];

/** La etiqueta del carrete: el mes, «JUNTI» y las exposiciones. */
function labelTexture(color: string, month: string, year: string, exposures: number) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const x = c.getContext('2d')!;
  x.fillStyle = '#FBF6EA';
  x.fillRect(0, 0, 1024, 256);
  // franjas de color, como en los carretes de verdad
  x.fillStyle = color;
  x.fillRect(0, 0, 1024, 38);
  x.fillRect(0, 218, 1024, 38);
  x.fillStyle = '#1D1F22';
  x.font = '600 96px Caveat_600SemiBold, Caveat, cursive';
  x.textBaseline = 'middle';
  // la etiqueta da la vuelta al cilindro: se escribe dos veces
  for (const ox of [40, 552]) {
    x.fillText(month, ox, 120);
    x.font = '700 34px system-ui, sans-serif';
    x.fillText(`JUNTI · ${year}`, ox + 4, 186);
    x.fillStyle = color;
    x.fillText(`${exposures} EXP`, ox + 300, 186);
    x.fillStyle = '#1D1F22';
    x.font = '600 96px Caveat_600SemiBold, Caveat, cursive';
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export type Canister = {
  /** Pinta el instante en su lienzo. spin: giro del carrete (radianes). */
  draw: (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    s: { dist: number; yaw: number; spin: number; wobble: number },
  ) => void;
  /** Dónde está la boca del carrete en el lienzo (0…1), para que salga de ahí la cinta. */
  mouth: (w: number, h: number) => { x: number; y: number };
  dispose: () => void;
};

export function makeCanister(
  color: string,
  month: string,
  year: string,
  exposures: number,
): Canister {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  // La luz del planeta: cielo azulado + sol cálido.
  scene.add(new THREE.HemisphereLight('#B8CCFF', '#22325A', 0.9));
  const sun = new THREE.DirectionalLight('#FFF1D6', 2.6);
  sun.position.set(3, 4, 5);
  scene.add(sun);

  const can = new THREE.Group();
  scene.add(can);
  const mat = (c: string, rough = 0.9, metal = 0) =>
    new THREE.MeshStandardMaterial({
      color: c,
      roughness: rough,
      metalness: metal,
      flatShading: true,
    });

  // cuerpo de color, con la etiqueta enrollada
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 28, 1, true), mat(color));
  can.add(body);
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.556, 0.556, 0.72, 48, 1, true),
    new THREE.MeshStandardMaterial({
      map: labelTexture(color, month, year, exposures),
      roughness: 0.85,
    }),
  );
  can.add(label);
  // tapas color crema con su anillo
  const capMat = mat('#EDE6D8', 0.6, 0.15);
  for (const y of [0.58, -0.58]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.585, 0.585, 0.08, 28), capMat);
    cap.position.y = y;
    can.add(cap);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.585, 0.025, 6, 28), capMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = y + (y > 0 ? 0.04 : -0.04);
    can.add(rim);
  }
  // el eje del carrete, arriba
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.18, 12), mat('#2B2622', 0.7));
  knob.position.y = 0.7;
  can.add(knob);
  const notch = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.05), mat('#4A423C', 0.7));
  notch.position.y = 0.8;
  can.add(notch);
  // la boca, de felpa oscura, en el lado que mira a la cinta
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.78, 0.22), mat('#1A1512', 1));
  mouth.position.set(0.56, 0, 0.12);
  can.add(mouth);
  // un poco de cinta asomando por la boca
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.012), mat('#3E2C22', 0.8));
  lip.position.set(0.64, 0, 0.2);
  can.add(lip);

  // sombra suave en el suelo (como el halo del planeta, pero debajo)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 32),
    new THREE.MeshBasicMaterial({
      color: '#000000',
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.72;
  scene.add(shadow);

  const mouthWorld = new THREE.Vector3();
  const place = (
    w: number,
    h: number,
    s: { dist: number; yaw: number; spin: number; wobble: number },
  ) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // el carrete, tumbado un poco hacia la cámara y mirando con la boca a la derecha
    camera.position.set(0, 0.55 * s.dist * 0.3, s.dist);
    camera.lookAt(0, 0, 0);
    can.rotation.set(0.12 + s.wobble * 0.05, s.yaw - 0.35, s.wobble * 0.04);
    label.rotation.y = s.spin;
    body.rotation.y = s.spin;
  };
  return {
    draw(ctx, w, h, s) {
      const r = renderer();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.round(w * dpr),
        H = Math.round(h * dpr);
      if (r.domElement.width !== W || r.domElement.height !== H) r.setSize(W, H, false);
      place(w, h, s);
      r.render(scene, camera);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage(r.domElement, 0, 0, ctx.canvas.width, ctx.canvas.height);
    },
    mouth(w, h) {
      lip.getWorldPosition(mouthWorld);
      mouthWorld.project(camera);
      return { x: (mouthWorld.x + 1) / 2, y: (1 - mouthWorld.y) / 2 };
    },
    dispose() {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mm = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mm) ? mm : mm ? [mm] : []).forEach((x) => x.dispose());
      });
    },
  };
}
