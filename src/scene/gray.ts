import * as THREE from 'three';
import { COLORS, PRESETS } from '../characters/catalog';
import { Character } from '../characters/Character';
import { el } from '../game/hud';
import { hackerPanel, otcPanel, politicianPanel, scamPc } from '../game/scam';
import { euros } from '../game/hud';
import { rect, type Floor, type Game, type Interactable, type Rect } from '../game/world';
import { createAtm } from './atm';
import { createElevator } from './elevator';
import { carpetTexture, keyboardTexture, screenTexture, signTexture } from './officeTextures';
import { box, chair, cyl, glow, mats, plant, wallWithGap } from './props';

// Planta 2 · La Planta Gris: sala de estafadores con las persianas bajadas,
// rincón de los muleros, mesa OTC del cambista, cuarto del hacker y el
// despacho del político con su sala de prensa. 20 x 14 m, luz tenue.

const W = 20, D = 14, H = 3.0;

function signPlane(text: string, sub: string, w: number, h: number) {
  const tex = signTexture(text, sub);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.3 }));
}

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function npc(i: number, extra: Partial<(typeof PRESETS)[number]>, x: number, z: number, rotY: number, pose: 'sentado' | 'quieto' | 'brazos_cruzados', g: THREE.Group, list: Character[]) {
  const c = new Character({
    ...PRESETS[0], name: `Gris ${i}`, hat: 'cascos', hatColor: '#1c1c1c', glasses: 'ninguna', tie: 'ninguna',
    top: i % 2 ? 'sudadera' : 'camiseta', topColor: ['#1c1c1c', '#3d4045', '#1d2440'][i % 3], print: 'ninguno',
    pants: 'anchos', pantsColor: '#1f2c45', shoes: 'bajas', shoesColor: '#f2f2f2',
    skin: COLORS.skin[(i * 5) % 6], hairStyle: (['pinchos', 'rapado', 'trenzas', 'rizos'] as const)[i % 4], face: 'concentrado',
    ...extra,
  });
  c.pose = pose;
  c.root.position.set(x, 0, z);
  c.root.rotation.y = rotY;
  g.add(c.root);
  list.push(c);
}

export function createGrayFloor(gameRef: () => Game): Floor {
  const g = new THREE.Group();
  const colliders: Rect[] = [];
  const interactables: Interactable[] = [];
  const people: Character[] = [];

  const carpet = carpetTexture();
  carpet.repeat.set(W, D);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: carpet, color: '#55505e', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: '#2a2830', emissive: '#100e14' }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  g.add(ceiling);
  const wall = new THREE.MeshStandardMaterial({ color: '#4a4652', roughness: 0.9 });
  g.add(box(W, H, 0.2, wall, 0, H / 2, -D / 2 - 0.1), box(W, H, 0.2, wall, 0, H / 2, D / 2 + 0.1));
  g.add(box(0.2, H, D, wall, -W / 2 - 0.1, H / 2, 0), wallWithGap('z', D, H, 0.2, wall, W / 2 + 0.1, 0.6, 2.0, 2.5));
  // persianas bajadas en la pared sur
  const blind = new THREE.MeshStandardMaterial({ color: '#8f8a80' });
  for (let x = -8; x <= -1; x += 3.5) for (let y = 0.95; y < 2.4; y += 0.08) g.add(box(2.8, 0.05, 0.03, blind, x, y, D / 2 - 0.02));
  // neón morado en el techo
  const neon = new THREE.MeshStandardMaterial({ color: '#b16cff', emissive: '#a24bff', emissiveIntensity: 2 });
  for (const z of [-4, 0, 4]) g.add(box(7, 0.04, 0.05, neon, -5.5, H - 0.05, z));

  const title = signPlane('PLANTA 2', 'aquí no ha pasado nada', 1.6, 0.5);
  title.position.set(-5.5, 2.4, -D / 2 + 0.03);
  g.add(title);

  // --- sala de estafadores: dos filas de puestos ---
  let n = 0;
  for (const rz of [-3.4, 0.6]) {
    const len = 6.8;
    g.add(box(len, 0.04, 1.6, new THREE.MeshStandardMaterial({ color: '#2b2d33' }), -5.5, 0.73, rz));
    g.add(box(len, 0.9, 0.05, new THREE.MeshStandardMaterial({ color: '#30264a' }), -5.5, 1.2, rz));
    colliders.push(rect(-5.5, rz, len + 0.1, 1.7));
    for (const side of [1, -1]) {
      for (let s = 0; s < 4; s++) {
        const x = -5.5 - len / 2 + 0.85 + s * 1.7;
        const z = rz + side * 0.45;
        const mon = new THREE.Group();
        mon.add(box(0.5, 0.31, 0.035, mats.plastic, 0, 1.07, 0, 0.01));
        mon.add(new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.27), glow(screenTexture((s + n) % 2), 1.0)).translateZ(0.02).translateY(1.07));
        mon.add(box(0.04, 0.25, 0.04, mats.plastic, 0, 0.88, -0.02));
        mon.position.set(x, 0, rz + side * 0.2);
        mon.rotation.y = side === 1 ? 0 : Math.PI;
        g.add(mon);
        const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13), new THREE.MeshStandardMaterial({ map: keyboardTexture() }));
        keys.rotation.x = -Math.PI / 2;
        keys.position.set(x, 0.771, z + side * 0.1);
        g.add(keys);
        const c = chair();
        c.position.set(x, 0, rz + side * 1.3);
        c.rotation.y = side === 1 ? 0 : Math.PI;
        g.add(c);
        const seat = { x, z: rz + side * 1.3, rotY: side === 1 ? Math.PI : 0 };
        if ((s + n) % 3 === 0 && people.length < 5) npc(n, {}, seat.x, seat.z, seat.rotY, 'sentado', g, people);
        else interactables.push({
          label: 'PC del estafador (Sender, Banca, Telegram)', x: seat.x, z: seat.z + (side === 1 ? 0.15 : -0.15), radius: 0.55,
          run: () => {
            const game = gameRef();
            game.player.sit(seat.x, seat.z, seat.rotY);
            scamPc(game, () => !game.hud.panelOpen && game.player.stand());
          },
        });
        n++;
      }
    }
  }

  // rincón de los muleros: mesa con móviles y el mapa de cajeros
  const mapTex = canvasTex(256, 160, (ctx) => {
    ctx.fillStyle = '#d9d4c4';
    ctx.fillRect(0, 0, 256, 160);
    ctx.strokeStyle = '#9a9384';
    ctx.lineWidth = 6;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 20 + i * 26);
      ctx.lineTo(256, 10 + i * 30);
      ctx.stroke();
    }
    ctx.fillStyle = '#c0392b';
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.arc(20 + ((i * 53) % 220), 20 + ((i * 37) % 120), 6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  const map = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshStandardMaterial({ map: mapTex }));
  map.position.set(-W / 2 + 0.03, 1.6, 4.6);
  map.rotation.y = Math.PI / 2;
  g.add(map);
  g.add(box(1.0, 0.75, 2.2, mats.wood, -W / 2 + 1.4, 0.375, 4.6, 0.02));
  for (let i = 0; i < 6; i++) g.add(box(0.07, 0.01, 0.14, mats.plastic, -W / 2 + 1.2 + (i % 2) * 0.3, 0.76, 3.8 + i * 0.28));
  colliders.push(rect(-W / 2 + 1.4, 4.6, 1.1, 2.3));
  npc(10, { name: 'Mulero', hat: 'gorra', hatColor: '#1c1c1c', top: 'sudadera', facialHair: 'perilla', face: 'chulo' }, -W / 2 + 2.3, 4.6, -Math.PI / 2, 'brazos_cruzados', g, people);
  interactables.push({
    label: 'Mulero: estado de las entregas', x: -W / 2 + 2.9, z: 4.6, radius: 1.1,
    run: () => {
      const game = gameRef();
      const d = game.state.data;
      game.hud.openPanel('Mulero', (body) => {
        body.append(el('div', 'bubble', '«Yo te consigo a las mulas y ellas sacan la pasta. Tú no te preocupes de nada.»'));
        if (!d.deliveries.length) body.append(el('p', 'muted', 'Ninguna entrega en camino.'));
        for (const del of d.deliveries) {
          const m = d.mules.find((x) => x.id === del.mule);
          body.append(el('div', 'msg', `${m?.name ?? 'Mula'} · ${euros(del.amount)} · ${del.waiting ? 'te espera en la Planta 0' : `llega a las ${game.state.clock(del.arriveAt)}`}`));
        }
      });
    },
  });

  // mesa OTC
  g.add(box(1.8, 1.0, 0.8, mats.wood, 0.8, 0.5, 4.8, 0.02));
  g.add(box(0.4, 0.3, 0.3, new THREE.MeshStandardMaterial({ color: '#f2c14e', metalness: 0.8, roughness: 0.3 }), 0.5, 1.15, 4.8));
  colliders.push(rect(0.8, 4.8, 1.9, 0.9));
  npc(11, { name: 'Cambista', hat: 'ninguno', top: 'traje', topColor: '#1c1c1c', glasses: 'oscuras', pants: 'vestir', pantsColor: '#1c1c1c', shoes: 'zapatos', shoesColor: '#1c1c1c', watch: 'rolex_oro', chain: 'cubana', face: 'serio' }, 0.8, 5.5, Math.PI, 'brazos_cruzados', g, people);
  interactables.push({ label: 'Mesa OTC: cambiar cripto por euros', x: 0.8, z: 3.9, radius: 1.1, run: () => otcPanel(gameRef()) });
  const otcSign = signPlane('OTC', 'cripto ↔ euros', 1.0, 0.32);
  otcSign.position.set(0.8, 2.4, D / 2 - 0.03);
  otcSign.rotation.y = Math.PI;
  g.add(otcSign);

  // cuarto del hacker (esquina noreste, cristal tintado)
  const tinted = new THREE.MeshPhysicalMaterial({ color: '#1a2a20', transmission: 0.5, transparent: true, opacity: 0.55, roughness: 0.1 });
  g.add(box(6.5, H, 0.06, tinted, 6.25, H / 2, -1.2));
  g.add(box(0.06, H, 5.6, tinted, 3.0, H / 2, -4.0));
  colliders.push(rect(7.0, -1.2, 5.0, 0.15), rect(3.0, -4.0, 0.15, 5.6));
  const ledMat = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#22ff88', emissiveIntensity: 1.5 });
  for (let i = 0; i < 4; i++) {
    const x = 4.0 + i * 0.75;
    g.add(box(0.6, 2, 0.9, mats.plastic, x, 1, -D / 2 + 0.5, 0.02));
    for (let y = 0.3; y < 1.9; y += 0.18) g.add(box(0.3, 0.02, 0.01, ledMat, x, y, -D / 2 + 0.96));
  }
  colliders.push(rect(5.1, -D / 2 + 0.5, 3.2, 1.0));
  g.add(box(2.2, 0.05, 0.8, mats.plastic, 8.0, 0.75, -3.0));
  for (let m = 0; m < 3; m++) g.add(new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), glow(screenTexture(2), 1)).translateX(7.4 + m * 0.6).translateY(1.1).translateZ(-3.25));
  colliders.push(rect(8.0, -3.0, 2.3, 0.9));
  npc(12, { name: 'Hacker', hat: 'ninguno', top: 'sudadera', topColor: '#111', glasses: 'pasta', face: 'concentrado' }, 8.0, -2.2, Math.PI, 'sentado', g, people);
  interactables.push({ label: 'Hacker: rigs y contratos', x: 6.4, z: -2.0, radius: 1.2, run: () => hackerPanel(gameRef()) });
  const hackSign = signPlane('SERVIDORES', 'no tocar', 1.2, 0.38);
  hackSign.position.set(5.0, 2.55, -1.17);
  g.add(hackSign);

  // despacho del político y sala de prensa (sureste)
  g.add(box(2.4, 0.06, 1.0, mats.wood, 7.0, 0.76, 4.6, 0.02), box(2.3, 0.72, 0.06, mats.wood, 7.0, 0.38, 4.15));
  colliders.push(rect(7.0, 4.6, 2.5, 1.1));
  for (const [x, c] of [[5.4, '#1f5fae'], [8.6, '#d9b24a']] as const) {
    g.add(cyl(0.02, 2.2, mats.steel, x, 1.1, 6.4));
    g.add(box(0.02, 0.9, 0.6, new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide }), x, 1.8, 6.1));
  }
  npc(13, { name: 'Alcalde', hat: 'ninguno', top: 'traje', topColor: '#1d2440', tie: 'granate', pants: 'vestir', pantsColor: '#1d2440', shoes: 'zapatos', shoesColor: '#111', hair: '#d8d8d8', face: 'chulo', build: 'grande' }, 7.0, 5.4, Math.PI, 'brazos_cruzados', g, people);
  interactables.push({ label: 'Despacho del alcalde', x: 7.0, z: 3.5, radius: 1.3, run: () => politicianPanel(gameRef()) });
  // atril de prensa con micrófonos
  g.add(box(0.6, 1.1, 0.4, mats.wood, 4.2, 0.55, 2.0, 0.02));
  for (let i = 0; i < 3; i++) g.add(cyl(0.012, 0.3, mats.plastic, 4.05 + i * 0.15, 1.25, 2.1));
  colliders.push(rect(4.2, 2.0, 0.7, 0.5));
  const pressSign = signPlane('SALA DE PRENSA', 'Ayuntamiento de la Torre', 1.6, 0.5);
  pressSign.position.set(W / 2 - 0.03, 2.4, 3.0);
  pressSign.rotation.y = -Math.PI / 2;
  g.add(pressSign);

  // ascensor, cajero y plantas
  const elevator = createElevator(gameRef, 2, W / 2, 0.6, 'west');
  g.add(elevator.group);
  colliders.push(...elevator.colliders);
  interactables.push(...elevator.interactables);
  const atm = createAtm(gameRef, -1.6, D / 2 - 0.3, Math.PI);
  g.add(atm.group);
  colliders.push(atm.collider);
  interactables.push(atm.interactable);
  for (const [px, pz] of [[-9.4, -6.4], [2.4, 6.4]] as const) {
    const p = plant(1.1);
    p.position.set(px, 0, pz);
    g.add(p);
    colliders.push(rect(px, pz, 0.45, 0.45));
  }

  // luz tenue morada
  g.add(new THREE.HemisphereLight('#c9b8ff', '#201a28', 0.55));
  for (const [x, z, c] of [[-5.5, -1.4, '#c49bff'], [6.5, -4, '#5cffb0'], [6.5, 4, '#ffd8a0'], [0, 4.5, '#ffd8a0']] as const) {
    const p = new THREE.PointLight(c, 7, 9, 1.5);
    p.position.set(x, H - 0.3, z);
    g.add(p);
  }
  const key = new THREE.DirectionalLight('#d8ccff', 0.6);
  key.position.set(-4, 7, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -12, right: 12, top: 9, bottom: -9 });
  g.add(key, key.target);

  return {
    level: 2,
    name: 'Planta 2 · La Planta Gris',
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
    },
  };
}
