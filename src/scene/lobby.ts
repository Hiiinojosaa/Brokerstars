import * as THREE from 'three';
import { PRESETS } from '../characters/catalog';
import { Character } from '../characters/Character';
import { rect, type Floor, type Interactable, type Rect } from '../game/world';
import { box, cyl, glow, mats, plant } from './office';
import { signTexture, sunsetTexture } from './officeTextures';

// Planta 0 · Calle: a la izquierda el Banco Estrella con su ventanilla y
// los cajeros, a la derecha el MegaMart 24 h, al fondo el ascensor y
// delante la cristalera que da a la calle.

const W = 18, D = 12, H = 3.4;

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Suelo de baldosa clara pulida.
function marbleTexture() {
  const t = canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = '#e9e4da';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#ddd6c9';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillRect(128, 128, 128, 128);
    ctx.strokeStyle = 'rgba(120,110,95,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 256, 256);
    ctx.strokeRect(0, 0, 128, 128);
    ctx.strokeRect(128, 128, 128, 128);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(W / 2, D / 2);
  return t;
}

// Cajas de producto de colores para las estanterías.
const PRODUCT_COLORS = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e67e22', '#ecf0f1', '#1abc9c', '#d35400', '#c0392b'];

function shelf(len: number, seed: number) {
  const g = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: '#d5d8dc', roughness: 0.5, metalness: 0.3 });
  g.add(box(0.6, 1.9, len, frame, 0, 0.95, 0));
  const products = PRODUCT_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
  let n = seed;
  for (const side of [-1, 1]) {
    for (let level = 0; level < 4; level++) {
      const y = 0.25 + level * 0.45;
      g.add(box(0.7, 0.03, len, frame, 0, y - 0.02, 0));
      let z = -len / 2 + 0.12;
      while (z < len / 2 - 0.12) {
        n = (n * 9301 + 49297) % 233280;
        const w = 0.12 + (n % 5) * 0.03;
        const h = 0.16 + (n % 7) * 0.03;
        g.add(box(0.22, h, w, products[n % products.length], side * 0.2, y + h / 2, z + w / 2));
        z += w + 0.02;
      }
    }
  }
  return g;
}

function npc(config: Partial<(typeof PRESETS)[number]>, x: number, z: number, rotY: number, group: THREE.Group, list: Character[]) {
  const c = new Character({ ...PRESETS[0], hat: 'ninguno', ...config });
  c.root.position.set(x, 0, z);
  c.root.rotation.y = rotY;
  group.add(c.root);
  list.push(c);
  return c;
}

export function createLobby(): Floor {
  const g = new THREE.Group();
  const colliders: Rect[] = [];
  const interactables: Interactable[] = [];
  const people: Character[] = [];

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: marbleTexture(), roughness: 0.45, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: '#f1eee8', emissive: '#2a2824' }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  g.add(ceiling);
  const panel = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6e6', emissiveIntensity: 1.2 });
  for (let x = -6; x <= 6; x += 4) for (let z = -3.5; z <= 3.5; z += 3.5) g.add(box(1.4, 0.04, 0.35, panel, x, H - 0.02, z));

  // paredes: fondo, laterales y la cristalera de la entrada
  const wall = new THREE.MeshStandardMaterial({ color: '#e3dccf', roughness: 0.9 });
  g.add(box(W, H, 0.2, wall, 0, H / 2, -D / 2 - 0.1));
  g.add(box(0.2, H, D, wall, -W / 2 - 0.1, H / 2, 0));
  g.add(box(0.2, H, D, wall, W / 2 + 0.1, H / 2, 0));
  const street = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, H * 2), new THREE.MeshBasicMaterial({ map: sunsetTexture(), toneMapped: false }));
  street.position.set(0, H / 2, D / 2 + 4);
  street.rotation.y = Math.PI;
  g.add(street);
  const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, 8), new THREE.MeshStandardMaterial({ color: '#9a958c' }));
  sidewalk.rotation.x = -Math.PI / 2;
  sidewalk.position.set(0, -0.01, D / 2 + 4);
  g.add(sidewalk);
  for (let x = -W / 2; x <= W / 2; x += 2.25) g.add(box(0.08, H, 0.08, mats.frame, x, H / 2, D / 2));
  g.add(box(W, 0.08, 0.08, mats.frame, 0, H - 0.04, D / 2));
  g.add(box(W, H, 0.03, mats.glass, 0, H / 2, D / 2));
  colliders.push(rect(0, D / 2, W, 0.2));

  // --- Banco Estrella (izquierda) ---
  const bankBlue = new THREE.MeshStandardMaterial({ color: '#1f3f73', roughness: 0.6 });
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 6), new THREE.MeshStandardMaterial({ color: '#2a4a80', roughness: 1 }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(-5.6, 0.005, -2.4);
  carpet.receiveShadow = true;
  g.add(carpet);
  g.add(box(6, 1.1, 0.7, mats.wood, -5.6, 0.55, -3.7, 0.02));
  g.add(box(6.1, 0.05, 0.8, mats.white, -5.6, 1.12, -3.7));
  for (const x of [-7.4, -5.6, -3.8]) {
    g.add(box(0.02, 0.6, 0.7, mats.glass, x + 0.9, 1.45, -3.7));
    g.add(box(0.4, 0.28, 0.04, mats.plastic, x, 1.3, -3.95, 0.01));
  }
  colliders.push(rect(-5.6, -3.7, 6.1, 0.9));
  const bankSign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1), new THREE.MeshStandardMaterial({ map: signTexture('BANCO ESTRELLA', 'cuentas · préstamos · cajeros'), emissive: '#ffffff', emissiveIntensity: 0.3, emissiveMap: signTexture('BANCO ESTRELLA', 'cuentas · préstamos · cajeros') }));
  bankSign.position.set(-5.6, 2.6, -D / 2 + 0.02);
  g.add(bankSign);
  g.add(box(6.6, 0.12, 0.05, bankBlue, -5.6, 3.2, -D / 2 + 0.03));
  npc({ name: 'Cajera', face: 'feliz', skin: '#d9a77e', hair: '#3b2414', hairStyle: 'rizos', top: 'traje', topColor: '#1f3f73', glasses: 'ninguna' }, -6.5, -4.4, 0, g, people);
  npc({ name: 'Gestor', face: 'normal', skin: '#f1c9a5', hair: '#111111', top: 'traje', topColor: '#1f3f73', tie: 'azul' }, -4.7, -4.4, 0, g, people);
  interactables.push({ kind: 'bank', label: 'Ventanilla del banco', x: -5.6, z: -2.7, radius: 1.6 });
  // cajeros en la pared izquierda
  const atmScreen = canvasTex(128, 96, (ctx) => {
    ctx.fillStyle = '#0d2a52';
    ctx.fillRect(0, 0, 128, 96);
    ctx.fillStyle = '#f2c14e';
    ctx.font = '700 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BANCO', 64, 34);
    ctx.fillText('ESTRELLA', 64, 54);
    ctx.fillStyle = '#9fc4ff';
    ctx.font = '12px sans-serif';
    ctx.fillText('Introduzca tarjeta', 64, 80);
  });
  for (const z of [0.6, 2.2]) {
    const atm = new THREE.Group();
    atm.add(box(0.5, 1.6, 0.7, bankBlue, 0, 0.8, 0, 0.03));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), glow(atmScreen, 0.8));
    scr.rotation.y = Math.PI / 2;
    scr.position.set(0.255, 1.3, 0);
    atm.add(scr);
    atm.add(box(0.12, 0.05, 0.4, mats.plastic, 0.3, 1.02, 0));
    atm.position.set(-W / 2 + 0.25, 0, z);
    g.add(atm);
    colliders.push(rect(-W / 2 + 0.25, z, 0.55, 0.75));
    interactables.push({ kind: 'atm', label: 'Cajero automático', x: -W / 2 + 1.1, z, radius: 0.8 });
  }

  // --- MegaMart (derecha) ---
  const martSign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.05), new THREE.MeshStandardMaterial({ map: signTexture('MEGAMART', 'abierto 24 h · de todo'), emissive: '#ffffff', emissiveIntensity: 0.45, emissiveMap: signTexture('MEGAMART', 'abierto 24 h · de todo') }));
  martSign.position.set(5.5, 2.6, -D / 2 + 0.02);
  g.add(martSign);
  for (const [i, x] of [3.2, 5.2, 7.2].entries()) {
    const s = shelf(4.2, i * 17 + 3);
    s.position.set(x, 0, -2.2);
    g.add(s);
    colliders.push(rect(x, -2.2, 0.75, 4.3));
    interactables.push({ kind: 'shop', label: 'Mirar estantería', x: x + (i === 2 ? -1 : 1), z: -2.2, radius: 1.0 });
  }
  // neveras de bebidas en la pared derecha
  const fridgeGlass = new THREE.MeshStandardMaterial({ color: '#cfefff', emissive: '#bfe6ff', emissiveIntensity: 0.6, transparent: true, opacity: 0.75 });
  for (const z of [-4.6, -3.4, -2.2]) {
    g.add(box(0.7, 2, 1.1, mats.white, W / 2 - 0.35, 1, z, 0.02));
    g.add(box(0.02, 1.7, 1.0, fridgeGlass, W / 2 - 0.71, 1.05, z));
  }
  colliders.push(rect(W / 2 - 0.35, -3.4, 0.75, 3.4));
  interactables.push({ kind: 'fridge', label: 'Neveras de bebidas', x: W / 2 - 1.3, z: -3.4, radius: 1.1 });
  // caja
  g.add(box(2.4, 0.95, 0.7, mats.white, 5.2, 0.475, 2.4, 0.02));
  g.add(box(2.4, 0.05, 0.75, mats.plastic, 5.2, 0.97, 2.4));
  g.add(box(0.35, 0.25, 0.05, mats.plastic, 5.6, 1.15, 2.2));
  colliders.push(rect(5.2, 2.4, 2.5, 0.8));
  npc({ name: 'Cajero', face: 'normal', skin: '#8d5a3b', hairStyle: 'rapado', top: 'camiseta', topColor: '#c0392b', print: 'ninguno', pants: 'rectos', pantsColor: '#1f2c45', shoes: 'bajas', glasses: 'ninguna' }, 5.2, 3.1, Math.PI, g, people);

  // --- centro: ascensor, seguridad, bancos y plantas ---
  g.add(box(1.7, 2.3, 0.08, mats.steel, 0, 1.15, -D / 2 + 0.05));
  g.add(box(0.03, 2.3, 0.1, mats.plastic, 0, 1.15, -D / 2 + 0.06));
  g.add(box(1.9, 2.45, 0.06, mats.frame, 0, 1.22, -D / 2 + 0.02));
  const floorSign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshStandardMaterial({ map: signTexture('PLANTA 0', 'CALLE · TORRE BROKERSTARS'), emissive: '#ffffff', emissiveIntensity: 0.25, emissiveMap: signTexture('PLANTA 0', 'CALLE · TORRE BROKERSTARS') }));
  floorSign.position.set(0, 2.8, -D / 2 + 0.03);
  g.add(floorSign);
  interactables.push({ kind: 'elevator', label: 'Llamar al ascensor', x: 0, z: -D / 2 + 1.0, radius: 1.1 });
  npc({ name: 'Seguridad', face: 'serio', skin: '#5e3a26', hairStyle: 'rapado', top: 'traje', topColor: '#1c1c1c', glasses: 'oscuras', build: 'grande' }, -1.2, 4.6, Math.PI * 0.85, g, people);
  for (const x of [-2.2, 2.2]) {
    g.add(box(1.6, 0.45, 0.5, mats.wood, x, 0.225, 1.2, 0.03));
    colliders.push(rect(x, 1.2, 1.7, 0.6));
  }
  for (const [px, pz] of [[-1.6, -5.4], [1.6, -5.4], [-8.4, 5.3], [8.4, 5.3]] as const) {
    const p = plant(1.2);
    p.position.set(px, 0, pz);
    g.add(p);
    colliders.push(rect(px, pz, 0.45, 0.45));
  }
  g.add(cyl(0.02, 1, mats.steel, -0.6, 0.5, 4.6), cyl(0.02, 1, mats.steel, 0.6, 0.5, 4.6));

  // luces
  g.add(new THREE.HemisphereLight('#fff4e6', '#4c4640', 0.65));
  const sun = new THREE.DirectionalLight('#ffd2a0', 1.8);
  sun.position.set(6, 6, 14);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  g.add(sun, sun.target);
  for (let lx = -6; lx <= 6; lx += 6) {
    const p = new THREE.PointLight('#fff4e4', 6, 10, 1.4);
    p.position.set(lx, H - 0.3, 0);
    g.add(p);
  }

  return {
    level: 0,
    name: 'Planta 0 · Calle',
    group: g,
    bounds: rect(0, 0, W - 0.5, D - 0.6),
    height: H,
    colliders,
    interactables,
    arrival: { x: 0, z: -D / 2 + 1.4, rotY: 0 },
    update: (dt) => {
      for (const p of people) p.update(dt);
    },
  };
}
