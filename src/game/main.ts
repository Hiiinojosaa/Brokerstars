import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { createCasino } from '../scene/casino';
import { createGrayFloor } from '../scene/gray';
import { createLobby } from '../scene/lobby';
import { createOffice } from '../scene/office';
import { loadSaved } from '../ui/creator';
import { sportsbook } from './casino';
import { bankApp, casinoApp, chatApp, messagesApp, newsApp, settingsApp, walletApp } from './apps';
import { storeApp, storeTick } from './dropship';
import { Hud, button, el, euros } from './hud';
import { Input } from './input';
import { Market } from './market';
import { Phone } from './phone';
import { Player } from './player';
import { scamTick } from './scam';
import { EFFECTS, GameState, ITEMS, RECIPES } from './state';
import type { Floor, Game, Interactable } from './world';
import './game.css';

// Demo de la Torre Brokerstars: cuatro plantas con ascensor, banco,
// súper, negocios, Planta Gris y casino, con el móvil del jugador.

const container = document.getElementById('game')!;
const ui = document.getElementById('ui')!;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a1a22');
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 80);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.5, 0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const resize = () => {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
};
window.addEventListener('resize', resize);
resize();

const state = new GameState();
const hud = new Hud(ui, state);
const phone = new Phone(ui, state);
const input = new Input(renderer.domElement, ui);
const player = new Player({ ...loadSaved() }, camera);
scene.add(player.character.root);
const market = new Market();

const editLink = el('a', 'menu-link', 'Editar personaje');
(editLink as HTMLAnchorElement).href = './creador.html';
ui.append(editLink);

// --- plantas ---
let floor: Floor;
const floors = new Map<number, Floor>();
const game: Game = {
  state, hud, phone, player,
  travel: (level, from) => travel(level, from),
  use: (action) => (action === 'microwave' ? microwavePanel() : action === 'coffee' ? coffee() : inventoryPanel()),
};
const gameRef = () => game;
const builders: Record<number, () => Floor> = {
  0: () => createLobby(gameRef),
  1: () => createOffice(gameRef, market),
  2: () => createGrayFloor(gameRef),
  3: () => createCasino(gameRef),
};

function goToFloor(level: number) {
  if (floor) scene.remove(floor.group);
  if (!floors.has(level)) floors.set(level, builders[level]());
  floor = floors.get(level)!;
  scene.add(floor.group);
  hud.setFloor(floor.name);
}

function travel(level: number, from?: number) {
  const go = () => {
    const prev = floor.level;
    goToFloor(level);
    player.place(floor.arrival.x, floor.arrival.z, floor.arrival.rotY);
    floor.onArrive?.(from ?? prev);
    if (level === 1) state.complete('subir');
    if (level === 3) state.complete('casino');
  };
  // dentro de la cabina todas las plantas se ven igual: el cambio no se nota
  if (from !== undefined) go();
  else hud.fade(go);
}

goToFloor(0);
player.place(0, 4.4, Math.PI);

// --- móvil: apps de los negocios ---
phone.addApp(storeApp(game));
phone.addApp(messagesApp(phone, game));
phone.addApp(casinoApp(game));
phone.addApp(newsApp(game));
phone.addApp(chatApp(game));
phone.addApp(bankApp(game));
phone.addApp(walletApp(game, market));
phone.addApp(settingsApp(game));
market.newsListener((text) => {
  state.addNews('mercado', '📈', text);
  if (state.data.positions.length || floor?.level === 1) phone.notify('📰 Noticias del mercado', text);
});
// algo de ambiente en el chat la primera vez
if (!state.data.chat.length) {
  state.chatSay('Marcos', '¿subimos al casino luego? han puesto el Crazy Time 🎡');
  state.chatSay('Lucía', 'yo cerrando ventas, en 10 min subo');
}

// --- acciones comunes ---
function inventoryPanel() {
  hud.openPanel('Inventario', (body) => {
    const entries = Object.entries(state.data.inventory);
    if (!entries.length) body.append(el('p', 'muted', 'No llevas nada. El MegaMart está en la Planta 0.'));
    const list = el('div', 'items');
    for (const [id, n] of entries) {
      const item = ITEMS[id];
      const row = el('div', 'item');
      row.append(el('span', 'icon', item.icon), el('span', '', `${item.name} × ${n}`));
      if (item.heatsInto) row.append(el('span', 'muted', 'al microondas'));
      else if (item.ocio) {
        const verb = item.ocio === 'globo' ? 'Inflar globo' : item.ocio === 'bong' ? 'Dar una calada' : item.ocio === 'liar' ? 'Liar y fumar' : 'Encender';
        row.append(button(verb, () => {
          const err = state.useOcio(id);
          if (err) hud.toast(err, 'bad');
          else {
            player.ocio(item.ocio!);
            hud.toast(item.effect ? `${EFFECTS[item.effect].icon} ${EFFECTS[item.effect].text}` : `${item.icon} ${item.name}`, 'ok');
          }
          inventoryPanel();
        }));
      } else if (item.equip) {
        const equipped = (item.equip === 'movil' && state.data.phoneModel === item.name)
          || (item.equip === 'portatil' && state.data.laptop === item.name)
          || (item.equip === 'arma' && state.data.weapon === item.name);
        row.append(button(equipped ? 'Equipado ✓' : 'Equipar', () => {
          const err = state.equip(id);
          if (err) hud.toast(err, 'bad');
          else hud.toast(`${item.icon} ${item.name} equipado`, 'ok');
          inventoryPanel();
        }, equipped ? 'btn ghost' : 'btn'));
      } else if (item.hunger || item.energy || item.effect) {
        row.append(button('Consumir', () => {
          const err = state.consume(id);
          if (err) hud.toast(err, 'bad');
          else hud.toast(item.effect ? `${EFFECTS[item.effect].icon} ${EFFECTS[item.effect].text}` : `${item.icon} +${item.hunger ?? 0} hambre, +${item.energy ?? 0} energía`, 'ok');
          inventoryPanel();
        }));
      } else row.append(el('span', ''));
      list.append(row);
    }
    body.append(list);
    // mezclas
    for (const r of RECIPES) {
      if (state.data.inventory[r.a] && state.data.inventory[r.b]) {
        body.append(button(`Mezclar ${ITEMS[r.a].name} + ${ITEMS[r.b].name}`, () => {
          const made = state.mix(r.a, r.b);
          if (made) hud.toast(`${made.icon} Has preparado ${made.name}`, 'ok');
          inventoryPanel();
        }, 'btn ghost'));
      }
    }
  });
}

function microwavePanel() {
  hud.openPanel('Microondas', (body) => {
    const frozen = Object.keys(state.data.inventory).filter((id) => ITEMS[id].heatsInto);
    if (!frozen.length) {
      body.append(el('p', 'muted', 'No llevas nada congelado. Compra precocinados en el MegaMart.'));
      return;
    }
    for (const id of frozen) {
      const item = ITEMS[id];
      body.append(button(`Calentar ${item.name}`, () => {
        body.innerHTML = '';
        const bar = el('div', 'bar');
        const fill = el('div', 'bar-fill');
        fill.style.background = '#55d68a';
        fill.style.width = '0%';
        bar.append(fill);
        body.append(el('p', '', `Calentando ${item.name}… 🔄`), bar);
        let t = 0;
        const timer = setInterval(() => {
          t += 0.1;
          fill.style.width = `${Math.min(100, t * 50)}%`;
          if (t >= 2) {
            clearInterval(timer);
            state.removeItem(id);
            state.addItem(item.heatsInto!);
            const hot = ITEMS[item.heatsInto!];
            body.innerHTML = '';
            body.append(el('p', '', `¡Ding! ${hot.icon} ${hot.name} lista.`));
            body.append(button('Comérmela ya', () => {
              state.consume(hot.id);
              hud.toast(`${hot.icon} +${hot.hunger} hambre`, 'ok');
              hud.closePanel();
            }), button('Guardarla', () => hud.closePanel(), 'btn ghost'));
          }
        }, 100);
      }));
    }
  });
}

function coffee() {
  if (!state.payCash(1)) return hud.toast('Necesitas 1 € en efectivo', 'bad');
  state.data.energy = Math.min(100, state.data.energy + 20);
  state.persist();
  hud.toast('☕ Café de máquina · +20 energía', 'ok');
}

// --- interacciones ---
let near: Interactable | null = null;
function nearest(): Interactable | null {
  let best: Interactable | null = null;
  let bestD = Infinity;
  for (const it of floor.interactables) {
    if (it.enabled && !it.enabled()) continue;
    const d = Math.hypot(player.pos.x - it.x, player.pos.z - it.z);
    if (d < it.radius && d < bestD) {
      best = it;
      bestD = d;
    }
  }
  return best;
}

input.on('e', () => {
  if (hud.panelOpen || !near) return;
  near.run();
});
input.on('i', () => (hud.panelOpen ? hud.closePanel() : inventoryPanel()));
input.on('m', () => phone.toggle());
input.on('escape', () => (hud.panelOpen ? hud.closePanel() : phone.toggle(false)));

// --- bucle ---
const clock = new THREE.Clock();
let needsTimer = 0;
let saveTimer = 0;
let lastHour = Math.floor(state.data.time / 60);
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  input.enabled = !hud.panelOpen;
  player.update(dt, input, floor);
  floor.update(dt);
  market.tick(dt);
  sportsbook.tick(dt, game);
  near = player.seated || hud.panelOpen ? null : nearest();
  hud.showPrompt(near?.label ?? null);
  needsTimer += dt;
  if (needsTimer > 1) {
    state.tick(needsTimer);
    needsTimer = 0;
    // cada hora de juego: ventas de la tienda y entregas de las mulas
    const hour = Math.floor(state.data.time / 60);
    if (hour !== lastHour) {
      const hours = hour - lastHour;
      lastHour = hour;
      storeTick(game, hours);
      scamTick(game);
      phone.refresh();
    }
    // efectos de los consumibles: Púrpura tiñe y ralentiza, la risa marea
    const fx = state.activeEffects().map(([e]) => e);
    container.style.filter = fx.includes('purpura') ? 'hue-rotate(250deg) saturate(1.6)' : fx.includes('risa') ? 'saturate(1.8) blur(0.6px)' : '';
    bloom.strength = fx.includes('purpura') ? 0.9 : 0.3;
  }
  saveTimer += dt;
  if (saveTimer > 10) {
    state.persist();
    saveTimer = 0;
  }
  composer.render();
});

// para pruebas desde la consola
Object.assign(window, { brokerstars: { state, player, goToFloor, travel, camera, hud, phone, market, game, get floor() { return floor; } } });
