import * as THREE from 'three';
import type { Face, FacialHair, Print } from './types';

// Texturas dibujadas en canvas: no necesitamos imágenes externas y
// mantienen el look pixelado de San Andreas.

const cache = new Map<string, THREE.CanvasTexture>();

function makeTexture(
  key: string,
  size: number,
  draw: (ctx: CanvasRenderingContext2D, s: number, h: number) => void,
  height = size,
) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // filtro "nearest": píxeles nítidos, como en PS2
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  cache.set(key, tex);
  return tex;
}

// Números pseudoaleatorios con semilla, para que las texturas salgan
// siempre iguales.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgba(hex: string, k: number, a = 1) {
  const c = new THREE.Color(hex);
  const f = (v: number) => Math.round(Math.min(1, Math.max(0, v * k)) * 255);
  // la textura se guarda en sRGB, así que convertimos de vuelta
  c.convertLinearToSRGB();
  return `rgba(${f(c.r)},${f(c.g)},${f(c.b)},${a})`;
}

// Ruido de grano fino por encima de todo el lienzo.
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, seed: number) {
  const r = rng(seed);
  for (let i = 0; i < w * h * 0.35; i++) {
    const v = r() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${amount * r()})`;
    ctx.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 1);
  }
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
      case 'mono': {
        // círculo de camuflaje con cabeza de mono, en plan parodia
        ctx.save();
        ctx.beginPath();
        ctx.arc(s / 2, s / 2 - 8, 46, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = '#8c7a4a';
        ctx.fillRect(0, 0, s, s);
        const blobs = ['#4d4a2a', '#c9b98a', '#6b5b33', '#e8dcb5'];
        for (let i = 0; i < 26; i++) {
          ctx.fillStyle = blobs[i % blobs.length];
          ctx.beginPath();
          const a = i * 2.39;
          const r = 8 + ((i * 17) % 38);
          ctx.ellipse(s / 2 + Math.cos(a) * r, s / 2 - 8 + Math.sin(a) * r, 10 + (i % 4) * 3, 6 + (i % 3) * 3, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = '#141414';
        ctx.beginPath();
        ctx.arc(s / 2, s / 2 - 10, 26, 0, Math.PI * 2);
        ctx.arc(s / 2 - 27, s / 2 - 12, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(s / 2 + 27, s / 2 - 12, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f4f4f0';
        ctx.beginPath();
        ctx.ellipse(s / 2 - 9, s / 2 - 14, 9, 11, 0, 0, Math.PI * 2);
        ctx.ellipse(s / 2 + 9, s / 2 - 14, 9, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(s / 2, s / 2 + 2, 16, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#141414';
        ctx.fillRect(s / 2 - 12, s / 2 - 14, 5, 5);
        ctx.fillRect(s / 2 + 7, s / 2 - 14, 5, 5);
        ctx.fillRect(s / 2 - 6, s / 2, 3, 3);
        ctx.fillRect(s / 2 + 3, s / 2, 3, 3);
        ctx.fillStyle = ink;
        ctx.font = '900 15px Impact, "Arial Black", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('BROKER APE', s / 2, s - 10);
        break;
      }
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

// Vaquero pintado: lavado más claro en el centro de la pernera, costuras
// laterales, bigotes arriba y pliegues amontonados abajo. En un cilindro
// u=0 es la parte de delante y v=1 la de arriba (arriba del lienzo).
export function denimTexture(color: string, ripped: boolean, skin: string) {
  return makeTexture(`denim:${color}:${ripped}:${skin}`, 64, (ctx, w, h) => {
    const r = rng(7);
    ctx.fillStyle = rgba(color, 1);
    ctx.fillRect(0, 0, w, h);
    // hilos verticales
    for (let x = 0; x < w; x++) {
      ctx.fillStyle = rgba(color, 0.85 + r() * 0.3, 0.35);
      ctx.fillRect(x, 0, 1, h);
    }
    // lavado claro delante (bordes del lienzo) y detrás más suave
    for (const [cx, k] of [[0, 1.55], [w, 1.55], [w / 2, 1.25]] as const) {
      const g = ctx.createRadialGradient(cx, h * 0.45, 2, cx, h * 0.45, w * 0.32);
      g.addColorStop(0, rgba(color, k, 0.85));
      g.addColorStop(1, rgba(color, k, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    // costuras laterales
    for (const x of [w * 0.25, w * 0.75]) {
      ctx.fillStyle = rgba(color, 0.55);
      ctx.fillRect(x - 1, 0, 2, h);
      ctx.fillStyle = 'rgba(214,170,90,0.6)';
      for (let y = 0; y < h; y += 3) ctx.fillRect(x + 1, y, 1, 1);
    }
    // bigotes en la parte de arriba delante
    for (let i = 0; i < 6; i++) {
      const y = 6 + i * 4;
      ctx.fillStyle = rgba(color, 1.7, 0.7);
      ctx.fillRect(0, y, 9 - i, 1);
      ctx.fillRect(w - 9 + i, y, 9 - i, 1);
    }
    // pliegues ondulados en la parte de abajo: sombra con un brillo encima
    let y = h * 0.62;
    while (y < h - 3) {
      const x0 = Math.floor(r() * w);
      const len = w * (0.35 + r() * 0.4);
      const amp = 1 + r() * 2;
      for (let x = 0; x < len; x++) {
        const px = (x0 + x) % w;
        const py = Math.floor(y + Math.sin((x / len) * Math.PI * 2) * amp);
        ctx.fillStyle = rgba(color, 0.55, 0.75);
        ctx.fillRect(px, py, 1, 2);
        ctx.fillStyle = rgba(color, 1.45, 0.5);
        ctx.fillRect(px, py - 1, 1, 1);
      }
      y += 6 + r() * 6;
    }
    if (ripped) {
      for (const [x, ry, rw] of [[2, 30, 10], [54, 34, 9], [30, 60, 11], [6, 86, 8]]) {
        ctx.fillStyle = skin;
        ctx.fillRect(x, ry, rw, 7);
        ctx.fillStyle = '#eeeeee';
        for (let t = 0; t < 3; t++) ctx.fillRect(x - 1, ry + 1 + t * 2, rw + 2, 1);
      }
    }
    grain(ctx, w, h, 0.08, 3);
  }, 128);
}

// Camiseta / sudadera pintada: arrugas, dobladillo, cuello y el
// estampado en el centro de la parte delantera (u = 0.5).
export function shirtTexture(color: string, print: Print, printV: number, printW: number, printH: number) {
  return makeTexture(`shirt:${color}:${print}:${printV}:${printW}:${printH}`, 256, (ctx, w, h) => {
    const r = rng(11);
    ctx.fillStyle = rgba(color, 1);
    ctx.fillRect(0, 0, w, h);
    // arrugas: trazos diagonales con sombra y brillo
    for (let i = 0; i < 26; i++) {
      const x = r() * w;
      const y = h * 0.25 + r() * h * 0.75;
      const len = 10 + r() * 26;
      const dir = r() < 0.5 ? -1 : 1;
      ctx.strokeStyle = rgba(color, 0.7, 0.55);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dir * len, y + len * 0.5);
      ctx.stroke();
      ctx.strokeStyle = rgba(color, 1.25, 0.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 1, y - 1);
      ctx.lineTo(x + 1 + dir * len, y - 1 + len * 0.5);
      ctx.stroke();
    }
    // sombra debajo del pecho y en los costados
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.12)');
    g.addColorStop(0.25, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    g.addColorStop(0.75, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // dobladillo
    ctx.fillStyle = rgba(color, 0.65);
    ctx.fillRect(0, h - 5, w, 1);
    if (print !== 'ninguno') {
      const img = printTexture(print, inkFor(color)).image as HTMLCanvasElement;
      const pw = printW * w;
      const ph = printH * h;
      ctx.drawImage(img, w / 2 - pw / 2, (1 - printV) * h - ph / 2, pw, ph);
    }
    grain(ctx, w, h, 0.05, 5);
  });
}

// Zapatilla gorda: un lienzo por cara de la caja.
export function shoeTextures(color: string) {
  const side = makeTexture(`shoe-side:${color}`, 64, (ctx, w, h) => {
    ctx.fillStyle = rgba(color, 1);
    ctx.fillRect(0, 0, w, h);
    // paneles
    ctx.fillStyle = rgba(color, 0.82);
    ctx.fillRect(0, h * 0.15, w * 0.3, h * 0.5);
    ctx.fillRect(w * 0.72, h * 0.1, w * 0.28, h * 0.55);
    ctx.fillStyle = rgba(color, 0.6);
    for (let x = 4; x < w; x += 4) ctx.fillRect(x, h * 0.66, 2, 1); // pespunte
    // logo genérico
    ctx.fillStyle = inkFor(color) === '#141414' ? 'rgba(20,20,20,0.85)' : 'rgba(240,240,240,0.9)';
    ctx.beginPath();
    ctx.moveTo(w * 0.22, h * 0.55);
    ctx.quadraticCurveTo(w * 0.5, h * 0.62, w * 0.82, h * 0.25);
    ctx.quadraticCurveTo(w * 0.5, h * 0.5, w * 0.22, h * 0.55);
    ctx.fill();
    // suela
    ctx.fillStyle = '#f1f1ee';
    ctx.fillRect(0, h * 0.7, w, h * 0.3);
    ctx.fillStyle = '#b9b9b4';
    ctx.fillRect(0, h * 0.7, w, 1);
    ctx.fillRect(0, h - 3, w, 3);
    for (let x = 2; x < w; x += 6) ctx.fillRect(x, h * 0.82, 3, 1);
    grain(ctx, w, h, 0.15, 9);
  }, 32);
  const top = makeTexture(`shoe-top:${color}`, 32, (ctx, w, h) => {
    ctx.fillStyle = rgba(color, 1);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = rgba(color, 0.7);
    ctx.fillRect(w * 0.3, h * 0.05, w * 0.4, h * 0.6);
    ctx.fillStyle = '#f4f4f0';
    for (let y = 3; y < h * 0.6; y += 4) ctx.fillRect(w * 0.32, y, w * 0.36, 2); // cordones
    ctx.fillStyle = rgba(color, 0.85);
    ctx.fillRect(0, h * 0.75, w, h * 0.25); // puntera
    grain(ctx, w, h, 0.15, 13);
  }, 64);
  const sole = makeTexture(`shoe-sole`, 16, (ctx, w, h) => {
    ctx.fillStyle = '#d8d8d2';
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 0.3, 17);
  });
  return { side, top, sole };
}

// Pelo: mechones finos oscuros y claros.
export function hairTexture(color: string) {
  return makeTexture(`hair:${color}`, 32, (ctx, w, h) => {
    const r = rng(21);
    ctx.fillStyle = rgba(color, 1);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = r() < 0.5 ? rgba(color, 0.55, 0.8) : rgba(color, 1.8, 0.5);
      ctx.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 2 + Math.floor(r() * 4));
    }
  });
}

// Piel con un poco de grano, para que no quede plana.
export function skinTexture(color: string) {
  return makeTexture(`skin:${color}`, 32, (ctx, w, h) => {
    ctx.fillStyle = rgba(color, 1);
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 0.08, 23);
  });
}

function inkFor(color: string) {
  const c = new THREE.Color(color);
  return c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 0.5 ? '#141414' : '#f4f4f0';
}

// Billete inventado para los fajos (no copia ningún billete real).
export function billTexture() {
  return makeTexture('bill', 256, (ctx, s) => {
    ctx.fillStyle = '#c8d5c0';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#4e6b52';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, s - 20, s - 20);
    ctx.fillStyle = '#4e6b52';
    ctx.font = '900 46px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('100', 70, -70);
    ctx.fillText('100', -70, 70);
    ctx.font = '700 18px Impact, sans-serif';
    ctx.fillText('BROKERSTARS', 0, 0);
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(s / 2, s / 2, 34, 44, 0, 0, Math.PI * 2);
    ctx.stroke();
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
