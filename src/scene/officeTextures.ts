import * as THREE from 'three';

// Texturas de la oficina dibujadas en canvas.

const cache = new Map<string, THREE.CanvasTexture>();

function canvasTexture(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

// Moqueta de losetas en dos tonos de azul grisáceo.
export function carpetTexture() {
  const tex = canvasTexture('carpet', 256, 256, (ctx, w, h) => {
    const tones = ['#4a5570', '#56627e'];
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        ctx.fillStyle = tones[(x + y) % 2];
        ctx.fillRect((x * w) / 2, (y * h) / 2, w / 2, h / 2);
      }
    }
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Cielo de atardecer con edificios a contraluz, para ver por las ventanas.
export function sunsetTexture() {
  return canvasTexture('sunset', 512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f6b76a');
    g.addColorStop(0.55, '#ffd89a');
    g.addColorStop(1, '#ffefc9');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(150,95,70,0.55)';
    let x = 0;
    while (x < w) {
      const bw = 20 + Math.random() * 40;
      const bh = 40 + Math.random() * 110;
      ctx.fillRect(x, h - bh, bw, bh);
      x += bw + 4;
    }
  });
}

// Pantallas de los ordenadores: guion de llamada, CRM o gráfica.
export function screenTexture(kind: number) {
  return canvasTexture('screen:' + kind, 256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#10161f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1f2a38';
    ctx.fillRect(0, 0, w, 16);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '700 10px sans-serif';
    switch (kind % 3) {
      case 0: {
        ctx.fillText('GUION DE LLAMADA', 8, 12);
        ctx.fillStyle = '#9fb3c8';
        const lines = ['Hola, le llamo de Brokerstars...', '¿Tiene 2 minutos?', 'Oferta exclusiva hoy', '¡Cerrar venta!'];
        lines.forEach((l, i) => ctx.fillText(l, 12, 38 + i * 22));
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(w - 70, h - 34, 60, 22);
        ctx.fillStyle = '#0b1a10';
        ctx.fillText('LLAMAR', w - 60, h - 19);
        break;
      }
      case 1: {
        ctx.fillText('CRM · LEADS', 8, 12);
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = i % 2 ? '#18212d' : '#1b2533';
          ctx.fillRect(6, 22 + i * 22, w - 12, 20);
          ctx.fillStyle = '#c9d3df';
          ctx.fillText(`Cliente #${1040 + i * 7}`, 12, 36 + i * 22);
          ctx.fillStyle = ['#2ecc71', '#f1c40f', '#e74c3c'][i % 3];
          ctx.fillRect(w - 40, 28 + i * 22, 26, 8);
        }
        break;
      }
      default: {
        ctx.fillText('BTC / EUR', 8, 12);
        ctx.strokeStyle = '#2ecc71';
        ctx.lineWidth = 2;
        ctx.beginPath();
        let y = h * 0.7;
        for (let x = 6; x < w - 6; x += 6) {
          y = Math.max(24, Math.min(h - 10, y + (Math.random() - 0.45) * 14));
          if (x === 6) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  });
}

export function whiteboardTexture() {
  return canvasTexture('whiteboard', 512, 320, (ctx, w, h) => {
    ctx.fillStyle = '#f7f7f4';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1d2a4a';
    ctx.font = '700 34px "Comic Sans MS", "Architects Daughter", cursive';
    ctx.textAlign = 'center';
    ctx.fillText('Objetivos del día', w / 2, 50);
    ctx.fillRect(w / 2 - 150, 60, 300, 3);
    ctx.textAlign = 'left';
    ctx.font = '600 28px "Comic Sans MS", cursive';
    ['1. Llamar 200 leads', '2. Cerrar 5 ventas', '3. ¿Subir de planta?', '4. Trabajo en equipo'].forEach((t, i) => ctx.fillText(t, 60, 115 + i * 48));
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(420, 245, 26, 0, Math.PI * 2);
    ctx.moveTo(408, 250);
    ctx.quadraticCurveTo(420, 262, 432, 250);
    ctx.stroke();
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(410, 235, 5, 5);
    ctx.fillRect(425, 235, 5, 5);
  });
}

export function clockTexture() {
  return canvasTexture('clock', 128, 128, (ctx, w) => {
    ctx.fillStyle = '#fbfbf8';
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.fillStyle = '#222';
      ctx.fillRect(w / 2 + Math.sin(a) * 50 - 2, w / 2 - Math.cos(a) * 50 - 2, 4, 4);
    }
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(w / 2, w / 2);
    ctx.lineTo(w / 2 + 22, w / 2 + 14);
    ctx.moveTo(w / 2, w / 2);
    ctx.lineTo(w / 2 - 6, w / 2 - 40);
    ctx.stroke();
  });
}

// Letrero de planta con el logo, junto al ascensor.
export function signTexture(text: string, sub: string) {
  return canvasTexture('sign:' + text + sub, 512, 160, (ctx, w, h) => {
    ctx.fillStyle = '#1c2230';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f2c14e';
    ctx.font = '900 64px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, 82);
    ctx.fillStyle = '#d7dbe3';
    ctx.font = '700 30px sans-serif';
    ctx.fillText(sub, w / 2, 130);
  });
}

export function stickyTexture(text: string) {
  return canvasTexture('sticky:' + text, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ffd66b';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7a3b10';
    ctx.font = '700 22px "Comic Sans MS", cursive';
    ctx.textAlign = 'center';
    text.split('\n').forEach((l, i) => ctx.fillText(l, w / 2, 48 + i * 30));
  });
}

export function keyboardTexture() {
  return canvasTexture('keyboard', 256, 96, (ctx, w, h) => {
    ctx.fillStyle = '#d9d6cf';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#efece6';
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 15; c++) ctx.fillRect(6 + c * 16.4, 6 + r * 17.5, 13, 14);
    }
  });
}

// Tienda online en la pantalla de las mesas de dropshipping.
export function shopScreenTexture(seed: number) {
  return canvasTexture('shopscreen:' + seed, 256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#8e44ad';
    ctx.fillRect(0, 0, w, 18);
    ctx.fillStyle = '#fff';
    ctx.font = '700 10px sans-serif';
    ctx.fillText('MI TIENDA · Pedidos de hoy: ' + (12 + seed * 3), 8, 13);
    const colors = ['#f39c12', '#16a085', '#2980b9', '#c0392b', '#8e44ad', '#27ae60'];
    for (let i = 0; i < 6; i++) {
      const x = 10 + (i % 3) * 82, y = 26 + Math.floor(i / 3) * 66;
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(x, y, 74, 58);
      ctx.fillStyle = colors[(i + seed) % colors.length];
      ctx.fillRect(x + 18, y + 6, 38, 30);
      ctx.fillStyle = '#333';
      ctx.fillText((9.99 + i * 5).toFixed(2) + ' €', x + 14, y + 50);
    }
  });
}

// Panel LED con cotizaciones que se desplaza (se repinta cada frame).
export function tickerCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 64;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { canvas, tex, ctx: canvas.getContext('2d')! };
}
