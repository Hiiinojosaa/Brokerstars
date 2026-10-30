import * as THREE from 'three';
import { Character } from '../characters/Character';
import type { CharacterConfig } from '../characters/types';
import type { Input } from './input';
import type { Floor } from './world';

// El jugador: mueve al personaje con colisiones y lleva la cámara en
// tercera persona detrás de él.

const RADIUS = 0.3;
const WALK = 2.2;
const RUN = 4.6;

export class Player {
  character: Character;
  pos = new THREE.Vector3();
  private heading = 0;
  private speed = 0;
  // cámara: giro horizontal, inclinación y distancia
  yaw = Math.PI;
  pitch = 0.32;
  dist = 3.4;
  seated = false;
  // al teletransportarse, la cámara salta en vez de deslizarse
  private snap = true;
  // empujando el carro de la compra se va más despacio
  slow = false;

  constructor(config: CharacterConfig, private camera: THREE.PerspectiveCamera) {
    this.character = new Character(config);
  }

  place(x: number, z: number, rotY: number) {
    this.pos.set(x, 0, z);
    this.heading = rotY;
    this.yaw = rotY + Math.PI;
    this.snap = true;
    this.sync();
  }

  sit(x: number, z: number, rotY: number) {
    this.seated = true;
    this.pos.set(x, 0, z);
    this.heading = rotY;
    this.character.pose = 'sentado';
    this.character.walk = 0;
    this.yaw = rotY + Math.PI + 0.5;
    this.pitch = 0.45;
    this.sync();
  }

  // lanza la animación de ocio (globo, fumar, bong) en el personaje
  ocio(kind: 'globo' | 'fumar' | 'bong' | 'liar') {
    this.character.ocio(kind);
  }

  stand() {
    if (!this.seated) return;
    this.seated = false;
    this.character.pose = 'quieto';
    // un paso atrás para separarse de la mesa
    this.pos.x -= Math.sin(this.heading) * 0.55;
    this.pos.z -= Math.cos(this.heading) * 0.55;
    this.sync();
  }

  private sync() {
    this.character.root.position.copy(this.pos);
    this.character.root.rotation.y = this.heading;
  }

  update(dt: number, input: Input, floor: Floor) {
    const look = input.takeLook();
    this.yaw -= look.x * 0.005;
    this.pitch = THREE.MathUtils.clamp(this.pitch + look.y * 0.004, -0.1, 1.1);
    this.dist = THREE.MathUtils.clamp(this.dist + input.takeZoom() * 0.4, 1.6, 6);

    if (!this.seated) {
      const m = input.move();
      const amount = Math.hypot(m.x, m.y);
      const target = amount > 0.05 ? (m.run && !this.slow ? RUN : WALK * (this.slow ? 0.75 : 1)) * amount : 0;
      this.speed += (target - this.speed) * Math.min(1, dt * 10);
      if (amount > 0.05) {
        // adelante = desde la cámara hacia el jugador
        const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
        const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
        const dx = fx * m.y + rx * m.x;
        const dz = fz * m.y + rz * m.x;
        const want = Math.atan2(dx, dz);
        let diff = want - this.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.heading += diff * Math.min(1, dt * 12);
        const len = Math.hypot(dx, dz) || 1;
        this.pos.x += (dx / len) * this.speed * dt;
        this.pos.z += (dz / len) * this.speed * dt;
      }
      this.collide(floor);
      this.character.walk = this.speed < 0.15 ? 0 : this.speed > WALK + 0.4 ? 2 : 1;
      this.sync();
    }
    this.character.update(dt);
    this.updateCamera(floor);
  }

  private collide(floor: Floor) {
    // dentro de alguna zona caminable; si no, a su punto más cercano
    let best: { x: number; z: number; d: number } | null = null;
    for (const w of floor.walkable) {
      const x = THREE.MathUtils.clamp(this.pos.x, w.minX + RADIUS, w.maxX - RADIUS);
      const z = THREE.MathUtils.clamp(this.pos.z, w.minZ + RADIUS, w.maxZ - RADIUS);
      const d = (x - this.pos.x) ** 2 + (z - this.pos.z) ** 2;
      if (!best || d < best.d) best = { x, z, d };
      if (d === 0) break;
    }
    if (best) {
      this.pos.x = best.x;
      this.pos.z = best.z;
    }
    for (const r of [...floor.colliders, ...(floor.dynamicColliders?.() ?? [])]) {
      const cx = THREE.MathUtils.clamp(this.pos.x, r.minX, r.maxX);
      const cz = THREE.MathUtils.clamp(this.pos.z, r.minZ, r.maxZ);
      const dx = this.pos.x - cx, dz = this.pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= RADIUS * RADIUS) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        this.pos.x = cx + (dx / d) * RADIUS;
        this.pos.z = cz + (dz / d) * RADIUS;
      } else {
        // el centro ha quedado dentro: sacarlo por el lado más cercano
        const pushes = [this.pos.x - r.minX, r.maxX - this.pos.x, this.pos.z - r.minZ, r.maxZ - this.pos.z];
        const i = pushes.indexOf(Math.min(...pushes));
        if (i === 0) this.pos.x = r.minX - RADIUS;
        else if (i === 1) this.pos.x = r.maxX + RADIUS;
        else if (i === 2) this.pos.z = r.minZ - RADIUS;
        else this.pos.z = r.maxZ + RADIUS;
      }
    }
  }

  private updateCamera(floor: Floor) {
    const target = new THREE.Vector3(this.pos.x, this.seated ? 1.15 : 1.5, this.pos.z);
    const cp = Math.cos(this.pitch);
    const cam = new THREE.Vector3(
      target.x + Math.sin(this.yaw) * cp * this.dist,
      target.y + Math.sin(this.pitch) * this.dist,
      target.z + Math.cos(this.yaw) * cp * this.dist,
    );
    // si detrás hay una pared, la cámara se acerca por su línea de visión
    // en vez de pegarse al techo
    const b = floor.bounds;
    const dir = cam.clone().sub(target);
    let t = 1;
    const limit = (from: number, d: number, min: number, max: number) => {
      if (d > 0 && from + d > max) t = Math.min(t, (max - from) / d);
      if (d < 0 && from + d < min) t = Math.min(t, (min - from) / d);
    };
    limit(target.x, dir.x, b.minX + 0.15, b.maxX - 0.15);
    limit(target.z, dir.z, b.minZ + 0.15, b.maxZ - 0.15);
    limit(target.y, dir.y, 0.4, floor.height - 0.2);
    cam.copy(target).addScaledVector(dir, Math.max(0.25, t));
    // la cámara no puede quedar fuera de las zonas por las que se anda (por
    // ejemplo detrás de la pared de la cabina del ascensor): se acerca
    const ok = (x: number, z: number) => floor.walkable.some((w) => x >= w.minX - 0.2 && x <= w.maxX + 0.2 && z >= w.minZ - 0.2 && z <= w.maxZ + 0.2);
    let k = 1;
    while (k > 0.15 && !ok(target.x + (cam.x - target.x) * k, target.z + (cam.z - target.z) * k)) k -= 0.08;
    cam.set(target.x + (cam.x - target.x) * k, target.y + (cam.y - target.y) * Math.max(k, 0.5), target.z + (cam.z - target.z) * k);
    if (this.snap) this.camera.position.copy(cam);
    else this.camera.position.lerp(cam, 0.35);
    this.snap = false;
    this.camera.lookAt(target);
  }
}
