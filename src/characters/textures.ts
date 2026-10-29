import * as THREE from 'three';
import type { Face, FacialHair, Print } from './types';

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

// Mano de Fátima rellena con el ojo calado, centrada en (cx, cy) y de alto h.
function drawHamsa(ctx: CanvasRenderingContext2D, cx: number, cy: number, h: number, color: string) {
  const u = h / 10;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  const pill = (x: number, y: number, w: number, hh: number, angle = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.roundRect(-w / 2, -hh / 2, w, hh, w / 2);
    ctx.fill();
    ctx.restore();
  };
  // palma
  ctx.beginPath();
  ctx.moveTo(-3 * u, -0.5 * u);
  ctx.lineTo(3 * u, -0.5 * u);
  ctx.quadraticCurveTo(3.4 * u, 4.6 * u, 0, 4.9 * u);
  ctx.quadraticCurveTo(-3.4 * u, 4.6 * u, -3 * u, -0.5 * u);
  ctx.fill();
  // tres dedos centrales y dos pulgares hacia fuera
  pill(-1.75 * u, -2.2 * u, 1.55 * u, 4.2 * u);
  pill(0, -2.7 * u, 1.55 * u, 5 * u);
  pill(1.75 * u, -2.2 * u, 1.55 * u, 4.2 * u);
  pill(-3.6 * u, 0.6 * u, 1.45 * u, 3.6 * u, -0.5);
  pill(3.6 * u, 0.6 * u, 1.45 * u, 3.6 * u, 0.5);
  // ojo calado
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(-2 * u, 1.9 * u);
  ctx.quadraticCurveTo(0, 0.3 * u, 2 * u, 1.9 * u);
  ctx.quadraticCurveTo(0, 3.5 * u, -2 * u, 1.9 * u);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.arc(0, 1.9 * u, 0.65 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function shade(hex: string, k: number) {
  const c = new THREE.Color(hex).multiplyScalar(k);
  return '#' + c.getHexString();
}

// Cara dibujada: se proyecta sobre la parte delantera de la cabeza.
// Tiene fondo transparente; los párpados usan el color de la piel.
export function faceTexture(face: Face, facialHair: FacialHair, skin: string, hair: string) {
  return makeTexture(`face:${face}:${facialHair}:${skin}:${hair}`, 256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const eyeY = 104;
    const ink = '#1b1210';

    // ojos
    for (const side of [-1, 1]) {
      const x = s / 2 + side * 56;
      ctx.fillStyle = '#fbf8f2';
      ctx.beginPath();
      ctx.ellipse(x, eyeY, 20, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      const look = face === 'chulo' ? -4 : 0;
      ctx.fillStyle = '#4a2c1c';
      ctx.beginPath();
      ctx.arc(x + look, eyeY + 1, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(x + look, eyeY + 1, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x + look + 4, eyeY - 4, 3.2, 0, Math.PI * 2);
      ctx.fill();

      // párpado: medio cerrado si va de chulo o serio
      const lid = face === 'chulo' ? 9 : face === 'serio' || face === 'enfadado' ? 4 : 0;
      if (lid > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(x, eyeY, 21, 16, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = skin;
        ctx.fillRect(x - 24, eyeY - 20, 48, 6 + lid);
        ctx.restore();
      }
      ctx.strokeStyle = ink;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(x, eyeY + lid * 0.4, 21, 15 - lid * 0.5, 0, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();

      // ceja
      ctx.strokeStyle = hair;
      ctx.lineWidth = 9;
      ctx.beginPath();
      const tilt = face === 'enfadado' ? 9 : face === 'feliz' ? -4 : face === 'chulo' ? (side === 1 ? -5 : 2) : 0;
      ctx.moveTo(x - side * 18, eyeY - 30 + tilt);
      ctx.quadraticCurveTo(x, eyeY - 38, x + side * 22, eyeY - 33 - tilt * 0.3);
      ctx.stroke();
    }

    // vello facial (debajo de la boca para que la boca quede encima)
    ctx.fillStyle = hair;
    ctx.strokeStyle = hair;
    if (facialHair === 'barba') {
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.moveTo(10, 120);
      ctx.lineTo(28, 120);
      ctx.quadraticCurveTo(40, 200, s / 2, 210);
      ctx.quadraticCurveTo(s - 40, 200, s - 28, 120);
      ctx.lineTo(s - 10, 120);
      ctx.quadraticCurveTo(s - 14, 246, s / 2, 252);
      ctx.quadraticCurveTo(14, 246, 10, 120);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (facialHair !== 'nada') {
      // bigote fino: más grueso en el centro y afilado en las puntas
      ctx.beginPath();
      ctx.moveTo(s / 2 - 30, 180);
      ctx.quadraticCurveTo(s / 2 - 14, 166, s / 2, 168);
      ctx.quadraticCurveTo(s / 2 + 14, 166, s / 2 + 30, 180);
      ctx.quadraticCurveTo(s / 2 + 12, 175, s / 2, 177);
      ctx.quadraticCurveTo(s / 2 - 12, 175, s / 2 - 30, 180);
      ctx.fill();
    }
    if (facialHair === 'perilla' || facialHair === 'barba') {
      ctx.beginPath();
      ctx.moveTo(s / 2 - 18, 212);
      ctx.lineTo(s / 2 + 18, 212);
      ctx.quadraticCurveTo(s / 2 + 16, 238, s / 2, 242);
      ctx.quadraticCurveTo(s / 2 - 16, 238, s / 2 - 18, 212);
      ctx.fill();
    }

    // boca
    const mouthY = 192;
    ctx.strokeStyle = shade(skin, 0.45);
    ctx.lineWidth = 5;
    ctx.beginPath();
    switch (face) {
      case 'feliz':
        ctx.fillStyle = '#5a1f1f';
        ctx.moveTo(s / 2 - 30, mouthY - 6);
        ctx.quadraticCurveTo(s / 2, mouthY + 34, s / 2 + 30, mouthY - 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(s / 2 - 22, mouthY - 5, 44, 8);
        break;
      case 'chulo':
        ctx.moveTo(s / 2 - 20, mouthY + 2);
        ctx.quadraticCurveTo(s / 2 + 6, mouthY + 6, s / 2 + 24, mouthY - 6);
        ctx.stroke();
        break;
      case 'serio':
        ctx.moveTo(s / 2 - 18, mouthY);
        ctx.lineTo(s / 2 + 18, mouthY);
        ctx.stroke();
        break;
      case 'enfadado':
        ctx.moveTo(s / 2 - 20, mouthY + 6);
        ctx.quadraticCurveTo(s / 2, mouthY - 6, s / 2 + 20, mouthY + 6);
        ctx.stroke();
        break;
      default:
        ctx.moveTo(s / 2 - 22, mouthY - 2);
        ctx.quadraticCurveTo(s / 2, mouthY + 12, s / 2 + 22, mouthY - 2);
        ctx.stroke();
    }
  });
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
