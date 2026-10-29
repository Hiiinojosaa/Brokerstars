import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CharacterConfig } from './types';
import { faceTexture, printTexture } from './textures';

// Personaje cartoon con proporciones humanas: torso con forma, brazos y
// piernas que se estrechan, cabeza ovalada con la cara dibujada encima.
// El origen está en los pies y mira hacia +Z. Brazos y piernas cuelgan
// de pivotes para poder animarlos.

export type Pose = 'quieto' | 'pose' | 'brazos_cruzados';

const BUILD_SCALE = { flaco: 0.88, normal: 1, grande: 1.2 };
const SEG = 14;

// Perfil de la cabeza (radio, altura) de la barbilla a la coronilla;
// se gira con LatheGeometry y se aplasta un poco de lado.
const HEAD_PROFILE: [number, number][] = [
  [0, -0.13], [0.03, -0.128], [0.058, -0.115], [0.08, -0.09], [0.096, -0.055],
  [0.104, -0.02], [0.108, 0.02], [0.11, 0.06], [0.104, 0.095], [0.088, 0.122],
  [0.062, 0.14], [0.032, 0.148], [0, 0.15],
];
const HEAD_SCALE = { x: 0.92, z: 1.04 };
const HEAD_SIZE = 1.25; // un poco más grande de lo real: toque cartoon

// Zona de la cara donde se proyecta la textura dibujada.
const FACE = { width: 0.2, height: 0.24, centerY: -0.0075 };

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

function mat(color: string, roughness = 0.6) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

function metal(color: string) {
  return new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.22 });
}

function shadowed<T extends THREE.Mesh>(mesh: T): T {
  mesh.castShadow = true;
  return mesh;
}

function rbox(w: number, h: number, d: number, m: THREE.Material, r = 0.02) {
  const radius = Math.min(r, w / 2, h / 2, d / 2) * 0.999;
  return shadowed(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, radius), m));
}

// Tramo de brazo o pierna: cilindro que se estrecha, centrado en su mitad.
function limb(rTop: number, rBottom: number, len: number, m: THREE.Material, depth = 1) {
  const mesh = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, len, SEG), m));
  mesh.scale.z = depth;
  return mesh;
}

function ball(r: number, m: THREE.Material, sx = 1, sy = 1, sz = 1) {
  const mesh = shadowed(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), m));
  mesh.scale.set(sx, sy, sz);
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

// Capa con la forma del cráneo, un poco más grande, desde la altura fromY
// hacia arriba. Sirve para el pelo, las gorras y los gorros.
function headShell(fromY: number, grow: number, m: THREE.Material, phiStart = 0, phiLength = Math.PI * 2) {
  const pts = HEAD_PROFILE.filter(([, y]) => y > fromY).map(([r, y]) => new THREE.Vector2(r * grow + 0.002, y * grow + 0.004));
  pts.unshift(new THREE.Vector2(headRadius(fromY) * grow + 0.002, fromY));
  const mesh = shadowed(new THREE.Mesh(new THREE.LatheGeometry(pts, 20, phiStart, phiLength), m));
  mesh.scale.set(HEAD_SCALE.x, 1, HEAD_SCALE.z);
  return mesh;
}

// Mitad delantera del cráneo con UVs proyectadas de frente, para pintar
// la cara encima sin que se deforme por la curva.
function faceShell(m: THREE.Material) {
  const pts = HEAD_PROFILE.map(([r, y]) => new THREE.Vector2(r + 0.0015, y));
  const geo = new THREE.LatheGeometry(pts, 24, -Math.PI / 2, Math.PI);
  geo.scale(HEAD_SCALE.x, 1, HEAD_SCALE.z);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, 0.5 + pos.getX(i) / FACE.width, 0.5 + (pos.getY(i) - FACE.centerY) / FACE.height);
  }
  return new THREE.Mesh(geo, m);
}

interface Limb {
  root: THREE.Group;
  joint: THREE.Group;
}

export class Character {
  readonly root = new THREE.Group();
  private upper = new THREE.Group();
  private head = new THREE.Group();
  private arms: { left: Limb; right: Limb } | null = null;
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
    const k = BUILD_SCALE[this.config.build];
    this.root.add(this.upper);
    this.buildLegs(k);
    const torso = this.buildTorso(k);
    this.buildHead();
    this.buildArms(k, torso.shoulderX);
    this.applyPose(0);
  }

  private buildLegs(k: number) {
    const c = this.config;
    const skin = mat(c.skin, 0.55);
    const pants = mat(c.pantsColor, 0.85);
    const shoe = mat(c.shoesColor, 0.5);
    const white = mat('#f4f4f0', 0.5);
    const hipY = 0.86;
    const thigh = 0.41;
    const shin = 0.39;

    // cadera
    this.root.add(at(limb(0.16 * k, 0.17 * k, 0.2, pants, 0.68), 0, hipY + 0.03, 0));
    for (const side of [-1, 1]) {
      const hip = at(new THREE.Group(), side * 0.095 * k, hipY, 0);
      const knee = at(new THREE.Group(), 0, -thigh, 0);
      hip.add(knee);
      this.root.add(hip);

      if (c.pants === 'jorts') {
        hip.add(at(limb(0.098 * k, 0.112 * k, 0.52, pants), 0, -0.25, 0));
        knee.add(at(limb(0.052 * k, 0.04 * k, shin, skin), 0, -shin / 2, 0));
        knee.add(at(limb(0.05 * k, 0.047 * k, 0.17, white), 0, -0.3, 0)); // calcetín alto
      } else {
        const wide = c.pants === 'anchos';
        hip.add(at(limb((wide ? 0.102 : 0.09) * k, (wide ? 0.108 : 0.072) * k, thigh, pants), 0, -thigh / 2, 0));
        knee.add(at(limb((wide ? 0.108 : 0.072) * k, (wide ? 0.118 : 0.062) * k, shin, pants), 0, -shin / 2, 0));
        // pliegue que cae sobre la zapatilla
        if (wide) knee.add(at(limb(0.12 * k, 0.128 * k, 0.07, pants), 0, -shin + 0.04, 0.005));
      }

      // zapatilla
      knee.add(at(rbox(0.135, 0.035, 0.3, white, 0.015), 0, -shin - 0.04, 0.045));
      knee.add(at(rbox(0.125, 0.09, 0.28, shoe, 0.035), 0, -shin + 0.01, 0.045));
      knee.add(at(rbox(0.05, 0.015, 0.11, white, 0.006), 0, -shin + 0.058, 0.09)); // cordones
      if (c.shoes === 'botas_altas') knee.add(at(rbox(0.12, 0.12, 0.15, shoe, 0.04), 0, -shin + 0.07, -0.02));
      const swoosh = rbox(0.008, 0.025, 0.12, inkFor(c.shoesColor) === '#141414' ? mat('#141414') : white, 0.003);
      swoosh.rotation.x = -0.25;
      knee.add(at(swoosh, side * 0.063, -shin + 0.01, 0.045));
    }
  }

  private buildTorso(k: number) {
    const c = this.config;
    const top = mat(c.topColor, 0.85);
    const loose = c.top !== 'manga_larga';
    const waist = (loose ? 0.22 : 0.19) * k;
    const chest = (loose ? 0.235 : 0.21) * k;
    const depth = loose ? 0.75 : 0.7;
    const bottom = loose ? 0.8 : 0.82;
    const topY = 1.42;
    const height = topY - bottom;
    // radio delante del torso a una altura dada, para pegar estampados
    const frontZ = (y: number) => (waist + ((chest - waist) * (y - bottom)) / height) * depth;

    this.upper.add(at(limb(chest, waist, height, top, depth), 0, bottom + height / 2, 0));
    this.upper.add(at(ball(chest, top, 1, 0.38, depth), 0, topY, 0)); // hombros

    if (c.top === 'sudadera') {
      this.upper.add(at(ball(0.11, top, 1.35, 0.6, 0.8), 0, 1.47, -0.08 * k)); // capucha
      const pocket = rbox(0.24 * k, 0.12, 0.02, top, 0.01);
      pocket.rotation.x = -0.05;
      this.upper.add(at(pocket, 0, 0.97, frontZ(0.97) + 0.004));
      this.upper.add(at(limb(waist + 0.008, waist + 0.008, 0.06, top, depth), 0, bottom + 0.03, 0)); // puño
      for (const side of [-1, 1]) this.upper.add(at(limb(0.006, 0.006, 0.08, mat('#f4f4f0')), side * 0.04, 1.36, frontZ(1.33) + 0.008));
    }
    if (c.print !== 'ninguno') {
      const size = 0.26 * k;
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshStandardMaterial({ map: printTexture(c.print, inkFor(c.topColor)), transparent: true, roughness: 0.9 }),
      );
      this.upper.add(at(plane, 0, 1.16, frontZ(1.16) + 0.004));
    }

    this.upper.add(at(limb(0.055, 0.062, 0.16, mat(c.skin, 0.55)), 0, 1.5, 0)); // cuello

    if (c.chain !== 'ninguna') {
      const gold = metal('#e6b84a');
      const thick = c.chain === 'cubana' ? 0.014 : 0.008;
      const chain = new THREE.Mesh(new THREE.TorusGeometry(0.085 * Math.max(1, k * 0.95), thick, 8, 28), gold);
      chain.rotation.x = Math.PI / 2 - 0.65;
      this.upper.add(at(chain, 0, 1.43, 0.045));
      if (c.chain === 'colgante') {
        this.upper.add(at(rbox(0.04, 0.055, 0.012, gold, 0.005), 0, 1.34, frontZ(1.34) + 0.01));
        this.upper.add(at(rbox(0.018, 0.018, 0.008, mat('#1a1a1a'), 0.003), 0, 1.34, frontZ(1.34) + 0.017));
      }
    }
    return { shoulderX: chest + 0.035 * k };
  }

  private buildHead() {
    const c = this.config;
    const skin = mat(c.skin, 0.55);
    const hair = mat(c.hair, 0.75);
    const head = (this.head = at(new THREE.Group(), 0, 1.71, 0));
    head.scale.setScalar(HEAD_SIZE);
    this.upper.add(head);

    const skull = shadowed(new THREE.Mesh(new THREE.LatheGeometry(HEAD_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 24), skin));
    skull.scale.set(HEAD_SCALE.x, 1, HEAD_SCALE.z);
    head.add(skull);
    head.add(
      faceShell(
        new THREE.MeshStandardMaterial({
          map: faceTexture(c.face, c.facialHair, c.skin, c.hair),
          transparent: true,
          roughness: 0.55,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        }),
      ),
    );

    // nariz y orejas en 3D para que la cara tenga volumen
    const nose = ball(0.012, skin, 1, 2.2, 1);
    head.add(at(nose, 0, -0.022, faceZ(-0.022, 0) - 0.002));
    head.add(at(ball(0.011, skin, 1.5, 0.85, 0.9), 0, -0.042, faceZ(-0.042, 0) + 0.004));
    for (const side of [-1, 1]) head.add(at(ball(0.026, skin, 0.45, 1, 0.75), side * faceX(0) * 0.98, -0.005, -0.005));

    // pelo
    const hatOn = c.hat !== 'ninguno';
    if (c.hairStyle !== 'calvo') {
      if (!hatOn) head.add(headShell(0.062, 1.045, hair));
      head.add(headShell(-0.05, 1.045, hair, Math.PI * 0.6, Math.PI * 0.8)); // nuca
    }
    if (!hatOn) {
      if (c.hairStyle === 'degradado') {
        const top = headShell(0.095, 1.1, hair);
        top.position.z = 0.008;
        head.add(top);
      } else if (c.hairStyle === 'rizos') {
        for (let ix = -2; ix <= 2; ix++) {
          for (let iz = -2; iz <= 2; iz++) {
            const x = ix * 0.036;
            const z = iz * 0.04;
            const y = 0.14 - (x * x + z * z) * 3.2;
            const curl = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(0.032, 1), hair));
            head.add(at(curl, x, y, z));
          }
        }
      } else if (c.hairStyle === 'trenzas') {
        // cada trenza es una fila de cuentas de la frente a la nuca
        const braid = mat('#' + new THREE.Color(c.hair).multiplyScalar(0.7).getHexString(), 0.6);
        for (let i = -2; i <= 2; i++) {
          const x = i * 0.034;
          for (let t = 0; t <= 1; t += 1 / 14) {
            const front = t < 0.5;
            const y = front ? 0.07 + t * 2 * 0.075 : 0.145 - (t - 0.5) * 2 * 0.2;
            const z = faceZ(y, x) * 1.05 * (front ? 1 : -1);
            const xr = x * (headRadius(y) / headRadius(0.06));
            head.add(at(ball(0.014, braid, 1, 1, 1.3), xr, y + 0.006, z));
          }
        }
      }
    }

    if (c.glasses !== 'ninguna') {
      const dark = c.glasses === 'oscuras';
      const lens = dark
        ? mat('#0c0c0c', 0.15)
        : new THREE.MeshStandardMaterial({ color: '#cfe3f0', transparent: true, opacity: 0.3, roughness: 0.1, depthWrite: false });
      const frame = mat(dark ? '#0c0c0c' : '#e8e8e8', 0.3);
      const eyeY = 0.015;
      const z = faceZ(eyeY, 0) + 0.014;
      for (const side of [-1, 1]) {
        const l = rbox(0.058, 0.032, 0.005, lens, 0.012);
        l.rotation.y = side * 0.2;
        head.add(at(l, side * 0.045, eyeY, z - 0.005));
        head.add(at(rbox(0.005, 0.005, 0.12, frame, 0.002), side * faceX(eyeY) * 1.03, eyeY + 0.012, z - 0.065));
      }
      head.add(at(rbox(0.18, 0.005, 0.005, frame, 0.002), 0, eyeY + 0.017, z));
    }

    const hatMat = mat(c.hatColor, 0.8);
    switch (c.hat) {
      case 'gorra':
      case 'gorra_atras': {
        head.add(headShell(0.04, 1.09, hatMat));
        const dir = c.hat === 'gorra' ? 1 : -1;
        const brim = rbox(0.19, 0.012, 0.11, hatMat, 0.005);
        brim.rotation.x = dir * 0.06;
        head.add(at(brim, 0, 0.05, dir * 0.155));
        head.add(at(rbox(0.035, 0.035, 0.006, mat(inkFor(c.hatColor)), 0.004), 0, 0.1, dir * (faceZ(0.1, 0) * 1.09 + 0.006)));
        head.add(at(ball(0.012, hatMat, 1, 0.5, 1), 0, 0.17, 0)); // botón
        break;
      }
      case 'gorro': {
        const beanie = headShell(0.03, 1.1, hatMat);
        beanie.scale.y = 1.12;
        head.add(beanie);
        head.add(at(limb(faceX(0.05) * 1.12, faceX(0.04) * 1.12, 0.045, hatMat, HEAD_SCALE.z / HEAD_SCALE.x), 0, 0.05, 0)); // vuelta
        break;
      }
      case 'pescador':
        head.add(at(limb(0.1, 0.12, 0.09, hatMat), 0, 0.12, 0));
        head.add(at(limb(0.17, 0.18, 0.012, hatMat), 0, 0.075, 0));
        break;
    }
  }

  private buildArms(k: number, shoulderX: number) {
    const c = this.config;
    const skin = mat(c.skin, 0.55);
    const top = mat(c.topColor, 0.85);
    const sleeve = c.top === 'camiseta_sobre_larga' ? mat(c.sleeveColor, 0.85) : top;
    const longSleeve = c.top !== 'camiseta';
    const upperLen = 0.3;
    const foreLen = 0.27;
    const make = (side: number): Limb => {
      const root = at(new THREE.Group(), side * shoulderX, 1.39, 0);
      const joint = at(new THREE.Group(), 0, -upperLen, 0);
      // primero se dobla hacia delante y luego gira hacia el cuerpo
      root.rotation.order = joint.rotation.order = 'YXZ';
      const upperMat = longSleeve ? sleeve : skin;
      root.add(at(limb(0.058 * k, 0.05 * k, upperLen, upperMat), 0, -upperLen / 2, 0));
      if (c.top !== 'manga_larga') {
        root.add(at(ball(0.07 * k, top, 1, 0.8, 1), 0, -0.005, 0)); // hombro
        root.add(at(limb(0.07 * k, 0.074 * k, 0.2, top), 0, -0.1, 0)); // manga ancha
      } else {
        root.add(at(ball(0.062 * k, top), 0, -0.01, 0));
      }
      const foreMat = longSleeve ? sleeve : skin;
      joint.add(at(ball(0.05 * k, foreMat), 0, 0, 0)); // codo
      joint.add(at(limb(0.049 * k, 0.04 * k, foreLen, foreMat), 0, -foreLen / 2, 0));
      if (longSleeve) joint.add(at(limb(0.046 * k, 0.046 * k, 0.04, sleeve), 0, -foreLen + 0.02, 0)); // puño
      // mano: palma hacia el cuerpo y pulgar hacia delante
      joint.add(at(rbox(0.05, 0.11, 0.09, skin, 0.02), 0, -foreLen - 0.055, 0.005));
      const thumb = rbox(0.026, 0.055, 0.028, skin, 0.011);
      thumb.rotation.x = 0.4;
      joint.add(at(thumb, -side * 0.008, -foreLen - 0.035, 0.05));
      if (c.watch !== 'ninguno' && side === -1) {
        const band = c.watch === 'rolex_oro' ? metal('#e6b84a') : metal('#d4d8dc');
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.042 * k, 0.009, 8, 20), band);
        ring.rotation.x = Math.PI / 2;
        joint.add(at(ring, 0, -foreLen + 0.02, 0));
        const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 16), band);
        dial.rotation.z = Math.PI / 2;
        joint.add(at(dial, side * 0.045 * k, -foreLen + 0.02, 0));
        const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.003, 16), mat('#0f3a26', 0.2));
        glass.rotation.z = Math.PI / 2;
        joint.add(at(glass, side * (0.045 * k + 0.007), -foreLen + 0.02, 0));
      }
      root.add(joint);
      this.upper.add(root);
      return { root, joint };
    };
    this.arms = { left: make(-1), right: make(1) };
  }

  private applyPose(sway: number) {
    if (!this.arms) return;
    const { left, right } = this.arms;
    for (const a of [left, right]) {
      a.root.rotation.set(0, 0, 0);
      a.joint.rotation.set(0, 0, 0);
    }
    switch (this.pose) {
      case 'quieto':
        left.root.rotation.z = -0.1 - sway;
        right.root.rotation.z = 0.1 + sway;
        left.joint.rotation.x = -0.15;
        right.joint.rotation.x = -0.15;
        break;
      case 'pose':
        // la "pistola con los dedos" de las fotos
        right.root.rotation.set(-1.35, -0.35, 0);
        left.root.rotation.set(-0.45, 0, -0.1 - sway);
        left.joint.rotation.set(-1.7, 1.0, 0);
        break;
      case 'brazos_cruzados':
        left.root.rotation.set(-0.3, 0, -0.12 - sway * 0.5);
        right.root.rotation.set(-0.42, 0, 0.12 + sway * 0.5);
        left.joint.rotation.set(-1.6, 1.3, 0);
        right.joint.rotation.set(-1.45, -1.3, 0);
        break;
    }
  }

  update(dt: number) {
    this.time += dt;
    const breath = Math.sin(this.time * 2);
    this.upper.position.y = breath * 0.004;
    this.head.rotation.y = Math.sin(this.time * 0.6) * 0.08;
    this.head.rotation.x = Math.sin(this.time * 0.9) * 0.02;
    this.applyPose(breath * 0.02);
  }
}
