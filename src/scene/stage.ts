import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { graffitiWallTexture, skyTexture, tileTexture } from '../characters/textures';
import { RetroPass } from './retro';

// Escenario del creador: acera, pared con grafiti y cielo de atardecer.

export function createStage(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  container.appendChild(renderer.domElement);
  const retro = new RetroPass(renderer);

  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog('#c98aa8', 9, 22);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(1.4, 1.35, 5.2);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.95, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.2;
  controls.maxDistance = 7;
  controls.maxPolarAngle = Math.PI * 0.55;

  scene.add(new THREE.HemisphereLight('#ffd9e6', '#3a2f4a', 0.75));
  const sun = new THREE.DirectionalLight('#ffc9a3', 1.7);
  sun.position.set(3, 5, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -3;
  sun.shadow.camera.right = sun.shadow.camera.top = 3;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  // luz de contorno por detrás para que el personaje se despegue del fondo
  const rim = new THREE.DirectionalLight('#9ec5ff', 1.3);
  rim.position.set(-3, 3, -4);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(9, 2.8, 0.2),
    new THREE.MeshStandardMaterial({ map: graffitiWallTexture(), roughness: 0.7, metalness: 0.2 }),
  );
  wall.position.set(0, 1.4, -2.4);
  wall.receiveShadow = true;
  scene.add(wall);

  // bordillo
  const curb = new THREE.Mesh(new THREE.BoxGeometry(30, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: '#8c877f' }));
  curb.position.set(0, 0.06, 3.5);
  curb.receiveShadow = true;
  scene.add(curb);

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h);
    retro.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  return { renderer, scene, camera, controls, retro };
}
