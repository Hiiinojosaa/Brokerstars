import type * as THREE from 'three';
import type { Hud } from './hud';
import type { Phone } from './phone';
import type { Player } from './player';
import type { GameState } from './state';

// Tipos compartidos por las plantas de la torre y el juego.

// Rectángulo en el suelo (plano XZ).
export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

// Punto donde el jugador puede pulsar E para hacer algo.
export interface Interactable {
  label: string;
  x: number;
  z: number;
  radius: number;
  // si devuelve false, el punto no está disponible ahora mismo
  enabled?: () => boolean;
  run(): void;
}

// Lo que una planta necesita del juego para sus acciones.
export interface Game {
  state: GameState;
  hud: Hud;
  phone: Phone;
  player: Player;
  // viaje en ascensor a otra planta (sin fundido si se va dentro de la cabina)
  travel(level: number, from?: number): void;
  // acciones compartidas por varias plantas
  use(action: 'microwave' | 'coffee' | 'inventory'): void;
}

export interface Floor {
  level: number;
  name: string;
  group: THREE.Group;
  // zonas por las que se puede andar (la sala y la cabina del ascensor)
  walkable: Rect[];
  // límites para la cámara
  bounds: Rect;
  height: number;
  colliders: Rect[];
  interactables: Interactable[];
  // dónde aparece el jugador al llegar en ascensor y hacia dónde mira
  arrival: { x: number; z: number; rotY: number };
  // colisiones que cambian (puertas del ascensor)
  dynamicColliders?: () => Rect[];
  update(dt: number): void;
  // se llama al llegar en ascensor
  onArrive?(from: number): void;
}

export function rect(cx: number, cz: number, w: number, d: number): Rect {
  return { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
}

export function inside(r: Rect, x: number, z: number) {
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}
