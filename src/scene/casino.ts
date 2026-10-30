import * as THREE from 'three';
import { PRESETS } from '../characters/catalog';
import { Character } from '../characters/Character';
import type { CharacterConfig } from '../characters/types';
import { baccaratPanel, barPanel, blackjackPanel, cashierPanel, crazyTimePanel, megaFireTerminalPanel, pokerPanel, slotsMenu, sportsbook, sportsbookPanel } from '../game/casino';
import { CASINO_NAME } from '../game/config';
import { button, el, euros } from '../game/hud';
import { rect, type Floor, type Game, type Interactable, type Rect } from '../game/world';
import { createAtm } from './atm';
import { createElevator } from './elevator';
import { signTexture } from './officeTextures';
import { box, cyl, glow, mats, wallWithGap } from './props';

// Planta 3 · Casino Royale: ruletas, blackjack, póker, tragaperras,
// apuestas deportivas con pantallas gigantes, bar, boutique de lujo, caja
// de fichas y sala VIP. 22 x 16 m.

const W = 22, D = 16, H = 3.8;

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { tex: t, canvas: c, ctx: c.getContext('2d')! };
}

// moqueta de casino con dibujo
function casinoCarpet() {
  const { tex } = canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = '#5a0f1a';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#c8a14a';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const x = i * 64 + 32, y = j * 64 + 32;
        ctx.beginPath();
        ctx.moveTo(x, y - 18); ctx.lineTo(x + 18, y); ctx.lineTo(x, y + 18); ctx.lineTo(x - 18, y); ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = '#2a0a12';
        ctx.beginPath();
        ctx.arc(x + 32, y + 32, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(W / 2, D / 2);
  return tex;
}

function signPlane(text: string, sub: string, w: number, h: number) {
  const tex = signTexture(text, sub);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.5 }));
}

const felt = new THREE.MeshStandardMaterial({ color: '#0f6b3a', roughness: 0.9 });
const gold = new THREE.MeshStandardMaterial({ color: '#d9b24a', metalness: 1, roughness: 0.25 });
const darkWood = new THREE.MeshStandardMaterial({ color: '#3a1f14', roughness: 0.4 });

function croupier(x: number, z: number, rotY: number, g: THREE.Group, list: Character[], i: number) {
  const c = new Character({ ...PRESETS[0], name: 'Crupier', hat: 'ninguno', glasses: 'ninguna', top: 'traje', topColor: '#1c1c1c', sleeveColor: '#f2f2f2', tie: 'negra', face: i % 2 ? 'feliz' : 'serio', skin: ['#f1c9a5', '#8d5a3b', '#d9a77e'][i % 3], hairStyle: i % 2 ? 'rapado' : 'degradado' });
  c.root.position.set(x, 0, z);
  c.root.rotation.y = rotY;
  g.add(c.root);
  list.push(c);
}

// Jugadores del casino: variados (orígenes y estilos distintos), sentados.
const GAMBLERS: Partial<(typeof PRESETS)[number]>[] = [
  { skin: '#f1c9a5', hair: '#111', hairStyle: 'rapado', top: 'traje', topColor: '#1c1c1c', tie: 'granate', face: 'serio', glasses: 'oscuras', watch: 'rolex_oro', chain: 'cubana', build: 'grande' },
  { skin: '#e8c9a0', hair: '#111', hairStyle: 'degradado', top: 'camiseta', topColor: '#7a1f1f', print: 'dolar', face: 'chulo', pants: 'pitillo', watch: 'digital' },
  { skin: '#8d5a3b', hair: '#111', hairStyle: 'trenzas', top: 'sudadera', topColor: '#1d2440', face: 'feliz', chain: 'colgante', glasses: 'oscuras' },
  { skin: '#d9a77e', hair: '#3b2414', hairStyle: 'rizos', top: 'manga_larga', topColor: '#5a3d6e', face: 'normal', facialHair: 'barba' },
  { skin: '#f1c9a5', hair: '#1a1a1a', hairStyle: 'rapado', top: 'traje', topColor: '#3d4045', tie: 'azul', face: 'concentrado', glasses: 'pasta' },
  { skin: '#5e3a26', hair: '#111', hairStyle: 'degradado', top: 'camiseta', topColor: '#f2f2f2', print: 'brokerstars', face: 'chulo', chain: 'oro' },
  { skin: '#b97f55', hair: '#111', hairStyle: 'pinchos', top: 'sudadera', topColor: '#111', face: 'normal', watch: 'rolex_plata' },
  { skin: '#e8c9a0', hair: '#111', hairStyle: 'rapado', top: 'camiseta_sobre_larga', topColor: '#1c1c1c', sleeveColor: '#f2f2f2', face: 'serio', facialHair: 'perilla' },
];
let gamblerIndex = 0;
function gambler(x: number, z: number, rotY: number, g: THREE.Group, list: Character[]) {
  const c = new Character({ ...PRESETS[0], name: 'Jugador', hat: 'ninguno', ...GAMBLERS[gamblerIndex++ % GAMBLERS.length] });
  c.pose = 'sentado';
  c.root.position.set(x, 0, z);
  c.root.rotation.y = rotY;
  g.add(c.root);
  list.push(c);
}

function cardTable(kind: 'blackjack' | 'poker') {
  const g = new THREE.Group();
  if (kind === 'blackjack') {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.1, 40, 1, false, -Math.PI / 2, Math.PI), darkWood);
    top.position.y = 0.85;
    top.castShadow = true;
    g.add(top);
    const f = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.02, 40, 1, false, -Math.PI / 2, Math.PI), felt);
    f.position.y = 0.91;
    g.add(f);
    g.add(box(2.3, 0.82, 0.2, darkWood, 0, 0.41, -0.05));
  } else {
    const top = cyl(1.15, 0.1, darkWood, 0, 0.82, 0, 40);
    top.scale.x = 1.5;
    g.add(top);
    const f = cyl(1.02, 0.02, felt, 0, 0.88, 0, 40);
    f.scale.x = 1.5;
    g.add(f);
    g.add(cyl(0.3, 0.8, darkWood, 0, 0.4, 0));
  }
  // fichas de colores encima
  for (let i = 0; i < 6; i++) {
    const stack = cyl(0.035, 0.02 + (i % 3) * 0.03, new THREE.MeshStandardMaterial({ color: ['#e74c3c', '#2980b9', '#f1c40f', '#27ae60', '#111', '#ecf0f1'][i] }), -0.4 + i * 0.16, 0.93, kind === 'poker' ? 0 : 0.3, 16);
    g.add(stack);
  }
  return g;
}

function slotMachine(i: number) {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: ['#7d2ae8', '#e8392a', '#1f8fe8', '#e8a21f'][i % 4], roughness: 0.4, metalness: 0.3 });
  g.add(box(0.7, 1.6, 0.6, body, 0, 0.8, 0, 0.05));
  const { tex } = canvasTex(128, 96, (ctx) => {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, 128, 96);
    ctx.font = '36px serif';
    ctx.fillText(['🍒🔔7️⃣', '💎💎💎', '⭐🍋🍉', '7️⃣7️⃣🍒'][i % 4], 6, 60);
  });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), glow(tex, 0.9));
  scr.position.set(0, 1.15, 0.305);
  g.add(scr);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 24, 1, false, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: '#ffe066', emissive: '#ffb300', emissiveIntensity: 1.2 }));
  top.rotation.z = Math.PI / 2;
  top.rotation.y = Math.PI / 2;
  top.position.set(0, 1.62, 0);
  g.add(top);
  const lever = cyl(0.02, 0.4, mats.steel, 0.4, 1.1, 0);
  g.add(lever, new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshStandardMaterial({ color: '#e74c3c' })).translateX(0.4).translateY(1.32));
  g.add(cyl(0.18, 0.5, darkWood, 0, 0.25, 0.75, 16)); // taburete
  return g;
}

// Stand de Crazy Time: rueda vertical gigante de colores sobre un pódium,
// con una tira de luces alrededor. Devuelve el grupo y la rueda (gira sola).
function crazyTimeStand() {
  const g = new THREE.Group();
  g.add(box(2.2, 0.5, 1.4, darkWood, 0, 0.25, 0, 0.05)); // pódium
  g.add(box(2.0, 0.04, 1.2, felt, 0, 0.5, 0));
  g.add(cyl(0.12, 2.4, mats.steel, 0, 1.2, -0.5)); // mástil
  const { tex } = canvasTex(256, 256, (ctx) => {
    const cols = ['#f2c94c', '#6fcf97', '#f2994a', '#eb5757', '#2d9cdb', '#9b51e0', '#219653', '#bb6bd9'];
    const n = 54;
    for (let i = 0; i < n; i++) {
      ctx.beginPath(); ctx.moveTo(128, 128);
      ctx.arc(128, 128, 126, (i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2);
      ctx.fillStyle = cols[i % cols.length]; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.stroke();
    }
    const gr = ctx.createRadialGradient(118, 118, 8, 128, 128, 36);
    gr.addColorStop(0, '#f6d365'); gr.addColorStop(1, '#8a5a12');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(128, 128, 36, 0, Math.PI * 2); ctx.fill();
  });
  const wheel = new THREE.Mesh(new THREE.CircleGeometry(1.0, 54), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, emissive: '#2a1a06', emissiveIntensity: 0.25 }));
  wheel.position.set(0, 2.0, -0.42);
  g.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.06, 10, 48), gold);
  rim.position.set(0, 2.0, -0.42);
  g.add(rim);
  // puntero arriba
  const ptr = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff', emissiveIntensity: 0.6 }));
  ptr.rotation.x = Math.PI;
  ptr.position.set(0, 3.05, -0.42);
  g.add(ptr);
  return { g, wheel };
}

// sentarse en un puesto y abrir la ventana; al cerrarla, levantarse
function sitAndOpen(game: Game, seat: { x: number; z: number; rotY: number }, open: (onClose: () => void) => void) {
  game.player.sit(seat.x, seat.z, seat.rotY);
  open(() => { if (!game.hud.panelOpen) game.player.stand(); });
}

// Terminal de ruleta MegaFire: ruleta central, pantalla grande en un mástil
// y varios puestos (taburetes con consola) alrededor para sentarse. Estilo
// terminal de casino físico (tipo ZUUM). Devuelve la rueda y la bola (giran
// solas), el canvas de la pantalla superior (atractor) y las poses de asiento.
function megaFireTerminal() {
  const g = new THREE.Group();
  // pódium redondo con tapa dorada
  g.add(cyl(1.5, 0.82, darkWood, 0, 0.41, 0, 40));
  g.add(cyl(1.52, 0.06, gold, 0, 0.85, 0, 40));
  // plato de la ruleta
  const { tex } = canvasTex(128, 128, (ctx) => {
    const n = 37;
    for (let i = 0; i < n; i++) {
      ctx.beginPath(); ctx.moveTo(64, 64);
      ctx.arc(64, 64, 62, (i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#0f8a4a' : i % 2 ? '#b3202a' : '#141414';
      ctx.fill();
    }
    const gr = ctx.createRadialGradient(58, 58, 6, 64, 64, 28);
    gr.addColorStop(0, '#f6d365'); gr.addColorStop(1, '#8a5a12');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(64, 64, 28, 0, Math.PI * 2); ctx.fill();
  });
  const wheel = new THREE.Mesh(new THREE.CircleGeometry(0.95, 37), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, emissive: '#301400', emissiveIntensity: 0.3 }));
  wheel.rotation.x = -Math.PI / 2;
  wheel.position.set(0, 0.89, 0);
  g.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.06, 10, 48), gold);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 0.9, 0);
  g.add(rim);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#777', emissiveIntensity: 0.4 }));
  ball.position.set(0.8, 0.95, 0);
  g.add(ball);
  // mástil con pantalla grande arriba (atractor: MEGAFIRE + jackpot + fuego)
  g.add(cyl(0.1, 2.5, mats.steel, 0, 2.1, -1.25));
  const screen = canvasTex(512, 256, () => undefined);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.25), new THREE.MeshBasicMaterial({ map: screen.tex, toneMapped: false }));
  scr.position.set(0, 3.15, -1.18);
  g.add(scr);
  g.add(box(2.7, 1.45, 0.1, mats.plastic, 0, 3.15, -1.26));
  // aro de luz naranja bajo la pantalla
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 8, 32), new THREE.MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff7a1a', emissiveIntensity: 1.4 }));
  halo.position.set(0, 2.35, -1.2);
  g.add(halo);
  // puestos alrededor del frente (arco sur), mirando a la pantalla
  const seats: { x: number; z: number; rotY: number }[] = [];
  const R = 2.0;
  for (const a of [-0.95, -0.47, 0, 0.47, 0.95]) {
    const sx = Math.sin(a) * R, sz = Math.cos(a) * R;
    g.add(cyl(0.22, 0.5, darkWood, sx, 0.25, sz, 16)); // taburete
    g.add(cyl(0.24, 0.05, gold, sx, 0.5, sz, 16));
    // pequeña consola inclinada con pantalla táctil
    const con = box(0.55, 0.34, 0.06, new THREE.MeshStandardMaterial({ color: '#0c0c0c', emissive: '#4a1e00', emissiveIntensity: 0.5 }), sx * 0.68, 0.92, sz * 0.68);
    con.lookAt(0, 0.92, 0);
    g.add(con);
    seats.push({ x: sx, z: sz, rotY: Math.atan2(-sx, -sz) });
  }
  return { g, wheel, ball, screen, seats };
}

function chandelier() {
  const g = new THREE.Group();
  const crystal = new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#ffd98a', emissiveIntensity: 1.6 });
  g.add(cyl(0.02, 0.5, gold, 0, -0.25, 0));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.04, 8, 32), gold);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.55;
  g.add(ring);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const drop = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 6), crystal);
    drop.rotation.x = Math.PI;
    drop.position.set(Math.cos(a) * 0.6, -0.72, Math.sin(a) * 0.6);
    g.add(drop);
  }
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), crystal).translateY(-0.6));
  return g;
}

// --- boutique de lujo: lo que compras se pone en el personaje ---
interface LuxuryItem { id: string; name: string; icon: string; price: number; apply: Partial<CharacterConfig> }
const LUXURY: LuxuryItem[] = [
  { id: 'rolex_oro', name: 'Rolex Day-Date oro', icon: '⌚', price: 25000, apply: { watch: 'rolex_oro' } },
  { id: 'rolex_plata', name: 'Rolex Submariner acero', icon: '⌚', price: 12000, apply: { watch: 'rolex_plata' } },
  { id: 'cubana', name: 'Cadena cubana de oro', icon: '⛓️', price: 9000, apply: { chain: 'cubana' } },
  { id: 'colgante', name: 'Cadena con colgante', icon: '📿', price: 5000, apply: { chain: 'colgante' } },
  { id: 'oro', name: 'Cadena fina de oro', icon: '✨', price: 2500, apply: { chain: 'oro' } },
  { id: 'gafas', name: 'Gafas de sol de diseño', icon: '🕶️', price: 450, apply: { glasses: 'oscuras' } },
  { id: 'traje_negro', name: 'Traje negro de diseño', icon: '🤵', price: 4200, apply: { top: 'traje', topColor: '#111111', tie: 'negra', pants: 'vestir', pantsColor: '#111111', shoes: 'zapatos', shoesColor: '#111111' } },
  { id: 'sudadera', name: 'Sudadera de marca «Broker Ape»', icon: '🧥', price: 900, apply: { top: 'sudadera', topColor: '#1c1c1c', print: 'mono' } },
  { id: 'zapas', name: 'Zapatillas blancas edición limitada', icon: '👟', price: 650, apply: { shoes: 'bajas', shoesColor: '#f2f2f2' } },
];

function wear(game: Game, apply: Partial<CharacterConfig>) {
  const config = { ...game.player.character.config, ...apply };
  game.player.character.setConfig(config);
  try {
    localStorage.setItem('brokerstars.character', JSON.stringify(config));
  } catch {
    // sin almacenamiento: dura hasta recargar
  }
}

function boutiquePanel(game: Game) {
  const { state, hud } = game;
  hud.openPanel('Boutique de lujo', (body) => {
    body.append(el('p', 'muted', `Pago con tarjeta · saldo ${euros(state.data.bank)}. Lo que compras te lo pones al momento.`));
    for (const it of LUXURY) {
      const owned = state.data.owned.includes(it.id);
      const row = el('div', 'item');
      row.append(el('span', 'icon', it.icon), el('span', '', it.name), el('span', 'muted', owned ? 'tuyo' : euros(it.price)));
      row.append(button(owned ? 'Ponérmelo' : 'Comprar', () => {
        if (!owned) {
          if (!state.hasCard || !state.payCard(it.price, `Boutique · ${it.name}`)) return hud.toast('Tarjeta rechazada: no te llega', 'bad');
          state.data.owned.push(it.id);
          state.persist();
          state.message('Boutique Royale', `Enhorabuena por tu ${it.name}. Te queda de lujo.`);
        }
        wear(game, it.apply);
        hud.toast(`${it.icon} Te has puesto ${it.name}`, 'ok');
        boutiquePanel(game);
      }, owned ? 'btn ghost small' : 'btn small'));
      body.append(row);
    }
  });
}

export function createCasino(gameRef: () => Game): Floor {
  const g = new THREE.Group();
  const colliders: Rect[] = [];
  const interactables: Interactable[] = [];
  const people: Character[] = [];
  const book = sportsbook;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: casinoCarpet(), roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: '#1a0c0c', emissive: '#120606' }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  g.add(ceiling);
  const wall = new THREE.MeshStandardMaterial({ color: '#3a0d14', roughness: 0.8 });
  g.add(box(W, H, 0.2, wall, 0, H / 2, -D / 2 - 0.1), box(W, H, 0.2, wall, 0, H / 2, D / 2 + 0.1));
  g.add(box(0.2, H, D, wall, -W / 2 - 0.1, H / 2, 0), wallWithGap('z', D, H, 0.2, wall, W / 2 + 0.1, -2.0, 2.0, 2.5));
  // molduras doradas
  for (const z of [-D / 2 + 0.01, D / 2 - 0.01]) g.add(box(W, 0.08, 0.04, gold, 0, 2.6, z));
  for (const x of [-W / 2 + 0.01, W / 2 - 0.01]) g.add(box(0.04, 0.08, D, gold, x, 2.6, 0));
  const title = signPlane(CASINO_NAME.toUpperCase(), 'Planta 3 · Torre Brokerstars', 3.6, 1.1);
  title.position.set(0, 3.0, -D / 2 + 0.03);
  g.add(title);
  for (const [x, z] of [[-6, -3], [0, -3], [6, -3], [-6, 3], [0, 3], [6, 3]] as const) {
    const c = chandelier();
    c.position.set(x, H, z);
    g.add(c);
  }

  // Terminal de ruleta MegaFire (sustituye a las ruletas sueltas): ruleta
  // central con pantalla grande y puestos para sentarse a jugar.
  const mfCenter = { x: -6.3, z: -3.0 };
  const mf = megaFireTerminal();
  mf.g.position.set(mfCenter.x, 0, mfCenter.z);
  g.add(mf.g);
  const wheels: THREE.Mesh[] = [mf.wheel];
  colliders.push(rect(mfCenter.x, mfCenter.z - 0.3, 3.2, 2.6));
  croupier(mfCenter.x, mfCenter.z - 1.7, 0, g, people, 0);
  const mfSeats = mf.seats.map((s) => ({ x: mfCenter.x + s.x, z: mfCenter.z + s.z, rotY: s.rotY }));
  // dos jugadores NPC sentados en los puestos de los extremos
  [mfSeats[0], mfSeats[4]].forEach((s) => gambler(s.x, s.z, s.rotY, g, people));
  // los tres puestos centrales son para sentarse a jugar
  [mfSeats[1], mfSeats[2], mfSeats[3]].forEach((s) => {
    interactables.push({
      label: 'Sentarse · Ruleta MegaFire', x: s.x, z: s.z + 0.5, radius: 1.0,
      run: () => sitAndOpen(gameRef(), s, (onClose) => megaFireTerminalPanel(gameRef(), onClose)),
    });
  });
  const mfSign = signPlane('MEGAFIRE', 'ruleta en fuego · bolas y bonus', 1.9, 0.58);
  mfSign.position.set(mfCenter.x, 3.98, mfCenter.z - 1.32);
  g.add(mfSign);
  // atractor de la pantalla superior
  let mfJackpot = 40000 + Math.floor(Math.random() * 90000);
  let mfFire: number[] = [];
  let mfAttract = 99;
  let mfBall = 0;
  const regenMfFire = () => {
    const s = new Set<number>();
    const count = 3 + Math.floor(Math.random() * 2);
    while (s.size < count) s.add(Math.floor(Math.random() * 37));
    mfFire = [...s].sort((a, b) => a - b);
  };
  const drawMf = () => {
    const { ctx, tex } = mf.screen;
    ctx.fillStyle = '#140603';
    ctx.fillRect(0, 0, 512, 256);
    const grad = ctx.createRadialGradient(256, 30, 10, 256, 60, 320);
    grad.addColorStop(0, 'rgba(255,120,30,.4)');
    grad.addColorStop(1, 'rgba(20,6,3,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb163';
    ctx.font = '800 40px sans-serif';
    ctx.fillText('🔥 MEGAFIRE', 256, 50);
    ctx.fillStyle = '#ffe0a8';
    ctx.font = '700 18px sans-serif';
    ctx.fillText('JACKPOT', 256, 82);
    ctx.fillStyle = '#ffd84a';
    ctx.font = '800 42px monospace';
    ctx.fillText(mfJackpot.toLocaleString('es-ES'), 256, 126);
    mfFire.forEach((num, i) => {
      const x = 256 + (i - (mfFire.length - 1) / 2) * 68;
      const g2 = ctx.createRadialGradient(x, 168, 4, x, 176, 26);
      g2.addColorStop(0, '#ff9a3c');
      g2.addColorStop(1, '#c43a06');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(x, 176, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '800 22px sans-serif';
      ctx.fillText(String(num), x, 184);
    });
    ctx.fillStyle = '#fff';
    ctx.font = '600 15px sans-serif';
    ctx.fillText('Siéntate en un puesto · ronda cada ~30 s', 256, 230);
    tex.needsUpdate = true;
  };
  // blackjack
  [[-1.5, -5.2], [1.6, -5.2]].forEach(([x, z], i) => {
    const t = cardTable('blackjack');
    t.position.set(x, 0, z);
    g.add(t);
    colliders.push(rect(x, z + 0.3, 2.4, 1.3));
    croupier(x, z - 0.5, 0, g, people, i + 2);
    gambler(x - 0.7, z + 0.9, Math.PI + 0.3, g, people);
    gambler(x + 0.7, z + 0.9, Math.PI - 0.3, g, people);
    interactables.push({ label: 'Blackjack', x, z: z + 1.5, radius: 1.1, run: () => blackjackPanel(gameRef()) });
  });
  // póker
  [[-1.5, -1.4], [2.0, -1.4]].forEach(([x, z], i) => {
    const t = cardTable('poker');
    t.position.set(x, 0, z);
    g.add(t);
    colliders.push(rect(x, z, 3.4, 2.3));
    croupier(x, z - 1.35, 0, g, people, i + 4);
    gambler(x - 1.1, z + 0.4, Math.PI + 0.5, g, people);
    gambler(x + 1.1, z + 0.4, Math.PI - 0.5, g, people);
    gambler(x, z + 1.5, Math.PI, g, people);
    interactables.push({ label: 'Mesa de póker', x, z: z + 1.6, radius: 1.2, run: () => pokerPanel(gameRef()) });
  });
  // Crazy Time: stand con rueda gigante en el centro-sur (zona de show)
  const ct = crazyTimeStand();
  ct.g.position.set(0, 0, 3.2);
  ct.g.rotation.y = Math.PI;
  g.add(ct.g);
  colliders.push(rect(0, 3.2, 2.3, 1.5));
  croupier(0, 2.3, 0, g, people, 1);
  interactables.push({ label: 'Crazy Time', x: 0, z: 1.8, radius: 1.5, run: () => crazyTimePanel(gameRef()) });
  const ctSign = signPlane('CRAZY TIME', 'rueda del dinero · bonus', 1.8, 0.56);
  ctSign.position.set(0, 3.5, 4.0);
  g.add(ctSign);
  // Speed Baccarat: mesa al oeste-sur
  const bacT = cardTable('blackjack');
  bacT.position.set(-6.0, 0, 3.0);
  g.add(bacT);
  colliders.push(rect(-6.0, 3.3, 2.4, 1.3));
  croupier(-6.0, 2.2, 0, g, people, 3);
  gambler(-6.7, 3.9, Math.PI + 0.3, g, people);
  gambler(-5.3, 3.9, Math.PI - 0.3, g, people);
  interactables.push({ label: 'Speed Baccarat', x: -6.0, z: 4.3, radius: 1.2, run: () => baccaratPanel(gameRef()) });
  const bacSign = signPlane('BACCARAT', 'punto y banca en directo', 1.6, 0.5);
  bacSign.position.set(-6.0, 3.4, 1.9);
  g.add(bacSign);

  // fila de tragaperras en la pared oeste
  for (let i = 0; i < 8; i++) {
    const s = slotMachine(i);
    const z = -6.6 + i * 1.0;
    s.position.set(-W / 2 + 0.4, 0, z);
    s.rotation.y = Math.PI / 2;
    g.add(s);
  }
  colliders.push(rect(-W / 2 + 0.4, -3.1, 0.8, 8));
  for (let i = 0; i < 8; i += 2) interactables.push({ label: 'Tragaperras', x: -W / 2 + 1.6, z: -6.1 + i * 1.0, radius: 0.9, run: () => slotsMenu(gameRef()) });

  // apuestas deportivas: pantallas gigantes en la pared norte, lado este
  const screen = canvasTex(1024, 512, () => undefined);
  const bigScreen = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.8), new THREE.MeshBasicMaterial({ map: screen.tex, toneMapped: false }));
  bigScreen.position.set(7.2, 2.2, -D / 2 + 0.07);
  g.add(bigScreen);
  g.add(box(5.8, 3.0, 0.08, mats.plastic, 7.2, 2.2, -D / 2 + 0.01));
  for (let i = 0; i < 3; i++) {
    g.add(box(1.4, 0.75, 0.6, darkWood, 5.2 + i * 2, 0.375, -4.6, 0.03));
    colliders.push(rect(5.2 + i * 2, -4.6, 1.5, 0.7));
  }
  interactables.push({ label: 'Apuestas deportivas', x: 7.2, z: -3.6, radius: 1.8, run: () => sportsbookPanel(gameRef(), book) });
  const bookSign = signPlane('APUESTAS', 'partidos reales en directo', 1.8, 0.56);
  bookSign.position.set(7.2, 3.6 - 0.05, -D / 2 + 0.05);
  g.add(bookSign);
  const drawScreen = () => {
    const { ctx, tex } = screen;
    const m = book.match;
    const [h, a] = book.score();
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#0c3d1e');
    grad.addColorStop(1, '#062210');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 150, 944, 320);
    ctx.beginPath();
    ctx.moveTo(512, 150); ctx.lineTo(512, 470);
    ctx.arc(512, 310, 60, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '600 30px sans-serif';
    ctx.fillText(m.comp, 512, 50);
    ctx.font = '800 54px sans-serif';
    ctx.fillText(`${m.home}  ${h} - ${a}  ${m.away}`, 512, 118);
    ctx.fillStyle = '#f2c14e';
    ctx.font = '800 44px monospace';
    ctx.fillText(`${book.minute}'`, 512, 300);
    // balón moviéndose por el campo
    const t = performance.now() / 1000;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(512 + Math.sin(t * 0.9) * 380, 310 + Math.cos(t * 1.3) * 120, 10, 0, Math.PI * 2);
    ctx.fill();
    const last = m.goals.filter((gl) => gl.min <= book.minute).slice(-1)[0];
    if (last) {
      ctx.font = '700 32px sans-serif';
      ctx.fillText(`⚽ ${last.min}' ${last.who}`, 512, 440);
    }
    tex.needsUpdate = true;
  };

  // bar en la pared sur
  g.add(box(6, 1.1, 0.8, darkWood, -2, 0.55, D / 2 - 1.2, 0.03));
  g.add(box(6.1, 0.05, 0.9, gold, -2, 1.12, D / 2 - 1.2));
  g.add(box(6, 1.8, 0.3, darkWood, -2, 1.6, D / 2 - 0.15));
  for (let i = 0; i < 16; i++) {
    const bottle = cyl(0.04, 0.3, new THREE.MeshStandardMaterial({ color: ['#2e7d32', '#8d6e63', '#fbc02d', '#1565c0', '#c62828'][i % 5], transparent: true, opacity: 0.85, roughness: 0.1 }), -4.6 + i * 0.35, 1.95, D / 2 - 0.2);
    g.add(bottle);
  }
  colliders.push(rect(-2, D / 2 - 1.2, 6.2, 1.0));
  const bartender = new Character({ ...PRESETS[0], name: 'Barman', hat: 'ninguno', glasses: 'ninguna', top: 'manga_larga', topColor: '#f2f2f2', face: 'feliz', facialHair: 'barba', skin: '#b97f55' });
  bartender.root.position.set(-2, 0, D / 2 - 0.55);
  bartender.root.rotation.y = Math.PI;
  g.add(bartender.root);
  people.push(bartender);
  interactables.push({ label: 'Bar', x: -2, z: D / 2 - 2.1, radius: 1.6, run: () => barPanel(gameRef()) });
  const barSign = signPlane('BAR', 'cócteles · champán', 1.2, 0.38);
  barSign.position.set(-2, 3.0, D / 2 - 0.03);
  barSign.rotation.y = Math.PI;
  g.add(barSign);

  // caja de fichas
  g.add(box(3, 1.2, 0.8, darkWood, 4.5, 0.6, D / 2 - 1.0, 0.03));
  for (let i = 0; i < 4; i++) g.add(box(0.04, 1.4, 0.04, gold, 3.1 + i * 0.93, 1.9, D / 2 - 1.0));
  colliders.push(rect(4.5, D / 2 - 1.0, 3.1, 1.0));
  croupier(4.5, D / 2 - 0.4, Math.PI, g, people, 6);
  interactables.push({ label: 'Caja: comprar y cambiar fichas', x: 4.5, z: D / 2 - 2.0, radius: 1.3, run: () => cashierPanel(gameRef()) });
  const cashSign = signPlane('CAJA', 'fichas · cambio', 1.2, 0.38);
  cashSign.position.set(4.5, 3.0, D / 2 - 0.03);
  cashSign.rotation.y = Math.PI;
  g.add(cashSign);

  // boutique de lujo en la esquina sureste (vitrinas con relojes)
  const glassCase = new THREE.MeshPhysicalMaterial({ color: '#e8f4ff', transmission: 0.8, transparent: true, opacity: 0.35, roughness: 0.05 });
  for (let i = 0; i < 3; i++) {
    const x = 7.6 + i * 1.2;
    g.add(box(1, 0.9, 0.6, darkWood, x, 0.45, 3.0), box(1, 0.4, 0.6, glassCase, x, 1.1, 3.0));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 20), gold).translateX(x).translateY(1.0).translateZ(3.0));
  }
  colliders.push(rect(8.8, 3.0, 3.7, 0.7));
  interactables.push({ label: 'Boutique de lujo: relojes, cadenas y ropa', x: 8.8, z: 4.0, radius: 1.4, run: () => boutiquePanel(gameRef()) });
  const shopSign = signPlane('BOUTIQUE', 'relojes · joyas · moda', 1.6, 0.5);
  shopSign.position.set(W / 2 - 0.03, 2.9, 3.0);
  shopSign.rotation.y = -Math.PI / 2;
  g.add(shopSign);

  // sala VIP acordonada (necesita estatus: haber gastado en la boutique)
  const vipRope = new THREE.MeshStandardMaterial({ color: '#8a0f1f', roughness: 0.6 });
  for (let i = 0; i < 5; i++) g.add(cyl(0.05, 1, gold, 6.2 + i * 1.2, 0.5, 6.0));
  g.add(box(4.8, 0.05, 0.05, vipRope, 8.6, 0.85, 6.0));
  g.add(box(2.4, 0.45, 0.9, new THREE.MeshStandardMaterial({ color: '#1a1a1a' }), 8.6, 0.22, 7.2, 0.08));
  colliders.push(rect(8.6, 6.0, 5.0, 0.2));
  interactables.push({
    label: 'Sala VIP High Roller', x: 8.6, z: 5.2, radius: 1.3,
    run: () => {
      const game = gameRef();
      if (game.state.data.owned.length < 2) return game.hud.toast('🔒 Sala VIP: solo para clientes con estatus (compra en la boutique)', 'bad');
      game.hud.toast('🍾 Bienvenido a la sala VIP. Las mesas de alto riesgo llegan pronto.', 'ok');
    },
  });

  // ascensor y cajero
  const elevator = createElevator(gameRef, 3, W / 2, -2.0, 'west');
  g.add(elevator.group);
  colliders.push(...elevator.colliders);
  interactables.push(...elevator.interactables);
  const atm = createAtm(gameRef, W / 2 - 0.3, -5.2, -Math.PI / 2);
  g.add(atm.group);
  colliders.push(atm.collider);
  interactables.push(atm.interactable);

  // luces cálidas y doradas
  g.add(new THREE.HemisphereLight('#ffd9a8', '#2a0a10', 0.6));
  for (const [x, z] of [[-6, -3], [0, -3], [6, -3], [-6, 3], [0, 3], [6, 3]] as const) {
    const p = new THREE.PointLight('#ffd08a', 9, 9, 1.4);
    p.position.set(x, H - 0.9, z);
    g.add(p);
  }
  const key = new THREE.DirectionalLight('#ffe2b8', 0.8);
  key.position.set(4, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -14, right: 14, top: 10, bottom: -10, near: 1, far: 40 });
  g.add(key, key.target);

  let screenTimer = 0;
  return {
    level: 3,
    name: `Planta 3 · ${CASINO_NAME}`,
    group: g,
    walkable: [rect(0, 0, W - 0.3, D - 0.3), elevator.walkable],
    bounds: rect(0.5, 0, W + 1, D),
    height: H,
    colliders,
    interactables,
    arrival: elevator.inside,
    dynamicColliders: elevator.doorCollider,
    onArrive: (from) => elevator.arrive(from),
    update: (dt) => {
      for (const p of people) p.update(dt);
      elevator.update(dt);
      for (const w of wheels) w.rotation.z += dt * 1.5;
      ct.wheel.rotation.z += dt * 0.5;
      // bola de la ruleta MegaFire orbitando sobre el plato
      mfBall += dt * 2.2;
      mf.ball.position.set(Math.cos(mfBall) * 0.8, 0.95, Math.sin(mfBall) * 0.8);
      // atractor de la pantalla: números en fuego rotando y jackpot subiendo
      mfAttract += dt;
      if (mfAttract > 3) {
        mfAttract = 0;
        regenMfFire();
        mfJackpot += 200 + Math.floor(Math.random() * 600);
      }
      screenTimer += dt;
      if (screenTimer > 0.1) {
        screenTimer = 0;
        drawScreen();
        drawMf();
      }
    },
  };
}
