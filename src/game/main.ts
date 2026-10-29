import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { createLobby } from '../scene/lobby';
import { createOffice } from '../scene/office';
import { loadSaved } from '../ui/creator';
import { randomCall } from './calls';
import { Hud, button, el, euros } from './hud';
import { Input } from './input';
import { Player } from './player';
import { GameState, ITEMS } from './state';
import type { Floor, Interactable } from './world';
import './game.css';

// Demo jugable de la Torre Brokerstars: Planta 0 (banco y MegaMart) y
// Planta 1 (oficina), con ascensor, dinero, inventario y el minijuego de
// llamadas en los puestos.

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
composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.5, 0.95));
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
const input = new Input(renderer.domElement, ui);
const player = new Player({ ...loadSaved() }, camera);
scene.add(player.character.root);

const editLink = el('a', 'menu-link', 'Editar personaje');
(editLink as HTMLAnchorElement).href = './creador.html';
ui.append(editLink);

// --- plantas ---
const builders: Record<number, () => Floor> = { 0: createLobby, 1: createOffice };
const floors = new Map<number, Floor>();
let floor: Floor;

function goToFloor(level: number, atElevator: boolean) {
  if (floor) scene.remove(floor.group);
  if (!floors.has(level)) floors.set(level, builders[level]());
  floor = floors.get(level)!;
  scene.add(floor.group);
  hud.setFloor(floor.name);
  if (atElevator) player.place(floor.arrival.x, floor.arrival.z, floor.arrival.rotY);
}

goToFloor(0, false);
player.place(0, 4.4, Math.PI);

// --- interacciones ---
let near: Interactable | null = null;

function nearest(): Interactable | null {
  let best: Interactable | null = null;
  let bestD = Infinity;
  for (const it of floor.interactables) {
    const d = Math.hypot(player.pos.x - it.x, player.pos.z - it.z);
    if (d < it.radius && d < bestD) {
      best = it;
      bestD = d;
    }
  }
  return best;
}

function needAccount() {
  if (state.data.hasAccount) return false;
  hud.toast('Primero abre una cuenta en la ventanilla del banco', 'bad');
  return true;
}

function bankPanel() {
  hud.openPanel('Banco Estrella', (body) => {
    const d = state.data;
    if (!d.hasAccount) {
      body.append(
        el('p', '', 'Bienvenido a la Torre Brokerstars. Para empezar a trabajar necesitas una cuenta: te damos tarjeta, PIN y 500 € de bienvenida.'),
        button('Abrir mi cuenta', () => {
          state.openAccount();
          hud.toast('Cuenta abierta · +500 € en el banco', 'ok');
          bankPanel();
        }),
      );
      return;
    }
    body.append(el('div', 'muted', 'Saldo en cuenta'), el('div', 'big', euros(d.bank)));
    body.append(el('p', 'muted', 'Préstamos, transferencias entre jugadores y la app del banco llegan en próximas versiones.'));
    body.append(
      button(`Ingresar todo el efectivo (${euros(d.cash)})`, () => {
        state.withdraw(-d.cash);
        hud.toast('Efectivo ingresado', 'ok');
        bankPanel();
      }, 'btn ghost'),
    );
  });
}

function atmPanel() {
  if (needAccount()) return;
  hud.openPanel('Cajero · Banco Estrella', (body) => {
    const d = state.data;
    body.append(el('div', 'screen', `SALDO: ${euros(d.bank)}   ·   EFECTIVO: ${euros(d.cash)}`));
    const row = el('div', 'row');
    for (const amount of [20, 50, 100, 200]) {
      const b = button(`Sacar ${amount} €`, () => {
        if (!state.withdraw(amount)) return hud.toast('No tienes saldo suficiente', 'bad');
        state.complete('sacar');
        hud.toast(`Has sacado ${amount} €`, 'ok');
        atmPanel();
      });
      b.disabled = d.bank < amount;
      row.append(b);
    }
    body.append(row);
    body.append(button('Ingresar todo el efectivo', () => {
      state.withdraw(-d.cash);
      atmPanel();
    }, 'btn ghost'));
  });
}

function shopPanel(where: 'shop' | 'fridge') {
  hud.openPanel(where === 'shop' ? 'MegaMart · Comida' : 'MegaMart · Bebidas', (body) => {
    body.append(el('div', 'muted', `Pagas en efectivo · llevas ${euros(state.data.cash)}`));
    const list = el('div', 'items');
    for (const item of Object.values(ITEMS)) {
      if (item.where !== where || item.price === 0) continue;
      const row = el('div', 'item');
      row.append(el('span', 'icon', item.icon), el('span', '', item.name), el('span', 'muted', euros(item.price)));
      row.append(button('Comprar', () => {
        if (!state.pay(item.price)) return hud.toast('No llevas suficiente efectivo: pasa por el cajero', 'bad');
        state.addItem(item.id);
        state.complete('comprar');
        hud.toast(`${item.icon} ${item.name} al inventario`, 'ok');
        shopPanel(where);
      }));
      list.append(row);
    }
    body.append(list);
    body.append(el('p', 'muted', 'Pronto: jarabes, globos, el estanco, la armería, ropa y relojes de imitación.'));
  });
}

function inventoryPanel() {
  hud.openPanel('Inventario', (body) => {
    const entries = Object.entries(state.data.inventory);
    if (!entries.length) body.append(el('p', 'muted', 'No llevas nada. El MegaMart está en la Planta 0.'));
    const list = el('div', 'items');
    for (const [id, n] of entries) {
      const item = ITEMS[id];
      const row = el('div', 'item');
      row.append(el('span', 'icon', item.icon), el('span', '', `${item.name} × ${n}`), el('span', 'muted', item.heatsInto ? 'congelado' : ''));
      row.append(button(item.heatsInto ? 'Calentar' : 'Consumir', () => {
        if (item.heatsInto) return hud.toast('Busca un microondas (hay uno en la cocina de la Planta 1)', 'bad');
        const err = state.consume(id);
        if (err) hud.toast(err, 'bad');
        else hud.toast(`${item.icon} ¡Qué bueno! +${item.hunger} hambre, +${item.energy} energía`, 'ok');
        inventoryPanel();
      }));
      list.append(row);
    }
    body.append(list);
  });
}

function microwavePanel() {
  hud.openPanel('Microondas', (body) => {
    const frozen = Object.keys(state.data.inventory).filter((id) => ITEMS[id].heatsInto);
    if (!frozen.length) {
      body.append(el('p', 'muted', 'No llevas nada congelado. Compra comida precocinada en el MegaMart.'));
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

function elevatorPanel() {
  hud.openPanel('Ascensor', (body) => {
    const list = el('div', 'floors');
    const all: [number, string, boolean][] = [
      [3, 'Planta 3 · Casino Royale', false],
      [2, 'Planta 2 · La Planta Gris', false],
      [1, 'Planta 1 · Los Negocios', true],
      [0, 'Planta 0 · Calle', true],
    ];
    for (const [level, name, open] of all) {
      const here = level === floor.level;
      const b = button('', () => {
        hud.closePanel();
        hud.fade(() => {
          goToFloor(level, true);
          if (level === 1) state.complete('subir');
        });
      });
      b.innerHTML = `<span>${name}</span><span>${here ? 'estás aquí' : open ? '' : 'próximamente'}</span>`;
      b.disabled = here || !open;
      if (!open || here) b.className = 'btn ghost';
      list.append(b);
    }
    body.append(list);
  });
}

// minijuego del puesto: una llamada de venta con dos decisiones
function pcPanel() {
  const call = randomCall();
  let step = 0;
  let score = 0;
  hud.openPanel('PC · Guion de llamada', (body) => {
    const render = () => {
      body.innerHTML = '';
      body.append(el('div', 'screen', `📞 ${call.name} — ${call.who}\nProducto: ${call.product}`));
      if (step < call.steps.length) {
        const s = call.steps[step];
        body.append(el('div', 'bubble', `«${s.client}»`));
        for (const o of [...s.options].sort(() => Math.random() - 0.5)) {
          const b = button(o.text, () => {
            score += o.score;
            step++;
            render();
          }, 'choice');
          body.append(b);
        }
        return;
      }
      // resultado
      const tired = state.data.energy < 15;
      if (tired) score -= 1;
      state.data.energy = Math.max(0, state.data.energy - 6);
      let msg: string;
      if (score >= 3 || (score >= 1 && Math.random() < 0.4)) {
        const commission = 25 + Math.round(Math.random() * 45) + (score >= 4 ? 20 : 0);
        if (state.data.hasAccount) state.depositToBank(commission);
        else state.data.cash += commission;
        state.data.sales++;
        state.complete('venta');
        msg = `✅ ¡Venta cerrada! Comisión de ${euros(commission)} ${state.data.hasAccount ? 'ingresada en el banco' : 'en efectivo'}.`;
        hud.toast(msg, 'ok');
      } else {
        msg = score <= 0 ? '☎️ Te ha colgado. Otra vez será.' : '🤔 Se lo va a pensar… no hay venta.';
      }
      state.persist();
      body.append(el('p', 'big', msg.split(' ')[0]), el('p', '', msg.slice(msg.indexOf(' ') + 1)));
      if (tired) body.append(el('p', 'muted', 'Estás reventado: tómate un café para vender mejor.'));
      body.append(el('p', 'muted', `Ventas totales: ${state.data.sales}`));
      body.append(button('Siguiente llamada', () => pcPanel()), button('Levantarse', () => hud.closePanel(), 'btn ghost'));
    };
    render();
  }, () => {
    if (!hud.panelOpen) player.stand();
  });
}

function interact() {
  if (hud.panelOpen) return;
  if (!near) return;
  switch (near.kind) {
    case 'bank': return bankPanel();
    case 'atm': return atmPanel();
    case 'shop': return shopPanel('shop');
    case 'fridge': return shopPanel('fridge');
    case 'microwave': return microwavePanel();
    case 'elevator': return elevatorPanel();
    case 'coffee':
      if (!state.pay(1)) return hud.toast('Necesitas 1 € en efectivo', 'bad');
      state.data.energy = Math.min(100, state.data.energy + 20);
      state.persist();
      return hud.toast('☕ Café de máquina · +20 energía', 'ok');
    case 'seat':
      player.sit(near.x, near.z, near.rotY ?? 0);
      return pcPanel();
  }
}

input.on('e', interact);
input.on('i', () => (hud.panelOpen ? hud.closePanel() : inventoryPanel()));
input.on('escape', () => hud.closePanel());

// --- bucle ---
const clock = new THREE.Clock();
let needsTimer = 0;
let saveTimer = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  input.enabled = !hud.panelOpen;
  player.update(dt, input, floor);
  floor.update(dt);
  near = player.seated || hud.panelOpen ? null : nearest();
  hud.showPrompt(near?.label ?? null);
  needsTimer += dt;
  if (needsTimer > 1) {
    state.tick(needsTimer);
    needsTimer = 0;
  }
  saveTimer += dt;
  if (saveTimer > 10) {
    state.persist();
    saveTimer = 0;
  }
  composer.render();
});

// para pruebas desde la consola
Object.assign(window, { brokerstars: { state, player, goToFloor, camera, hud, renderer, composer } });
