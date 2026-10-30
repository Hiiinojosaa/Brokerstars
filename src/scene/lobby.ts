import * as THREE from 'three';
import { PRESETS } from '../characters/catalog';
import { Character } from '../characters/Character';
import { atmPanel, bitbasePanel, loansPanel, tellerPanel } from '../game/bank';
import { BANK_NAME, SHOP_NAME } from '../game/config';
import { collectCash, waitingCash } from '../game/scam';
import { ShopCart, checkoutPanel, shelfPanel, takeCart } from '../game/shop';
import { inside, rect, type Floor, type Game, type Interactable, type Rect } from '../game/world';
import { createElevator } from './elevator';
import { box, cyl, glow, mats, plant, wallWithGap } from './props';
import { signTexture, sunsetTexture } from './officeTextures';

// Planta 0 · Calle. Tres zonas separadas por paredes:
// - Vestíbulo (centro): entrada de cristal, cajeros, seguridad y ascensor.
// - Banco (izquierda): ventanilla y despacho del gestor de préstamos.
// - MegaMart (derecha): carros, estanterías, neveras, estanco y caja.

const W = 24, D = 14, H = 3.4;
const BANK_X = -3; // pared entre banco y vestíbulo
const SHOP_X = 2; // pared entre vestíbulo y súper (el súper es el más grande)
const DOOR = { z: 2.6, w: 1.8 }; // puertas de banco y súper (mismo sitio en las dos paredes)

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function tiles(a: string, b: string, repeatX: number, repeatZ: number) {
  const t = canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = b;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillRect(128, 128, 128, 128);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 256, 256);
    ctx.strokeRect(0, 0, 128, 128);
    ctx.strokeRect(128, 128, 128, 128);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatZ);
  return t;
}

function floorPatch(g: THREE.Group, x0: number, x1: number, z0: number, z1: number, map: THREE.Texture, roughness = 0.5) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshStandardMaterial({ map, roughness }));
  m.rotation.x = -Math.PI / 2;
  m.position.set((x0 + x1) / 2, 0.001, (z0 + z1) / 2);
  m.receiveShadow = true;
  g.add(m);
}

// pared a lo largo de Z en x fijo, con un hueco de puerta
function wallZ(g: THREE.Group, colliders: Rect[], x: number, mat: THREE.Material, door?: { z: number; w: number }) {
  const segs: [number, number][] = door ? [[-D / 2, door.z - door.w / 2], [door.z + door.w / 2, D / 2]] : [[-D / 2, D / 2]];
  for (const [z0, z1] of segs) {
    g.add(box(0.2, H, z1 - z0, mat, x, H / 2, (z0 + z1) / 2));
    colliders.push(rect(x, (z0 + z1) / 2, 0.25, z1 - z0));
  }
  if (door) g.add(box(0.2, H - 2.5, door.w, mat, x, 2.5 + (H - 2.5) / 2, door.z));
}

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

// vitrina de cristal con baldas iluminadas: para electrónica y armería.
// `items` son cajitas/figuras de colores sobre las baldas.
function vitrina(len: number, color: string, kinds: ('box' | 'phone' | 'gun')[]) {
  const g = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1 });
  const led = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#eaf6ff', emissiveIntensity: 1.1 });
  g.add(box(0.55, 0.1, len, frame, 0, 0.05, 0)); // base
  g.add(box(0.55, 0.05, len, frame, 0, 1.75, 0)); // techo
  for (const s of [-1, 1]) g.add(box(0.03, 1.7, len, glass, s * 0.26, 0.9, 0)); // caras de cristal
  g.add(box(0.03, 1.7, 0.03, frame, 0, 0.9, -len / 2), box(0.03, 1.7, 0.03, frame, 0, 0.9, len / 2));
  const palette = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#1abc9c'];
  let n = kinds.length * 13 + len;
  for (let level = 0; level < 3; level++) {
    const y = 0.35 + level * 0.5;
    g.add(box(0.5, 0.03, len - 0.1, frame, 0, y - 0.03, 0)); // balda
    g.add(box(0.5, 0.01, len - 0.1, led, 0, y - 0.08, 0)); // tira led bajo la balda
    let z = -len / 2 + 0.2;
    while (z < len / 2 - 0.2) {
      n = (n * 9301 + 49297) % 233280;
      const kind = kinds[n % kinds.length];
      const col = new THREE.MeshStandardMaterial({ color: palette[n % palette.length], roughness: 0.5, metalness: 0.2 });
      if (kind === 'phone') {
        const p = box(0.012, 0.26, 0.13, new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.2, metalness: 0.4 }), 0, y + 0.13, z);
        p.rotation.z = Math.PI / 2;
        g.add(p);
        z += 0.3;
      } else if (kind === 'gun') {
        g.add(box(0.26, 0.08, 0.04, new THREE.MeshStandardMaterial({ color: '#2b2b2f', roughness: 0.4, metalness: 0.6 }), 0, y + 0.14, z));
        g.add(box(0.05, 0.12, 0.04, new THREE.MeshStandardMaterial({ color: '#2b2b2f', roughness: 0.4 }), -0.08, y + 0.05, z));
        z += 0.42;
      } else {
        const w = 0.18 + (n % 3) * 0.05;
        g.add(box(0.26, 0.14 + (n % 4) * 0.04, w, col, 0, y + 0.1, z));
        z += w + 0.08;
      }
    }
  }
  return g;
}

// kiosco de autocobro (autocaja) con pantalla táctil y luz de estado
function selfCheckout() {
  const g = new THREE.Group();
  g.add(box(0.6, 1.0, 0.5, new THREE.MeshStandardMaterial({ color: '#e8e8ea', roughness: 0.6 }), 0, 0.5, 0, 0.03));
  const scr = canvasTex(128, 96, (ctx) => {
    ctx.fillStyle = '#0a2a1a';
    ctx.fillRect(0, 0, 128, 96);
    ctx.fillStyle = '#7CF1B0';
    ctx.font = '800 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AUTOCAJA', 64, 42);
    ctx.font = '11px sans-serif';
    ctx.fillText('Escanea y paga', 64, 66);
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), glow(scr, 0.8));
  screen.position.set(0, 1.15, 0.12);
  screen.rotation.x = -0.5;
  g.add(screen);
  g.add(box(0.08, 0.5, 0.08, new THREE.MeshStandardMaterial({ color: '#2ecc71', emissive: '#2ecc71', emissiveIntensity: 1.3 }), 0, 1.6, -0.1)); // baliza
  return g;
}

function cartModel() {
  const g = new THREE.Group();
  const wire = new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.8, roughness: 0.3, wireframe: true });
  const red = new THREE.MeshStandardMaterial({ color: '#d63a2f' });
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.8, 4, 3, 5), wire);
  b.position.y = 0.78;
  g.add(b);
  g.add(box(0.6, 0.04, 0.04, red, 0, 1.02, -0.45));
  return g;
}

function sign(text: string, sub: string, w: number, h: number) {
  const tex = signTexture(text, sub);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35 }));
}

function npc(config: Partial<(typeof PRESETS)[number]>, x: number, z: number, rotY: number, group: THREE.Group, list: Character[]) {
  const c = new Character({ ...PRESETS[0], hat: 'ninguno', ...config });
  c.root.position.set(x, 0, z);
  c.root.rotation.y = rotY;
  group.add(c.root);
  list.push(c);
  return c;
}

export function createLobby(gameRef: () => Game): Floor {
  const g = new THREE.Group();
  const colliders: Rect[] = [];
  const interactables: Interactable[] = [];
  const people: Character[] = [];
  const cart = new ShopCart();

  // suelos distintos en cada zona
  floorPatch(g, BANK_X, SHOP_X, -D / 2, D / 2, tiles('#e9e4da', '#ddd6c9', 3, 6), 0.4);
  floorPatch(g, -W / 2, BANK_X, -D / 2, D / 2, tiles('#22344f', '#1d2d45', 3, 6), 0.9);
  floorPatch(g, SHOP_X, W / 2, -D / 2, D / 2, tiles('#f2f2ee', '#e4e4de', 6, 12), 0.35);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: '#f1eee8', emissive: '#2a2824' }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  g.add(ceiling);
  const panel = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6e6', emissiveIntensity: 1.2 });
  for (let x = -10; x <= 10; x += 3.3) for (let z = -5; z <= 5; z += 3.3) g.add(box(1.4, 0.04, 0.35, panel, x, H - 0.02, z));

  // paredes exteriores y de separación
  const wall = new THREE.MeshStandardMaterial({ color: '#e3dccf', roughness: 0.9 });
  const bankWall = new THREE.MeshStandardMaterial({ color: '#1b3a66', roughness: 0.7 });
  const shopWall = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.9 });
  g.add(wallWithGap('x', W, H, 0.2, wall, -D / 2 - 0.1, 0, 2.0, 2.5));
  g.add(box(0.2, H, D, bankWall, -W / 2 - 0.1, H / 2, 0));
  g.add(box(0.2, H, D, shopWall, W / 2 + 0.1, H / 2, 0));
  wallZ(g, colliders, BANK_X, bankWall, DOOR);
  wallZ(g, colliders, SHOP_X, shopWall, DOOR);
  // puerta de cristal del banco (siempre abierta, marco de acero)
  g.add(box(0.06, 2.5, 0.06, mats.steel, BANK_X, 1.25, DOOR.z - DOOR.w / 2), box(0.06, 2.5, 0.06, mats.steel, BANK_X, 1.25, DOOR.z + DOOR.w / 2));
  // fachada de cristal de la calle
  const street = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, H * 2), new THREE.MeshBasicMaterial({ map: sunsetTexture(), toneMapped: false }));
  street.position.set(0, H / 2, D / 2 + 4);
  street.rotation.y = Math.PI;
  g.add(street);
  for (let x = -W / 2; x <= W / 2; x += 2.25) g.add(box(0.08, H, 0.08, mats.frame, x, H / 2, D / 2));
  g.add(box(W, 0.08, 0.08, mats.frame, 0, H - 0.04, D / 2));
  g.add(box(W, H, 0.03, mats.glass, 0, H / 2, D / 2));
  colliders.push(rect(0, D / 2, W, 0.2));

  // --- vestíbulo ---
  g.add(sign('TORRE BROKERSTARS', 'Planta 0 · Calle', 2.4, 0.62).translateX(0).translateY(3.08).translateZ(-D / 2 + 0.03));
  const elevator = createElevator(gameRef, 0, 0, -D / 2, 'south');
  g.add(elevator.group);
  colliders.push(...elevator.colliders);
  interactables.push(...elevator.interactables);
  // cajeros en la pared del banco, del lado del vestíbulo
  const bankBlue = new THREE.MeshStandardMaterial({ color: '#0f3c78', roughness: 0.6 });
  const atmScreen = canvasTex(128, 96, (ctx) => {
    ctx.fillStyle = '#0d2a52';
    ctx.fillRect(0, 0, 128, 96);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(BANK_NAME, 64, 44);
    ctx.fillStyle = '#9fc4ff';
    ctx.font = '12px sans-serif';
    ctx.fillText('Introduzca su tarjeta', 64, 74);
  });
  const addAtm = (x: number, z: number, rotY: number, at: { x: number; z: number }) => {
    const atm = new THREE.Group();
    atm.add(box(0.7, 1.7, 0.45, bankBlue, 0, 0.85, 0, 0.03));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), glow(atmScreen, 0.8));
    scr.position.set(0, 1.35, 0.23);
    atm.add(scr);
    atm.add(box(0.36, 0.05, 0.14, mats.plastic, 0, 1.05, 0.28));
    atm.add(box(0.12, 0.02, 0.05, mats.steel, 0.18, 1.2, 0.24));
    atm.position.set(x, 0, z);
    atm.rotation.y = rotY;
    g.add(atm);
    colliders.push(rect(x, z, 0.6, 0.6));
    interactables.push({ label: `Cajero ${BANK_NAME}`, x: at.x, z: at.z, radius: 0.8, run: () => atmPanel(gameRef()) });
  };
  addAtm(BANK_X + 0.3, -1.2, Math.PI / 2, { x: BANK_X + 1.0, z: -1.2 });
  addAtm(BANK_X + 0.3, -0.2, Math.PI / 2, { x: BANK_X + 1.0, z: -0.2 });
  // Cajero Bitcoin Bitbase (naranja), junto a los cajeros del banco
  const bbMat = new THREE.MeshStandardMaterial({ color: '#e07a1a', roughness: 0.5, metalness: 0.2, emissive: '#3a1a00', emissiveIntensity: 0.3 });
  const bb = new THREE.Group();
  bb.add(box(0.7, 1.8, 0.45, bbMat, 0, 0.9, 0, 0.03));
  const bbScreenTex = canvasTex(128, 96, (ctx) => {
    ctx.fillStyle = '#1a0f00'; ctx.fillRect(0, 0, 128, 96);
    ctx.fillStyle = '#ffb163'; ctx.font = '800 30px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('₿', 64, 40);
    ctx.fillStyle = '#ffd9a8'; ctx.font = '700 13px sans-serif';
    ctx.fillText('BITBASE', 64, 64); ctx.fillText('compra · vende', 64, 82);
  });
  bb.add(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), glow(bbScreenTex, 0.9)).translateY(1.4).translateZ(0.23));
  bb.add(box(0.3, 0.03, 0.12, mats.plastic, 0, 0.95, 0.28)); // ranura del vale
  bb.position.set(BANK_X + 0.3, 0, 0.9);
  bb.rotation.y = Math.PI / 2;
  g.add(bb);
  colliders.push(rect(BANK_X + 0.3, 0.9, 0.6, 0.6));
  interactables.push({ label: 'Cajero Bitcoin Bitbase', x: BANK_X + 1.0, z: 0.9, radius: 0.8, run: () => bitbasePanel(gameRef()) });
  npc({ name: 'Seguridad', face: 'serio', skin: '#5e3a26', hairStyle: 'rapado', top: 'traje', topColor: '#1c1c1c', glasses: 'oscuras', build: 'grande' }, 1.8, 4.8, Math.PI * 0.85, g, people);
  for (const [px, pz] of [[-2.3, -5.4], [2.3, -5.4]] as const) {
    const p = plant(1.2);
    p.position.set(px, 0, pz);
    g.add(p);
    colliders.push(rect(px, pz, 0.45, 0.45));
  }
  g.add(cyl(0.02, 1, mats.steel, -0.8, 0.5, 4.6), cyl(0.02, 1, mats.steel, 0.8, 0.5, 4.6));
  // la mula que paga en efectivo espera junto a la entrada
  const mule = new Character({ ...PRESETS[0], name: 'Mula', hat: 'gorra', hatColor: '#1c1c1c', glasses: 'ninguna', top: 'sudadera', topColor: '#3d4045', print: 'ninguno', pants: 'anchos', pantsColor: '#2f4d7a', shoes: 'bajas', shoesColor: '#f2f2f2', face: 'serio', skin: '#d9a77e' });
  mule.root.position.set(-1.6, 0, 5.2);
  mule.root.rotation.y = Math.PI;
  mule.root.visible = false;
  g.add(mule.root);
  people.push(mule);
  interactables.push({ label: 'La mula te trae el efectivo', x: -1.6, z: 4.4, radius: 1.1, enabled: () => waitingCash(gameRef()).length > 0, run: () => collectCash(gameRef()) });

  // --- banco ---
  const bankSign = sign(BANK_NAME, 'oficina · préstamos · cajeros', 2.2, 0.7);
  bankSign.rotation.y = Math.PI / 2;
  bankSign.position.set(BANK_X + 0.12, 2.95, DOOR.z);
  g.add(bankSign);
  const bankSignIn = sign(BANK_NAME, 'Su banco en la Torre Brokerstars', 3.2, 1);
  bankSignIn.position.set(-6, 2.6, -D / 2 + 0.03);
  g.add(bankSignIn);
  // ventanilla al fondo
  g.add(box(4.6, 1.1, 0.7, mats.wood, -6, 0.55, -4.2, 0.02));
  g.add(box(4.7, 0.05, 0.8, mats.white, -6, 1.12, -4.2));
  for (const x of [-7.2, -4.8]) {
    g.add(box(1.1, 0.7, 0.02, mats.glass, x, 1.5, -4.1));
    g.add(box(0.4, 0.28, 0.04, mats.plastic, x, 1.3, -4.45, 0.01));
  }
  colliders.push(rect(-6, -4.2, 4.8, 0.9));
  npc({ name: 'Cajera', face: 'feliz', skin: '#d9a77e', hair: '#3b2414', hairStyle: 'rizos', top: 'traje', topColor: '#0f3c78', glasses: 'ninguna' }, -7.2, -4.9, 0, g, people);
  npc({ name: 'Cajero', face: 'normal', skin: '#f1c9a5', hair: '#111111', top: 'traje', topColor: '#0f3c78', tie: 'azul' }, -4.8, -4.9, 0, g, people);
  interactables.push({ label: 'Ventanilla: cuenta y transferencias', x: -6, z: -3.3, radius: 1.5, run: () => tellerPanel(gameRef()) });
  // despacho de cristal del gestor de préstamos
  const ox0 = -W / 2, ox1 = -5.4, oz0 = 2.2, oz1 = D / 2;
  // pared de cristal con la puerta en el extremo derecho
  g.add(box(ox1 - ox0 - 1.2, H, 0.06, mats.glass, (ox0 + ox1) / 2 - 0.6, H / 2, oz0));
  g.add(box(0.06, H, oz1 - oz0, mats.glass, ox1, H / 2, (oz0 + oz1) / 2));
  for (const y of [0.04, 1.05, H - 0.04]) {
    g.add(box(ox1 - ox0 - 1.2, 0.06, 0.07, mats.frame, (ox0 + ox1) / 2 - 0.6, y, oz0));
  }
  colliders.push(rect((ox0 + ox1) / 2 - 0.6, oz0, ox1 - ox0 - 1.2, 0.15)); // hueco de puerta a la derecha
  colliders.push(rect(ox1, (oz0 + oz1) / 2, 0.15, oz1 - oz0));
  const desk = new THREE.Group();
  desk.add(box(1.6, 0.05, 0.8, mats.wood, 0, 0.75, 0), box(1.5, 0.7, 0.05, mats.wood, 0, 0.37, 0.35));
  desk.add(box(0.5, 0.32, 0.04, mats.plastic, 0.3, 1.0, 0.25, 0.01));
  desk.position.set(-7.4, 0, 4.4);
  g.add(desk);
  colliders.push(rect(-7.4, 4.4, 1.7, 0.9));
  npc({ name: 'Gestor', face: 'serio', skin: '#b97f55', hair: '#111', top: 'traje', topColor: '#1d2440', tie: 'granate', glasses: 'pasta' }, -7.4, 5.2, Math.PI, g, people);
  interactables.push({ label: 'Gestor de préstamos', x: -7.4, z: 3.4, radius: 1.2, run: () => loansPanel(gameRef()) });
  const loanSign = sign('PRÉSTAMOS', 'hasta 20.000 € al momento', 1.6, 0.5);
  loanSign.position.set((ox0 + ox1) / 2, 2.7, oz0 - 0.05);
  loanSign.rotation.y = Math.PI;
  g.add(loanSign);
  // sillas de espera
  for (const z of [-1.5, -0.6]) {
    g.add(box(0.5, 0.45, 0.5, mats.white, -4.2, 0.225, z, 0.04));
    colliders.push(rect(-4.2, z, 0.55, 0.55));
  }

  // --- MegaMart ---
  const shopSign = sign(SHOP_NAME, 'abierto 24 h · de todo', 2.4, 0.75);
  shopSign.rotation.y = -Math.PI / 2;
  shopSign.position.set(SHOP_X - 0.12, 2.95, DOOR.z);
  g.add(shopSign);
  // carros en la entrada (junto a la puerta del súper)
  for (let i = 0; i < 5; i++) {
    const c = cartModel();
    c.position.set(SHOP_X + 0.7, 0, 5.2 + i * 0.25);
    g.add(c);
  }
  colliders.push(rect(SHOP_X + 0.7, 5.6, 0.7, 1.5));
  interactables.push({ label: 'Coger / dejar carro', x: SHOP_X + 1.5, z: 5.6, radius: 1.0, run: () => takeCart(gameRef(), cart) });
  // congelador isla (centro)
  const freezer = new THREE.Group();
  freezer.add(box(1.1, 0.85, 3.2, mats.white, 0, 0.425, 0, 0.03));
  freezer.add(box(1.0, 0.04, 3.1, new THREE.MeshStandardMaterial({ color: '#cfefff', emissive: '#a9dcff', emissiveIntensity: 0.6, transparent: true, opacity: 0.7 }), 0, 0.87, 0));
  freezer.position.set(6.0, 0, -3.6);
  g.add(freezer);
  colliders.push(rect(6.0, -3.6, 1.15, 3.25));
  interactables.push({ label: 'Congelados', x: 5.0, z: -3.6, radius: 1.0, run: () => shelfPanel(gameRef(), cart, 'congelados') });
  // dos pasillos largos de snacks
  const s1 = shelf(4.2, 7);
  s1.position.set(8.4, 0, -3.3);
  g.add(s1);
  colliders.push(rect(8.4, -3.3, 0.75, 4.3));
  interactables.push({ label: 'Snacks y dulces', x: 7.5, z: -3.3, radius: 1.1, run: () => shelfPanel(gameRef(), cart, 'snacks') });
  const s3 = shelf(4.2, 51); // segundo pasillo (decorativo, da sensación de súper grande)
  s3.position.set(10.3, 0, -3.3);
  g.add(s3);
  colliders.push(rect(10.3, -3.3, 0.75, 4.3));
  // neveras al fondo (pared norte del súper)
  const fridgeGlass = new THREE.MeshStandardMaterial({ color: '#cfefff', emissive: '#bfe6ff', emissiveIntensity: 0.6, transparent: true, opacity: 0.75 });
  for (const x of [5.4, 6.6, 7.8, 9.0, 10.2]) {
    g.add(box(1.1, 2, 0.7, mats.white, x, 1, -D / 2 + 0.35, 0.02));
    g.add(box(1.0, 1.7, 0.02, fridgeGlass, x, 1.05, -D / 2 + 0.71));
  }
  colliders.push(rect(7.8, -D / 2 + 0.35, 6.1, 0.75));
  interactables.push({ label: 'Neveras de bebidas', x: 7.8, z: -D / 2 + 1.4, radius: 1.5, run: () => shelfPanel(gameRef(), cart, 'bebidas') });
  // pasillo de fiesta
  const s2 = shelf(2.4, 23);
  s2.position.set(6.0, 0, 1.6);
  g.add(s2);
  colliders.push(rect(6.0, 1.6, 0.75, 2.5));
  interactables.push({ label: 'Pasillo de fiesta', x: 7.0, z: 1.6, radius: 1.0, run: () => shelfPanel(gameRef(), cart, 'fiesta') });
  // estanco (mostrador al fondo derecha)
  g.add(box(0.7, 1.05, 2.4, mats.wood, 11.1, 0.525, 1.2, 0.02));
  g.add(box(0.6, 1.4, 2.4, new THREE.MeshStandardMaterial({ color: '#2f6b3a' }), 11.55, 1.75, 1.2));
  colliders.push(rect(11.2, 1.2, 1.0, 2.5));
  npc({ name: 'Estanquero', face: 'chulo', skin: '#8d5a3b', hairStyle: 'trenzas', top: 'camiseta', topColor: '#2f6b3a', print: 'ninguno', pants: 'rectos', pantsColor: '#1f2c45', shoes: 'bajas', glasses: 'oscuras' }, 11.4, 1.2, -Math.PI / 2, g, people);
  interactables.push({ label: 'Estanco', x: 10.1, z: 1.2, radius: 1.1, run: () => shelfPanel(gameRef(), cart, 'estanco') });
  // vitrina de electrónica (móviles y portátiles) contra la pared del súper
  const vElec = vitrina(2.8, '#2b3a55', ['phone', 'box', 'phone']);
  vElec.position.set(SHOP_X + 0.55, 0, -3.0);
  g.add(vElec);
  colliders.push(rect(SHOP_X + 0.55, -3.0, 0.6, 2.85));
  const elecSign = sign('ELECTRÓNICA', 'iPhone · Pixel · portátiles', 1.6, 0.5);
  elecSign.rotation.y = -Math.PI / 2;
  elecSign.position.set(SHOP_X + 0.3, 2.2, -3.0);
  g.add(elecSign);
  interactables.push({ label: 'Electrónica: móviles y portátiles', x: SHOP_X + 1.2, z: -3.0, radius: 1.1, run: () => shelfPanel(gameRef(), cart, 'electronica') });
  npc({ name: 'Dependiente', face: 'feliz', skin: '#e0b48c', hairStyle: 'degradado', top: 'camiseta', topColor: '#2b3a55', print: 'ninguno', pants: 'rectos', pantsColor: '#1f2c45', shoes: 'bajas', glasses: 'pasta' }, SHOP_X + 1.4, -1.6, -Math.PI / 2, g, people);
  // armería (atrezzo/airsoft con licencia): vitrina acristalada y cerrada
  const vArm = vitrina(2.4, '#3a2b2b', ['gun', 'box', 'gun']);
  vArm.position.set(SHOP_X + 0.55, 0, 0.3);
  g.add(vArm);
  colliders.push(rect(SHOP_X + 0.55, 0.3, 0.6, 2.45));
  const armSign = sign('ARMERÍA', 'airsoft y atrezzo · con licencia', 1.6, 0.5);
  armSign.rotation.y = -Math.PI / 2;
  armSign.position.set(SHOP_X + 0.3, 2.2, 0.3);
  g.add(armSign);
  interactables.push({ label: 'Armería (atrezzo con licencia)', x: SHOP_X + 1.2, z: 0.3, radius: 1.1, run: () => shelfPanel(gameRef(), cart, 'armeria') });
  // línea de cajas (frente a la salida): una atendida + tres autocajas
  g.add(box(2.2, 0.95, 0.7, mats.white, 9.6, 0.475, 4.8, 0.02));
  g.add(box(2.2, 0.05, 0.75, mats.plastic, 9.6, 0.97, 4.8));
  g.add(box(0.35, 0.25, 0.05, mats.plastic, 10.0, 1.15, 5.05));
  colliders.push(rect(9.6, 4.8, 2.3, 0.8));
  npc({ name: 'Cajero', face: 'normal', skin: '#8d5a3b', hairStyle: 'rapado', top: 'camiseta', topColor: '#c0392b', print: 'ninguno', pants: 'rectos', pantsColor: '#1f2c45', shoes: 'bajas', glasses: 'ninguna' }, 9.6, 5.5, Math.PI, g, people);
  interactables.push({ label: 'Caja atendida: el cajero pasa tu compra', x: 9.6, z: 4.0, radius: 1.1, run: () => checkoutPanel(gameRef(), cart, 'staffed') });
  for (const ax of [5.0, 6.0, 7.0] as const) {
    const sc = selfCheckout();
    sc.position.set(ax, 0, 4.9);
    g.add(sc);
    colliders.push(rect(ax, 4.9, 0.6, 0.5));
    interactables.push({ label: 'Autopago: escanea, tarjeta cliente y paga', x: ax, z: 4.1, radius: 0.9, run: () => checkoutPanel(gameRef(), cart, 'self') });
  }
  // máquina expendedora de tabaco junto al estanco
  const vend = new THREE.Group();
  vend.add(box(0.7, 1.8, 0.5, new THREE.MeshStandardMaterial({ color: '#8a1f2a', roughness: 0.5 }), 0, 0.9, 0, 0.03));
  const vendGlass = canvasTex(96, 128, (ctx) => {
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 96, 128);
    ctx.font = '22px serif'; ctx.textAlign = 'center';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) ctx.fillText('🚬', 18 + c * 30, 28 + r * 30);
  });
  vend.add(new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), glow(vendGlass, 0.5)).translateY(1.0).translateZ(0.26));
  vend.add(box(0.5, 0.25, 0.05, mats.plastic, 0, 1.55, 0.26));
  vend.position.set(9.7, 0, 1.2);
  vend.rotation.y = -Math.PI / 2;
  g.add(vend);
  colliders.push(rect(9.7, 1.2, 0.6, 0.6));
  interactables.push({ label: 'Máquina de tabaco', x: 9.0, z: 1.2, radius: 0.9, run: () => shelfPanel(gameRef(), cart, 'estanco') });

  // luces
  g.add(new THREE.HemisphereLight('#fff4e6', '#4c4640', 0.65));
  const sun = new THREE.DirectionalLight('#ffd2a0', 1.8);
  sun.position.set(6, 6, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  g.add(sun, sun.target);
  for (const [lx, lz] of [[-6, 0], [0, 0], [6, -1]] as const) {
    const p = new THREE.PointLight('#fff4e4', 6, 9, 1.4);
    p.position.set(lx, H - 0.3, lz);
    g.add(p);
  }

  const room = rect(0, 0, W - 0.3, D - 0.4);
  let warned = false;
  return {
    level: 0,
    name: 'Planta 0 · Calle',
    group: g,
    walkable: [room, elevator.walkable],
    bounds: rect(0, 0, W, D),
    height: H,
    colliders,
    interactables,
    arrival: elevator.inside,
    dynamicColliders: elevator.doorCollider,
    onArrive: (from) => elevator.arrive(from),
    update: (dt) => {
      mule.root.visible = waitingCash(gameRef()).length > 0;
      for (const p of people) p.update(dt);
      elevator.update(dt);
      // salir del súper con cosas sin pagar
      const game = gameRef();
      const pos = game.player.pos;
      const inShop = inside(rect((SHOP_X + W / 2) / 2, 0, W / 2 - SHOP_X, D), pos.x, pos.z);
      if (cart.active && !inShop) {
        if (cart.count && !warned) {
          warned = true;
          game.hud.toast('🚨 ¡Alarma! El guardia te quita la compra sin pagar', 'bad');
          for (const [id, n] of Object.entries(cart.items)) game.state.data.stock[id] = (game.state.data.stock[id] ?? 0) + n;
        } else if (!cart.count) game.hud.toast('Has dejado el carro en la entrada', '');
        cart.detach();
        game.player.slow = false;
      }
      if (inShop) warned = false;
    },
  };
}
