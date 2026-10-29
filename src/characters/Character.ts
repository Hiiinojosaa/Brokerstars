import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CharacterConfig } from './types';
import { billTexture, denimTexture, fabricTexture, faceTexture, jacketTexture, shirtTexture } from './textures';

// Personaje estilizado con proporciones humanas (unos 1,80 m): cabeza
// ovalada con la cara dibujada, torso con forma, brazos y piernas que se
// estrechan y sombreado suave. El origen está en los pies y mira hacia +Z.
// Brazos y piernas cuelgan de pivotes para poder animarlos.

export type Pose = 'quieto' | 'presentacion' | 'pose' | 'brazos_cruzados' | 'billetes' | 'sentado';

// Altura del asiento de una silla de oficina, para la pose 'sentado'.
export const SEAT_HEIGHT = 0.5;

const BUILD_SCALE = { flaco: 0.9, normal: 1, grande: 1.18 };
const SEG = 20;

// Perfil de la cabeza (radio, altura) de la barbilla a la coronilla, en
// unidades de cabeza; el grupo de la cabeza se escala con HEAD_SIZE.
const HEAD_PROFILE: [number, number][] = [
  [0, -0.13], [0.03, -0.128], [0.058, -0.115], [0.08, -0.09], [0.096, -0.055],
  [0.104, -0.02], [0.108, 0.02], [0.11, 0.06], [0.104, 0.095], [0.088, 0.122],
  [0.062, 0.14], [0.032, 0.148], [0, 0.15],
];
const HEAD_SCALE = { x: 0.92, z: 1.04 };
const HEAD_SIZE = 1.12;
const HEAD_SEG = 32;
const HEAD_Y = 1.665;

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

function mat(color: string, roughness = 0.55) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

function texMat(map: THREE.Texture, roughness = 0.75) {
  return new THREE.MeshStandardMaterial({ map, roughness });
}

function metal(color: string) {
  return new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.25 });
}

function shadowed<T extends THREE.Mesh>(mesh: T): T {
  mesh.castShadow = true;
  return mesh;
}

function rbox(w: number, h: number, d: number, m: THREE.Material, r = 0.02) {
  const radius = Math.min(r, w / 2, h / 2, d / 2) * 0.999;
  return shadowed(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), m));
}

// Tubo con los extremos redondeados (brazos, dedos).
function capsule(r: number, len: number, m: THREE.Material) {
  return shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 6, SEG), m));
}

// Tramo que se estrecha, centrado en su mitad (perneras, mangas).
function limb(rTop: number, rBottom: number, len: number, m: THREE.Material, seg = SEG) {
  return shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, len, seg), m));
}

// Brazo o pierna con forma: perfil [t, radio] de arriba (t=0, en la
// articulación) a abajo (t=1). Los extremos son cúpulas, así que al doblar
// rodilla o codo las dos piezas se funden sin dejar hueco. El origen está
// en la articulación de arriba y la pieza cuelga hacia -Y.
type Muscle = [number, number][];
const THIGH: Muscle = [[0, 0.095], [0.3, 0.092], [0.7, 0.078], [1, 0.068]];
const SHIN: Muscle = [[0, 0.066], [0.25, 0.071], [0.62, 0.056], [1, 0.044]];
const UPPER_ARM: Muscle = [[0, 0.062], [0.35, 0.061], [0.75, 0.052], [1, 0.047]];
const FOREARM: Muscle = [[0, 0.05], [0.28, 0.053], [0.75, 0.041], [1, 0.035]];

function muscle(profile: Muscle, len: number, m: THREE.Material, k = 1, grow = 0) {
  const r = (t: number) => {
    for (let i = 1; i < profile.length; i++) {
      if (t <= profile[i][0]) {
        const [t0, r0] = profile[i - 1];
        const [t1, r1] = profile[i];
        return (r0 + ((r1 - r0) * (t - t0)) / (t1 - t0)) * k + grow;
      }
    }
    return profile[profile.length - 1][1] * k + grow;
  };
  const pts: THREE.Vector2[] = [];
  const rTop = r(0), rBot = r(1);
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.sin(a) * rBot, -len - Math.cos(a) * rBot * 0.8));
  }
  for (let i = 1; i < 12; i++) {
    const t = 1 - i / 12;
    pts.push(new THREE.Vector2(r(t), -t * len));
  }
  for (let i = 6; i >= 0; i--) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.sin(a) * rTop, Math.cos(a) * rTop * 0.8));
  }
  return shadowed(new THREE.Mesh(new THREE.LatheGeometry(pts, SEG), m));
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

// Perfil del torso: [altura, medio ancho, media profundidad] de abajo arriba.
// Se suaviza con una curva, así que bastan unos pocos puntos.
type TorsoProfile = [number, number, number][];

// Camiseta ancha: cae suelta por debajo de la cintura.
const TORSO_LOOSE: TorsoProfile = [
  [0.84, 0, 0], [0.845, 0.17, 0.12], [0.88, 0.235, 0.16], [1.0, 0.235, 0.158], [1.16, 0.24, 0.16],
  [1.32, 0.245, 0.155], [1.42, 0.225, 0.14], [1.48, 0.17, 0.11], [1.525, 0.085, 0.07], [1.545, 0.058, 0.054],
];
// Manga larga ajustada: espalda en V, más estrecha en la cintura.
const TORSO_FITTED: TorsoProfile = [
  [0.86, 0, 0], [0.865, 0.16, 0.11], [0.9, 0.19, 0.13], [1.0, 0.18, 0.125], [1.14, 0.2, 0.135],
  [1.3, 0.222, 0.14], [1.4, 0.225, 0.135], [1.47, 0.18, 0.11], [1.52, 0.09, 0.07], [1.545, 0.056, 0.052],
];
// Chaqueta de traje: hombros marcados y el bajo tapando la cadera.
const TORSO_JACKET: TorsoProfile = [
  [0.8, 0, 0], [0.805, 0.18, 0.125], [0.84, 0.205, 0.142], [0.98, 0.192, 0.136], [1.14, 0.208, 0.143],
  [1.3, 0.23, 0.148], [1.4, 0.238, 0.142], [1.47, 0.19, 0.115], [1.52, 0.095, 0.072], [1.545, 0.058, 0.054],
];
const TORSO_TOP = 1.545;

function smoothProfile(profile: TorsoProfile, samples = 40): TorsoProfile {
  const curve = new THREE.CatmullRomCurve3(profile.map(([y, w, d]) => new THREE.Vector3(w, y, d)));
  return curve.getPoints(samples).map((p) => [p.y, Math.max(0, p.x), Math.max(0, p.z)]);
}

function profileAt(profile: TorsoProfile, y: number): [number, number] {
  for (let i = 1; i < profile.length; i++) {
    const [y1, w1, d1] = profile[i];
    if (y <= y1 && y1 > profile[i - 1][0]) {
      const [y0, w0, d0] = profile[i - 1];
      const t = (y - y0) / (y1 - y0);
      return [w0 + (w1 - w0) * t, d0 + (d1 - d0) * t];
    }
  }
  const last = profile[profile.length - 1];
  return [last[1], last[2]];
}

// Contorno aproximado de una elipse de semiejes w y d.
function perimeter(w: number, d: number) {
  return Math.PI * (3 * (w + d) - Math.sqrt((3 * w + d) * (w + 3 * d)));
}

// Malla del torso a partir del perfil. La sección es una superelipse (algo
// más plana delante y detrás que un cilindro). La u=0.5 cae en el centro
// del pecho para que lo pintado en la textura quede delante.
function torsoMesh(profile: TorsoProfile, k: number, m: THREE.Material) {
  const cols = 40;
  const y0 = profile[0][0];
  const y1 = profile[profile.length - 1][0];
  const exp = 2 / 2.3;
  const pos: number[] = [];
  const uv: number[] = [];
  for (const [y, w, d] of profile) {
    for (let j = 0; j <= cols; j++) {
      const a = (j / cols) * Math.PI * 2 - Math.PI;
      const sx = Math.sin(a), cz = Math.cos(a);
      pos.push(Math.sign(sx) * Math.abs(sx) ** exp * w * k, y, Math.sign(cz) * Math.abs(cz) ** exp * d * k);
      uv.push(j / cols, (y - y0) / (y1 - y0));
    }
  }
  const index: number[] = [];
  for (let r = 0; r < profile.length - 1; r++) {
    for (let j = 0; j < cols; j++) {
      const a = r * (cols + 1) + j, b = a + cols + 1;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return shadowed(new THREE.Mesh(geo, m));
}

// Capa con la forma del cráneo, un poco más grande, desde la altura fromY
// hacia arriba. Sirve para el pelo, las gorras y los gorros.
function headShell(fromY: number, grow: number, m: THREE.Material, phiStart = 0, phiLength = Math.PI * 2) {
  const pts = HEAD_PROFILE.filter(([, y]) => y > fromY).map(([r, y]) => new THREE.Vector2(r * grow + 0.002, y * grow + 0.004));
  pts.unshift(new THREE.Vector2(headRadius(fromY) * grow + 0.002, fromY));
  const mesh = shadowed(new THREE.Mesh(new THREE.LatheGeometry(pts, HEAD_SEG, phiStart, phiLength), m));
  mesh.scale.set(HEAD_SCALE.x, 1, HEAD_SCALE.z);
  return mesh;
}

// Pelo pegado al cráneo con una línea de pelo natural: alta en la frente,
// bajando por las sienes hasta la nuca. `front` es la altura en la frente.
function hairCap(front: number, m: THREE.Material) {
  const cols = HEAD_SEG;
  const rows = 14;
  const top = 0.15;
  const hairline = (phi: number) => {
    const c = Math.cos(phi); // 1 delante, -1 detrás
    return c > 0 ? 0.01 + (front - 0.01) * c * c : 0.01 + 0.06 * c;
  };
  const pos: number[] = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const phi = (i / cols) * Math.PI * 2;
      const hl = hairline(phi);
      const y = hl + (top - hl) * (j / rows);
      const r = headRadius(Math.min(y, top - 0.001)) * 1.045 + 0.002;
      pos.push(Math.sin(phi) * r * HEAD_SCALE.x, y * 1.02 + 0.003, Math.cos(phi) * r * HEAD_SCALE.z);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i, b = a + cols + 1;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return shadowed(new THREE.Mesh(geo, m));
}

// Mitad delantera del cráneo con UVs proyectadas de frente, para pintar la
// cara encima sin que se deforme por la curva.
function faceShell(m: THREE.Material) {
  const pts = HEAD_PROFILE.map(([r, y]) => new THREE.Vector2(r + 0.0012, y));
  const geo = new THREE.LatheGeometry(pts, HEAD_SEG, -Math.PI / 2, Math.PI);
  geo.scale(HEAD_SCALE.x, 1, HEAD_SCALE.z);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, 0.5 + pos.getX(i) / FACE.width, 0.5 + (pos.getY(i) - FACE.centerY) / FACE.height);
  }
  return new THREE.Mesh(geo, m);
}

// Color de tinta que contrasta con la prenda.
function inkFor(color: string) {
  const c = new THREE.Color(color);
  return c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 0.5 ? '#141414' : '#f4f4f0';
}

const TIE_COLORS = { negra: '#151517', granate: '#6b1d26', azul: '#1f2b4d' } as const;

interface Limb {
  root: THREE.Group;
  joint: THREE.Group;
  hand: THREE.Group;
}

export class Character {
  readonly root = new THREE.Group();
  // todo el cuerpo cuelga de aquí; al sentarse baja hasta el asiento
  private body = new THREE.Group();
  private upper = new THREE.Group();
  private legs: Limb[] = [];
  private head = new THREE.Group();
  private arms: { left: Limb; right: Limb } | null = null;
  private cash = new THREE.Group();
  private time = Math.random() * 10;
  pose: Pose = 'quieto';
  // 0 = quieto, 1 = andando, 2 = corriendo; lo pone el controlador del jugador
  walk = 0;
  private walkPhase = 0;

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
        for (const m of [o.material].flat()) m.dispose();
      }
    });
    this.root.clear();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.upper = new THREE.Group();
    this.legs = [];
  }

  private build() {
    this.clear();
    const k = BUILD_SCALE[this.config.build];
    this.body.add(this.upper);
    this.buildLegs(k);
    const torso = this.buildTorso(k);
    this.buildHead();
    this.buildArms(k, torso.shoulderX);
    this.applyPose(0);
  }

  private buildLegs(k: number) {
    const c = this.config;
    const skin = mat(c.skin);
    const dress = c.pants === 'vestir';
    const pants = dress
      ? texMat(fabricTexture(c.pantsColor), 0.7)
      : texMat(denimTexture(c.pantsColor, c.pants === 'pitillo', c.skin), 0.85);
    const white = mat('#f2f2ee');
    const hipY = 0.92;
    const thigh = 0.44;
    const shin = 0.42;
    const ground = -(hipY - thigh); // el suelo visto desde la rodilla

    this.body.add(at(ball(0.19 * k, pants, 1, 0.6, 0.72), 0, hipY + 0.02, 0)); // cadera
    if (dress && c.top !== 'traje') {
      const belt = limb(0.183 * k, 0.183 * k, 0.035, mat('#18181a', 0.4));
      belt.scale.z = 0.72;
      this.body.add(at(belt, 0, hipY + 0.06, 0));
      this.body.add(at(rbox(0.04, 0.03, 0.01, metal('#c9c9c9'), 0.004), 0, hipY + 0.06, 0.183 * k * 0.72));
    }
    for (const side of [-1, 1]) {
      const hip = at(new THREE.Group(), side * 0.1 * k, hipY, 0);
      const knee = at(new THREE.Group(), 0, -thigh, 0);
      hip.add(knee);
      this.body.add(hip);
      this.legs.push({ root: hip, joint: knee, hand: knee });

      switch (c.pants) {
        case 'vestir':
          hip.add(muscle(THIGH, thigh, pants, k, 0.006));
          knee.add(muscle(SHIN, shin - 0.03, pants, k, 0.012));
          break;
        case 'jorts':
          hip.add(at(limb(0.1 * k, 0.115 * k, 0.5, pants), 0, -0.24, 0));
          knee.add(muscle(SHIN, shin - 0.02, skin, k * 0.85));
          knee.add(at(limb(0.052 * k, 0.05 * k, 0.15, white), 0, -shin + 0.12, 0)); // calcetín alto
          break;
        case 'pitillo':
          hip.add(muscle(THIGH, thigh, pants, k * 0.95));
          knee.add(muscle(SHIN, shin - 0.02, pants, k, 0.006));
          // pernera apilada sobre la zapatilla
          for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.064 * k, 0.014, 8, SEG), pants);
            ring.rotation.x = Math.PI / 2 + (i % 2 ? 0.12 : -0.1);
            knee.add(at(ring, 0, -shin + 0.11 + i * 0.035, 0));
          }
          break;
        case 'rectos':
          hip.add(muscle(THIGH, thigh, pants, k, 0.01));
          knee.add(at(ball(0.088 * k, pants), 0, 0, 0)); // rodilla
          knee.add(at(limb(0.088 * k, 0.086 * k, shin, pants), 0, -shin / 2, 0));
          break;
        default:
          // vaqueros anchos que caen sobre la zapatilla
          hip.add(muscle(THIGH, thigh, pants, k, 0.022));
          knee.add(at(ball(0.105 * k, pants), 0, 0, 0)); // rodilla
          knee.add(at(limb(0.106 * k, 0.13 * k, shin + 0.02, pants), 0, -shin / 2 - 0.005, 0.005));
      }

      const shoe = mat(c.shoesColor, 0.45);
      if (c.shoes === 'zapatos') {
        // zapato de piel: más fino, con brillo y suela oscura
        const leather = new THREE.MeshStandardMaterial({ color: c.shoesColor, roughness: 0.28 });
        knee.add(at(rbox(0.115, 0.025, 0.29, mat('#2a2522', 0.6), 0.01), 0, ground + 0.0125, 0.05));
        knee.add(at(rbox(0.105, 0.07, 0.27, leather, 0.034), 0, ground + 0.055, 0.045));
      } else {
        knee.add(at(rbox(0.15, 0.045, 0.3, white, 0.02), 0, ground + 0.0225, 0.05));
        knee.add(at(rbox(0.135, 0.085, 0.27, shoe, 0.04), 0, ground + 0.075, 0.04));
        if (c.shoes === 'botas_altas') knee.add(at(capsule(0.07, 0.16, shoe), 0, ground + 0.14, -0.01));
      }
    }
  }

  private buildTorso(k: number) {
    const c = this.config;
    const suit = c.top === 'traje';
    const loose = c.top !== 'manga_larga' && !suit;
    const profile = smoothProfile(suit ? TORSO_JACKET : loose ? TORSO_LOOSE : TORSO_FITTED);
    const bottom = profile[0][0];
    const frontZ = (y: number) => profileAt(profile, y)[1] * k;
    const halfWidth = (y: number) => profileAt(profile, y)[0] * k;
    const around = (y: number) => perimeter(...profileAt(profile, y)) * k;

    let top: THREE.Material;
    if (suit) {
      const tie = c.tie === 'ninguna' ? null : TIE_COLORS[c.tie];
      top = texMat(jacketTexture(c.topColor, c.sleeveColor, tie, { y0: bottom, y1: TORSO_TOP, around, key: `${k}` }), 0.7);
    } else {
      // tamaño del estampado en proporción a la textura que envuelve el torso
      const printY = 1.2;
      const printSize = 0.25 * k;
      top = texMat(
        shirtTexture(c.topColor, c.print, (printY - bottom) / (TORSO_TOP - bottom), printSize / around(printY), printSize / (TORSO_TOP - bottom)),
      );
    }
    const plain = mat(c.topColor, 0.8);
    this.upper.add(torsoMesh(profile, k, top));

    if (suit) {
      // cuello de la camisa asomando por encima de la chaqueta
      const shirt = mat(c.sleeveColor, 0.6);
      for (const side of [-1, 1]) {
        const collar = rbox(0.05, 0.045, 0.012, shirt, 0.005);
        collar.rotation.set(-0.35, side * 0.55, side * 0.5);
        this.upper.add(at(collar, side * 0.042, 1.54, 0.045));
      }
    }
    if (c.top === 'sudadera') {
      this.upper.add(at(ball(0.12, plain, 1.3, 0.55, 0.8), 0, 1.5, -0.09 * k)); // capucha
      const pocket = rbox(0.24 * k, 0.11, 0.025, plain, 0.012);
      pocket.rotation.x = -0.06;
      this.upper.add(at(pocket, 0, 1.0, frontZ(1.0) - 0.002));
      for (const side of [-1, 1]) this.upper.add(at(capsule(0.006, 0.09, mat('#f4f4f0')), side * 0.045, 1.4, frontZ(1.4) + 0.008));
    }

    this.upper.add(at(limb(0.056, 0.066, 0.13, mat(c.skin)), 0, 1.56, 0)); // cuello

    if (c.chain !== 'ninguna') {
      const gold = metal('#e6b84a');
      const thick = c.chain === 'cubana' ? 0.015 : 0.008;
      const chain = new THREE.Mesh(new THREE.TorusGeometry(0.085 * Math.max(1, k * 0.95), thick, 8, 28), gold);
      chain.rotation.x = Math.PI / 2 - 0.7;
      this.upper.add(at(chain, 0, 1.49, 0.045));
      if (c.chain === 'colgante') {
        this.upper.add(at(rbox(0.04, 0.055, 0.012, gold, 0.005), 0, 1.38, frontZ(1.38) + 0.01));
        this.upper.add(at(rbox(0.018, 0.018, 0.008, mat('#1a1a1a'), 0.003), 0, 1.38, frontZ(1.38) + 0.017));
      }
    }
    return { shoulderX: halfWidth(1.42) - 0.01 * k };
  }

  private buildHead() {
    const c = this.config;
    const skin = mat(c.skin, 0.5);
    const hair = mat(c.hair, 0.7);
    const head = (this.head = at(new THREE.Group(), 0, HEAD_Y, 0));
    head.scale.setScalar(HEAD_SIZE);
    this.upper.add(head);

    const skull = shadowed(new THREE.Mesh(new THREE.LatheGeometry(HEAD_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), HEAD_SEG), skin));
    skull.scale.set(HEAD_SCALE.x, 1, HEAD_SCALE.z);
    head.add(skull);
    head.add(
      faceShell(
        new THREE.MeshStandardMaterial({
          map: faceTexture(c.face, c.facialHair, c.skin, c.hair),
          transparent: true,
          roughness: 0.5,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        }),
      ),
    );

    // nariz y orejas
    const nose = ball(0.013, skin, 1, 2, 1);
    head.add(at(nose, 0, -0.022, faceZ(-0.022, 0) - 0.002));
    head.add(at(ball(0.012, skin, 1.5, 0.85, 0.9), 0, -0.042, faceZ(-0.042, 0) + 0.004));
    for (const side of [-1, 1]) head.add(at(ball(0.026, skin, 0.45, 1, 0.75), side * faceX(0) * 0.98, -0.005, -0.005));

    // pelo
    const covers = c.hat !== 'ninguno' && c.hat !== 'cascos';
    if (c.hairStyle !== 'calvo') {
      if (covers) head.add(headShell(-0.05, 1.045, hair, Math.PI * 0.6, Math.PI * 0.8)); // nuca bajo la gorra
      else head.add(hairCap(c.hairStyle === 'degradado' ? 0.085 : 0.07, hair));
    }
    if (!covers) {
      if (c.hairStyle === 'degradado') {
        // corte moderno: volumen arriba, peinado un poco hacia delante
        const top = headShell(0.1, 1.1, hair);
        top.position.z = 0.012;
        top.rotation.x = 0.08;
        head.add(top);
      } else if (c.hairStyle === 'rizos') {
        for (let ix = -2; ix <= 2; ix++) {
          for (let iz = -2; iz <= 2; iz++) {
            const x = ix * 0.036;
            const z = iz * 0.04;
            const y = 0.14 - (x * x + z * z) * 3.2;
            head.add(at(shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(0.032, 2), hair)), x, y, z));
          }
        }
      } else if (c.hairStyle === 'pinchos') {
        // mechones en punta repartidos por la cabeza (espiral de Fibonacci)
        const up = new THREE.Vector3(0, 1, 0);
        const n = 90;
        for (let i = 0; i < n; i++) {
          const theta = Math.acos(1 - (i / n) * 1.2);
          const phi = i * 2.39996;
          const dir = new THREE.Vector3(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi));
          if (dir.z > 0.55 && dir.y < 0.62) continue; // deja libre la frente
          // más largos arriba y cortos en los lados, casi todos hacia arriba
          const len = (0.05 + ((i * 7) % 5) * 0.012) * (0.6 + dir.y * 0.8);
          const spike = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.018, len, 8), hair));
          const tilt = new THREE.Vector3(((i * 13) % 7) - 3, 0, ((i * 5) % 7) - 3).multiplyScalar(0.07);
          const aim = dir.clone().lerp(up, 0.45).add(tilt).normalize();
          spike.quaternion.setFromUnitVectors(up, aim);
          const base = new THREE.Vector3(dir.x * 0.1, 0.02 + dir.y * 0.125, dir.z * 0.11);
          spike.position.copy(base.add(aim.clone().multiplyScalar(len * 0.3)));
          head.add(spike);
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
      const eyeY = 0.015;
      const z = faceZ(eyeY, 0) + 0.012;
      if (c.glasses === 'pasta') {
        // montura gruesa de pasta negra
        const frame = mat('#141414', 0.35);
        const lens = new THREE.MeshStandardMaterial({ color: '#d9e8f2', transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false });
        for (const side of [-1, 1]) {
          const g = at(new THREE.Group(), side * 0.045, eyeY, z - 0.006);
          g.rotation.y = side * 0.25;
          g.add(at(rbox(0.066, 0.012, 0.008, frame, 0.003), 0, 0.017, 0));
          g.add(at(rbox(0.066, 0.007, 0.007, frame, 0.003), 0, -0.018, 0));
          g.add(at(rbox(0.008, 0.04, 0.008, frame, 0.003), -0.03, 0, 0));
          g.add(at(rbox(0.008, 0.04, 0.008, frame, 0.003), 0.03, 0, 0));
          g.add(rbox(0.058, 0.032, 0.003, lens, 0.008));
          head.add(g);
          head.add(at(rbox(0.007, 0.008, 0.12, frame, 0.003), side * faceX(eyeY) * 1.02, eyeY + 0.014, z - 0.065));
        }
        head.add(at(rbox(0.03, 0.008, 0.008, frame, 0.003), 0, eyeY + 0.012, z + 0.002));
      } else {
        const dark = c.glasses === 'oscuras';
        const lens = dark
          ? mat('#0c0c0c', 0.15)
          : new THREE.MeshStandardMaterial({ color: '#cfe3f0', transparent: true, opacity: 0.3, roughness: 0.1, depthWrite: false });
        const frame = mat(dark ? '#0c0c0c' : '#e8e8e8', 0.3);
        for (const side of [-1, 1]) {
          const l = rbox(0.058, 0.032, 0.005, lens, 0.012);
          l.rotation.y = side * 0.25;
          head.add(at(l, side * 0.045, eyeY, z - 0.007));
          head.add(at(rbox(0.005, 0.005, 0.12, frame, 0.002), side * faceX(eyeY) * 1.02, eyeY + 0.012, z - 0.065));
        }
        head.add(at(rbox(0.17, 0.005, 0.005, frame, 0.002), 0, eyeY + 0.017, z));
      }
    }

    const hatMat = mat(c.hatColor, 0.75);
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
        const fold = limb(faceX(0.05) * 1.12, faceX(0.04) * 1.12, 0.045, hatMat, HEAD_SEG);
        fold.scale.z = HEAD_SCALE.z / HEAD_SCALE.x;
        head.add(at(fold, 0, 0.05, 0));
        break;
      }
      case 'pescador':
        head.add(at(limb(0.1, 0.12, 0.09, hatMat), 0, 0.12, 0));
        head.add(at(limb(0.17, 0.18, 0.012, hatMat), 0, 0.075, 0));
        break;
      case 'cascos': {
        // cascos grandes de call center con micrófono
        const plastic = mat(c.hatColor, 0.4);
        const pad = mat('#1c1c1c', 0.8);
        const bandR = faceX(0.02) + 0.026;
        const band = new THREE.Mesh(new THREE.TorusGeometry(bandR, 0.01, 8, 32, Math.PI), plastic);
        band.scale.y = 1.2;
        head.add(at(shadowed(band), 0, 0.012, -0.005));
        for (const side of [-1, 1]) {
          const cup = limb(0.042, 0.045, 0.034, plastic);
          cup.rotation.z = Math.PI / 2;
          head.add(at(cup, side * (faceX(0) + 0.02), 0, -0.005));
          const cushion = limb(0.04, 0.04, 0.014, pad);
          cushion.rotation.z = Math.PI / 2;
          head.add(at(cushion, side * (faceX(0) + 0.002), 0, -0.005));
          const cap = ball(0.03, pad, 0.4, 1, 1);
          head.add(at(cap, side * (faceX(0) + 0.038), 0, -0.005));
        }
        const boom = capsule(0.005, 0.12, plastic);
        boom.rotation.set(Math.PI / 2 - 0.3, 0, 0.45);
        head.add(at(boom, -faceX(0) + 0.008, -0.05, 0.055));
        head.add(at(ball(0.011, pad, 1, 1, 1.2), -0.04, -0.082, faceZ(-0.082, -0.04) + 0.014));
        break;
      }
    }
  }

  private buildArms(k: number, shoulderX: number) {
    const c = this.config;
    const skin = mat(c.skin, 0.5);
    const suit = c.top === 'traje';
    const top = texMat(suit ? fabricTexture(c.topColor) : shirtTexture(c.topColor, 'ninguno', 0, 0, 0), suit ? 0.7 : 0.75);
    const sleeve = c.top === 'camiseta_sobre_larga' ? texMat(shirtTexture(c.sleeveColor, 'ninguno', 0, 0, 0)) : top;
    const longSleeve = c.top !== 'camiseta';
    const upperLen = 0.3;
    const foreLen = 0.27;
    const make = (side: number): Limb => {
      const root = at(new THREE.Group(), side * shoulderX, 1.45, 0);
      const joint = at(new THREE.Group(), 0, -upperLen, 0);
      // primero se dobla hacia delante y luego gira hacia el cuerpo
      root.rotation.order = joint.rotation.order = 'YXZ';
      const upperMat = longSleeve ? sleeve : skin;
      root.add(muscle(UPPER_ARM, upperLen, upperMat, k, suit ? 0.008 : longSleeve ? 0.004 : 0));
      root.add(at(ball((suit ? 0.07 : 0.066) * k, longSleeve ? sleeve : top, 1, 0.8, 1), -side * 0.018, -0.02, 0)); // hombro
      if (!longSleeve || c.top === 'camiseta_sobre_larga') root.add(at(limb(0.072 * k, 0.08 * k, 0.17, top), 0, -0.08, 0)); // manga corta
      const foreMat = longSleeve ? sleeve : skin;
      if (suit) {
        // manga de la chaqueta y el puño de la camisa asomando
        joint.add(muscle(FOREARM, foreLen - 0.035, foreMat, k, 0.01));
        joint.add(at(limb(0.045 * k, 0.045 * k, 0.04, mat(c.sleeveColor, 0.6)), 0, -foreLen + 0.015, 0));
      } else {
        joint.add(muscle(FOREARM, foreLen - 0.01, foreMat, k, longSleeve ? 0.004 : 0));
      }
      // mano: palma hacia el cuerpo, cuatro dedos y el pulgar hacia delante
      const hand = at(new THREE.Group(), 0, -foreLen, 0);
      joint.add(hand);
      hand.add(at(rbox(0.042, 0.08, 0.085, skin, 0.02), 0, -0.045, 0.005));
      for (let i = 0; i < 4; i++) {
        const finger = capsule(0.0105, 0.07 - Math.abs(i - 1.3) * 0.008, skin);
        finger.rotation.x = (i - 1.5) * 0.07;
        hand.add(at(finger, 0, -0.11, 0.032 - i * 0.021));
      }
      const thumb = capsule(0.012, 0.055, skin);
      thumb.rotation.x = 0.7;
      hand.add(at(thumb, -side * 0.006, -0.035, 0.05));

      if (c.watch === 'digital' && side === -1) {
        const rubber = mat('#151515', 0.5);
        joint.add(at(limb(0.05 * k, 0.05 * k, 0.04, rubber), 0, -foreLen + 0.03, 0));
        joint.add(at(rbox(0.026, 0.06, 0.06, rubber, 0.012), side * 0.052 * k, -foreLen + 0.03, 0));
        joint.add(at(rbox(0.004, 0.032, 0.036, mat('#8a9488', 0.3), 0.003), side * (0.052 * k + 0.013), -foreLen + 0.03, 0));
      } else if (c.watch !== 'ninguno' && side === -1) {
        const band = c.watch === 'rolex_oro' ? metal('#e6b84a') : metal('#d4d8dc');
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.046 * k, 0.01, 8, 20), band);
        ring.rotation.x = Math.PI / 2;
        joint.add(at(ring, 0, -foreLen + 0.03, 0));
        const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 16), band);
        dial.rotation.z = Math.PI / 2;
        joint.add(at(dial, side * 0.05 * k, -foreLen + 0.03, 0));
        const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.003, 16), mat('#0f3a26', 0.2));
        glass.rotation.z = Math.PI / 2;
        joint.add(at(glass, side * (0.05 * k + 0.007), -foreLen + 0.03, 0));
      }
      root.add(joint);
      this.upper.add(root);
      return { root, joint, hand };
    };
    this.arms = { left: make(-1), right: make(1) };

    // abanico de billetes delante de la cara para la pose 'billetes'
    this.cash = at(new THREE.Group(), 0, 1.5, 0.33);
    const billMat = new THREE.MeshStandardMaterial({ map: billTexture(), roughness: 0.8, side: THREE.DoubleSide });
    const count = 11;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.PlaneGeometry(0.1, 0.23);
      geo.translate(0, 0.115, 0);
      const bill = shadowed(new THREE.Mesh(geo, billMat));
      bill.rotation.z = 0.95 - (i / (count - 1)) * 1.9;
      bill.position.z = i * 0.003;
      this.cash.add(bill);
    }
    this.upper.add(this.cash);
  }

  private applyPose(sway: number) {
    if (!this.arms) return;
    const { left, right } = this.arms;
    for (const a of [left, right]) {
      a.root.rotation.set(0, 0, 0);
      a.joint.rotation.set(0, 0, 0);
      a.hand.rotation.set(0, 0, 0);
    }
    for (const leg of this.legs) {
      leg.root.rotation.set(0, 0, 0);
      leg.joint.rotation.set(0, 0, 0);
    }
    this.body.position.y = 0;
    this.cash.visible = this.pose === 'billetes';
    switch (this.pose) {
      case 'sentado': {
        // sentado en la silla con las manos en el teclado
        const hipY = 0.92;
        this.body.position.y = SEAT_HEIGHT - hipY + 0.06;
        for (const leg of this.legs) {
          leg.root.rotation.x = -1.5;
          leg.joint.rotation.x = 1.5;
        }
        for (const [a, s] of [[left, -1], [right, 1]] as const) {
          a.root.rotation.set(-0.35, -s * 0.15, 0);
          a.joint.rotation.set(-1.25, -s * 0.35, 0);
          a.hand.rotation.set(0.2, s * 1.3, 0);
        }
        break;
      }
      case 'billetes':
        // las dos manos delante de la cara sujetando el abanico
        for (const [a, s] of [[left, -1], [right, 1]] as const) {
          a.root.rotation.set(-1.0, -s * 0.3, 0);
          a.joint.rotation.set(-1.6, -s * 0.1, 0);
          a.hand.rotation.set(0, s * 1.2, 0);
        }
        break;
      case 'presentacion':
        // pose en A de las hojas de personaje, palmas hacia delante
        left.root.rotation.z = -0.42;
        right.root.rotation.z = 0.42;
        left.joint.rotation.z = -0.08;
        right.joint.rotation.z = 0.08;
        left.hand.rotation.y = -0.9;
        right.hand.rotation.y = 0.9;
        break;
      case 'quieto':
        left.root.rotation.z = -0.08 - sway;
        right.root.rotation.z = 0.08 + sway;
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
    if (this.walk > 0.01 && this.pose === 'quieto') this.applyWalk(dt);
    else this.body.position.y = this.pose === 'sentado' ? this.body.position.y : 0;
  }

  // ciclo de andar: piernas y brazos en oposición y un pequeño rebote
  private applyWalk(dt: number) {
    if (!this.arms) return;
    const run = Math.min(1, Math.max(0, this.walk - 1));
    this.walkPhase += dt * (7.5 + run * 3.5);
    const swing = 0.45 + run * 0.35;
    const p = this.walkPhase;
    this.legs.forEach((leg, i) => {
      const s = Math.sin(p + i * Math.PI);
      leg.root.rotation.x = s * swing;
      // la rodilla se dobla cuando la pierna va hacia atrás
      leg.joint.rotation.x = Math.max(0, Math.sin(p + i * Math.PI - 1.2)) * (0.7 + run * 0.6);
    });
    const { left, right } = this.arms;
    left.root.rotation.x = Math.sin(p) * swing * 0.8;
    right.root.rotation.x = -Math.sin(p) * swing * 0.8;
    left.joint.rotation.x = right.joint.rotation.x = -0.3 - run * 0.7;
    this.body.position.y = Math.abs(Math.cos(p)) * (0.025 + run * 0.02);
  }
}
