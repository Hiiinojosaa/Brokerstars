import * as THREE from 'three';
import './style.css';
import { Character } from './characters/Character';
import { createStage } from './scene/stage';
import { createCreator, loadSaved } from './ui/creator';

const viewport = document.getElementById('viewport')!;
const panel = document.getElementById('panel')!;

const { renderer, scene, camera, controls, retro, render } = createStage(viewport);

const initial = loadSaved();
const character = new Character(initial);
scene.add(character.root);

const nametag = document.createElement('div');
nametag.id = 'nametag';
nametag.textContent = initial.name;
viewport.appendChild(nametag);

createCreator(panel, initial, {
  onChange: (config) => {
    character.setConfig(config);
    nametag.textContent = config.name;
  },
  onPose: (pose) => (character.pose = pose),
  onRetro: (on) => (retro.enabled = on),
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  character.update(dt);
  controls.update();
  render();
});

// para pruebas desde la consola / tests automáticos
Object.assign(window, { brokerstars: { character, camera, controls, retro, scene } });
