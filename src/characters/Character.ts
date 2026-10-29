import * as THREE from 'three';
import type { CharacterConfig } from './types';
import { printTexture } from './textures';

// Personaje low-poly estilo San Andreas montado con primitivas.
// El origen está en los pies y el personaje mira hacia +Z.

export type Pose = 'quieto' | 'pose' | 'brazos_cruzados';

const SEGMENTS = 7; // pocos lados = look de PS2

const BUILD_SCALE = { flaco: 0.88, normal: 1, grande: 1.2 };

// Perfil de la cabeza (radio, altura) de la barbilla a la coronilla;
// se gira con LatheGeometry y se aplasta un poco de lado.
const HEAD_PROFILE: [number, number][] = [
  [0, -0.13], [0.03, -0.128], [0.058, -0.115], [0.08, -0.09], [0.096, -0.055],
  [0.104, -0.02], [0.108, 0.02], [0.11, 0.06], [0.104, 0.095], [0.088, 0.122],
  [0.062, 0.14], [0.032, 0.148], [0, 0.15],
];
const HEAD_SCALE = { x: 0.92, z: 1.04 };

function headRadius(y: number) {
  for (let i = 1; i < HEAD_PROFILE.length; i++) {
    const [r1, y1] = HEAD_PROFILE[i];
    if (y <= y1) {
      const [r0, y0] = HEAD_PROFILE[i - 1];
      return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
  }
  return 0;
}

// Punto de la superficie de la cara a esa altura y desplazamiento lateral.
function faceZ(y: number, x: number) {
  const r = headRadius(y);
  const nx = x / (r * HEAD_SCALE.x);
  return r * HEAD_SCALE.z * Math.sqrt(Math.max(0, 1 - nx * nx));
}

function faceX(y: number) {
  return headRadius(y) * HEAD_SCALE.x;
}

function mat(color: string) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 });
}

function metal(color: string) {
  return new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.25 });
}

function box(w: number, h: number, d: number, m: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.castShadow = true;
  return mesh;
}

function cyl(rTop: number, rBottom: number, h: number, m: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, SEGMENTS), m);
  mesh.castShadow = true;
  return mesh;
}

function at<T extends THREE.Object3D>(obj: T, x: number, y: number, z: number): T {
  obj.position.set(x, y, z);
  return obj;
}

// Color de tinta que contrasta con la prenda.
function inkFor(color: string) {
  const c = new THREE.Color(color);
  return c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 0.5 ? '#141414' : '#f4f4f0';
}

interface Arm {
  shoulder: THREE.Group;
  elbow: THREE.Group;
}

export class Character {
  readonly root = new THREE.Group();
  private upper = new THREE.Group();
  private arms: { left: Arm; right: Arm } | null = null;
  private time = Math.random() * 10;
  pose: Pose = 'quieto';

  constructor(public config: CharacterConfig) {
    this.build();
  }

  setConfig(config: CharacterConfig) {
    this.config = config;
    this.build();
  }

  private clear() {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.root.clear();
    this.upper = new THREE.Group();
  }

  private build() {
    this.clear();
    const c = this.config;
    const k = BUILD_SCALE[c.build];
    const skin = mat(c.skin);
    const top = mat(c.topColor);
    const sleeve = mat(c.sleeveColor);
    const pants = mat(c.pantsColor);
    const shoe = mat(c.shoesColor);
    const white = mat('#f4f4f0');
    const gold = metal('#e0b44a');
    const silver = metal('#d4d8dc');

    // --- Piernas y pies ---
    const hipY = 0.95;
    const legX = 0.11 * k;
    this.root.add(at(box(0.42 * k, 0.2, 0.26 * k, pants), 0, hipY - 0.02, 0));
    for (const side of [-1, 1]) {
      const x = side * legX;
      if (c.pants === 'jorts') {
        this.root.add(at(cyl(0.14 * k, 0.16 * k, 0.48, pants), x, hipY - 0.24, 0));
        this.root.add(at(cyl(0.05 * k, 0.045 * k, 0.42, skin), x, 0.3, 0));
        // calcetines altos blancos
        this.root.add(at(cyl(0.056 * k, 0.056 * k, 0.24, white), x, 0.2, 0));
      } else {
        const wide = c.pants === 'anchos';
        const rTop = (wide ? 0.13 : 0.1) * k;
        const rBottom = (wide ? 0.155 : 0.095) * k;
        const leg = cyl(rTop, rBottom, hipY - 0.08, pants);
        this.root.add(at(leg, x, (hipY + 0.08) / 2, 0));
        if (wide) {
          // pliegue que cae sobre la zapatilla
          this.root.add(at(cyl(rBottom * 1.03, rBottom * 1.08, 0.08, pants), x, 0.13, 0.01));
        }
      }
      // zapatilla
      const high = c.shoes === 'botas_altas';
      this.root.add(at(box(0.15 * k, 0.04, 0.32, white), x, 0.02, 0.04));
      this.root.add(at(box(0.145 * k, 0.1, 0.3, shoe), x, 0.09, 0.04));
      this.root.add(at(box(0.07, 0.015, 0.12, white), x, 0.145, 0.1)); // cordones
      if (high) this.root.add(at(box(0.14 * k, 0.12, 0.16, shoe), x, 0.18, -0.02));
      // swoosh genérico en el lateral
      this.root.add(at(box(0.004, 0.025, 0.12, inkFor(c.shoesColor) === '#141414' ? mat('#141414') : white), x + side * 0.074 * k, 0.09, 0.03));
    }

    // --- Torso ---
    this.root.add(this.upper);
    const loose = c.top !== 'manga_larga';
    const tw = (loose ? 0.5 : 0.46) * k;
    const td = (loose ? 0.28 : 0.26) * k;
    const bottom = loose ? 0.84 : 0.9;
    const topY = 1.5;
    const th = topY - bottom;
    this.upper.add(at(box(tw, th, td, top), 0, bottom + th / 2, 0));
    if (c.top === 'sudadera') {
      this.upper.add(at(box(0.3 * k, 0.13, 0.12, top), 0, topY + 0.02, -0.1 * k)); // capucha
      this.upper.add(at(box(0.3 * k, 0.14, 0.02, top), 0, 1.0, td / 2 + 0.008)); // bolsillo
      this.upper.add(at(box(tw + 0.01, 0.06, td + 0.01, top), 0, bottom + 0.03, 0)); // puño
    }
    if (c.print !== 'ninguno') {
      const tex = printTexture(c.print, inkFor(c.topColor));
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.34 * k, 0.34 * k),
        new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9 }),
      );
      this.upper.add(at(plane, 0, 1.23, td / 2 + 0.002));
    }

    // cuello y cabeza
    this.upper.add(at(cyl(0.06, 0.065, 0.1, skin), 0, 1.54, 0));
    this.buildHead();

    // joyas
    if (c.chain !== 'ninguna') {
      const thick = c.chain === 'cubana' ? 0.016 : 0.009;
      const chain = new THREE.Mesh(new THREE.TorusGeometry(0.105 * Math.max(1, k * 0.95), thick, 5, 18), gold);
      chain.rotation.x = Math.PI / 2 - 0.55;
      this.upper.add(at(chain, 0, 1.47, 0.035));
      if (c.chain === 'colgante') {
        this.upper.add(at(box(0.05, 0.065, 0.012, gold), 0, 1.37, td / 2 + 0.012));
        this.upper.add(at(box(0.024, 0.024, 0.014, mat('#1a1a1a')), 0, 1.37, td / 2 + 0.016));
      }
    }

    // --- Brazos ---
    const longSleeve = c.top !== 'camiseta';
    const sleeveMat = c.top === 'camiseta_sobre_larga' ? sleeve : top;
    const make = (side: number): Arm => {
      const shoulder = at(new THREE.Group(), side * (tw / 2 + 0.05), 1.44, 0);
      const elbow = at(new THREE.Group(), 0, -0.3, 0);
      // primero se dobla hacia delante y luego gira hacia el cuerpo
      shoulder.rotation.order = elbow.rotation.order = 'YXZ';
      // primero se dobla hacia delante y luego gira hacia el cuerpo
      shoulder.rotation.order = elbow.rotation.order = 'YXZ';
      shoulder.add(at(cyl(0.065 * k, 0.06 * k, 0.32, longSleeve ? sleeveMat : skin), 0, -0.15, 0));
      // manga de la camiseta
      if (c.top !== 'manga_larga') shoulder.add(at(cyl(0.1 * k, 0.11 * k, 0.26, top), 0, -0.1, 0));
      elbow.add(at(cyl(0.058 * k, 0.05 * k, 0.28, longSleeve ? sleeveMat : skin), 0, -0.13, 0));
      elbow.add(at(box(0.07, 0.1, 0.09, skin), 0, -0.32, 0.005));
      if (c.watch !== 'ninguno' && side === -1) {
        const w = new THREE.Mesh(new THREE.TorusGeometry(0.055 * k, 0.012, 4, 10), c.watch === 'rolex_oro' ? gold : silver);
        w.rotation.x = Math.PI / 2;
        elbow.add(at(w, 0, -0.25, 0));
        elbow.add(at(box(0.04, 0.012, 0.04, mat('#0f2a1c')), 0, -0.25, 0.058 * k));
      }
      shoulder.add(elbow);
      this.upper.add(shoulder);
      return { shoulder, elbow };
    };
    this.arms = { left: make(-1), right: make(1) };
    this.applyPose(0);
  }

  private buildHead() {
    const c = this.config;
    const head = at(new THREE.Group(), 0, 1.71, 0);
    this.upper.add(head);
    // la cabeza va con sombreado suave para que no parezca un cubo
    const skin = new THREE.MeshStandardMaterial({ color: c.skin, roughness: 0.7 });
    const hair = new THREE.MeshStandardMaterial({ color: c.hair, roughness: 0.9 });

    const skull = new THREE.Mesh(new THREE.LatheGeometry(HEAD_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 16), skin);
    skull.scale.set(HEAD_SCALE.x, 1, HEAD_SCALE.z);
    skull.castShadow = true;
    head.add(skull);
    const hh = 0.28; // alto total, para colocar gorras

    // pelo corto: una capa un poco más grande que el cráneo; por delante
    // empieza en la frente y por detrás baja hasta la nuca
    const hairShell = (fromY: number, phiStart = 0, phiLength = Math.PI * 2) => {
      const pts = HEAD_PROFILE.filter(([, y]) => y >= fromY).map(([r, y]) => new THREE.Vector2(r * 1.045 + 0.002, y + 0.004));
      pts.unshift(new THREE.Vector2(headRadius(fromY) * 1.045 + 0.002, fromY));
      const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 16, phiStart, phiLength), hair);
      m.scale.set(HEAD_SCALE.x, 1, HEAD_SCALE.z);
      m.castShadow = true;
      return m;
    };
    head.add(hairShell(0.062));
    head.add(hairShell(-0.05, Math.PI * 0.6, Math.PI * 0.8)); // nuca

    // orejas
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), skin);
      ear.scale.set(0.45, 1, 0.8);
      head.add(at(ear, side * faceX(0) * 0.98, -0.005, -0.005));
    }

    const eyeWhite = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.4 });
    const iris = new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.3 });
    const eyeY = 0.012;
    for (const side of [-1, 1]) {
      const x = side * 0.042;
      const z = faceZ(eyeY, x) - 0.008;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 8), eyeWhite);
      eye.scale.set(1.2, 0.65, 0.6);
      head.add(at(eye, x, eyeY, z));
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 8, 6), iris);
      pupil.scale.set(1, 1, 0.5);
      head.add(at(pupil, x, eyeY, z + 0.01));
      // párpado superior y ceja, siguiendo la curva de la cara
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.021, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), skin);
      lid.scale.set(1.2, 0.7, 0.7);
      head.add(at(lid, x, eyeY + 0.002, z));
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.034, 2, 6), hair);
      brow.rotation.z = Math.PI / 2 + side * 0.12;
      brow.rotation.y = side * 0.35;
      head.add(at(brow, x * 1.05, eyeY + 0.03, faceZ(eyeY + 0.03, x) - 0.001));
    }

    // nariz
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.05, 8), skin);
    nose.rotation.x = -0.35;
    head.add(at(nose, 0, -0.018, faceZ(-0.018, 0) + 0.006));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), skin);
    tip.scale.set(1.3, 0.9, 1);
    head.add(at(tip, 0, -0.038, faceZ(-0.038, 0) + 0.012));

    // boca
    const lipMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(c.skin).multiplyScalar(0.72), roughness: 0.6 });
    const lips = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.032, 2, 8), lipMat);
    lips.rotation.z = Math.PI / 2;
    head.add(at(lips, 0, -0.07, faceZ(-0.07, 0) - 0.003));

    // bigote fino y perilla, como en las referencias
    const stache = new THREE.Mesh(new THREE.CapsuleGeometry(0.0045, 0.04, 2, 6), hair);
    stache.rotation.z = Math.PI / 2;
    head.add(at(stache, 0, -0.056, faceZ(-0.056, 0) + 0.001));
    const goatee = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 6), hair);
    goatee.scale.set(1.1, 0.7, 0.5);
    head.add(at(goatee, 0, -0.112, faceZ(-0.112, 0) - 0.006));

    if (c.glasses !== 'ninguna') {
      const lens = c.glasses === 'oscuras' ? mat('#0c0c0c') : new THREE.MeshStandardMaterial({ color: '#cfe3f0', transparent: true, opacity: 0.35 });
      const frame = mat(c.glasses === 'oscuras' ? '#0c0c0c' : '#e8e8e8');
      const z = faceZ(eyeY, 0) + 0.012;
      for (const side of [-1, 1]) {
        const l = box(0.056, 0.03, 0.006, lens);
        l.rotation.y = side * 0.18;
        head.add(at(l, side * 0.043, eyeY, z - 0.004));
        head.add(at(box(0.006, 0.006, 0.12, frame), side * faceX(eyeY) * 1.02, eyeY + 0.012, z - 0.065));
      }
      head.add(at(box(0.17, 0.005, 0.005, frame), 0, eyeY + 0.016, z));
    }

    const hatMat = mat(c.hatColor);
    switch (c.hat) {
      case 'gorra':
      case 'gorra_atras': {
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.135, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), hatMat);
        crown.scale.set(0.85, 0.75, 0.95);
        crown.castShadow = true;
        head.add(at(crown, 0, hh / 2 - 0.035, 0));
        const dir = c.hat === 'gorra' ? 1 : -1;
        head.add(at(box(0.21, 0.014, 0.13, hatMat), 0, hh / 2 - 0.03, dir * 0.17));
        // logo frontal
        head.add(at(box(0.028, 0.028, 0.005, mat(inkFor(c.hatColor))), 0, hh / 2, 0.122 * dir));
        break;
      }
      case 'gorro':
        head.add(at(cyl(0.118, 0.122, 0.16, hatMat), 0, hh / 2 + 0.03, -0.005));
        head.add(at(cyl(0.126, 0.126, 0.05, hatMat), 0, hh / 2 - 0.035, -0.005));
        break;
      case 'pescador':
        head.add(at(cyl(0.11, 0.125, 0.11, hatMat), 0, hh / 2 + 0.03, 0));
        head.add(at(cyl(0.19, 0.2, 0.015, hatMat), 0, hh / 2 - 0.02, 0));
        break;
    }
  }

  private applyPose(sway: number) {
    if (!this.arms) return;
    const { left, right } = this.arms;
    const reset = (a: Arm) => {
      a.shoulder.rotation.set(0, 0, 0);
      a.elbow.rotation.set(0, 0, 0);
    };
    reset(left);
    reset(right);
    switch (this.pose) {
      case 'quieto':
        left.shoulder.rotation.z = -0.12 - sway;
        right.shoulder.rotation.z = 0.12 + sway;
        left.elbow.rotation.x = -0.15;
        right.elbow.rotation.x = -0.15;
        break;
      case 'pose':
        // la "pistola con los dedos" de las fotos
        right.shoulder.rotation.set(-1.35, -0.35, 0);
        left.shoulder.rotation.set(-0.45, 0, -0.1 - sway);
        left.elbow.rotation.set(-1.7, 1.0, 0);
        break;
      case 'brazos_cruzados':
        left.shoulder.rotation.set(-0.3, 0, -0.12 - sway * 0.5);
        right.shoulder.rotation.set(-0.42, 0, 0.12 + sway * 0.5);
        left.elbow.rotation.set(-1.6, 1.3, 0);
        right.elbow.rotation.set(-1.45, -1.3, 0);
        break;
    }
  }

  update(dt: number) {
    this.time += dt;
    const breath = Math.sin(this.time * 2);
    this.upper.position.y = breath * 0.004;
    this.applyPose(breath * 0.02);
  }
}
