import type * as THREE from 'three';

// Tipos compartidos por las plantas de la torre y el juego.

// Rectángulo en el suelo (plano XZ) que el jugador no puede atravesar.
export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type InteractKind = 'seat' | 'elevator' | 'atm' | 'bank' | 'shop' | 'fridge' | 'microwave' | 'coffee';

// Punto donde el jugador puede pulsar E para hacer algo.
export interface Interactable {
  kind: InteractKind;
  label: string;
  x: number;
  z: number;
  radius: number;
  // para sentarse: hacia dónde mira el personaje
  rotY?: number;
}

export interface Floor {
  level: number;
  name: string;
  group: THREE.Group;
  bounds: Rect;
  height: number;
  colliders: Rect[];
  interactables: Interactable[];
  // dónde aparece el jugador al salir del ascensor y hacia dónde mira
  arrival: { x: number; z: number; rotY: number };
  update(dt: number): void;
}

export function rect(cx: number, cz: number, w: number, d: number): Rect {
  return { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
}
