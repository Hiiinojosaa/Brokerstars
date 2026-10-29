import * as THREE from 'three';
import { COLORS, PRESETS } from '../characters/catalog';
import { Character, type Pose } from '../characters/Character';
import type { CharacterConfig } from '../characters/types';
import { dropshipPc } from '../game/dropship';
import { button, el } from '../game/hud';
import { tradingTerminal, type Market } from '../game/market';
import { bossPanel, salesPc } from '../game/sales';
import { rect, type Floor, type Game, type Interactable, type Rect } from '../game/world';
import { createAtm } from './atm';
import { createElevator } from './elevator';
import {
  carpetTexture,
  clockTexture,
  keyboardTexture,
  screenTexture,
  shopScreenTexture,
  signTexture,
  stickyTexture,
  sunsetTexture,
  tickerCanvas,
  whiteboardTexture,
} from './officeTextures';
import { box, chair, cyl, glow, mats, plant } from './props';

export { box, cyl, glow, mats, plant } from './props';

// Planta 1 · Los Negocios, al estilo de El lobo de Wall Street: una sala
// abierta de 24 x 16 m con filas de mesas por zonas (ventas de
// automatizaciones, trading y dropshipping), ticker LED con precios, y al
// fondo el despacho del supervisor, la sala de reuniones y la cocina.

const W = 24, D = 16, H = 3.2;
const BAND = -4.6; // pared de cristal de los despachos del fondo

type Zone = 'ventas' | 'trading' | 'drop';

interface Seat {
  x: number;
  z: number;
  rotY: number;
  zone: Zone;
}

function operatorConfig(i: number, zone: Zone): CharacterConfig {
  const base = PRESETS[0];
  const suit = zone !== 'drop' || i % 2 === 0;
  return {
    ...base,
    name: `Compañero ${i + 1}`,
    skin: COLORS.skin[(i * 7) % COLORS.skin.length],
    hair: COLORS.hair[(i * 3) % 4],
    hairStyle: (['degradado', 'rapado', 'rizos', 'degradado', 'trenzas'] as const)[i % 5],
    face: (['concentrado', 'normal', 'feliz', 'serio', 'chulo'] as const)[i % 5],
    facialHair: i % 4 === 1 ? 'barba' : 'nada',
    glasses: i % 3 === 0 ? 'pasta' : 'ninguna',
    hat: zone === 'ventas' ? 'cascos' : 'ninguno',
    hatColor: ['#3d4045', '#1c1c1c', '#e6e6e6'][i % 3],
    top: suit ? 'traje' : 'sudadera',
    topColor: suit ? ['#5f6368', '#1f2124', '#1d2440'][i % 3] : ['#2e6f9e', '#7a1f1f', '#3e4a2c'][i % 3],
    tie: suit && i % 2 ? (['negra', 'granate', 'azul'] as const)[i % 3] : 'ninguna',
    pants: suit ? 'vestir' : 'anchos',
    pantsColor: suit ? ['#3d4045', '#1f2124', '#5f6368'][i % 3] : '#2f4d7a',
    shoes: suit ? 'zapatos' : 'bajas',
    shoesColor: suit ? '#1c1c1c' : '#f2f2f2',
    watch: i % 4 === 0 ? 'rolex_oro' : 'ninguno',
  };
}

// Puesto mirando hacia -Z local: la mesa va de z=0 (centro de la fila) a
// z=0.8 (borde) y la silla queda en z≈1.3.
function station(zone: Zone, index: number) {
  const g = new THREE.Group();
  const monitors = zone === 'trading' ? 3 : zone === 'drop' ? 2 : 1;
  for (let m = 0; m < monitors; m++) {
    const off = (m - (monitors - 1) / 2) * 0.52;
    const turn = monitors > 1 ? -off * 0.5 : 0;
    const mon = new THREE.Group();
    mon.add(box(0.2, 0.02, 0.15, mats.plastic, 0, 0.76, 0));
    mon.add(box(0.04, 0.24, 0.04, mats.plastic, 0, 0.88, -0.02));
    mon.add(box(0.5, 0.31, 0.035, mats.plastic, 0, 1.07, 0, 0.01));
    const tex = zone === 'trading' ? screenTexture(2 + ((index + m) % 2) * 3) : zone === 'drop' ? (m === 0 ? shopScreenTexture(index % 4) : screenTexture(1)) : screenTexture((index + m) % 2);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.27), glow(tex, 0.9));
    scr.position.set(0, 1.07, 0.019);
    mon.add(scr);
    mon.position.set(off, 0, 0.18 + Math.abs(off) * 0.12);
    mon.rotation.y = turn;
    g.add(mon);
  }
  g.add(box(0.44, 0.02, 0.15, mats.beige, 0, 0.76, 0.56, 0.008));
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13), new THREE.MeshStandardMaterial({ map: keyboardTexture() }));
  keys.rotation.x = -Math.PI / 2;
  keys.position.set(0, 0.771, 0.56);
  g.add(keys);
  g.add(box(0.06, 0.03, 0.1, mats.plastic, 0.33, 0.765, 0.57, 0.015));
  if (zone === 'ventas') {
    g.add(box(0.2, 0.06, 0.18, mats.beige, -0.62, 0.78, 0.38, 0.015));
    g.add(box(0.05, 0.04, 0.2, mats.beige, -0.66, 0.83, 0.38, 0.018));
  }
  if (zone === 'drop') {
    // cajas de muestras encima de la mesa
    for (let b = 0; b < 2; b++) g.add(box(0.22, 0.16, 0.18, new THREE.MeshStandardMaterial({ color: '#c49a6c' }), -0.6 + b * 0.05, 0.82 + b * 0.16, 0.35));
  }
  if (index % 2) g.add(cyl(0.04, 0.22, mats.white, 0.62, 0.86, 0.3));
  if (index % 3 === 0) {
    const note = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.11), new THREE.MeshStandardMaterial({ map: stickyTexture(['¡VENDE!', 'NO\nDORMIR', 'TO THE\nMOON'][index % 3]) }));
    note.position.set(0.42, 1.02, 0.12);
    g.add(note);
  }
  const c = chair();
  c.position.z = 1.3;
  c.rotation.y = 0.12 * ((index % 3) - 1);
  g.add(c);
  return g;
}

// fila doble de mesas sin mamparas (puestos a los dos lados)
function deskRow(zone: Zone, seats: number, startIndex: number) {
  const g = new THREE.Group();
  const len = seats * 1.7;
  const top = zone === 'trading' ? new THREE.MeshStandardMaterial({ color: '#2b2d33', roughness: 0.35 }) : mats.deskTop;
  g.add(box(len, 0.04, 1.7, top, 0, 0.73, 0));
  g.add(box(len, 0.25, 0.04, mats.plastic, 0, 0.86, 0)); // canaleta de cables en el centro
  for (let s = 0; s <= seats; s += seats) g.add(box(0.05, 0.71, 1.6, mats.deskLeg, -len / 2 + s * 1.7 + (s ? -0.03 : 0.03), 0.355, 0));
  const local: { x: number; z: number; rotY: number; index: number }[] = [];
  let index = startIndex;
  for (const side of [1, -1]) {
    for (let s = 0; s < seats; s++) {
      const x = -len / 2 + 0.85 + s * 1.7;
      const st = station(zone, index);
      st.position.set(x, 0, 0);
      if (side === -1) st.rotation.y = Math.PI;
      g.add(st);
      local.push({ x, z: side * 1.3, rotY: side === 1 ? Math.PI : 0, index });
      index++;
    }
  }
  return { group: g, local, len };
}

function signPlane(text: string, sub: string, w: number, h: number) {
  const tex = signTexture(text, sub);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35 }));
}

// sentarse en un puesto y abrir lo que toque; al cerrar, levantarse
function sitAndOpen(game: Game, seat: { x: number; z: number; rotY: number }, open: (onClose: () => void) => void) {
  game.player.sit(seat.x, seat.z, seat.rotY);
  open(() => {
    if (!game.hud.panelOpen) game.player.stand();
  });
}

export function createOffice(gameRef: () => Game, market: Market): Floor {
  const g = new THREE.Group();
  const colliders: Rect[] = [];
  const interactables: Interactable[] = [];
  const people: Character[] = [];

  // suelo de moqueta oscura, techo con paneles
  const carpet = carpetTexture();
  carpet.repeat.set(W, D);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: carpet, roughness: 1, color: '#8a93a8' }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mats.ceiling);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  g.add(ceiling);
  const panel = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff3dd', emissiveIntensity: 1.5 });
  for (let x = -10; x <= 10; x += 4) for (let z = -6; z <= 6; z += 3) g.add(box(1.4, 0.04, 0.35, panel, x, H - 0.02, z));

  // paredes; ventanales al sur (detrás de la cámara al entrar) y al oeste
  const wall = new THREE.MeshStandardMaterial({ color: '#d9cdb8', roughness: 0.9 });
  g.add(box(W, H, 0.2, wall, 0, H / 2, -D / 2 - 0.1));
  g.add(box(0.2, H, D, wall, W / 2 + 0.1, H / 2, 0));
  const sky = new THREE.MeshBasicMaterial({ map: sunsetTexture(), toneMapped: false });
  for (const [cx, cz, rot, len] of [[0, D / 2 + 0.6, Math.PI, W], [-W / 2 - 0.6, 0, Math.PI / 2, D]] as const) {
    const view = new THREE.Mesh(new THREE.PlaneGeometry(len, H), sky);
    view.position.set(cx, H / 2, cz);
    view.rotation.y = rot;
    g.add(view);
  }
  g.add(box(W, 0.8, 0.2, wall, 0, 0.4, D / 2 + 0.1));
  g.add(box(0.2, 0.8, D, wall, -W / 2 - 0.1, 0.4, 0));
  for (let x = -W / 2; x <= W / 2; x += 2) g.add(box(0.1, H, 0.12, mats.frame, x, H / 2, D / 2 + 0.05));
  for (let z = -D / 2; z <= D / 2; z += 2) g.add(box(0.12, H, 0.1, mats.frame, -W / 2 - 0.05, H / 2, z));
  g.add(box(W, H, 0.03, mats.glass, 0, H / 2, D / 2 + 0.12));

  // --- despachos del fondo (pared de cristal en z = BAND) ---
  const glassWall = (x0: number, x1: number, doorAt?: number) => {
    const segs: [number, number][] = doorAt !== undefined ? [[x0, doorAt - 0.6], [doorAt + 0.6, x1]] : [[x0, x1]];
    for (const [a, b] of segs) {
      g.add(box(b - a, H, 0.06, mats.glass, (a + b) / 2, H / 2, BAND));
      for (const y of [0.04, 1.05, H - 0.04]) g.add(box(b - a, 0.06, 0.08, mats.frame, (a + b) / 2, y, BAND));
      colliders.push(rect((a + b) / 2, BAND, b - a, 0.15));
    }
  };
  const glassSide = (x: number) => {
    g.add(box(0.06, H, -D / 2 - BAND, mats.glass, x, H / 2, (BAND - D / 2) / 2));
    g.add(box(0.08, H, 0.08, mats.frame, x, H / 2, BAND));
    colliders.push(rect(x, (BAND - D / 2) / 2, 0.15, -D / 2 - BAND));
  };
  // despacho del supervisor: x -12 .. -6.5
  glassWall(-W / 2, -6.5, -7.6);
  glassSide(-6.5);
  const boss = new THREE.Group();
  boss.add(box(2, 0.05, 0.9, mats.wood, 0, 0.75, 0), box(1.9, 0.7, 0.05, mats.wood, 0, 0.37, 0.4));
  boss.add(box(0.58, 0.36, 0.04, mats.plastic, 0, 1.1, -0.2, 0.01));
  const bossChair = chair();
  bossChair.scale.setScalar(1.2);
  bossChair.position.z = -0.9;
  bossChair.rotation.y = Math.PI;
  boss.add(bossChair);
  boss.position.set(-9.3, 0, -6.4);
  boss.rotation.y = Math.PI;
  g.add(boss);
  colliders.push(rect(-9.3, -6.4, 2.1, 1.0));
  g.add(box(2.2, 0.45, 0.8, new THREE.MeshStandardMaterial({ color: '#3b2a22' }), -11.2, 0.22, -5.4, 0.08)); // sofá
  colliders.push(rect(-11.2, -5.4, 1.0, 1.5));
  const ruiz = new Character({ ...operatorConfig(0, 'ventas'), name: 'Sr. Ruiz', hat: 'ninguno', face: 'serio', top: 'traje', topColor: '#1f2124', tie: 'granate', watch: 'rolex_oro', build: 'grande', hair: '#d8d8d8', facialHair: 'bigote' });
  ruiz.root.position.set(-9.3, 0, -7.25);
  ruiz.pose = 'brazos_cruzados';
  g.add(ruiz.root);
  people.push(ruiz);
  interactables.push({ label: 'Hablar con el Sr. Ruiz (comisiones)', x: -9.3, z: -5.5, radius: 1.3, run: () => bossPanel(gameRef()) });
  const bossSign = signPlane('SUPERVISOR', 'Sr. Ruiz', 1.2, 0.375);
  bossSign.position.set(-9.3, 2.65, BAND + 0.05);
  g.add(bossSign);

  // sala de reuniones: x -6.5 .. 0.5
  glassWall(-6.5, 0.5, -0.4);
  glassSide(0.5);
  const tableMat = new THREE.MeshStandardMaterial({ color: '#2a2320', roughness: 0.3 });
  g.add(box(4.2, 0.06, 1.4, tableMat, -3, 0.75, -6.3, 0.02));
  g.add(box(0.3, 0.72, 0.3, mats.plastic, -4.6, 0.36, -6.3), box(0.3, 0.72, 0.3, mats.plastic, -1.4, 0.36, -6.3));
  colliders.push(rect(-3, -6.3, 4.3, 1.5));
  const meetingSeats: { x: number; z: number; rotY: number }[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const x = -4.6 + i * 1.07;
      const c = chair();
      c.position.set(x, 0, -6.3 + side * 1.15);
      c.rotation.y = side === 1 ? 0 : Math.PI;
      g.add(c);
      meetingSeats.push({ x, z: -6.3 + side * 1.15, rotY: side === 1 ? Math.PI : 0 });
    }
  }
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshStandardMaterial({ map: whiteboardTexture() }));
  board.position.set(-3, 1.6, -D / 2 + 0.02);
  g.add(board);
  const meetSign = signPlane('SALA DE REUNIONES', 'para ti y tus colegas', 1.6, 0.5);
  meetSign.position.set(-3, 2.65, BAND + 0.05);
  g.add(meetSign);
  for (const s of meetingSeats) {
    interactables.push({ label: 'Sentarse en la reunión', x: s.x, z: s.z + (s.rotY === 0 ? -0.2 : 0.2), radius: 0.55, run: () => sitAndOpen(gameRef(), s, (done) => meetingPanel(gameRef(), done)) });
  }

  // cocina abierta: x 1 .. 6
  g.add(box(4.6, 0.9, 0.65, mats.white, 3.5, 0.45, -D / 2 + 0.33, 0.01));
  g.add(box(4.7, 0.04, 0.7, mats.wood, 3.5, 0.92, -D / 2 + 0.35));
  colliders.push(rect(3.5, -D / 2 + 0.35, 4.8, 0.8));
  const micro = new THREE.Group();
  micro.add(box(0.5, 0.28, 0.4, mats.white, 0, 0.14, 0, 0.02));
  micro.add(box(0.32, 0.2, 0.01, mats.plastic, -0.05, 0.14, 0.205));
  micro.position.set(2.2, 0.94, -D / 2 + 0.35);
  g.add(micro);
  const coffee = new THREE.Group();
  coffee.add(box(0.36, 0.45, 0.34, mats.plastic, 0, 0.225, 0, 0.03));
  coffee.add(cyl(0.05, 0.08, mats.white, 0, 0.1, 0.12));
  coffee.position.set(3.5, 0.94, -D / 2 + 0.35);
  g.add(coffee);
  g.add(box(0.8, 1.9, 0.7, mats.steel, 5.4, 0.95, -D / 2 + 0.4, 0.02)); // nevera
  g.add(box(1.6, 0.04, 0.9, mats.white, 3.5, 0.75, -5.8), cyl(0.06, 0.72, mats.steel, 3.5, 0.37, -5.8));
  colliders.push(rect(3.5, -5.8, 1.7, 1.0));
  interactables.push({ label: 'Microondas', x: 2.2, z: -D / 2 + 1.2, radius: 0.9, run: () => gameRef().use('microwave') });
  interactables.push({ label: 'Café de máquina (1 €)', x: 3.5, z: -D / 2 + 1.2, radius: 0.8, run: () => gameRef().use('coffee') });
  const kitchenSign = signPlane('COCINA', 'microondas · café · nevera', 1.4, 0.44);
  kitchenSign.position.set(3.5, 2.6, -D / 2 + 0.02);
  g.add(kitchenSign);

  // ticker LED colgado del techo sobre la zona de trading
  const ticker = tickerCanvas();
  const tickerMesh = new THREE.Mesh(new THREE.BoxGeometry(9, 0.42, 0.08), [mats.plastic, mats.plastic, mats.plastic, mats.plastic, new THREE.MeshBasicMaterial({ map: ticker.tex, toneMapped: false }), mats.plastic]);
  tickerMesh.position.set(1.8, 2.75, -3.6);
  g.add(tickerMesh);
  g.add(cyl(0.015, 0.25, mats.steel, -2, 3.05, -3.6), cyl(0.015, 0.25, mats.steel, 5.6, 3.05, -3.6));
  let tickerX = 0;

  // --- filas de mesas por zonas ---
  const seats: Seat[] = [];
  let npc = 0;
  const addRows = (zone: Zone, cx: number, perSide: number, zs: number[], occupy: (i: number) => Pose | null) => {
    zs.forEach((rz, r) => {
      const row = deskRow(zone, perSide, r * 20 + perSide);
      row.group.position.set(cx, 0, rz);
      g.add(row.group);
      colliders.push(rect(cx, rz, row.len + 0.1, 1.8));
      for (const s of row.local) {
        const world = { x: cx + s.x, z: rz + s.z, rotY: s.rotY, zone };
        const pose = occupy(s.index);
        if (pose && npc < 14) {
          const c = new Character(operatorConfig(npc++, zone));
          c.pose = pose;
          c.root.position.set(world.x, 0, world.z + (pose === 'sentado' ? 0 : (s.rotY === 0 ? -0.35 : 0.35)));
          c.root.rotation.y = s.rotY;
          g.add(c.root);
          people.push(c);
        } else {
          seats.push(world);
        }
      }
    });
  };
  addRows('ventas', -7.4, 4, [-2.3, 0.9, 4.1], (i) => (i % 3 === 0 ? 'sentado' : null));
  addRows('trading', 1.4, 3, [-1.4, 1.8], (i) => (i % 4 === 0 ? 'sentado' : i % 7 === 1 ? 'pose' : null));
  addRows('drop', 8.5, 2, [-1.4, 1.8], (i) => (i % 3 === 1 ? 'sentado' : null));
  for (const s of seats) {
    const label = s.zone === 'ventas' ? 'Mesa de ventas: CRM y llamadas' : s.zone === 'trading' ? 'Mesa de trading' : 'Mesa de dropshipping';
    interactables.push({
      label, x: s.x, z: s.z + (s.rotY === 0 ? -0.15 : 0.15), radius: 0.55,
      run: () => {
        const game = gameRef();
        sitAndOpen(game, s, (done) => {
          if (s.zone === 'ventas') salesPc(game, done);
          else if (s.zone === 'trading') tradingTerminal(game, market, done);
          else dropshipPc(game, done);
        });
      },
    });
  }
  // carteles de zona colgados
  for (const [text, sub, x] of [['VENTAS', 'automatizaciones con IA', -7.4], ['TRADING', 'cripto · oro · memecoins', 1.4], ['DROPSHIPPING', 'tiendas online', 8.5]] as const) {
    const s = signPlane(text, sub, 1.8, 0.56);
    s.position.set(x, 2.55, 6.4);
    s.rotation.y = Math.PI;
    g.add(s);
    const s2 = signPlane(text, sub, 1.8, 0.56);
    s2.position.set(x, 2.55, 6.42);
    g.add(s2);
  }
  // mesa de empaquetado en dropshipping
  g.add(box(2.6, 0.9, 0.9, mats.wood, 8.0, 0.45, 5.2, 0.01));
  for (let i = 0; i < 4; i++) g.add(box(0.35, 0.25, 0.3, new THREE.MeshStandardMaterial({ color: '#c49a6c' }), 7.0 + i * 0.6, 1.03, 5.2));
  colliders.push(rect(8.0, 5.2, 2.7, 1.0));

  // ascensor y cajero en la pared este
  const elevator = createElevator(gameRef, 1, W / 2, 5.6, 'west');
  g.add(elevator.group);
  colliders.push(...elevator.colliders);
  interactables.push(...elevator.interactables);
  const floorSign = signPlane('PLANTA 1', 'LOS NEGOCIOS', 1.4, 0.44);
  floorSign.rotation.y = -Math.PI / 2;
  floorSign.position.set(W / 2 - 0.03, 2.4, 7.35);
  g.add(floorSign);
  const atm = createAtm(gameRef, W / 2 - 0.3, 2.6, -Math.PI / 2);
  g.add(atm.group);
  colliders.push(atm.collider);
  interactables.push(atm.interactable);

  // reloj y plantas
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.25, 32), new THREE.MeshStandardMaterial({ map: clockTexture() }));
  clock.position.set(8.5, 2.5, -D / 2 + 0.02);
  g.add(clock);
  for (const [px, pz] of [[-11.4, 7.2], [-4.8, 7.2], [4.8, 7.2], [11.4, 7.2], [11.4, -7.2]] as const) {
    const p = plant(1.2);
    p.position.set(px, 0, pz);
    g.add(p);
    colliders.push(rect(px, pz, 0.45, 0.45));
  }

  // luces: sol de tarde por los ventanales y luz de oficina
  g.add(new THREE.HemisphereLight('#ffe6c7', '#4a4250', 0.85));
  const sun = new THREE.DirectionalLight('#ffbe7a', 3.2);
  sun.position.set(-14, 6, 12);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 50 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  g.add(sun, sun.target);
  for (const [lx, lz] of [[-8, 1], [0, 1], [8, 1], [-6, -6], [3, -6]] as const) {
    const p = new THREE.PointLight('#fff1dc', 8, 10, 1.4);
    p.position.set(lx, H - 0.3, lz);
    g.add(p);
  }

  return {
    level: 1,
    name: 'Planta 1 · Los Negocios',
    group: g,
    walkable: [rect(0, 0, W - 0.3, D - 0.3), elevator.walkable],
    bounds: rect(0.5, 0, W + 1, D),
    height: H,
    colliders,
    interactables,
    arrival: elevator.inside,
    dynamicColliders: elevator.doorCollider,
    onArrive: () => elevator.open(),
    update: (dt) => {
      for (const p of people) p.update(dt);
      elevator.update(dt);
      // ticker: precios en directo desplazándose
      const { ctx, canvas, tex } = ticker;
      tickerX = (tickerX + dt * 120) % canvas.width;
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '700 38px monospace';
      ctx.textBaseline = 'middle';
      let x = -tickerX;
      const items = market.assets.map((a) => {
        const prev = a.candles[a.candles.length - 20]?.c ?? a.price;
        const ch = ((a.price - prev) / prev) * 100;
        return { text: `${a.symbol} ${a.price >= 100 ? a.price.toFixed(0) : a.price.toFixed(4)} ${ch >= 0 ? '▲' : '▼'}${Math.abs(ch).toFixed(2)}%   `, up: ch >= 0 };
      });
      while (x < canvas.width) {
        for (const it of items) {
          ctx.fillStyle = it.up ? '#2ee86b' : '#ff4a4a';
          ctx.fillText(it.text, x, 34);
          x += ctx.measureText(it.text).width;
        }
      }
      tex.needsUpdate = true;
    },
  };
}

// sala de reuniones: de momento una pizarra compartida de notas
function meetingPanel(game: Game, onClose: () => void) {
  const { hud } = game;
  hud.openPanel('Sala de reuniones', (body) => {
    body.append(el('p', '', 'Aquí te sientas con tus colegas a planear el siguiente golpe: repartos, quién hace qué, objetivos de la semana.'));
    const notes = el('textarea', 'field chat-input') as HTMLTextAreaElement;
    try {
      notes.value = localStorage.getItem('brokerstars.notas') ?? '';
    } catch {
      // sin almacenamiento
    }
    notes.placeholder = 'Notas de la reunión (se guardan en tu navegador)';
    notes.oninput = () => {
      try {
        localStorage.setItem('brokerstars.notas', notes.value);
      } catch {
        // sin almacenamiento
      }
    };
    body.append(notes, el('p', 'muted', 'Con el multijugador, tus colegas verán estas notas y podréis repartir el dinero del equipo desde aquí.'), button('Levantarse', () => hud.closePanel(), 'btn ghost'));
  }, onClose);
}
