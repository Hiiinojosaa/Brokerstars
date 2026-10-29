import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CharacterConfig } from './types';
import { billTexture, denimTexture, faceTexture, shirtTexture } from './textures';

// Personaje cartoon tipo juguete, como los de los juegos de oficina:
// cabeza grande en forma de huevo, cuerpo blandito, brazos y piernas de
// tubo y sombreado suave. El origen está en los pies y mira hacia +Z.
// Brazos y piernas cuelgan de pivotes para poder animarlos.

export type Pose = 'quieto' | 'pose' | 'brazos_cruzados' | 'billetes';

const BUILD_SCALE = { flaco: 0.88, normal: 1, grande: 1.2 };
const SEG = 20;

// Perfil de la cabeza (radio, altura) de la barbilla a la coronilla, en
// unidades de cabeza; el grupo de la cabeza se escala con HEAD_SIZE.
const HEAD_PROFILE: [number, number][] = [
  [0, -0.13], [0.03, -0.128], [0.058, -0.115], [0.08, -0.09], [0.096, -0.055],
  [0.104, -0.02], [0.108, 0.02], [0.11, 0.06], [0.104, 0.095], [0.088, 0.122],
  [0.062, 0.14], [0.032, 0.148], [0, 0.15],
];
const HEAD_SCALE = { x: 0.96, z: 1.0 };
const HEAD_SIZE = 1.75;
const HEAD_SEG = 32;

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

// Tubo con los extremos redondeados (brazos, piernas, dedos).
function capsule(r: number, len: number, m: THREE.Material) {
  return shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 6, SEG), m));
}

// Tramo que se estrecha, centrado en su mitad (perneras, mangas).
function limb(rTop: number, rBottom: number, len: number, m: THREE.Material, seg = SEG) {
  return shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, len, seg), m));
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

// Camiseta ancha: cuerpo de "judía", con la base redondeada.
const TORSO_LOOSE: TorsoProfile = [
  [0.56, 0.0, 0.0], [0.565, 0.15, 0.11], [0.6, 0.225, 0.16], [0.72, 0.24, 0.17],
  [0.9, 0.245, 0.17], [1.02, 0.235, 0.16], [1.1, 0.2, 0.14], [1.16, 0.13, 0.1], [1.19, 0.06, 0.055],
];
// Manga larga: más ajustada en la cintura.
const TORSO_FITTED: TorsoProfile = [
  [0.58, 0.0, 0.0], [0.585, 0.13, 0.1], [0.62, 0.19, 0.14], [0.74, 0.2, 0.145],
  [0.92, 0.225, 0.155], [1.03, 0.225, 0.15], [1.1, 0.19, 0.13], [1.16, 0.12, 0.095], [1.19, 0.06, 0.055],
];
const TORSO_TOP = 1.19;

function smoothProfile(profile: TorsoProfile, samples = 36): TorsoProfile {
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

// Malla del torso a partir del perfil. La sección es una superelipse (algo
// más plana delante y detrás que un cilindro). La u=0.5 cae en el centro
// del pecho para que el estampado de la textura quede delante.
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

interface Limb {
  root: THREE.Group;
  joint: THREE.Group;
  hand: THREE.Group;
}

export class Character {
  readonly root = new THREE.Group();
  private upper = new THREE.Group();
  private head = new THREE.Group();
  private arms: { left: Limb; right: Limb } | null = null;
  private cash = new THREE.Group();
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
        for (const m of [o.material].flat()) m.dispose();
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
    const skin = mat(c.skin);
    const pants = texMat(denimTexture(c.pantsColor, c.pants === 'pitillo', c.skin), 0.85);
    const white = mat('#f2f2ee');
    const hipY = 0.62;
    const thigh = 0.3;
    const shin = 0.28;

    this.root.add(at(ball(0.2 * k, pants, 1, 0.55, 0.72), 0, hipY + 0.02, 0)); // cadera
    for (const side of [-1, 1]) {
      const hip = at(new THREE.Group(), side * 0.1 * k, hipY, 0);
      const knee = at(new THREE.Group(), 0, -thigh, 0);
      hip.add(knee);
      this.root.add(hip);

      switch (c.pants) {
        case 'jorts':
          hip.add(at(limb(0.1 * k, 0.115 * k, 0.36, pants), 0, -0.17, 0));
          knee.add(at(capsule(0.055 * k, shin, skin), 0, -shin / 2, 0));
          knee.add(at(limb(0.058 * k, 0.056 * k, 0.12, white), 0, -shin + 0.1, 0)); // calcetín alto
          break;
        case 'pitillo':
          hip.add(at(capsule(0.08 * k, thigh + 0.06, pants), 0, -thigh / 2, 0));
          knee.add(at(capsule(0.066 * k, shin + 0.04, pants), 0, -shin / 2, 0));
          // pernera apilada sobre la zapatilla
          for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.066 * k, 0.014, 8, SEG), pants);
            ring.rotation.x = Math.PI / 2 + (i % 2 ? 0.12 : -0.1);
            knee.add(at(ring, 0, -shin + 0.06 + i * 0.035, 0));
          }
          break;
        case 'rectos':
          hip.add(at(capsule(0.09 * k, thigh + 0.08, pants), 0, -thigh / 2, 0));
          knee.add(at(limb(0.088 * k, 0.09 * k, shin, pants), 0, -shin / 2, 0));
          break;
        default:
          // vaqueros anchos que caen sobre la zapatilla
          hip.add(at(capsule(0.1 * k, thigh + 0.1, pants), 0, -thigh / 2, 0));
          knee.add(at(limb(0.1 * k, 0.125 * k, shin, pants), 0, -shin / 2 + 0.01, 0.005));
      }

      // zapatilla gorda y redondeada
      const shoe = mat(c.shoesColor, 0.45);
      knee.add(at(rbox(0.16, 0.05, 0.3, white, 0.024), 0, -shin + 0.005, 0.05));
      knee.add(at(rbox(0.145, 0.09, 0.27, shoe, 0.045), 0, -shin + 0.05, 0.04));
      if (c.shoes === 'botas_altas') knee.add(at(capsule(0.075, 0.16, shoe), 0, -shin + 0.11, -0.01));
    }
  }

  private buildTorso(k: number) {
    const c = this.config;
    const loose = c.top !== 'manga_larga';
    const profile = smoothProfile(loose ? TORSO_LOOSE : TORSO_FITTED);
    const bottom = profile[0][0];
    const frontZ = (y: number) => profileAt(profile, y)[1] * k;
    const halfWidth = (y: number) => profileAt(profile, y)[0] * k;
    // tamaño del estampado en proporción a la textura que envuelve el torso
    const printY = 0.88;
    const [w, d] = profileAt(profile, printY);
    const around = 2 * Math.PI * Math.sqrt((w * w + d * d) / 2) * k;
    const printSize = 0.24 * k;
    const top = texMat(
      shirtTexture(c.topColor, c.print, (printY - bottom) / (TORSO_TOP - bottom), printSize / around, printSize / (TORSO_TOP - bottom)),
    );
    const plain = mat(c.topColor, 0.8);

    this.upper.add(torsoMesh(profile, k, top));

    if (c.top === 'sudadera') {
      this.upper.add(at(ball(0.13, plain, 1.3, 0.55, 0.8), 0, 1.16, -0.09 * k)); // capucha
      const pocket = rbox(0.24 * k, 0.11, 0.025, plain, 0.012);
      pocket.rotation.x = -0.08;
      this.upper.add(at(pocket, 0, 0.7, frontZ(0.7) - 0.002));
      for (const side of [-1, 1]) this.upper.add(at(capsule(0.006, 0.09, mat('#f4f4f0')), side * 0.045, 1.06, frontZ(1.06) + 0.008));
    }

    this.upper.add(at(limb(0.065, 0.075, 0.12, mat(c.skin)), 0, 1.2, 0)); // cuello

    if (c.chain !== 'ninguna') {
      const gold = metal('#e6b84a');
      const thick = c.chain === 'cubana' ? 0.016 : 0.009;
      const chain = new THREE.Mesh(new THREE.TorusGeometry(0.1 * Math.max(1, k * 0.95), thick, 8, 28), gold);
      chain.rotation.x = Math.PI / 2 - 0.7;
      this.upper.add(at(chain, 0, 1.14, 0.05));
      if (c.chain === 'colgante') {
        this.upper.add(at(rbox(0.045, 0.06, 0.014, gold, 0.006), 0, 1.03, frontZ(1.03) + 0.012));
        this.upper.add(at(rbox(0.02, 0.02, 0.01, mat('#1a1a1a'), 0.004), 0, 1.03, frontZ(1.03) + 0.02));
      }
    }
    return { shoulderX: halfWidth(1.05) - 0.01 * k };
  }

  private buildHead() {
    const c = this.config;
    const skin = mat(c.skin, 0.5);
    const hair = mat(c.hair, 0.7);
    const head = (this.head = at(new THREE.Group(), 0, 1.45, 0));
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

    // nariz pequeña y orejas redondas
    head.add(at(ball(0.014, skin, 1.2, 1, 0.9), 0, -0.035, faceZ(-0.035, 0) + 0.004));
    for (const side of [-1, 1]) head.add(at(ball(0.026, skin, 0.5, 1, 0.8), side * faceX(0) * 0.98, -0.005, -0.005));

    // pelo
    const covers = c.hat !== 'ninguno' && c.hat !== 'cascos';
    if (c.hairStyle !== 'calvo') {
      if (!covers) head.add(headShell(0.062, 1.045, hair));
      head.add(headShell(-0.05, 1.045, hair, Math.PI * 0.6, Math.PI * 0.8)); // nuca
    }
    if (!covers) {
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
      const dark = c.glasses === 'oscuras';
      const lens = dark
        ? mat('#0c0c0c', 0.15)
        : new THREE.MeshStandardMaterial({ color: '#cfe3f0', transparent: true, opacity: 0.3, roughness: 0.1, depthWrite: false });
      const frame = mat(dark ? '#0c0c0c' : '#e8e8e8', 0.3);
      const eyeY = 0.015;
      const z = faceZ(eyeY, 0) + 0.012;
      for (const side of [-1, 1]) {
        const l = rbox(0.058, 0.032, 0.005, lens, 0.012);
        l.rotation.y = side * 0.25;
        head.add(at(l, side * 0.045, eyeY, z - 0.007));
        head.add(at(rbox(0.005, 0.005, 0.12, frame, 0.002), side * faceX(eyeY) * 1.02, eyeY + 0.012, z - 0.065));
      }
      head.add(at(rbox(0.17, 0.005, 0.005, frame, 0.002), 0, eyeY + 0.017, z));
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
        // cascos de call center con micrófono
        const plastic = mat(c.hatColor, 0.4);
        const pad = mat('#1c1c1c', 0.8);
        const bandR = faceX(0.02) + 0.02;
        const band = new THREE.Mesh(new THREE.TorusGeometry(bandR, 0.009, 8, 32, Math.PI), plastic);
        band.scale.y = 1.25;
        head.add(at(shadowed(band), 0, 0.01, -0.005));
        for (const side of [-1, 1]) {
          const cup = limb(0.04, 0.04, 0.03, plastic);
          cup.rotation.z = Math.PI / 2;
          head.add(at(cup, side * (faceX(0) + 0.015), 0, -0.005));
          const cushion = limb(0.036, 0.036, 0.012, pad);
          cushion.rotation.z = Math.PI / 2;
          head.add(at(cushion, side * (faceX(0) + 0.001), 0, -0.005));
        }
        const boom = capsule(0.005, 0.11, plastic);
        boom.rotation.set(Math.PI / 2 - 0.35, 0, 0.5);
        head.add(at(boom, -faceX(0) + 0.005, -0.045, 0.05));
        head.add(at(ball(0.011, pad, 1, 1, 1.2), -0.045, -0.075, faceZ(-0.075, -0.045) + 0.012));
        break;
      }
    }
  }

  private buildArms(k: number, shoulderX: number) {
    const c = this.config;
    const skin = mat(c.skin, 0.5);
    const top = texMat(shirtTexture(c.topColor, 'ninguno', 0, 0, 0));
    const sleeve = c.top === 'camiseta_sobre_larga' ? texMat(shirtTexture(c.sleeveColor, 'ninguno', 0, 0, 0)) : top;
    const longSleeve = c.top !== 'camiseta';
    const upperLen = 0.24;
    const foreLen = 0.22;
    const make = (side: number): Limb => {
      const root = at(new THREE.Group(), side * shoulderX, 1.06, 0);
      const joint = at(new THREE.Group(), 0, -upperLen, 0);
      // primero se dobla hacia delante y luego gira hacia el cuerpo
      root.rotation.order = joint.rotation.order = 'YXZ';
      const upperMat = longSleeve ? sleeve : skin;
      root.add(at(capsule(0.06 * k, upperLen + 0.1, upperMat), 0, -upperLen / 2, 0));
      if (c.top !== 'manga_larga') root.add(at(limb(0.075 * k, 0.085 * k, 0.15, top), 0, -0.06, 0)); // manga ancha
      root.add(at(ball(0.078 * k, c.top === 'manga_larga' ? sleeve : top, 1, 0.8, 1), -side * 0.015, -0.005, 0)); // hombro
      const foreMat = longSleeve ? sleeve : skin;
      joint.add(at(capsule(0.054 * k, foreLen + 0.1, foreMat), 0, -foreLen / 2, 0));
      // mano tipo manopla con pulgar
      const hand = at(new THREE.Group(), 0, -foreLen, 0);
      joint.add(hand);
      hand.add(at(ball(0.058, skin, 0.75, 1, 0.95), 0, -0.04, 0.005));
      const thumb = capsule(0.02, 0.06, skin);
      thumb.rotation.x = 0.7;
      hand.add(at(thumb, -side * 0.005, -0.02, 0.045));

      if (c.watch === 'digital' && side === -1) {
        const rubber = mat('#151515', 0.5);
        joint.add(at(limb(0.058 * k, 0.058 * k, 0.04, rubber), 0, -foreLen + 0.03, 0));
        joint.add(at(rbox(0.03, 0.065, 0.065, rubber, 0.014), side * 0.06 * k, -foreLen + 0.03, 0));
        joint.add(at(rbox(0.004, 0.035, 0.04, mat('#8a9488', 0.3), 0.003), side * (0.06 * k + 0.015), -foreLen + 0.03, 0));
      } else if (c.watch !== 'ninguno' && side === -1) {
        const band = c.watch === 'rolex_oro' ? metal('#e6b84a') : metal('#d4d8dc');
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.056 * k, 0.011, 8, 20), band);
        ring.rotation.x = Math.PI / 2;
        joint.add(at(ring, 0, -foreLen + 0.03, 0));
        const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.014, 16), band);
        dial.rotation.z = Math.PI / 2;
        joint.add(at(dial, side * 0.062 * k, -foreLen + 0.03, 0));
        const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.004, 16), mat('#0f3a26', 0.2));
        glass.rotation.z = Math.PI / 2;
        joint.add(at(glass, side * (0.062 * k + 0.008), -foreLen + 0.03, 0));
      }
      root.add(joint);
      this.upper.add(root);
      return { root, joint, hand };
    };
    this.arms = { left: make(-1), right: make(1) };

    // abanico de billetes delante de la cara para la pose 'billetes'
    this.cash = at(new THREE.Group(), 0, 1.22, 0.33);
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
    this.cash.visible = this.pose === 'billetes';
    switch (this.pose) {
      case 'billetes':
        // las dos manos delante de la cara sujetando el abanico
        for (const [a, s] of [[left, -1], [right, 1]] as const) {
          a.root.rotation.set(-1.0, -s * 0.35, 0);
          a.joint.rotation.set(-1.6, -s * 0.1, 0);
          a.hand.rotation.set(0, s * 1.2, 0);
        }
        break;
      case 'quieto':
        left.root.rotation.z = -0.14 - sway;
        right.root.rotation.z = 0.14 + sway;
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
