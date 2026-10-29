import * as THREE from 'three';
import type { CharacterConfig } from './types';
import {
  billTexture,
  denimTexture,
  faceTexture,
  hairTexture,
  shirtTexture,
  shoeTextures,
  skinTexture,
} from './textures';

// Personaje low-poly estilo PS2 / mods de San Andreas: pocas caras con
// sombreado plano y todo el detalle (lavados, pliegues, arrugas, paneles)
// pintado en texturas pixeladas. El origen está en los pies y mira hacia
// +Z. Brazos y piernas cuelgan de pivotes para poder animarlos.

export type Pose = 'quieto' | 'pose' | 'brazos_cruzados' | 'billetes';

const BUILD_SCALE = { flaco: 0.88, normal: 1, grande: 1.2 };
const SEG = 7; // lados de brazos y piernas

// Perfil de la cabeza (radio, altura) de la barbilla a la coronilla;
// se gira con LatheGeometry y se aplasta un poco de lado.
const HEAD_PROFILE: [number, number][] = [
  [0, -0.13], [0.058, -0.115], [0.088, -0.075], [0.104, -0.02],
  [0.11, 0.05], [0.098, 0.105], [0.062, 0.14], [0, 0.15],
];
const HEAD_SCALE = { x: 0.92, z: 1.04 };
const HEAD_SIZE = 1.2;
const HEAD_SEG = 10;

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
  const r = headRadius(y) * Math.cos(Math.PI / HEAD_SEG); // centro de la cara plana
  const nx = x / (r * HEAD_SCALE.x);
  return r * HEAD_SCALE.z * Math.sqrt(Math.max(0, 1 - nx * nx));
}

function faceX(y: number) {
  return headRadius(y) * HEAD_SCALE.x;
}

function mat(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
}

function texMat(map: THREE.Texture) {
  return new THREE.MeshStandardMaterial({ map, roughness: 0.9, flatShading: true });
}

function metal(color: string) {
  return new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.25, flatShading: true });
}

function shadowed<T extends THREE.Mesh>(mesh: T): T {
  mesh.castShadow = true;
  return mesh;
}

function box(w: number, h: number, d: number, m: THREE.Material | THREE.Material[]) {
  return shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m));
}

// Tramo de brazo o pierna: cilindro que se estrecha, centrado en su mitad.
function limb(rTop: number, rBottom: number, len: number, m: THREE.Material, seg = SEG) {
  return shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, len, seg), m));
}

function ball(r: number, m: THREE.Material, sx = 1, sy = 1, sz = 1) {
  const mesh = shadowed(new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), m));
  mesh.scale.set(sx, sy, sz);
  return mesh;
}

function at<T extends THREE.Object3D>(obj: T, x: number, y: number, z: number): T {
  obj.position.set(x, y, z);
  return obj;
}

// Perfil del torso: [altura, medio ancho, media profundidad] de abajo arriba.
type TorsoProfile = [number, number, number][];

// Camiseta ancha: cae suelta por debajo de la cintura.
const TORSO_LOOSE: TorsoProfile = [
  [0.78, 0.0, 0.0], [0.78, 0.25, 0.17], [0.98, 0.238, 0.158], [1.16, 0.245, 0.163],
  [1.34, 0.25, 0.158], [1.42, 0.215, 0.135], [1.47, 0.135, 0.095], [1.5, 0.062, 0.058],
];
// Manga larga ajustada: espalda en V, más estrecha en la cintura.
const TORSO_FITTED: TorsoProfile = [
  [0.82, 0.0, 0.0], [0.82, 0.2, 0.14], [1.0, 0.19, 0.135], [1.18, 0.222, 0.152],
  [1.35, 0.238, 0.15], [1.43, 0.2, 0.124], [1.475, 0.125, 0.088], [1.5, 0.06, 0.056],
];
const TORSO_TOP = 1.5;

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
  const cols = 10;
  const y0 = profile[0][0];
  const exp = 2 / 2.6;
  const pos: number[] = [];
  const uv: number[] = [];
  for (const [y, w, d] of profile) {
    for (let j = 0; j <= cols; j++) {
      const a = (j / cols) * Math.PI * 2 - Math.PI;
      const sx = Math.sin(a), cz = Math.cos(a);
      pos.push(Math.sign(sx) * Math.abs(sx) ** exp * w * k, y, Math.sign(cz) * Math.abs(cz) ** exp * d * k);
      uv.push(j / cols, (y - y0) / (TORSO_TOP - y0));
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

// Copia del cráneo con UVs proyectadas de frente, para pintar la cara encima
// sin que se deforme. Solo se ve la parte delantera (el resto es transparente).
function faceShell(m: THREE.Material) {
  const pts = HEAD_PROFILE.map(([r, y]) => new THREE.Vector2(r + 0.001, y));
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
    const skin = texMat(skinTexture(c.skin));
    const pants = texMat(denimTexture(c.pantsColor, c.pants === 'pitillo', c.skin));
    const white = mat('#ecece8');
    const hipY = 0.86;
    const thigh = 0.41;
    const shin = 0.39;

    // cadera
    const pelvis = limb(0.17 * k, 0.175 * k, 0.2, pants, 8);
    pelvis.scale.z = 0.68;
    this.root.add(at(pelvis, 0, hipY + 0.03, 0));
    for (const side of [-1, 1]) {
      const hip = at(new THREE.Group(), side * 0.095 * k, hipY, 0);
      const knee = at(new THREE.Group(), 0, -thigh, 0);
      hip.add(knee);
      this.root.add(hip);

      switch (c.pants) {
        case 'jorts':
          hip.add(at(limb(0.11 * k, 0.13 * k, 0.52, pants, 8), 0, -0.25, 0));
          knee.add(at(limb(0.05 * k, 0.04 * k, shin, skin), 0, -shin / 2, 0));
          knee.add(at(limb(0.05 * k, 0.047 * k, 0.17, white), 0, -0.3, 0)); // calcetín alto
          break;
        case 'pitillo':
          hip.add(at(limb(0.09 * k, 0.07 * k, thigh, pants), 0, -thigh / 2, 0));
          knee.add(at(limb(0.07 * k, 0.06 * k, shin, pants), 0, -shin / 2, 0));
          // pernera apilada: varios pliegues sobre la zapatilla
          for (let i = 0; i < 4; i++) {
            const r = (0.068 + (i % 2) * 0.01) * k;
            knee.add(at(limb(r, r + 0.006, 0.04, pants), 0, -shin + 0.035 + i * 0.038, (i % 2) * 0.005));
          }
          break;
        case 'rectos':
          hip.add(at(limb(0.1 * k, 0.09 * k, thigh, pants, 8), 0, -thigh / 2, 0));
          knee.add(at(limb(0.09 * k, 0.088 * k, shin + 0.02, pants, 8), 0, -shin / 2 - 0.01, 0));
          break;
        default:
          // vaqueros gigantes que caen y arrastran sobre la zapatilla
          hip.add(at(limb(0.11 * k, 0.13 * k, thigh, pants, 8), 0, -thigh / 2, 0));
          knee.add(at(limb(0.13 * k, 0.165 * k, shin + 0.03, pants, 8), 0, -shin / 2 - 0.015, 0.005));
      }

      // zapatilla gorda: textura distinta en cada cara
      const t = shoeTextures(c.shoesColor);
      const sideMat = texMat(t.side);
      const shoeMats = [sideMat, sideMat, texMat(t.top), texMat(t.sole), sideMat, sideMat];
      knee.add(at(box(0.15, 0.12, 0.32, shoeMats), 0, -shin - 0.0, 0.05));
      if (c.shoes === 'botas_altas') knee.add(at(box(0.135, 0.13, 0.17, sideMat), 0, -shin + 0.1, -0.02));
    }
  }

  private buildTorso(k: number) {
    const c = this.config;
    const loose = c.top !== 'manga_larga';
    const profile = loose ? TORSO_LOOSE : TORSO_FITTED;
    const bottom = profile[0][0];
    // superficie delantera del torso a una altura dada
    const frontZ = (y: number) => profileAt(profile, y)[1] * k;
    const halfWidth = (y: number) => profileAt(profile, y)[0] * k;
    const printY = 1.17;
    // tamaño del estampado (26 cm) en proporción a la textura que envuelve el torso
    const [w, d] = profileAt(profile, printY);
    const around = 2 * Math.PI * Math.sqrt((w * w + d * d) / 2) * k;
    const printSize = 0.26 * k;
    const top = texMat(
      shirtTexture(c.topColor, c.print, (printY - bottom) / (TORSO_TOP - bottom), printSize / around, printSize / (TORSO_TOP - bottom)),
    );
    const plain = mat(new THREE.Color(c.topColor).getStyle());

    this.upper.add(torsoMesh(profile, k, top));
    // cuello redondo
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.012, 4, 10), mat('#' + new THREE.Color(c.topColor).multiplyScalar(0.8).getHexString()));
    rib.rotation.x = Math.PI / 2 - 0.15;
    this.upper.add(at(rib, 0, 1.49, 0.004));

    if (c.top === 'sudadera') {
      this.upper.add(at(ball(0.11, plain, 1.35, 0.6, 0.8), 0, 1.47, -0.08 * k)); // capucha
      const pocket = box(0.24 * k, 0.12, 0.02, top);
      pocket.rotation.x = -0.05;
      this.upper.add(at(pocket, 0, 0.97, frontZ(0.97) + 0.002));
      const cuff = torsoMesh(
        [[bottom, 0, 0], [bottom, halfWidth(bottom) + 0.006, frontZ(bottom) + 0.006], [bottom + 0.06, halfWidth(bottom + 0.06) + 0.006, frontZ(bottom + 0.06) + 0.006]],
        1,
        plain,
      );
      this.upper.add(cuff); // puño
      for (const side of [-1, 1]) this.upper.add(at(box(0.01, 0.08, 0.01, mat('#f4f4f0')), side * 0.04, 1.36, frontZ(1.36) + 0.008));
    }

    this.upper.add(at(limb(0.055, 0.062, 0.16, texMat(skinTexture(c.skin))), 0, 1.5, 0)); // cuello

    if (c.chain !== 'ninguna') {
      const gold = metal('#e6b84a');
      const thick = c.chain === 'cubana' ? 0.014 : 0.008;
      const chain = new THREE.Mesh(new THREE.TorusGeometry(0.085 * Math.max(1, k * 0.95), thick, 4, 14), gold);
      chain.rotation.x = Math.PI / 2 - 0.65;
      this.upper.add(at(chain, 0, 1.43, 0.045));
      if (c.chain === 'colgante') {
        this.upper.add(at(box(0.04, 0.055, 0.012, gold), 0, 1.34, frontZ(1.34) + 0.01));
        this.upper.add(at(box(0.018, 0.018, 0.008, mat('#1a1a1a')), 0, 1.34, frontZ(1.34) + 0.017));
      }
    }
    return { shoulderX: halfWidth(1.37) - 0.005 * k };
  }

  private buildHead() {
    const c = this.config;
    const skin = texMat(skinTexture(c.skin));
    const hair = texMat(hairTexture(c.hair));
    const head = (this.head = at(new THREE.Group(), 0, 1.71, 0));
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
          roughness: 0.8,
          flatShading: true,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        }),
      ),
    );

    // nariz y orejas
    const nose = box(0.026, 0.045, 0.03, skin);
    nose.rotation.x = -0.25;
    head.add(at(nose, 0, -0.03, faceZ(-0.03, 0) + 0.006));
    for (const side of [-1, 1]) head.add(at(box(0.016, 0.05, 0.035, skin), side * faceX(0) * 0.98, -0.005, -0.005));

    // pelo
    const hatOn = c.hat !== 'ninguno';
    if (c.hairStyle !== 'calvo') {
      if (!hatOn) head.add(headShell(0.062, 1.05, hair));
      head.add(headShell(-0.05, 1.05, hair, Math.PI * 0.6, Math.PI * 0.8)); // nuca
    }
    if (!hatOn) {
      if (c.hairStyle === 'degradado') {
        const top = headShell(0.095, 1.12, hair);
        top.position.z = 0.008;
        head.add(top);
      } else if (c.hairStyle === 'rizos') {
        for (let ix = -2; ix <= 2; ix++) {
          for (let iz = -2; iz <= 2; iz++) {
            const x = ix * 0.036;
            const z = iz * 0.04;
            const y = 0.14 - (x * x + z * z) * 3.2;
            head.add(at(shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(0.034, 0), hair)), x, y, z));
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
          const len = (0.06 + ((i * 7) % 5) * 0.014) * (0.6 + dir.y * 0.8);
          const spike = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.02, len, 4), hair));
          const tilt = new THREE.Vector3(((i * 13) % 7) - 3, 0, ((i * 5) % 7) - 3).multiplyScalar(0.07);
          const aim = dir.clone().lerp(up, 0.45).add(tilt).normalize();
          spike.quaternion.setFromUnitVectors(up, aim);
          const base = new THREE.Vector3(dir.x * 0.1, 0.02 + dir.y * 0.125, dir.z * 0.11);
          spike.position.copy(base.add(aim.clone().multiplyScalar(len * 0.3)));
          head.add(spike);
        }
      } else if (c.hairStyle === 'trenzas') {
        // cada trenza es una fila de cuentas de la frente a la nuca
        const braid = texMat(hairTexture('#' + new THREE.Color(c.hair).multiplyScalar(0.7).getHexString()));
        for (let i = -2; i <= 2; i++) {
          const x = i * 0.034;
          for (let t = 0; t <= 1; t += 1 / 12) {
            const front = t < 0.5;
            const y = front ? 0.07 + t * 2 * 0.075 : 0.145 - (t - 0.5) * 2 * 0.2;
            const z = faceZ(y, x) * 1.06 * (front ? 1 : -1);
            const xr = x * (headRadius(y) / headRadius(0.06));
            head.add(at(box(0.024, 0.02, 0.03, braid), xr, y + 0.006, z));
          }
        }
      }
    }

    if (c.glasses !== 'ninguna') {
      const dark = c.glasses === 'oscuras';
      const lens = dark
        ? mat('#0c0c0c')
        : new THREE.MeshStandardMaterial({ color: '#cfe3f0', transparent: true, opacity: 0.35, depthWrite: false });
      const frame = mat(dark ? '#0c0c0c' : '#e8e8e8');
      const eyeY = 0.015;
      const z = faceZ(eyeY, 0) + 0.014;
      for (const side of [-1, 1]) {
        const l = box(0.058, 0.032, 0.005, lens);
        l.rotation.y = side * 0.2;
        head.add(at(l, side * 0.045, eyeY, z - 0.005));
        head.add(at(box(0.005, 0.005, 0.12, frame), side * faceX(eyeY) * 1.03, eyeY + 0.012, z - 0.065));
      }
      head.add(at(box(0.18, 0.005, 0.005, frame), 0, eyeY + 0.017, z));
    }

    const hatMat = texMat(skinTexture(c.hatColor));
    switch (c.hat) {
      case 'gorra':
      case 'gorra_atras': {
        head.add(headShell(0.04, 1.1, hatMat));
        const dir = c.hat === 'gorra' ? 1 : -1;
        const brim = box(0.19, 0.014, 0.11, hatMat);
        brim.rotation.x = dir * 0.06;
        head.add(at(brim, 0, 0.05, dir * 0.155));
        head.add(at(box(0.035, 0.035, 0.006, mat(inkFor(c.hatColor))), 0, 0.1, dir * (faceZ(0.1, 0) * 1.1 + 0.008)));
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
        head.add(at(limb(0.1, 0.12, 0.09, hatMat, 9), 0, 0.12, 0));
        head.add(at(limb(0.17, 0.18, 0.012, hatMat, 9), 0, 0.075, 0));
        break;
    }
  }

  private buildArms(k: number, shoulderX: number) {
    const c = this.config;
    const skin = texMat(skinTexture(c.skin));
    const top = texMat(shirtTexture(c.topColor, 'ninguno', 0, 0, 0));
    const sleeve = c.top === 'camiseta_sobre_larga' ? texMat(shirtTexture(c.sleeveColor, 'ninguno', 0, 0, 0)) : top;
    const longSleeve = c.top !== 'camiseta';
    const upperLen = 0.3;
    const foreLen = 0.27;
    const make = (side: number): Limb => {
      const root = at(new THREE.Group(), side * shoulderX, 1.39, 0);
      const joint = at(new THREE.Group(), 0, -upperLen, 0);
      // primero se dobla hacia delante y luego gira hacia el cuerpo
      root.rotation.order = joint.rotation.order = 'YXZ';
      root.add(at(limb(0.063 * k, 0.052 * k, upperLen, longSleeve ? sleeve : skin), 0, -upperLen / 2, 0));
      if (c.top !== 'manga_larga') {
        root.add(at(ball(0.068 * k, top, 0.9, 0.75, 1), -side * 0.012, -0.01, 0)); // hombro
        root.add(at(limb(0.068 * k, 0.08 * k, 0.2, top), 0, -0.1, 0)); // manga ancha
      } else {
        root.add(at(ball(0.062 * k, top, 0.9, 0.8, 1), -side * 0.012, -0.01, 0));
      }
      const foreMat = longSleeve ? sleeve : skin;
      joint.add(at(ball(0.05 * k, foreMat), 0, 0, 0)); // codo
      joint.add(at(limb(0.049 * k, 0.04 * k, foreLen, foreMat), 0, -foreLen / 2, 0));
      if (longSleeve) joint.add(at(limb(0.048 * k, 0.048 * k, 0.04, sleeve), 0, -foreLen + 0.02, 0)); // puño
      // mano: palma hacia el cuerpo, dedos juntos y el pulgar hacia delante
      const hand = at(new THREE.Group(), 0, -foreLen, 0);
      joint.add(hand);
      hand.add(at(box(0.045, 0.075, 0.085, skin), 0, -0.04, 0.005));
      for (let i = 0; i < 4; i++) {
        const finger = box(0.02, 0.055 - Math.abs(i - 1.3) * 0.006, 0.019, skin);
        finger.rotation.x = (i - 1.5) * 0.08;
        hand.add(at(finger, 0, -0.1, 0.033 - i * 0.021));
      }
      const thumb = box(0.022, 0.05, 0.022, skin);
      thumb.rotation.x = 0.7;
      hand.add(at(thumb, -side * 0.006, -0.035, 0.055));

      if (c.watch === 'digital' && side === -1) {
        const rubber = mat('#151515');
        joint.add(at(limb(0.05 * k, 0.05 * k, 0.04, rubber), 0, -foreLen + 0.02, 0));
        joint.add(at(box(0.026, 0.06, 0.06, rubber), side * 0.052 * k, -foreLen + 0.02, 0));
        joint.add(at(box(0.004, 0.032, 0.036, mat('#8a9488')), side * (0.052 * k + 0.013), -foreLen + 0.02, 0));
        joint.add(at(box(0.006, 0.008, 0.012, mat('#c0392b')), side * (0.052 * k + 0.012), -foreLen + 0.048, 0.02));
      } else if (c.watch !== 'ninguno' && side === -1) {
        const band = c.watch === 'rolex_oro' ? metal('#e6b84a') : metal('#d4d8dc');
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.044 * k, 0.01, 4, 10), band);
        ring.rotation.x = Math.PI / 2;
        joint.add(at(ring, 0, -foreLen + 0.02, 0));
        const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 8), band);
        dial.rotation.z = Math.PI / 2;
        joint.add(at(dial, side * 0.047 * k, -foreLen + 0.02, 0));
        const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.003, 8), mat('#0f3a26'));
        glass.rotation.z = Math.PI / 2;
        joint.add(at(glass, side * (0.047 * k + 0.007), -foreLen + 0.02, 0));
      }
      root.add(joint);
      this.upper.add(root);
      return { root, joint, hand };
    };
    this.arms = { left: make(-1), right: make(1) };

    // abanico de billetes delante de la cara para la pose 'billetes'
    this.cash = at(new THREE.Group(), 0, 1.47, 0.33);
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
          a.root.rotation.set(-1.0, -s * 0.3, 0);
          a.joint.rotation.set(-1.6, -s * 0.1, 0);
          a.hand.rotation.set(0, s * 1.2, 0);
        }
        break;
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
