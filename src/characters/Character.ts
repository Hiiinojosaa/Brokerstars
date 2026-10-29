import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CharacterConfig } from './types';
import { faceTexture, printTexture } from './textures';

// Personaje estilizado tipo Roblox: piezas redondeadas, cabeza grande y
// cara dibujada. El origen está en los pies y mira hacia +Z.
// Brazos y piernas cuelgan de pivotes para poder animarlos.

export type Pose = 'quieto' | 'pose' | 'brazos_cruzados';

const BUILD_SCALE = { flaco: 0.88, normal: 1, grande: 1.2 };

const HEAD = { w: 0.4, h: 0.4, d: 0.38, r: 0.12 };

function mat(color: string, roughness = 0.6) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

function metal(color: string) {
  return new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.22 });
}

function rbox(w: number, h: number, d: number, m: THREE.Material, r = 0.05) {
  const radius = Math.min(r, w / 2, h / 2, d / 2) * 0.999;
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), m);
  mesh.castShadow = true;
  return mesh;
}

function at<T extends THREE.Object3D>(obj: T, x: number, y: number, z: number): T {
  obj.position.set(x, y, z);
  return obj;
}

// Color de tinta que contrasta con la prenda.
function inkFor(color: string) {
  const c = new THREE.Color(color);
  return c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 0.5 ? '#141414' : '#f4f4f0';
}

interface Limb {
  root: THREE.Group;
  joint: THREE.Group;
}

export class Character {
  readonly root = new THREE.Group();
  private upper = new THREE.Group();
  private head = new THREE.Group();
  private arms: { left: Limb; right: Limb } | null = null;
  private time = Math.random() * 10;
  pose: Pose = 'quieto';

  constructor(public config: CharacterConfig) {
    this.build();
  }

  setConfig(config: CharacterConfig) {
    this.config = config;
    this.build();
  }

  private clear() {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.root.clear();
    this.upper = new THREE.Group();
  }

  private build() {
    this.clear();
    const k = BUILD_SCALE[this.config.build];
    this.root.add(this.upper);
    this.buildLegs(k);
    const torso = this.buildTorso(k);
    this.buildHead();
    this.buildArms(k, torso.width);
    this.applyPose(0);
  }

  private buildLegs(k: number) {
    const c = this.config;
    const skin = mat(c.skin, 0.55);
    const pants = mat(c.pantsColor, 0.8);
    const shoe = mat(c.shoesColor, 0.5);
    const white = mat('#f4f4f0', 0.5);
    const hipY = 0.86;

    this.root.add(at(rbox(0.5 * k, 0.22, 0.3 * k, pants, 0.06), 0, hipY + 0.02, 0));
    for (const side of [-1, 1]) {
      const hip = at(new THREE.Group(), side * 0.125 * k, hipY, 0);
      const knee = at(new THREE.Group(), 0, -0.42, 0);
      hip.add(knee);
      this.root.add(hip);

      if (c.pants === 'jorts') {
        hip.add(at(rbox(0.25 * k, 0.5, 0.27 * k, pants, 0.06), 0, -0.24, 0));
        knee.add(at(rbox(0.25 * k, 0.12, 0.27 * k, pants, 0.05), 0, -0.02, 0));
        knee.add(at(rbox(0.15 * k, 0.3, 0.16 * k, skin, 0.06), 0, -0.18, 0));
        knee.add(at(rbox(0.165 * k, 0.16, 0.175 * k, white, 0.06), 0, -0.27, 0)); // calcetín alto
      } else {
        const wide = c.pants === 'anchos';
        const w = (wide ? 0.25 : 0.2) * k;
        hip.add(at(rbox(w, 0.46, w * 1.08, pants, 0.06), 0, -0.21, 0));
        knee.add(at(rbox(w * (wide ? 1.04 : 0.96), 0.38, w * 1.08, pants, 0.06), 0, -0.17, 0));
        // pliegue que cae sobre la zapatilla
        if (wide) knee.add(at(rbox(w * 1.12, 0.09, w * 1.2, pants, 0.04), 0, -0.33, 0.01));
      }

      // zapatilla gorda
      knee.add(at(rbox(0.21, 0.05, 0.36, white, 0.02), 0, -0.415, 0.05));
      knee.add(at(rbox(0.2, 0.12, 0.34, shoe, 0.05), 0, -0.36, 0.05));
      knee.add(at(rbox(0.08, 0.02, 0.14, white, 0.008), 0, -0.3, 0.1)); // cordones
      if (c.shoes === 'botas_altas') knee.add(at(rbox(0.19, 0.14, 0.2, shoe, 0.05), 0, -0.27, -0.02));
      const swoosh = rbox(0.01, 0.035, 0.16, inkFor(c.shoesColor) === '#141414' ? mat('#141414') : white, 0.004);
      swoosh.rotation.x = -0.25;
      knee.add(at(swoosh, side * 0.1, -0.36, 0.05));
    }
  }

  private buildTorso(k: number) {
    const c = this.config;
    const top = mat(c.topColor, 0.85);
    const loose = c.top !== 'manga_larga';
    const width = (loose ? 0.6 : 0.56) * k;
    const depth = (loose ? 0.33 : 0.31) * k;
    const bottom = loose ? 0.8 : 0.85;
    const topY = 1.48;
    const height = topY - bottom;
    this.upper.add(at(rbox(width, height, depth, top, 0.08), 0, bottom + height / 2, 0));

    if (c.top === 'sudadera') {
      this.upper.add(at(rbox(0.38 * k, 0.16, 0.16, top, 0.06), 0, topY, -0.12 * k)); // capucha
      this.upper.add(at(rbox(0.34 * k, 0.16, 0.03, top, 0.012), 0, 0.98, depth / 2 + 0.008)); // bolsillo
      this.upper.add(at(rbox(width + 0.015, 0.07, depth + 0.015, top, 0.03), 0, bottom + 0.03, 0)); // puño
      // cordones de la capucha
      for (const side of [-1, 1]) this.upper.add(at(rbox(0.015, 0.14, 0.015, mat('#f4f4f0')), side * 0.06, 1.36, depth / 2 + 0.01));
    }
    if (c.print !== 'ninguno') {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.36 * k, 0.36 * k),
        new THREE.MeshStandardMaterial({ map: printTexture(c.print, inkFor(c.topColor)), transparent: true, roughness: 0.9 }),
      );
      this.upper.add(at(plane, 0, 1.17, depth / 2 + 0.003));
    }

    // cuello
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.1, 16), mat(c.skin, 0.55));
    this.upper.add(at(neck, 0, 1.52, 0));

    if (c.chain !== 'ninguna') {
      const gold = metal('#e6b84a');
      const thick = c.chain === 'cubana' ? 0.02 : 0.011;
      const chain = new THREE.Mesh(new THREE.TorusGeometry(0.13 * Math.max(1, k * 0.95), thick, 8, 28), gold);
      chain.rotation.x = Math.PI / 2 - 0.5;
      this.upper.add(at(chain, 0, 1.46, 0.045));
      if (c.chain === 'colgante') {
        this.upper.add(at(rbox(0.06, 0.08, 0.016, gold, 0.006), 0, 1.33, depth / 2 + 0.014));
        this.upper.add(at(rbox(0.028, 0.028, 0.01, mat('#1a1a1a'), 0.004), 0, 1.33, depth / 2 + 0.024));
      }
    }
    return { width };
  }

  private buildHead() {
    const c = this.config;
    const skin = mat(c.skin, 0.55);
    const hair = mat(c.hair, 0.75);
    const head = (this.head = at(new THREE.Group(), 0, 1.76, 0));
    this.upper.add(head);
    const { w, h, d, r } = HEAD;
    head.add(rbox(w, h, d, skin, r));

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.32, 0.32),
      new THREE.MeshStandardMaterial({ map: faceTexture(c.face, c.facialHair, c.skin, c.hair), transparent: true, roughness: 0.55 }),
    );
    head.add(at(face, 0, -0.02, d / 2 + 0.002));
    for (const side of [-1, 1]) head.add(at(rbox(0.05, 0.1, 0.08, skin, 0.022), side * (w / 2 + 0.012), -0.01, -0.01)); // orejas

    // pelo
    const hatOn = c.hat !== 'ninguno';
    if (c.hairStyle !== 'calvo') {
      // casquete pegado que comparten todos los peinados
      if (!hatOn) head.add(at(rbox(w + 0.018, 0.13, d + 0.018, hair, 0.065), 0, h / 2 - 0.055, 0));
      head.add(at(rbox(w + 0.018, 0.26, 0.12, hair, 0.06), 0, 0.03, -d / 2 + 0.05)); // nuca
    }
    if (!hatOn) {
      if (c.hairStyle === 'degradado') {
        const top = rbox(w - 0.02, 0.11, d - 0.03, hair, 0.05);
        top.rotation.x = -0.12;
        head.add(at(top, 0, h / 2 + 0.03, 0.01));
      } else if (c.hairStyle === 'rizos') {
        for (let ix = -2; ix <= 2; ix++) {
          for (let iz = -2; iz <= 2; iz++) {
            const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 1), hair);
            ball.castShadow = true;
            const y = h / 2 + 0.03 - (Math.abs(ix) + Math.abs(iz)) * 0.012;
            head.add(at(ball, ix * 0.078, y, iz * 0.072));
          }
        }
      } else if (c.hairStyle === 'trenzas') {
        const braid = mat('#' + new THREE.Color(c.hair).multiplyScalar(0.75).getHexString(), 0.6);
        for (let i = -2; i <= 2; i++) head.add(at(rbox(0.035, 0.03, d + 0.03, braid, 0.014), i * 0.07, h / 2 + 0.008, 0));
      }
    }

    if (c.glasses !== 'ninguna') {
      const dark = c.glasses === 'oscuras';
      const lens = dark ? mat('#0c0c0c', 0.15) : new THREE.MeshStandardMaterial({ color: '#cfe3f0', transparent: true, opacity: 0.3, roughness: 0.1, depthWrite: false });
      const frame = mat(dark ? '#0c0c0c' : '#e8e8e8', 0.3);
      const z = d / 2 + 0.018;
      for (const side of [-1, 1]) {
        head.add(at(rbox(0.13, 0.075, 0.014, lens, 0.02), side * 0.075, 0.02, z));
        head.add(at(rbox(0.012, 0.012, d * 0.9, frame, 0.004), side * (w / 2 + 0.008), 0.045, 0));
      }
      head.add(at(rbox(0.3, 0.012, 0.012, frame, 0.004), 0, 0.058, z + 0.002));
    }

    const hatMat = mat(c.hatColor, 0.8);
    switch (c.hat) {
      case 'gorra':
      case 'gorra_atras': {
        // copa con la misma forma redondeada que la cabeza, un poco más grande
        head.add(at(rbox(w + 0.03, 0.17, d + 0.03, hatMat, 0.1), 0, 0.135, 0));
        const dir = c.hat === 'gorra' ? 1 : -1;
        head.add(at(rbox(0.36, 0.025, 0.2, hatMat, 0.01), 0, 0.065, dir * 0.27));
        head.add(at(rbox(0.05, 0.05, 0.008, mat(inkFor(c.hatColor)), 0.006), 0, 0.14, dir * (d / 2 + 0.019)));
        head.add(at(rbox(0.035, 0.02, 0.035, hatMat, 0.01), 0, 0.225, 0)); // botón
        break;
      }
      case 'gorro':
        head.add(at(rbox(0.43, 0.2, 0.41, hatMat, 0.09), 0, 0.17, 0));
        head.add(at(rbox(0.445, 0.08, 0.425, hatMat, 0.035), 0, 0.085, 0));
        break;
      case 'pescador': {
        const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.225, 0.16, 24), hatMat);
        bucket.castShadow = true;
        head.add(at(bucket, 0, 0.17, 0));
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.31, 0.02, 24), hatMat);
        brim.castShadow = true;
        head.add(at(brim, 0, 0.095, 0));
        break;
      }
    }
  }

  private buildArms(k: number, torsoWidth: number) {
    const c = this.config;
    const skin = mat(c.skin, 0.55);
    const top = mat(c.topColor, 0.85);
    const sleeve = c.top === 'camiseta_sobre_larga' ? mat(c.sleeveColor, 0.85) : top;
    const longSleeve = c.top !== 'camiseta';
    const make = (side: number): Limb => {
      const root = at(new THREE.Group(), side * (torsoWidth / 2 + 0.085 * k), 1.38, 0);
      const joint = at(new THREE.Group(), 0, -0.32, 0);
      // primero se dobla hacia delante y luego gira hacia el cuerpo
      root.rotation.order = joint.rotation.order = 'YXZ';
      root.add(at(rbox(0.16 * k, 0.36, 0.17 * k, longSleeve ? sleeve : skin, 0.06), 0, -0.14, 0));
      if (c.top !== 'manga_larga') root.add(at(rbox(0.21 * k, 0.26, 0.22 * k, top, 0.07), 0, -0.06, 0)); // manga camiseta
      joint.add(at(rbox(0.145 * k, 0.3, 0.155 * k, longSleeve ? sleeve : skin, 0.06), 0, -0.13, 0));
      if (longSleeve) joint.add(at(rbox(0.155 * k, 0.05, 0.165 * k, sleeve, 0.02), 0, -0.27, 0)); // puño
      joint.add(at(rbox(0.13, 0.14, 0.14, skin, 0.05), 0, -0.36, 0.005));
      joint.add(at(rbox(0.04, 0.08, 0.05, skin, 0.018), -side * 0.07, -0.33, 0.04)); // pulgar
      if (c.watch !== 'ninguno' && side === -1) {
        const band = c.watch === 'rolex_oro' ? metal('#e6b84a') : metal('#d4d8dc');
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085 * k, 0.016, 8, 20), band);
        ring.rotation.x = Math.PI / 2;
        joint.add(at(ring, 0, -0.26, 0));
        const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16), band);
        dial.rotation.x = Math.PI / 2;
        joint.add(at(dial, 0, -0.26, 0.09 * k));
        const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.004, 16), mat('#0f3a26', 0.2));
        glass.rotation.x = Math.PI / 2;
        joint.add(at(glass, 0, -0.26, 0.1 * k + 0.002));
      }
      root.add(joint);
      this.upper.add(root);
      return { root, joint };
    };
    this.arms = { left: make(-1), right: make(1) };
  }

  private applyPose(sway: number) {
    if (!this.arms) return;
    const { left, right } = this.arms;
    for (const a of [left, right]) {
      a.root.rotation.set(0, 0, 0);
      a.joint.rotation.set(0, 0, 0);
    }
    switch (this.pose) {
      case 'quieto':
        left.root.rotation.z = -0.1 - sway;
        right.root.rotation.z = 0.1 + sway;
        left.joint.rotation.x = -0.12;
        right.joint.rotation.x = -0.12;
        break;
      case 'pose':
        // la "pistola con los dedos" de las fotos
        right.root.rotation.set(-1.35, -0.35, 0);
        left.root.rotation.set(-0.45, 0, -0.1 - sway);
        left.joint.rotation.set(-1.7, 1.0, 0);
        break;
      case 'brazos_cruzados':
        left.root.rotation.set(-0.3, 0, -0.12 - sway * 0.5);
        right.root.rotation.set(-0.42, 0, 0.12 + sway * 0.5);
        left.joint.rotation.set(-1.6, 1.3, 0);
        right.joint.rotation.set(-1.45, -1.3, 0);
        break;
    }
  }

  update(dt: number) {
    this.time += dt;
    const breath = Math.sin(this.time * 2);
    this.upper.position.y = breath * 0.005;
    this.head.rotation.y = Math.sin(this.time * 0.6) * 0.08;
    this.head.rotation.x = Math.sin(this.time * 0.9) * 0.02;
    this.applyPose(breath * 0.02);
  }
}
