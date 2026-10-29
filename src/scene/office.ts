import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLORS, PRESETS } from '../characters/catalog';
import { Character } from '../characters/Character';
import type { CharacterConfig } from '../characters/types';
import {
  carpetTexture,
  clockTexture,
  keyboardTexture,
  screenTexture,
  signTexture,
  stickyTexture,
  sunsetTexture,
  whiteboardTexture,
} from './officeTextures';

// Planta 1 de Brokerstars: el call center donde empieza el jugador.
// Sala de 18 x 12 m: dos bloques de puestos con mamparas azules, ventanas
// al fondo con el sol de la tarde, pizarra a la izquierda, despacho del
// supervisor y ascensor a la derecha. El suelo es y=0 y la sala está
// centrada en el origen.

export const ROOM = { w: 18, d: 12, h: 3 };

const mats = {
  wall: new THREE.MeshStandardMaterial({ color: '#d8c3a0', roughness: 0.9 }),
  ceiling: new THREE.MeshStandardMaterial({ color: '#e9e4da', roughness: 1, emissive: '#2a2620' }),
  deskTop: new THREE.MeshStandardMaterial({ color: '#eeeae2', roughness: 0.5 }),
  deskLeg: new THREE.MeshStandardMaterial({ color: '#9aa0a8', roughness: 0.4, metalness: 0.6 }),
  partition: new THREE.MeshStandardMaterial({ color: '#2f4f9a', roughness: 1 }),
  frame: new THREE.MeshStandardMaterial({ color: '#c9ccd1', roughness: 0.35, metalness: 0.7 }),
  plastic: new THREE.MeshStandardMaterial({ color: '#2a2c31', roughness: 0.6 }),
  beige: new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.6 }),
  chair: new THREE.MeshStandardMaterial({ color: '#e6e6e6', roughness: 0.55 }),
  wood: new THREE.MeshStandardMaterial({ color: '#7a4f2e', roughness: 0.6 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#3f7d3a', roughness: 0.8 }),
  pot: new THREE.MeshStandardMaterial({ color: '#b8653a', roughness: 0.8 }),
  glass: new THREE.MeshPhysicalMaterial({ color: '#cfe3ef', transmission: 0.9, transparent: true, opacity: 0.25, roughness: 0.05 }),
  steel: new THREE.MeshStandardMaterial({ color: '#b9bec6', roughness: 0.25, metalness: 0.9 }),
  white: new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.4 }),
};

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, r = 0) {
  const geo = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.99) : new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(r: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Material que brilla con su propia textura (pantallas, ventanas).
function glow(map: THREE.Texture, intensity = 1) {
  return new THREE.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: intensity, roughness: 0.3 });
}

function chair() {
  const g = new THREE.Group();
  g.add(box(0.5, 0.08, 0.48, mats.chair, 0, 0.46, 0, 0.03));
  g.add(box(0.48, 0.55, 0.06, mats.chair, 0, 0.82, 0.24, 0.03));
  g.add(cyl(0.025, 0.38, mats.plastic, 0, 0.25, 0));
  for (let i = 0; i < 5; i++) {
    const leg = box(0.3, 0.03, 0.05, mats.plastic, 0, 0.06, 0);
    leg.rotation.y = (i / 5) * Math.PI * 2;
    leg.translateX(0.14);
    g.add(leg);
  }
  return g;
}

function plant(scale = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.18 * scale, 0.35 * scale, mats.pot, 0, 0.175 * scale, 0));
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16 * scale, 10, 8), mats.leaf);
    const a = i * 2.4;
    leaf.position.set(Math.cos(a) * 0.1 * scale, (0.5 + (i % 3) * 0.14) * scale, Math.sin(a) * 0.1 * scale);
    leaf.scale.set(1, 1.5, 0.6);
    leaf.rotation.y = a;
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

// Un puesto de trabajo mirando hacia -Z local: la mesa va de z=0 (mampara)
// a z=0.8 (borde) y la silla queda en z≈1.25.
function workstation(index: number) {
  const g = new THREE.Group();
  // monitor
  g.add(box(0.22, 0.02, 0.16, mats.plastic, 0, 0.76, 0.2));
  g.add(box(0.04, 0.25, 0.04, mats.plastic, 0, 0.88, 0.17));
  g.add(box(0.58, 0.36, 0.04, mats.plastic, 0, 1.08, 0.2, 0.01));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.32), glow(screenTexture(index), 0.9));
  screen.position.set(0, 1.08, 0.221);
  g.add(screen);
  // teclado y ratón
  g.add(box(0.46, 0.02, 0.16, mats.beige, 0, 0.76, 0.55, 0.008));
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.14), new THREE.MeshStandardMaterial({ map: keyboardTexture(), roughness: 0.6 }));
  keys.rotation.x = -Math.PI / 2;
  keys.position.set(0, 0.771, 0.55);
  g.add(keys);
  g.add(box(0.06, 0.03, 0.1, mats.plastic, 0.34, 0.765, 0.56, 0.015));
  // teléfono de mesa
  g.add(box(0.2, 0.06, 0.18, mats.beige, -0.62, 0.78, 0.4, 0.015));
  const handset = box(0.05, 0.04, 0.2, mats.beige, -0.66, 0.83, 0.4, 0.018);
  g.add(handset);
  // botella o taza
  if (index % 2) g.add(cyl(0.04, 0.24, mats.white, 0.62, 0.87, 0.28));
  else g.add(cyl(0.045, 0.1, new THREE.MeshStandardMaterial({ color: ['#c0392b', '#2e6f9e', '#f2c14e'][index % 3] }), 0.6, 0.8, 0.45));
  // post-it en la mampara
  if (index % 3 === 0) {
    const note = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), new THREE.MeshStandardMaterial({ map: stickyTexture(['¡VENDE!', 'NO\nDORMIR', '200\nLLAMADAS'][index % 3 === 0 ? (index / 3) % 3 : 0]) }));
    note.position.set(0.42, 1.12, 0.032);
    g.add(note);
  }
  const c = chair();
  c.position.z = 1.3;
  c.rotation.y = 0.15 * ((index % 3) - 1);
  g.add(c);
  return g;
}

function randomOperator(i: number): CharacterConfig {
  const base = PRESETS[0];
  const suit = i % 3 !== 2;
  return {
    ...base,
    name: `Operador ${i + 1}`,
    skin: COLORS.skin[(i * 7) % COLORS.skin.length],
    hair: COLORS.hair[(i * 3) % 4],
    hairStyle: (['degradado', 'rapado', 'rizos', 'degradado', 'trenzas'] as const)[i % 5],
    face: (['concentrado', 'normal', 'concentrado', 'feliz', 'serio'] as const)[i % 5],
    facialHair: i % 4 === 1 ? 'barba' : 'nada',
    glasses: i % 3 === 0 ? 'pasta' : 'ninguna',
    hatColor: ['#3d4045', '#1c1c1c', '#e6e6e6'][i % 3],
    top: suit ? 'traje' : 'manga_larga',
    topColor: suit ? ['#5f6368', '#3d4045', '#1d2440'][i % 3] : ['#f2f2f2', '#2e6f9e', '#c9b48c'][i % 3],
    pantsColor: ['#3d4045', '#1f2124', '#5f6368'][i % 3],
  };
}

// Bloque de puestos enfrentados con una mampara azul en medio.
function deskBlock(seats: number, operators: Character[], startIndex: number, occupied: (i: number) => boolean) {
  const g = new THREE.Group();
  const len = seats * 1.8;
  // mampara central con marco de aluminio
  g.add(box(len, 1.25, 0.05, mats.partition, 0, 0.625, 0));
  g.add(box(len + 0.04, 0.04, 0.08, mats.frame, 0, 1.27, 0));
  let index = startIndex;
  for (const side of [1, -1]) {
    // tablero y patas
    g.add(box(len, 0.04, 0.8, mats.deskTop, 0, 0.73, side * 0.42));
    for (let s = 0; s <= seats; s++) g.add(box(0.05, 0.71, 0.7, mats.deskLeg, -len / 2 + s * 1.8, 0.355, side * 0.42));
    for (let s = 0; s < seats; s++) {
      const x = -len / 2 + 0.9 + s * 1.8;
      const ws = workstation(index);
      ws.position.set(x, 0, 0);
      if (side === -1) ws.rotation.y = Math.PI;
      g.add(ws);
      // separador bajo entre puestos
      if (s > 0) {
        const div = box(0.04, 0.5, 0.78, mats.partition, -len / 2 + s * 1.8, 1.0, side * 0.41);
        g.add(div);
      }
      if (occupied(index)) {
        const op = new Character(randomOperator(index));
        op.pose = 'sentado';
        op.root.position.set(x, 0, side * 1.25);
        op.root.rotation.y = side === 1 ? Math.PI : 0;
        g.add(op.root);
        operators.push(op);
      }
      index++;
    }
  }
  return g;
}

export function createOffice(scene: THREE.Scene) {
  const { w, d, h } = ROOM;
  const operators: Character[] = [];
  const office = new THREE.Group();
  scene.add(office);

  // suelo y techo
  const carpet = carpetTexture();
  carpet.repeat.set(w, d);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: carpet, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  office.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mats.ceiling);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = h;
  office.add(ceiling);
  // paneles de luz del techo
  const panel = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff3dd', emissiveIntensity: 1.6 });
  for (let x = -6; x <= 6; x += 4) {
    for (let z = -3.5; z <= 3.5; z += 3.5) office.add(box(1.4, 0.04, 0.35, panel, x, h - 0.02, z));
  }

  // paredes laterales y delantera
  office.add(box(0.2, h, d, mats.wall, -w / 2 - 0.1, h / 2, 0));
  office.add(box(0.2, h, d, mats.wall, w / 2 + 0.1, h / 2, 0));
  office.add(box(w, h, 0.2, mats.wall, 0, h / 2, d / 2 + 0.1));
  // zócalo
  for (const [x, z, sw, sd] of [[-w / 2, 0, 0.02, d], [w / 2, 0, 0.02, d], [0, d / 2, w, 0.02]] as const) office.add(box(sw || 0.02, 0.1, sd || 0.02, mats.plastic, x, 0.05, z));

  // pared del fondo con ventanales, persianas y la ciudad al atardecer
  const zb = -d / 2 - 0.1;
  const winW = 2.6, winGap = 0.9, sill = 0.9, top = 2.4;
  office.add(box(w, sill, 0.2, mats.wall, 0, sill / 2, zb));
  office.add(box(w, h - top, 0.2, mats.wall, 0, (h + top) / 2, zb));
  const sky = new THREE.MeshBasicMaterial({ map: sunsetTexture(), toneMapped: false });
  const slat = new THREE.MeshStandardMaterial({ color: '#e8d9bd', roughness: 0.7 });
  let x = -w / 2;
  const windows: number[] = [];
  while (x < w / 2) {
    const pillar = Math.min(winGap, w / 2 - x);
    office.add(box(pillar, top - sill, 0.2, mats.wall, x + pillar / 2, (sill + top) / 2, zb));
    x += pillar;
    if (x + winW > w / 2) break;
    windows.push(x + winW / 2);
    x += winW;
  }
  for (const cx of windows) {
    const view = new THREE.Mesh(new THREE.PlaneGeometry(winW, top - sill), sky);
    view.position.set(cx, (sill + top) / 2, zb - 0.3);
    office.add(view);
    office.add(box(winW, 0.05, 0.25, mats.frame, cx, sill, zb + 0.02));
    // persiana a medio bajar: las lamas dejan pasar el sol en franjas
    for (let y = top - 0.04; y > 1.55; y -= 0.075) {
      const s = box(winW - 0.04, 0.012, 0.06, slat, cx, y, zb + 0.15);
      s.rotation.x = 0.55;
      office.add(s);
    }
  }

  // bloques de puestos
  const blockA = deskBlock(4, operators, 0, (i) => i % 4 !== 3);
  blockA.position.set(-2, 0, -2.6);
  office.add(blockA);
  const blockB = deskBlock(4, operators, 8, (i) => i % 3 !== 1);
  blockB.position.set(-2, 0, 1.3);
  office.add(blockB);

  // pared izquierda: pizarra, reloj, fuente de agua y plantas
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.375), new THREE.MeshStandardMaterial({ map: whiteboardTexture(), roughness: 0.4 }));
  board.rotation.y = Math.PI / 2;
  board.position.set(-w / 2 + 0.035, 1.6, -1.5);
  office.add(board);
  office.add(box(0.04, 1.45, 2.28, mats.frame, -w / 2 + 0.01, 1.6, -1.5));
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.22, 32), new THREE.MeshStandardMaterial({ map: clockTexture() }));
  clock.rotation.y = Math.PI / 2;
  clock.position.set(-w / 2 + 0.03, 2.55, 1.2);
  office.add(clock);
  const cooler = new THREE.Group();
  cooler.add(box(0.35, 1.0, 0.35, mats.white, 0, 0.5, 0, 0.03));
  cooler.add(cyl(0.15, 0.4, new THREE.MeshPhysicalMaterial({ color: '#7fb8e6', transmission: 0.6, transparent: true, opacity: 0.7, roughness: 0.1 }), 0, 1.2, 0));
  cooler.position.set(-w / 2 + 0.4, 0, 2.8);
  office.add(cooler);
  for (const [px, pz, sc] of [[-w / 2 + 0.5, -5.3, 1.3], [-w / 2 + 0.5, 4.8, 1.1], [w / 2 - 0.6, 5.2, 1.2], [3.6, -5.3, 1]] as const) {
    const p = plant(sc);
    p.position.set(px, 0, pz);
    office.add(p);
  }

  // despacho del supervisor: esquina de cristal al fondo a la derecha
  const ox = 5.2;
  const oz = -2.2;
  office.add(box(0.06, h, oz + d / 2, mats.glass, ox, h / 2, (oz - d / 2) / 2));
  // el hueco de 1,1 m junto a la pared derecha es la puerta
  office.add(box(w / 2 - 1.1 - ox, h, 0.06, mats.glass, (ox + w / 2 - 1.1) / 2, h / 2, oz));
  office.add(box(0.08, h, 0.08, mats.frame, ox, h / 2, oz));
  // perfiles de aluminio arriba y abajo para que se lea el cristal
  for (const y of [0.04, 1.05, h - 0.04]) {
    office.add(box(0.07, 0.06, oz + d / 2, mats.frame, ox, y, (oz - d / 2) / 2));
    office.add(box(w / 2 - 1.1 - ox, 0.06, 0.07, mats.frame, (ox + w / 2 - 1.1) / 2, y, oz));
  }
  const boss = new THREE.Group();
  boss.add(box(1.8, 0.05, 0.85, mats.wood, 0, 0.75, 0));
  boss.add(box(1.7, 0.7, 0.05, mats.wood, 0, 0.37, -0.38));
  boss.add(box(0.58, 0.36, 0.04, mats.plastic, 0, 1.1, -0.2, 0.01));
  const bossScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.32), glow(screenTexture(2), 0.9));
  bossScreen.position.set(0, 1.1, -0.178);
  boss.add(bossScreen);
  const bossChair = chair();
  bossChair.scale.setScalar(1.15);
  bossChair.position.z = -0.95;
  bossChair.rotation.y = Math.PI;
  boss.add(bossChair);
  boss.position.set(7.1, 0, -4.4);
  boss.rotation.y = Math.PI;
  office.add(boss);
  const bossSign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.375), new THREE.MeshStandardMaterial({ map: signTexture('SUPERVISOR', 'Sr. Ruiz'), roughness: 0.4 }));
  bossSign.position.set((ox + w / 2) / 2 + 0.5, 2.55, oz + 0.04);
  office.add(bossSign);

  // ascensor en la pared derecha: para subir de planta
  const ez = 3.2;
  office.add(box(0.08, 2.3, 1.7, mats.steel, w / 2 - 0.04, 1.15, ez));
  office.add(box(0.1, 2.3, 0.03, mats.plastic, w / 2 - 0.06, 1.15, ez));
  office.add(box(0.12, 2.4, 1.85, mats.frame, w / 2 - 0.02, 1.2, ez).translateX(0.04));
  const floorSign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshStandardMaterial({ map: signTexture('PLANTA 1', 'OPERADORES · BROKERSTARS'), emissive: '#ffffff', emissiveIntensity: 0.25, emissiveMap: signTexture('PLANTA 1', 'OPERADORES · BROKERSTARS') }));
  floorSign.rotation.y = -Math.PI / 2;
  floorSign.position.set(w / 2 - 0.02, 2.65, ez);
  office.add(floorSign);
  office.add(box(0.04, 0.3, 0.12, mats.steel, w / 2 - 0.03, 1.2, ez - 1.15));
  office.add(cyl(0.025, 0.02, new THREE.MeshStandardMaterial({ color: '#f2c14e', emissive: '#f2c14e', emissiveIntensity: 1.5 }), w / 2 - 0.06, 1.25, ez - 1.15).rotateZ(Math.PI / 2));

  // luces: sol de tarde entrando por las ventanas, relleno cálido y techo
  scene.add(new THREE.HemisphereLight('#ffe6c7', '#4a4250', 0.9));
  const sun = new THREE.DirectionalLight('#ffbe7a', 4.5);
  sun.position.set(-5, 5.5, -16);
  sun.target.position.set(1, 0, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -12; sc.right = 12; sc.top = 10; sc.bottom = -10; sc.near = 1; sc.far = 40;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  for (let lx = -6; lx <= 6; lx += 6) {
    const p = new THREE.PointLight('#fff1dc', 10, 10, 1.4);
    p.position.set(lx, h - 0.3, 0);
    scene.add(p);
  }

  return { office, operators };
}
