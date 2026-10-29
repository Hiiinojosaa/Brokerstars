import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Piezas y materiales comunes de todas las plantas.

export const mats = {
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

export function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, r = 0) {
  const geo = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.99) : new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function cyl(r: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Material que brilla con su propia textura (pantallas, ventanas).
export function glow(map: THREE.Texture, intensity = 1) {
  return new THREE.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: intensity, roughness: 0.3 });
}

export function chair() {
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

export function plant(scale = 1) {
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

// Pared recta con un hueco (para la puerta del ascensor). `along` es el eje
// en el que se extiende la pared; `pos` la posición en el otro eje.
export function wallWithGap(along: 'x' | 'z', len: number, h: number, thick: number, m: THREE.Material, pos: number, gapCenter: number, gapWidth: number, gapHeight: number) {
  const g = new THREE.Group();
  const a0 = -len / 2, a1 = len / 2;
  const g0 = gapCenter - gapWidth / 2, g1 = gapCenter + gapWidth / 2;
  const piece = (from: number, to: number, y0: number, y1: number) => {
    if (to - from <= 0.001 || y1 - y0 <= 0.001) return;
    const c = (from + to) / 2, l = to - from;
    g.add(along === 'x' ? box(l, y1 - y0, thick, m, c, (y0 + y1) / 2, pos) : box(thick, y1 - y0, l, m, pos, (y0 + y1) / 2, c));
  };
  piece(a0, g0, 0, h);
  piece(g1, a1, 0, h);
  piece(g0, g1, gapHeight, h);
  return g;
}
