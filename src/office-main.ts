import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { PRESETS } from './characters/catalog';
import { Character } from './characters/Character';
import { createOffice } from './scene/office';

// Vista de diseño de la oficina (Planta 1). De momento solo se mira con
// la cámara; el movimiento del jugador llega en la siguiente fase.

const viewport = document.getElementById('viewport')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a1a22');
// reflejos suaves para metales y cristal
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
const { operators } = createOffice(scene);

// el jugador de pie en el pasillo, mirando hacia los puestos
const player = new Character({ ...PRESETS[0], name: 'Jugador' });
player.root.position.set(-1.2, 0, 3.6);
player.root.rotation.y = Math.PI;
scene.add(player.root);

const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 60);
camera.position.set(-0.5, 1.9, 5.4);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-1.5, 1.2, 1.5);
controls.enableDamping = true;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.5, 0.95));
composer.addPass(new OutputPass());

const resize = () => {
  const { clientWidth: w, clientHeight: h } = viewport;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
};
new ResizeObserver(resize).observe(viewport);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  player.update(dt);
  for (const op of operators) op.update(dt);
  controls.update();
  composer.render();
});

// para capturas: parar la animación y pintar un único fotograma
const still = () => {
  renderer.setAnimationLoop(null);
  controls.update();
  composer.render();
};

Object.assign(window, { brokerstars: { camera, controls, scene, player, still } });
