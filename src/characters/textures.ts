import * as THREE from 'three';
import type { Print } from './types';

// Texturas dibujadas en canvas: no necesitamos imágenes externas y
// mantienen el look pixelado de San Andreas.

const cache = new Map<string, THREE.CanvasTexture>();

function makeTexture(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  cache.set(key, tex);
  return tex;
}

// Mano de Fátima con ojo, centrada en (cx, cy) y de alto h.
function drawHamsa(ctx: CanvasRenderingContext2D, cx: number, cy: number, h: number, color: string) {
  const u = h / 10;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.lineWidth = u * 0.45;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  // dedos centrales
  const fingers = [-1.9, -0.65, 0.65, 1.9];
  const tops = [-3.2, -4.4, -4.4, -3.2];
  // pulgares abiertos hacia fuera, como en la hamsa clásica
  ctx.moveTo(-1.2 * u, 4.6 * u);
  ctx.quadraticCurveTo(-3.6 * u, 4.4 * u, -3.9 * u, 2 * u);
  ctx.lineTo(-4.4 * u, 0.2 * u);
  ctx.quadraticCurveTo(-4.3 * u, -0.6 * u, -3.4 * u, -0.2 * u);
  ctx.lineTo(-2.5 * u, 0.6 * u);
  for (let i = 0; i < fingers.length; i++) {
    const x = fingers[i] * u;
    const w = 0.55 * u;
    ctx.lineTo(x - w, -0.6 * u);
    ctx.lineTo(x - w, tops[i] * u);
    ctx.quadraticCurveTo(x, (tops[i] - 0.8) * u, x + w, tops[i] * u);
    ctx.lineTo(x + w, -0.6 * u);
  }
  ctx.lineTo(2.5 * u, 0.6 * u);
  ctx.lineTo(3.4 * u, -0.2 * u);
  ctx.quadraticCurveTo(4.3 * u, -0.6 * u, 4.4 * u, 0.2 * u);
  ctx.lineTo(3.9 * u, 2 * u);
  ctx.quadraticCurveTo(3.6 * u, 4.4 * u, 1.2 * u, 4.6 * u);
  ctx.closePath();
  ctx.stroke();
  // ojo
  ctx.beginPath();
  ctx.moveTo(-1.8 * u, 1.6 * u);
  ctx.quadraticCurveTo(0, 0.2 * u, 1.8 * u, 1.6 * u);
  ctx.quadraticCurveTo(0, 3 * u, -1.8 * u, 1.6 * u);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 1.6 * u, 0.55 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function dripText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  ctx.fillStyle = color;
  ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  // goterones de pintura
  const w = ctx.measureText(text).width;
  for (let i = 0; i < 6; i++) {
    const dx = x - w / 2 + ((i * 37) % w);
    const len = 6 + ((i * 13) % 14);
    ctx.fillRect(dx, y + size * 0.3, 3, len);
    ctx.beginPath();
    ctx.arc(dx + 1.5, y + size * 0.3 + len, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Estampado del pecho sobre fondo transparente; `ink` es el color que
// contrasta con la prenda.
export function printTexture(print: Exclude<Print, 'ninguno'>, ink: string) {
  return makeTexture(`print:${print}:${ink}`, 128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    switch (print) {
      case 'hamsa':
        drawHamsa(ctx, s / 2, s / 2 - 6, s * 0.7, ink);
        ctx.fillStyle = ink;
        ctx.font = 'italic 700 13px "Brush Script MT", cursive';
        ctx.textAlign = 'center';
        ctx.fillText('o j o', s / 2, s - 14);
        break;
      case 'hand':
        dripText(ctx, 'HAND', s / 2, s / 2, 40, ink);
        break;
      case 'gh':
        ctx.fillStyle = ink;
        ctx.font = '900 64px Impact, "Arial Black", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GH', s / 2, s / 2);
        break;
      case 'brokerstars':
        ctx.fillStyle = ink;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 20px Impact, "Arial Black", sans-serif';
        ctx.fillText('BROKER', s / 2, s / 2 - 10);
        ctx.fillText('STARS', s / 2, s / 2 + 12);
        ctx.font = '900 22px sans-serif';
        ctx.fillText('★', s / 2, s / 2 - 36);
        break;
      case 'dolar':
        ctx.fillStyle = '#2e8b57';
        ctx.beginPath();
        ctx.arc(s / 2, s / 2, 36, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f4f4f0';
        ctx.font = '900 54px Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', s / 2, s / 2 + 2);
        break;
    }
  });
}

export function graffitiWallTexture() {
  return makeTexture('wall', 512, (ctx, s) => {
    // chapa ondulada
    for (let x = 0; x < s; x += 8) {
      ctx.fillStyle = x % 16 === 0 ? '#5d6166' : '#6d7176';
      ctx.fillRect(x, 0, 8, s);
    }
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#141414';
    ctx.fillStyle = '#141414';
    ctx.lineWidth = 6;
    ctx.font = 'italic 900 72px "Brush Script MT", cursive';
    ctx.textAlign = 'center';
    ctx.strokeText('Brokerstars', s / 2, s * 0.42);
    ctx.font = 'italic 700 34px "Brush Script MT", cursive';
    ctx.fillText('nos vemos arriba', s / 2, s * 0.58);
    ctx.fillStyle = '#c0392b';
    ctx.font = '900 70px Impact, sans-serif';
    ctx.fillText('$$', s * 0.82, s * 0.8);
    ctx.globalAlpha = 1;
  });
}

export function tileTexture() {
  const tex = makeTexture('tiles', 128, (ctx, s) => {
    ctx.fillStyle = '#aaa59c';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#a8a39a';
    ctx.fillRect(0, 0, s, 3);
    ctx.fillRect(0, 0, 3, s);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.03 + (i % 5) * 0.01})`;
      ctx.fillRect((i * 53) % s, (i * 29) % s, 4, 4);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 12);
  return tex;
}

export function skyTexture() {
  return makeTexture('sky', 256, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#1a1b3a');
    g.addColorStop(0.45, '#6a4c8c');
    g.addColorStop(0.75, '#e79bb5');
    g.addColorStop(1, '#f6c99a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}
