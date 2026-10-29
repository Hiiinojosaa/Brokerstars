import * as THREE from 'three';
import { el } from '../game/hud';
import { rect, type Game, type Interactable, type Rect } from '../game/world';
import { box, mats } from './props';

// Ascensor con puertas correderas, cabina y botonera. Se coloca en una
// pared: `x, z` es el centro de la puerta y `facing` hacia dónde da la
// puerta (la cabina queda detrás, fuera de la sala).

export const FLOOR_NAMES: Record<number, string> = {
  3: 'Casino Royale',
  2: 'La Planta Gris',
  1: 'Los Negocios',
  0: 'Calle · Banco · MegaMart',
};

type Facing = 'north' | 'south' | 'east' | 'west';

const W = 1.8; // ancho de la puerta
const DEPTH = 1.9; // fondo de la cabina
const H = 2.4;

function canvasLabel(text: string, w = 256, h = 96, bg = '#111', fg = '#ff5a3c', font = '700 64px monospace') {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { tex: t, ctx, canvas: c };
}

export interface Elevator {
  group: THREE.Group;
  walkable: Rect;
  colliders: Rect[];
  interactables: Interactable[];
  doorCollider: () => Rect[];
  // dentro de la cabina, en coordenadas de mundo
  inside: { x: number; z: number; rotY: number };
  update(dt: number): void;
  open(): void;
  close(): void;
  isOpen(): boolean;
  playerInside(x: number, z: number): boolean;
}

export function createElevator(game: () => Game, level: number, x: number, z: number, facing: Facing): Elevator {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  // en local la puerta mira a +Z y la cabina va hacia -Z
  const rotY = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }[facing];
  g.rotation.y = rotY;

  // marco y fachada de acero
  const steel = mats.steel;
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 0.4, metalness: 0.6 });
  g.add(box(0.18, H + 0.2, 0.2, steel, -W / 2 - 0.09, (H + 0.2) / 2, 0.02));
  g.add(box(0.18, H + 0.2, 0.2, steel, W / 2 + 0.09, (H + 0.2) / 2, 0.02));
  g.add(box(W + 0.36, 0.2, 0.2, steel, 0, H + 0.1, 0.02));

  // indicador de planta encima de la puerta
  const indicator = canvasLabel(String(level));
  const ind = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), new THREE.MeshStandardMaterial({ map: indicator.tex, emissive: '#ffffff', emissiveMap: indicator.tex, emissiveIntensity: 1.2 }));
  ind.position.set(0, H + 0.3, 0.13);
  g.add(ind);
  const setIndicator = (text: string) => {
    const { ctx, canvas } = indicator;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff5a3c';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
    indicator.tex.needsUpdate = true;
  };

  // botón de llamada en la pared, a la derecha
  const callPanel = box(0.14, 0.26, 0.04, dark, W / 2 + 0.45, 1.2, 0.04);
  g.add(callPanel);
  const callLight = new THREE.MeshStandardMaterial({ color: '#333', emissive: '#ffb347', emissiveIntensity: 0.2 });
  const callBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), callLight);
  callBtn.rotation.x = Math.PI / 2;
  callBtn.position.set(W / 2 + 0.45, 1.2, 0.07);
  g.add(callBtn);

  // puertas
  const doorMat = new THREE.MeshStandardMaterial({ color: '#c3c8cf', roughness: 0.2, metalness: 0.95 });
  const left = box(W / 2, H, 0.05, doorMat, -W / 4, H / 2, 0);
  const right = box(W / 2, H, 0.05, doorMat, W / 4, H / 2, 0);
  g.add(left, right);

  // cabina
  const cabinWall = new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.5 });
  const mirror = new THREE.MeshStandardMaterial({ color: '#dfe6ec', roughness: 0.05, metalness: 1 });
  g.add(box(W + 0.2, H + 0.1, 0.1, cabinWall, 0, (H + 0.1) / 2, -DEPTH - 0.05));
  g.add(box(1.4, 1.2, 0.02, mirror, 0, 1.5, -DEPTH + 0.01));
  g.add(box(0.1, H + 0.1, DEPTH, cabinWall, -W / 2 - 0.05, (H + 0.1) / 2, -DEPTH / 2));
  g.add(box(0.1, H + 0.1, DEPTH, cabinWall, W / 2 + 0.05, (H + 0.1) / 2, -DEPTH / 2));
  g.add(box(W, 0.04, DEPTH, new THREE.MeshStandardMaterial({ color: '#2d2a28', roughness: 0.6 }), 0, 0.02, -DEPTH / 2));
  g.add(box(W, 0.05, DEPTH, new THREE.MeshStandardMaterial({ color: '#fff6e0', emissive: '#fff1d0', emissiveIntensity: 1.3 }), 0, H + 0.05, -DEPTH / 2));
  g.add(box(0.05, 0.05, DEPTH - 0.2, steel, -W / 2 + 0.03, 0.95, -DEPTH / 2));
  // botonera dentro de la cabina
  const panelLabel = canvasLabel('3\n2\n1\n0', 64, 192, '#2a2d33', '#f2c14e', '700 34px sans-serif');
  {
    const { ctx, canvas } = panelLabel;
    ctx.fillStyle = '#2a2d33';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const [i, n] of ['3', '2', '1', '0'].entries()) {
      ctx.fillStyle = '#c9ccd1';
      ctx.beginPath();
      ctx.arc(32, 28 + i * 44, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b1b1b';
      ctx.fillText(n, 32, 30 + i * 44);
    }
    panelLabel.tex.needsUpdate = true;
  }
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.48), new THREE.MeshStandardMaterial({ map: panelLabel.tex, emissive: '#ffffff', emissiveMap: panelLabel.tex, emissiveIntensity: 0.4 }));
  panel.position.set(W / 2 - 0.01, 1.3, -0.45);
  panel.rotation.y = -Math.PI / 2;
  g.add(panel);
  const cabinLight = new THREE.PointLight('#fff1d6', 3, 3.5, 1.5);
  cabinLight.position.set(0, H - 0.2, -DEPTH / 2);
  g.add(cabinLight);

  // paso de local a mundo (solo giros de 90°)
  const toWorld = (lx: number, lz: number) => {
    const c = Math.cos(rotY), s = Math.sin(rotY);
    return { x: x + lx * c + lz * s, z: z - lx * s + lz * c };
  };
  const worldRect = (lx: number, lz: number, w: number, d: number): Rect => {
    const p = toWorld(lx, lz);
    const turned = facing === 'east' || facing === 'west';
    return rect(p.x, p.z, turned ? d : w, turned ? w : d);
  };

  let openAmount = 0; // 0 cerrada, 1 abierta
  let target = 0;
  let holdTimer = 0;
  const cabin = worldRect(0, -DEPTH / 2, W - 0.1, DEPTH - 0.1);
  // pasillo de entrada a través de la pared
  const doorway = worldRect(0, 0, W - 0.3, 0.6);
  const walkable: Rect = {
    minX: Math.min(cabin.minX, doorway.minX), maxX: Math.max(cabin.maxX, doorway.maxX),
    minZ: Math.min(cabin.minZ, doorway.minZ), maxZ: Math.max(cabin.maxZ, doorway.maxZ),
  };
  const insidePoint = toWorld(0, -DEPTH / 2 - 0.1);
  const callPoint = toWorld(0.3, 1.0);
  const panelPoint = toWorld(0, -DEPTH / 2);

  const elevator: Elevator = {
    group: g,
    walkable,
    colliders: [worldRect(-W / 2 - 0.5, 0, 1, 0.3), worldRect(W / 2 + 0.5, 0, 1, 0.3)],
    doorCollider: () => (openAmount < 0.8 ? [worldRect(0, 0, W, 0.12)] : []),
    inside: { x: insidePoint.x, z: insidePoint.z, rotY: rotY },
    interactables: [],
    open() {
      target = 1;
      holdTimer = 7;
    },
    close() {
      target = 0;
    },
    isOpen: () => openAmount > 0.95,
    playerInside: (px, pz) => px >= cabin.minX && px <= cabin.maxX && pz >= cabin.minZ && pz <= cabin.maxZ,
    update(dt) {
      openAmount += Math.sign(target - openAmount) * Math.min(Math.abs(target - openAmount), dt * 1.3);
      left.position.x = -W / 4 - openAmount * (W / 2 - 0.05);
      right.position.x = W / 4 + openAmount * (W / 2 - 0.05);
      callLight.emissiveIntensity = target === 1 ? 1.5 : 0.2;
      if (target === 1) {
        const p = game().player.pos;
        const inCabin = elevator.playerInside(p.x, p.z);
        holdTimer -= dt;
        if (holdTimer <= 0 && !inCabin) target = 0;
      }
    },
  };

  elevator.interactables.push({
    label: 'Llamar al ascensor',
    x: callPoint.x,
    z: callPoint.z,
    radius: 1.2,
    enabled: () => !elevator.playerInside(game().player.pos.x, game().player.pos.z) && target === 0,
    run: () => elevator.open(),
  });
  elevator.interactables.push({
    label: 'Botonera del ascensor',
    x: panelPoint.x,
    z: panelPoint.z,
    radius: 1.0,
    run: () => {
      const gm = game();
      gm.hud.openPanel('Ascensor · Torre Brokerstars', (body) => {
        const pad = el('div', 'lift-pad');
        for (const lv of [3, 2, 1, 0]) {
          const b = el('button', 'lift-btn' + (lv === level ? ' here' : ''));
          b.innerHTML = `<span class="lift-num">${lv}</span><span>${FLOOR_NAMES[lv]}</span>`;
          b.onclick = () => {
            if (lv === level) return;
            b.classList.add('lit');
            gm.hud.closePanel();
            target = 0;
            // primero se cierran las puertas y luego se viaja
            setTimeout(() => {
              setIndicator('▲▼');
              gm.travel(lv);
              setTimeout(() => setIndicator(String(level)), 600);
            }, 1100);
          };
          pad.append(b);
        }
        body.append(pad, el('p', 'muted', 'Pulsa la planta a la que quieres ir.'));
      });
    },
  });

  return elevator;
}
