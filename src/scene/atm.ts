import * as THREE from 'three';
import { atmPanel } from '../game/bank';
import { BANK_NAME } from '../game/config';
import { rect, type Game, type Interactable, type Rect } from '../game/world';
import { box, glow, mats } from './props';

// Cajero automático del banco; hay uno en cada planta.

let screen: THREE.CanvasTexture | null = null;

function screenTexture() {
  if (screen) return screen;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0d2a52';
  ctx.fillRect(0, 0, 128, 96);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(BANK_NAME, 64, 44);
  ctx.fillStyle = '#9fc4ff';
  ctx.font = '12px sans-serif';
  ctx.fillText('Introduzca su tarjeta', 64, 74);
  screen = new THREE.CanvasTexture(c);
  screen.colorSpace = THREE.SRGBColorSpace;
  return screen;
}

// `rotY` = hacia dónde mira la pantalla (0 = +Z)
export function createAtm(gameRef: () => Game, x: number, z: number, rotY: number): { group: THREE.Group; collider: Rect; interactable: Interactable } {
  const g = new THREE.Group();
  const blue = new THREE.MeshStandardMaterial({ color: '#0f3c78', roughness: 0.6 });
  g.add(box(0.7, 1.7, 0.45, blue, 0, 0.85, 0, 0.03));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), glow(screenTexture(), 0.8));
  scr.position.set(0, 1.35, 0.23);
  g.add(scr);
  g.add(box(0.36, 0.05, 0.14, mats.plastic, 0, 1.05, 0.28));
  g.add(box(0.12, 0.02, 0.05, mats.steel, 0.18, 1.2, 0.24));
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return {
    group: g,
    collider: rect(x, z, 0.65, 0.65),
    interactable: { label: `Cajero ${BANK_NAME}`, x: x + Math.sin(rotY) * 0.8, z: z + Math.cos(rotY) * 0.8, radius: 0.8, run: () => atmPanel(gameRef()) },
  };
}
