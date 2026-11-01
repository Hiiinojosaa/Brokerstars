import { button, el, euros } from './hud';
import type { Game } from './world';

// Juegos del Casino Royale. Todo se juega con fichas compradas en la caja
// con dinero del juego: aquí nunca entra dinero real.

const chips = (n: number) => `${n.toLocaleString('es-ES')} fichas`;

function betSelector(values = [5, 25, 100, 500, 1000, 5000]) {
  let value = values[1];
  const row = el('div', 'row chip-row');
  const render = () => {
    row.innerHTML = '';
    for (const v of values) row.append(button(String(v), () => { value = v; render(); }, 'chip-btn' + (v === value ? ' on' : '')));
  };
  render();
  return { row, get: () => value };
}

function chipBar(game: Game) {
  return el('div', 'chip-bar', `🪙 ${chips(game.state.data.chips)}`);
}

function spend(game: Game, n: number) {
  if (game.state.data.chips < n) {
    game.hud.toast('No tienes fichas suficientes: cámbialas en la caja', 'bad');
    return false;
  }
  game.state.data.chips -= n;
  game.state.complete('casino');
  game.state.persist();
  return true;
}

function win(game: Game, n: number) {
  game.state.data.chips += n;
  game.state.persist();
}

// --- caja ---
export function cashierPanel(game: Game) {
  const { state, hud } = game;
  hud.openPanel('Caja del casino', (body) => {
    body.append(chipBar(game), el('p', 'muted', '1 ficha = 1 €. Compra en efectivo o con tarjeta; al cambiar te lo damos en efectivo.'));
    const amount = el('input', 'field') as HTMLInputElement;
    amount.type = 'number';
    amount.value = '100';
    const row = el('div', 'row');
    row.append(
      button('Comprar en efectivo', () => {
        const n = Math.floor(Number(amount.value));
        if (!(n > 0) || !state.payCash(n)) return hud.toast('No llevas tanto efectivo', 'bad');
        win(game, n);
        cashierPanel(game);
      }),
      button('Comprar con tarjeta', () => {
        const n = Math.floor(Number(amount.value));
        if (!(n > 0) || !state.hasCard || !state.payCard(n, 'Fichas Casino Royale')) return hud.toast('Tarjeta rechazada', 'bad');
        win(game, n);
        cashierPanel(game);
      }, 'btn ghost'),
    );
    body.append(amount, row, button(`Cambiar todas las fichas a efectivo (${euros(state.data.chips)})`, () => {
      state.data.cash += state.data.chips;
      state.data.chips = 0;
      state.persist();
      cashierPanel(game);
    }, 'btn ghost'));
  });
}

// --- ruleta europea ---
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

interface RouletteBet {
  label: string;
  numbers: number[];
  payout: number; // a cuánto se paga (35 = 35 a 1)
  amount: number;
}

export function roulettePanel(game: Game) {
  const { hud } = game;
  const bets: RouletteBet[] = [];
  const history: number[] = [];
  let spinning = false;
  hud.openPanel('Ruleta Lightning', (body) => {
    const bar = chipBar(game);
    const sel = betSelector();
    const wheel = el('canvas', 'wheel') as HTMLCanvasElement;
    wheel.width = wheel.height = 240;
    const result = el('div', 'muted', 'Pon fichas en el tapete y gira');
    // --- Lightning: cada ronda 1-5 números reciben un multiplicador ---
    const MULTS = [50, 100, 150, 200, 250, 300, 400, 500];
    let lightning: Record<number, number> = {};
    const strip = el('div', 'light-strip');
    const genLightning = () => {
      lightning = {};
      const count = 1 + Math.floor(Math.random() * 5);
      while (Object.keys(lightning).length < count) {
        const n = Math.floor(Math.random() * 37);
        lightning[n] = MULTS[Math.floor(Math.random() * MULTS.length)];
      }
      strip.innerHTML = '<span class="ls-tag">⚡ LIGHTNING</span>';
      for (const [n, m] of Object.entries(lightning)) {
        const c = el('span', 'ls-num');
        c.innerHTML = `<b>${n}</b><small>×${m}</small>`;
        strip.append(c);
      }
      // marca los números con rayo en el tapete
      board.querySelectorAll('.rcell').forEach((b) => {
        const num = Number((b as HTMLElement).dataset.n);
        (b as HTMLElement).classList.toggle('lit', lightning[num] !== undefined);
      });
    };
    // lluvia de multiplicadores al ganar con rayo
    const rain = (mult: number) => {
      const r = el('div', 'mult-rain');
      for (let i = 0; i < 24; i++) {
        const d = el('span', 'mr', `×${mult}`);
        d.style.left = Math.random() * 100 + '%';
        d.style.animationDelay = (Math.random() * 0.6) + 's';
        d.style.fontSize = (14 + Math.random() * 22) + 'px';
        r.append(d);
      }
      body.append(r);
      setTimeout(() => r.remove(), 2200);
    };
    const board = el('div', 'roulette');
    // montón de fichas sobre una casilla
    const chipStack = (amount: number) => {
      const s = el('span', 'chip-stack');
      s.textContent = amount >= 1000 ? (amount / 1000) + 'k' : String(amount);
      s.style.setProperty('--chip', amount >= 5000 ? '#0f8a4a' : amount >= 1000 ? '#c6a24c' : amount >= 500 ? '#7d2ae8' : amount >= 100 ? '#1a1a1a' : amount >= 25 ? '#1f5fae' : '#b3202a');
      return s;
    };
    const place = (label: string, numbers: number[], payout: number, cell: HTMLElement) => {
      if (spinning) return;
      const v = sel.get();
      if (!spend(game, v)) return;
      const existing = bets.find((b) => b.label === label);
      if (existing) existing.amount += v;
      else bets.push({ label, numbers, payout, amount: v });
      cell.querySelector('.chip-stack')?.remove();
      cell.append(chipStack(bets.find((b) => b.label === label)!.amount));
      bar.textContent = `🪙 ${chips(game.state.data.chips)}`;
    };
    const cell = (text: string, cls: string, numbers: number[], payout: number) => {
      const b = el('button', 'rcell ' + cls, text);
      if (numbers.length === 1) b.dataset.n = String(numbers[0]);
      b.onclick = () => place(text, numbers, payout, b);
      return b;
    };
    board.append(cell('0', 'green zero', [0], 35));
    for (let col = 0; col < 12; col++) {
      for (let row = 2; row >= 0; row--) {
        const n = col * 3 + row + 1;
        const c = cell(String(n), RED.has(n) ? 'red' : 'black', [n], 35);
        c.style.gridColumn = String(col + 2);
        c.style.gridRow = String(3 - row);
        board.append(c);
      }
    }
    const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
    const outside = el('div', 'roulette-out');
    outside.append(
      cell('1-12', 'out', range(1, 12), 2), cell('13-24', 'out', range(13, 24), 2), cell('25-36', 'out', range(25, 36), 2),
      cell('1-18', 'out', range(1, 18), 1), cell('PAR', 'out', range(1, 36).filter((n) => n % 2 === 0), 1),
      cell('ROJO', 'red out', [...RED], 1), cell('NEGRO', 'black out', range(1, 36).filter((n) => !RED.has(n)), 1),
      cell('IMPAR', 'out', range(1, 36).filter((n) => n % 2), 1), cell('19-36', 'out', range(19, 36), 1),
    );
    // dibuja la rueda: `wheelAngle` gira el plato, `ballAngle` la posición de la
    // bola (en ángulo absoluto) y `ballR` su radio (va cayendo hacia dentro)
    const drawWheel = (wheelAngle: number, ballAngle: number, ballR: number) => {
      const ctx = wheel.getContext('2d')!;
      const R = 116, c = 120;
      ctx.clearRect(0, 0, 240, 240);
      // aro exterior dorado
      ctx.beginPath(); ctx.arc(c, c, R + 2, 0, Math.PI * 2);
      ctx.fillStyle = '#4a3418'; ctx.fill();
      const seg = (Math.PI * 2) / WHEEL.length;
      WHEEL.forEach((n, i) => {
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.arc(c, c, R, wheelAngle + i * seg, wheelAngle + (i + 1) * seg);
        ctx.fillStyle = n === 0 ? '#0f8a4a' : RED.has(n) ? '#b3202a' : '#141414';
        ctx.fill();
        ctx.save();
        ctx.translate(c, c);
        ctx.rotate(wheelAngle + (i + 0.5) * seg + Math.PI / 2);
        ctx.fillStyle = '#fff';
        ctx.font = '700 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(n), 0, -R + 13);
        ctx.restore();
      });
      // pista de la bola y centro
      ctx.beginPath(); ctx.arc(c, c, R - 26, 0, Math.PI * 2);
      ctx.strokeStyle = '#2a1c0c'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(c, c, 54, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(c - 15, c - 15, 8, c, c, 54);
      g.addColorStop(0, '#caa24a'); g.addColorStop(1, '#6b4a22');
      ctx.fillStyle = g; ctx.fill();
      // bola
      ctx.beginPath();
      ctx.arc(c + Math.cos(ballAngle) * ballR, c + Math.sin(ballAngle) * ballR, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 4;
      ctx.fill(); ctx.shadowBlur = 0;
    };
    const seg = (Math.PI * 2) / WHEEL.length;
    let wheelAngle = 0;
    drawWheel(0, -Math.PI / 2, 90);
    const spinBtn = button('GIRAR', () => {
      if (!bets.length) return hud.toast('Pon alguna ficha en el tapete', 'bad');
      if (spinning) return;
      spinning = true;
      spinBtn.disabled = true;
      const n = WHEEL[Math.floor(Math.random() * WHEEL.length)];
      const targetIndex = WHEEL.indexOf(n);
      // dónde queda la casilla ganadora (centro) tras el giro del plato
      let wheelSpeed = 0.28;
      let ballAngle = 0;
      let ballSpeed = -0.55; // la bola gira al revés
      let ballR = 90;
      let t = 0;
      const anim = () => {
        t++;
        wheelAngle += wheelSpeed;
        wheelSpeed *= 0.991;
        if (ballSpeed < -0.05 || ballR > 62) {
          ballAngle += ballSpeed;
          ballSpeed *= 0.985;
          if (Math.abs(ballSpeed) < 0.12) ballR = Math.max(62, ballR - 0.7); // cae hacia dentro
          drawWheel(wheelAngle, ballAngle, ballR);
          requestAnimationFrame(anim);
        } else {
          // encaja la bola en la casilla ganadora respecto al plato
          const finalWheel = wheelAngle;
          const slotCenter = finalWheel + (targetIndex + 0.5) * seg;
          drawWheel(finalWheel, slotCenter, 62);
          let won = 0;
          let litHit = 0;
          for (const b of bets) {
            if (!b.numbers.includes(n)) continue;
            // pleno a un número con rayo: paga el multiplicador en vez de 35:1
            if (b.numbers.length === 1 && lightning[n] !== undefined) {
              won += b.amount * lightning[n];
              litHit = lightning[n];
            } else won += b.amount * (b.payout + 1);
          }
          if (won) win(game, won);
          if (litHit) { rain(litHit); game.state.addNews('casino', '⚡', `¡Lightning! El ${n} con ×${litHit} en la ruleta: ${chips(won)}.`); }
          history.unshift(n);
          result.innerHTML = `Ha salido <b class="rn ${n === 0 ? 'g' : RED.has(n) ? 'r' : 'b'}">${n}</b>${litHit ? ` ⚡×${litHit}` : ''} ${won ? `· ¡GANAS ${chips(won)}!` : '· gana la banca'} <span class="muted">· ${history.slice(0, 10).join(' ')}</span>`;
          genLightning();
          bets.length = 0;
          board.querySelectorAll('.chip-stack').forEach((e) => e.remove());
          outside.querySelectorAll('.chip-stack').forEach((e) => e.remove());
          bar.textContent = `🪙 ${chips(game.state.data.chips)}`;
          spinning = false;
          spinBtn.disabled = false;
        }
      };
      anim();
    });
    const top = el('div', 'roulette-top');
    const right = el('div', 'col');
    right.append(spinBtn, button('Retirar fichas', () => {
      if (spinning) return;
      for (const b of bets) win(game, b.amount);
      bets.length = 0;
      board.querySelectorAll('.chip-stack').forEach((e) => e.remove());
      outside.querySelectorAll('.chip-stack').forEach((e) => e.remove());
      bar.textContent = `🪙 ${chips(game.state.data.chips)}`;
    }, 'btn ghost'));
    top.append(wheel, right);
    body.append(bar, strip, top, el('div', 'muted', 'Elige el valor de la ficha y toca el tapete:'), sel.row, board, outside, result);
    genLightning();
  });
}

// --- Ruleta MegaFire: terminal estilo casino físico ---------------------
// Te sientas en un puesto, la ruleta gira SOLA por tiempo y, si la bola cae
// en un número "en fuego" donde tenías ficha, se dispara el minijuego de
// bolas y multiplicadores (MegaFire). Todo con fichas del casino.
const MF_MULTS = [1, 2, 4, 5, 10, 15, 20];
const MF_MULT_WEIGHTS = [26, 22, 16, 13, 10, 7, 4]; // lo bajo sale más
const MF_BONUS = [10, 100, 500, 1000];
const MF_BONUS_WEIGHTS = [50, 30, 14, 6]; // x1000 es muy raro

function mfPick(values: number[], weights: number[]) {
  const total = weights.reduce((s, x) => s + x, 0);
  let r = Math.random() * total;
  for (let i = 0; i < values.length; i++) if ((r -= weights[i]) < 0) return values[i];
  return values[0];
}

export function megaFireTerminalPanel(game: Game, onClose?: () => void) {
  const { hud } = game;
  // control de temporizadores: al cerrar la ventana se cancela todo
  let closed = false;
  const timers = new Set<number>();
  let raf = 0;
  const after = (ms: number, fn: () => void) => {
    const id = window.setTimeout(() => { timers.delete(id); if (!closed) fn(); }, ms);
    timers.add(id);
    return id;
  };
  const cleanup = () => {
    closed = true;
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    cancelAnimationFrame(raf);
  };

  const bets: RouletteBet[] = [];
  const cellByLabel = new Map<string, HTMLElement>();
  let chipMult = 1; // fichas por toque (sumador)
  let lastBets: { label: string; numbers: number[]; payout: number; amount: number }[] = [];
  const history: number[] = [];
  let fire = new Set<number>();
  let phase: 'bet' | 'spin' | 'resolve' | 'mini' = 'bet';
  let jackpot = 40000 + Math.floor(Math.random() * 90000);

  hud.openPanel('Mega Fire Blaze · Ruleta', (body) => {
    const term = el('div', 'mf-live');
    body.closest('.panel')?.classList.add('casino-live');
    // ---- elementos del escenario (arriba) ----
    const jackEl = el('div', 'mf-jackpot');
    const fireStrip = el('div', 'mf-fire');
    const phaseEl = el('div', 'mf-phase', 'Haz tus apuestas');
    const countBar = el('div', 'mf-countbar');
    const countFill = el('div', 'mf-countbar-fill');
    countBar.append(countFill);
    const paintJack = () => { jackEl.innerHTML = `<span>JACKPOT</span><b>${chips(jackpot)}</b>`; };
    paintJack();
    const wheel = el('canvas', 'mf-wheel') as HTMLCanvasElement;
    wheel.width = wheel.height = 480;
    const reveal = el('div', 'mf-reveal');
    const bar = chipBar(game);
    const result = el('div', 'mf-result', 'Haz tus apuestas antes de que acabe la cuenta atrás.');
    const histEl = el('div', 'mf-hist');

    // ---- tapete de apuestas ----
    const sel = betSelector();
    const board = el('div', 'roulette mf-board');
    const chipStack = (amount: number) => {
      const s = el('span', 'chip-stack');
      s.textContent = amount >= 1000 ? (amount / 1000) + 'k' : String(amount);
      s.style.setProperty('--chip', amount >= 5000 ? '#0f8a4a' : amount >= 1000 ? '#c6a24c' : amount >= 500 ? '#7d2ae8' : amount >= 100 ? '#1a1a1a' : amount >= 25 ? '#1f5fae' : '#b3202a');
      return s;
    };
    const refreshBar = () => { bar.textContent = `🪙 ${chips(game.state.data.chips)}`; };
    const place = (label: string, numbers: number[], payout: number, cell: HTMLElement) => {
      if (phase !== 'bet') return hud.toast('Espera a la fase de apuestas', 'bad');
      const v = sel.get() * chipMult;
      if (!spend(game, v)) return;
      const existing = bets.find((b) => b.label === label);
      if (existing) existing.amount += v;
      else bets.push({ label, numbers, payout, amount: v });
      cellByLabel.set(label, cell);
      cell.querySelector('.chip-stack')?.remove();
      cell.append(chipStack(bets.find((b) => b.label === label)!.amount));
      refreshBar();
    };
    const cell = (text: string, cls: string, numbers: number[], payout: number, label = text) => {
      const b = el('button', 'rcell ' + cls, text);
      if (numbers.length === 1) b.dataset.n = String(numbers[0]);
      b.onclick = () => place(label, numbers, payout, b);
      return b;
    };
    board.style.gridTemplateColumns = '38px repeat(12, 1fr) 42px';
    board.append(cell('0', 'green zero', [0], 35));
    for (let col = 0; col < 12; col++) {
      for (let row = 2; row >= 0; row--) {
        const n = col * 3 + row + 1;
        const c = cell(String(n), RED.has(n) ? 'red' : 'black', [n], 35);
        c.style.gridColumn = String(col + 2);
        c.style.gridRow = String(3 - row);
        board.append(c);
      }
    }
    // columnas 2:1 a la derecha (como en la mesa real)
    const colBet = (m: number) => Array.from({ length: 36 }, (_, i) => i + 1).filter((x) => x % 3 === m);
    [[0, 'col-alta'], [2, 'col-media'], [1, 'col-baja']].forEach(([m, lab], i) => {
      const c = cell('2:1', 'out col2to1', colBet(m as number), 2, lab as string);
      c.style.gridColumn = '14';
      c.style.gridRow = String(i + 1);
      board.append(c);
    });
    const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
    const outside = el('div', 'roulette-out');
    outside.append(
      cell('1-12', 'out', range(1, 12), 2), cell('13-24', 'out', range(13, 24), 2), cell('25-36', 'out', range(25, 36), 2),
      cell('1-18', 'out', range(1, 18), 1), cell('PAR', 'out', range(1, 36).filter((x) => x % 2 === 0), 1),
      cell('ROJO', 'red out', [...RED], 1), cell('NEGRO', 'black out', range(1, 36).filter((x) => !RED.has(x)), 1),
      cell('IMPAR', 'out', range(1, 36).filter((x) => x % 2), 1), cell('19-36', 'out', range(19, 36), 1),
    );
    const clearChips = () => {
      term.querySelectorAll('.chip-stack').forEach((e) => e.remove());
    };

    // ---- sectores de la rueda (racetrack) ----
    const VOISINS = [22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25];
    const TIER = [27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33];
    const ORPHELINS = [1, 20, 14, 31, 9, 17, 34, 6];
    const sector = (name: string, nums: number[]) => cell(name, 'mf-sector', nums, Math.max(1, Math.floor(36 / nums.length) - 1), 'sector-' + name);
    // racetrack ovalado: números en el orden de la rueda + zonas en el centro
    const track = el('div', 'mf-track');
    const oval = el('div', 'mf-oval');
    WHEEL.forEach((num, i) => {
      const a = -Math.PI / 2 + i * (2 * Math.PI / WHEEL.length);
      const nb = el('button', 'mf-rt-num ' + (num === 0 ? 'g' : RED.has(num) ? 'r' : 'b'), String(num));
      nb.style.left = (50 + 45 * Math.cos(a)) + '%';
      nb.style.top = (50 + 45 * Math.sin(a)) + '%';
      nb.onclick = () => { const c = board.querySelector<HTMLElement>(`.rcell[data-n="${num}"]`); if (c) place(String(num), [num], 35, c); };
      oval.append(nb);
    });
    const zones = el('div', 'mf-rt-zones');
    zones.append(sector('Tier', TIER), sector('Orphelins', ORPHELINS), sector('Voisins', VOISINS));
    oval.append(zones);
    track.append(el('div', 'mf-track-title', 'RACETRACK · apuesta por zonas'), oval);

    // ---- acciones (como en la mesa real: deshacer / doblar / girar) ----
    const findCell = (b: { label: string }) => cellByLabel.get(b.label) ?? null;
    const spinNow = button('GIRAR YA', () => { if (phase === 'bet' && bets.length) doSpin(); else if (!bets.length) hud.toast('Pon alguna ficha primero', 'bad'); });
    const doble = button('×2 Doblar', () => {
      if (phase !== 'bet' || !bets.length) return;
      const snapshot = bets.map((b) => ({ ...b }));
      for (const b of snapshot) {
        const c = findCell(b);
        if (!c) continue;
        if (game.state.data.chips < b.amount) { hud.toast('No te llega para doblar todo', 'bad'); break; }
        place(b.label, b.numbers, b.payout, c);
      }
    }, 'mf-act');
    const undo = button('↩ Deshacer', () => {
      if (phase !== 'bet' || !bets.length) return;
      const last = bets[bets.length - 1];
      win(game, last.amount);
      bets.pop();
      const c = findCell(last);
      c?.querySelector('.chip-stack')?.remove();
      refreshBar();
    }, 'mf-act');
    const repeat = button('↻ Repetir', () => {
      if (phase !== 'bet' || !lastBets.length) return;
      for (const b of lastBets) {
        const c = findCell(b);
        if (!c) continue;
        if (game.state.data.chips < b.amount) { hud.toast('No te llega para repetir todo', 'bad'); break; }
        place(b.label, b.numbers, b.payout, c);
      }
    }, 'mf-act');

    // ---- escenario (arriba): directo, números en fuego, rueda, cuenta atrás ----
    const stage = el('div', 'mf-stage');
    const liveBar = el('div', 'mf-livebar');
    liveBar.append(el('span', 'mf-live-tag', '● EN DIRECTO'), el('div', 'mf-stage-title', 'MEGA FIRE BLAZE · RULETA'), jackEl);
    const wheelWrap = el('div', 'mf-wheel-wrap');
    wheelWrap.append(wheel, reveal);
    stage.append(liveBar, fireStrip, wheelWrap, phaseEl, countBar, result);

    // ---- logo del juego ----
    const logo = el('div', 'mf-logo');
    logo.innerHTML = '<span class="mf-logo-top">MEGA <b>FIRE BLAZE</b></span><span class="mf-logo-mid">ROULETTE</span><span class="mf-logo-bot">LIVE</span>';

    // ---- cubierta de control (abajo) ----
    const deck = el('div', 'mf-deck');
    const left = el('div', 'mf-deck-left');
    const actions = el('div', 'mf-actions');
    actions.append(undo, doble, repeat, spinNow);
    left.append(bar, track, actions);

    const center = el('div', 'mf-deck-center');
    center.append(board, outside);

    const rightCol = el('div', 'mf-deck-right');
    const tray = el('div', 'mf-tray');
    const multRow = el('div', 'mf-mult');
    const MULTS = [1, 3, 5, 10];
    const multBtns = MULTS.map((m) => button('×' + m, () => { chipMult = m; multBtns.forEach((b, j) => b.classList.toggle('on', MULTS[j] === chipMult)); }, 'mf-mult-btn' + (m === 1 ? ' on' : '')));
    multRow.append(...multBtns);
    tray.append(el('div', 'mf-tray-label', 'VALOR DE LA FICHA'), sel.row, el('div', 'mf-tray-label', 'FICHAS POR TOQUE'), multRow);
    rightCol.append(histEl, logo, tray);

    deck.append(left, center, rightCol);
    term.append(stage, deck);
    body.append(term);

    // ---- dibujo de la rueda ----
    const WHEEL_SEG = (Math.PI * 2) / WHEEL.length;
    let wheelAngle = 0;
    // rueda 3D: elipse en perspectiva con profundidad, casillas y bola con sombra
    const drawWheel = (wa: number, ba: number, br: number) => {
      const ctx = wheel.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, 480, 480);
      ctx.setTransform(2, 0, 0, 2, 0, 0); // dibujamos en espacio lógico 240
      const c = 120, ky = 0.46, Rx = 114, ro = Rx * 0.9, ri = Rx * 0.56;
      const pt = (ang: number, r: number): [number, number] => [c + Math.cos(ang) * r, c + Math.sin(ang) * r * ky];
      // sombra bajo la rueda
      ctx.beginPath(); ctx.ellipse(c, c + 14, Rx * 1.05, Rx * ky * 1.05, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill();
      // pared lateral (profundidad)
      ctx.beginPath(); ctx.ellipse(c, c + 11, Rx, Rx * ky, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#2a1d0c'; ctx.fill();
      // borde dorado exterior
      ctx.beginPath(); ctx.ellipse(c, c, Rx, Rx * ky, 0, 0, Math.PI * 2);
      const rim = ctx.createLinearGradient(c - Rx, c - 20, c + Rx, c + 20);
      rim.addColorStop(0, '#6e4e20'); rim.addColorStop(.5, '#f2d88e'); rim.addColorStop(1, '#6e4e20');
      ctx.fillStyle = rim; ctx.fill();
      // pista de la bola (anillo oscuro)
      ctx.beginPath(); ctx.ellipse(c, c, ro, ro * ky, 0, 0, Math.PI * 2); ctx.fillStyle = '#17100a'; ctx.fill();
      // casillas, dibujadas de atrás hacia delante para el efecto 3D
      const order = WHEEL.map((num, i) => ({ num, i, mid: wa + (i + 0.5) * WHEEL_SEG }))
        .sort((a, b) => Math.sin(a.mid) - Math.sin(b.mid));
      for (const { num, i, mid } of order) {
        const a0 = wa + i * WHEEL_SEG, a1 = wa + (i + 1) * WHEEL_SEG;
        ctx.beginPath();
        ctx.ellipse(c, c, ro, ro * ky, 0, a0, a1);
        ctx.ellipse(c, c, ri, ri * ky, 0, a1, a0, true);
        ctx.closePath();
        ctx.fillStyle = num === 0 ? '#0f8a4a' : RED.has(num) ? '#c0202c' : '#1b1b1f';
        ctx.fill();
        const front = (Math.sin(mid) + 1) / 2; // 0 = atrás, 1 = delante
        ctx.save(); ctx.globalAlpha = 0.42 * (1 - front); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
        if (fire.has(num)) { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#ff7a1a'; ctx.fill(); ctx.restore(); }
        ctx.strokeStyle = 'rgba(235,205,130,.45)'; ctx.lineWidth = 0.7; ctx.stroke();
        const [nx, ny] = pt(mid, (ro + ri) / 2);
        const sc = 0.6 + 0.6 * front;
        ctx.save(); ctx.translate(nx, ny);
        ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.4 + 0.6 * front;
        ctx.font = `800 ${(8.5 * sc).toFixed(1)}px Inter, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(num), 0, 0);
        ctx.restore();
      }
      // torreta central
      ctx.beginPath(); ctx.ellipse(c, c, ri, ri * ky, 0, 0, Math.PI * 2); ctx.fillStyle = '#120c06'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(c, c - 3, ri * 0.72, ri * 0.72 * ky, 0, 0, Math.PI * 2);
      const hub = ctx.createRadialGradient(c - 10, c - 9, 3, c, c, ri * 0.72);
      hub.addColorStop(0, '#f6de98'); hub.addColorStop(1, '#6e4c1e');
      ctx.fillStyle = hub; ctx.fill();
      ctx.beginPath(); ctx.ellipse(c, c - 7, ri * 0.2, ri * 0.2 * ky, 0, 0, Math.PI * 2); ctx.fillStyle = '#eccb78'; ctx.fill();
      // la bola
      const [bx, by] = pt(ba, br);
      const bfront = (Math.sin(ba) + 1) / 2;
      const brad = 3.4 + 1.8 * bfront;
      ctx.beginPath(); ctx.ellipse(bx, by + 1.5, brad * 1.2, brad * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill();
      const bg = ctx.createRadialGradient(bx - brad * 0.4, by - brad * 0.4, 0.5, bx, by, brad);
      bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#bfc4cc');
      ctx.beginPath(); ctx.arc(bx, by, brad, 0, Math.PI * 2); ctx.fillStyle = bg; ctx.fill();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };
    drawWheel(0, -Math.PI / 2, 90);

    const drawHistory = () => {
      histEl.innerHTML = '';
      for (const num of history.slice(0, 12)) {
        const s = el('span', 'rn ' + (num === 0 ? 'g' : RED.has(num) ? 'r' : 'b'), String(num));
        if (fire.has(num)) s.classList.add('fire');
        histEl.append(s);
      }
    };

    const genFire = () => {
      fire = new Set();
      const count = 2 + Math.floor(Math.random() * 4); // 2-5 números
      while (fire.size < count) fire.add(Math.floor(Math.random() * 37));
      fireStrip.innerHTML = '<span class="mf-fire-tag">EN LLAMAS</span>';
      for (const num of [...fire].sort((a, b) => a - b)) {
        const c = el('span', 'mf-fire-num');
        c.innerHTML = `<b>${num}</b>`;
        fireStrip.append(c);
      }
      board.querySelectorAll('.rcell').forEach((b) => {
        const num = Number((b as HTMLElement).dataset.n);
        (b as HTMLElement).classList.toggle('fire', fire.has(num));
      });
    };

    // ---- ciclo de ronda por tiempo ----
    const BET_MS = 16000;
    let betEnd = 0;
    const startRound = () => {
      if (closed) return;
      phase = 'bet';
      bets.length = 0;
      clearChips();
      term.querySelectorAll('.win').forEach((e) => e.classList.remove('win'));
      genFire();
      drawHistory();
      result.textContent = 'Fase de apuestas: pon tus fichas. Los números en llamas disparan el bonus si caen.';
      betEnd = performance.now() + BET_MS;
      spinNow.disabled = false;
      tickCountdown();
    };
    const tickCountdown = () => {
      if (closed || phase !== 'bet') return;
      const left = Math.max(0, betEnd - performance.now());
      countFill.style.width = (left / BET_MS) * 100 + '%';
      phaseEl.textContent = `Haz tus apuestas · ${Math.ceil(left / 1000)} s`;
      if (left <= 0) return doSpin();
      after(120, tickCountdown);
    };

    const revealNumber = (n: number) => {
      const color = n === 0 ? 'g' : RED.has(n) ? 'r' : 'b';
      reveal.className = 'mf-reveal show ' + color + (fire.has(n) ? ' fire' : '');
      reveal.innerHTML = `<span class="mf-reveal-tag">${fire.has(n) ? 'EN LLAMAS' : 'SALE EL'}</span><span class="mf-reveal-num">${n}</span>`;
      wheel.classList.remove('spinning');
      after(1500, () => { reveal.classList.remove('show'); resolve(n); });
    };

    function doSpin() {
      if (phase !== 'bet') return;
      phase = 'spin';
      spinNow.disabled = true;
      lastBets = bets.map((b) => ({ ...b }));
      phaseEl.textContent = 'NO VA MÁS · la bola rueda';
      countFill.style.width = '0%';
      wheel.classList.add('spinning');
      const n = WHEEL[Math.floor(Math.random() * WHEEL.length)];
      const targetIndex = WHEEL.indexOf(n);
      // animación POR TIEMPO (independiente de los fps): ~5,2 s
      const SPIN_MS = 5200;
      const startWheel = wheelAngle;
      const wheelTurns = 5 + Math.random() * 2;   // vueltas del cilindro
      const ballTurns = 9 + Math.random() * 3;    // vueltas de la bola (sentido contrario)
      const t0 = performance.now();
      const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
      const frame = () => {
        if (closed) return;
        const p = Math.min(1, (performance.now() - t0) / SPIN_MS);
        const e = easeOut(p);
        wheelAngle = startWheel + wheelTurns * 2 * Math.PI * e;
        if (p < 1) {
          const ballAngle = -ballTurns * 2 * Math.PI * e;
          const drop = p < 0.62 ? 0 : (p - 0.62) / 0.38;   // la bola cae en el último tramo
          const ballR = 100 - (100 - 82) * easeOut(drop);
          drawWheel(wheelAngle, ballAngle, ballR);
          raf = requestAnimationFrame(frame);
        } else {
          // la bola queda asentada en la casilla ganadora
          drawWheel(wheelAngle, wheelAngle + (targetIndex + 0.5) * WHEEL_SEG, 82);
          after(500, () => revealNumber(n));
        }
      };
      frame();
    }

    const resolve = (n: number) => {
      phase = 'resolve';
      jackpot += 150 + Math.floor(Math.random() * 400);
      paintJack();
      let normalWon = 0, fireBet = 0;
      for (const b of bets) {
        if (!b.numbers.includes(n)) continue;
        cellByLabel.get(b.label)?.classList.add('win');
        if (b.numbers.length === 1 && fire.has(n)) fireBet += b.amount;
        else normalWon += b.amount * (b.payout + 1);
      }
      board.querySelector(`.rcell[data-n="${n}"]`)?.classList.add('win');
      if (normalWon) win(game, normalWon);
      refreshBar();
      history.unshift(n);
      drawHistory();
      const color = n === 0 ? 'g' : RED.has(n) ? 'r' : 'b';
      if (fireBet > 0 && fire.has(n)) {
        result.innerHTML = `El <b class="rn ${color}">${n}</b> estaba EN LLAMAS · empieza el bonus…`;
        after(800, () => runMegaFire(n, fireBet, (prize, total) => {
          if (prize >= fireBet * 20) hud.toast(`Mega Fire ×${total}: +${chips(prize)}`, 'ok');
          result.innerHTML = `<b class="rn ${color}">${n}</b> · bonus ×${total} → <b>${chips(prize)}</b>${normalWon ? ` · apuestas +${chips(normalWon)}` : ''}`;
          phase = 'resolve';
          after(1800, startRound);
        }));
      } else {
        result.innerHTML = `Sale el <b class="rn ${color}">${n}</b> ${normalWon ? `· ganas ${chips(normalWon)}` : '· gana la banca'}`;
        after(4200, startRound);
      }
    };

    // ---- minijuego MegaFire: bolas que caen en bloques con multiplicadores ----
    const runMegaFire = (n: number, stake: number, done: (prize: number, total: number) => void) => {
      phase = 'mini';
      const COLS = 5, ROWS = 4, N = COLS * ROWS;
      const blocks: (number | null)[] = Array(N).fill(null);
      let total = 0, drops = 3, rainStreak = 0, ended = false;
      const star = Math.random() < 0.55;

      const mini = el('div', 'mf-mini');
      const starEl = el('div', 'mf-star' + (star ? ' on' : ''), star ? '⭐ ESTRELLA ACTIVA' : '☆ sin estrella');
      const status = el('div', 'mf-mini-status');
      const arena = el('div', 'mf-arena');
      const grid = el('div', 'mf-grid');
      grid.style.gridTemplateColumns = `repeat(${COLS},1fr)`;
      const cellEls: HTMLElement[] = [];
      for (let i = 0; i < N; i++) { const c = el('div', 'mf-block'); cellEls.push(c); grid.append(c); }
      arena.append(grid);
      mini.append(el('div', 'mf-mini-head', `🔥 MEGAFIRE · número ${n}`), starEl, status, arena);
      term.append(mini);

      const paint = () => {
        status.innerHTML = `Tiradas: <b>${drops}</b> · Total: <b>×${total}</b>${rainStreak ? ` · 🌧️ lluvia ${rainStreak}/3` : ''}`;
      };
      paint();

      const dropBall = (targetCell: HTMLElement | null, mult: number, rain: boolean, cb: () => void) => {
        const ball = el('div', 'mf-ball' + (rain ? ' rain' : ''), rain ? '' : '×' + mult);
        const ar = arena.getBoundingClientRect();
        const startX = 12 + Math.random() * Math.max(10, ar.width - 24);
        ball.style.left = startX + 'px';
        ball.style.top = '-26px';
        arena.append(ball);
        void ball.offsetHeight; // fuerza reflow para que arranque la transición
        if (rain || !targetCell) {
          ball.style.transform = `translateY(${ar.height + 46}px)`;
          ball.style.opacity = '0';
          after(640, () => { ball.remove(); cb(); });
        } else {
          const cr = targetCell.getBoundingClientRect();
          const tx = cr.left - ar.left + cr.width / 2 - startX;
          const ty = cr.top - ar.top + cr.height / 2 + 13;
          ball.style.transform = `translate(${tx}px, ${ty}px)`;
          after(560, () => {
            ball.remove();
            targetCell.classList.add('filled');
            targetCell.textContent = '×' + mult;
            cb();
          });
        }
      };

      const endGame = () => {
        if (ended) return;
        ended = true;
        const prize = stake * total;
        if (prize) win(game, prize);
        refreshBar();
        if (total >= 40) game.state.addNews('casino', '🔥', `¡MegaFire en el ${n}! Multiplicador ×${total} = ${chips(prize)}.`);
        status.innerHTML = `🔥 Fin · multiplicador total <b>×${total}</b> · ${prize ? `¡GANAS ${chips(prize)}!` : 'sin premio'}`;
        after(2600, () => { mini.remove(); done(prize, total); });
      };

      const runBonus = (cb: (v: number) => void) => {
        const bonus = el('div', 'mf-bonus');
        const strip = el('div', 'mf-bonus-strip');
        const cells = MF_BONUS.map((v) => { const c = el('div', 'mf-bonus-cell', '×' + v); strip.append(c); return c; });
        bonus.append(el('div', 'mf-bonus-title', '⭐ RULETA BONUS'), strip);
        mini.append(bonus);
        const winner = mfPick(MF_BONUS, MF_BONUS_WEIGHTS);
        let i = 0, ticks = 0;
        const totalTicks = 26 + Math.floor(Math.random() * MF_BONUS.length);
        const hop = () => {
          cells.forEach((c) => c.classList.remove('on'));
          cells[i % cells.length].classList.add('on');
          if (ticks >= totalTicks && MF_BONUS[i % cells.length] === winner) {
            after(700, () => { bonus.classList.add('done'); cb(winner); });
            return;
          }
          ticks++; i++;
          after(ticks > totalTicks - 7 ? 170 : 60, hop);
        };
        hop();
      };

      const endFull = () => {
        if (star) {
          status.innerHTML = '¡BLOQUES LLENOS + ⭐! Rueda de bonus…';
          runBonus((v) => { total += v; paint(); after(400, endGame); });
        } else {
          status.textContent = '¡Bloques llenos! Pero sin estrella esta vez.';
          after(900, endGame);
        }
      };

      const step = () => {
        if (closed || ended) return;
        if (drops <= 0) return endGame();
        drops--;
        const empties = cellEls.map((_, i) => i).filter((i) => blocks[i] === null);
        const rain = empties.length > 0 && Math.random() < 0.3;
        if (rain) {
          rainStreak++; drops++; // la lluvia es tirada gratis
          status.innerHTML = `🌧️ ¡LLUVIA! Las bolas no se quedan · tirada gratis (${rainStreak}/3)`;
          dropBall(null, 0, true, () => {
            if (rainStreak >= 3) after(500, endGame);
            else { paint(); after(350, step); }
          });
        } else {
          rainStreak = 0;
          const k = Math.min(empties.length, 1 + (Math.random() < 0.4 ? 1 : 0));
          const chosen: number[] = [];
          for (let j = 0; j < k; j++) {
            const pool = empties.filter((e) => !chosen.includes(e));
            chosen.push(pool[Math.floor(Math.random() * pool.length)]);
          }
          let landed = 0;
          chosen.forEach((idx, j) => {
            const m = mfPick(MF_MULTS, MF_MULT_WEIGHTS);
            after(j * 180, () => dropBall(cellEls[idx], m, false, () => {
              blocks[idx] = m; total += m; paint();
              if (++landed === chosen.length) {
                if (blocks.every((b) => b !== null)) after(400, endFull);
                else after(300, step);
              }
            }));
          });
        }
      };
      step();
    };

    startRound();
  }, () => { cleanup(); onClose?.(); });
}

// --- cartas ---
const SUITS = ['♠', '♥', '♦', '♣'];
interface Card { r: number; s: number }
function deck(): Card[] {
  const d: Card[] = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s });
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
const rankText = (r: number) => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[r] ?? String(r));
function cardEl(c: Card | null) {
  if (!c) return el('div', 'card back');
  const red = c.s === 1 || c.s === 2;
  const e = el('div', 'card' + (red ? ' redc' : ''));
  const r = rankText(c.r), s = SUITS[c.s];
  const tl = el('span', 'card-idx'); tl.innerHTML = `${r}<b>${s}</b>`;
  const br = el('span', 'card-idx br'); br.innerHTML = `${r}<b>${s}</b>`;
  e.append(tl, el('span', 'card-pip', s), br);
  return e;
}

// --- blackjack ---
function bjValue(hand: Card[]) {
  let v = 0, aces = 0;
  for (const c of hand) {
    if (c.r === 14) { v += 11; aces++; } else v += Math.min(10, c.r);
  }
  while (v > 21 && aces--) v -= 10;
  return v;
}

export function blackjackPanel(game: Game, onClose?: () => void) {
  const { hud } = game;
  hud.openPanel('Blackjack', (body) => {
    const sel = betSelector();
    let d = deck();
    let hands: Card[][] = [];      // puede haber 2 manos tras dividir
    let bets: number[] = [];
    let active = 0;                // mano que juega
    let dealer: Card[] = [];
    let playing = false;
    let insurance = 0;
    const bar = chipBar(game);
    const dealerRow = el('div', 'hand');
    const handsWrap = el('div', 'bj-hands');
    const msg = el('div', 'bj-msg', 'Elige tu apuesta y reparte.');
    const actions = el('div', 'bj-actions');

    const draw = () => { if (d.length < 15) d = deck(); return d.pop()!; };
    const render = (reveal = false) => {
      bar.textContent = `🪙 ${chips(game.state.data.chips)}`;
      dealerRow.innerHTML = '';
      dealer.forEach((c, i) => dealerRow.append(cardEl(i === 1 && !reveal ? null : c)));
      dealerRow.append(el('span', 'bj-val', reveal ? String(bjValue(dealer)) : '?'));
      handsWrap.innerHTML = '';
      hands.forEach((h, i) => {
        const hd = el('div', 'bj-hand' + (playing && i === active ? ' on' : ''));
        const cards = el('div', 'hand');
        h.forEach((c) => cards.append(cardEl(c)));
        hd.append(cards, el('div', 'muted', `${hands.length > 1 ? `Mano ${i + 1} · ` : ''}${bjValue(h)}${bjValue(h) > 21 ? ' · pasado' : ''} · ${chips(bets[i])}`));
        handsWrap.append(hd);
      });
      actions.innerHTML = '';
      if (!playing) { actions.append(button('Repartir', deal)); return; }
      const h = hands[active];
      actions.append(button('Pedir', hit), button('Plantarse', stand, 'btn ghost'));
      if (h.length === 2 && game.state.data.chips >= bets[active]) actions.append(button('Doblar', dbl, 'btn ghost'));
      if (h.length === 2 && h[0].r === h[1].r && hands.length === 1 && game.state.data.chips >= bets[active]) actions.append(button('Dividir', split, 'btn ghost'));
      if (dealer[0]?.r === 14 && !insurance && active === 0 && h.length === 2 && game.state.data.chips >= Math.floor(bets[0] / 2)) actions.append(button('Seguro', takeInsurance, 'btn ghost'));
    };
    const deal = () => {
      const bet = sel.get();
      if (!spend(game, bet)) return;
      hands = [[draw(), draw()]];
      bets = [bet];
      dealer = [draw(), draw()];
      active = 0; insurance = 0; playing = true;
      msg.textContent = `Apuesta ${chips(bet)}`;
      if (bjValue(hands[0]) === 21) { playing = false; return finishAll('¡BLACKJACK!'); }
      render();
    };
    const takeInsurance = () => {
      insurance = Math.floor(bets[0] / 2);
      if (!spend(game, insurance)) { insurance = 0; return; }
      msg.textContent = `Seguro de ${chips(insurance)} contra blackjack de la banca`;
      render();
    };
    const hit = () => {
      hands[active].push(draw());
      if (bjValue(hands[active]) >= 21) next();
      else render();
    };
    const dbl = () => {
      if (!spend(game, bets[active])) return;
      bets[active] *= 2;
      hands[active].push(draw());
      next();
    };
    const split = () => {
      if (!spend(game, bets[0])) return;
      hands = [[hands[0][0], draw()], [hands[0][1], draw()]];
      bets = [bets[0], bets[0]];
      render();
    };
    const next = () => {
      if (active < hands.length - 1) { active++; render(); }
      else stand();
    };
    const stand = () => {
      if (active < hands.length - 1) { active++; return render(); }
      // juega la banca
      while (bjValue(dealer) < 17) dealer.push(draw());
      playing = false;
      finishAll();
    };
    const finishAll = (special?: string) => {
      const dv = bjValue(dealer);
      let totalWin = 0;
      const results: string[] = [];
      // seguro: paga 2:1 si la banca tiene blackjack natural
      if (insurance) {
        if (dealer.length === 2 && dv === 21) { totalWin += insurance * 3; results.push('seguro pagado'); }
      }
      hands.forEach((h, i) => {
        const pv = bjValue(h);
        const natural = special && h.length === 2 && pv === 21;
        if (pv > 21) results.push(`mano ${i + 1}: te pasas`);
        else if (natural) { totalWin += Math.floor(bets[i] * 2.5); results.push('¡blackjack!'); }
        else if (dv > 21 || pv > dv) { totalWin += bets[i] * 2; results.push(`mano ${i + 1}: ganas`); }
        else if (pv === dv) { totalWin += bets[i]; results.push(`mano ${i + 1}: empate`); }
        else results.push(`mano ${i + 1}: gana banca`);
      });
      if (totalWin) win(game, totalWin);
      msg.textContent = `${special ?? ''} Banca ${dv} · ${results.join(' · ')}${totalWin ? ` · +${chips(totalWin)}` : ''}`;
      render(true);
    };
    body.closest('.panel')?.classList.add('casino-live');
    const term = el('div', 'bj-live');
    const stage = el('div', 'bj-stage');
    const dealerArea = el('div', 'bj-area');
    dealerArea.append(el('div', 'bj-seat-label', 'Crupier'), dealerRow);
    const rules = el('div', 'bj-rules', 'El crupier se planta en 17 · Blackjack paga 3:2 · Seguro 2:1');
    const spots = el('div', 'bj-spots');
    spots.append(el('div', 'bj-spot'), el('div', 'bj-spot'), el('div', 'bj-spot'));
    const playerArea = el('div', 'bj-area');
    playerArea.append(handsWrap, el('div', 'bj-seat-label', 'Jugador'));
    stage.append(dealerArea, rules, spots, playerArea, msg);

    const bjDeck = el('div', 'bj-deck');
    const dkLeft = el('div', 'bj-deck-left');
    dkLeft.append(bar);
    const dkCenter = el('div', 'bj-deck-center');
    dkCenter.append(el('div', 'mf-tray-label', 'VALOR DE LA FICHA'), sel.row);
    const dkRight = el('div', 'bj-deck-right');
    dkRight.append(actions);
    bjDeck.append(dkLeft, dkCenter, dkRight);

    term.append(stage, bjDeck);
    body.append(term);
    render();
  }, onClose);
}

// --- Crazy Time: rueda del dinero con top slot y 4 bonus ---
interface CtSeg { key: string; label: string; color: string; pay: number; bonus?: boolean }
const CT_TYPES: Record<string, CtSeg> = {
  '1': { key: '1', label: '1', color: '#f2c94c', pay: 1 },
  '2': { key: '2', label: '2', color: '#6fcf97', pay: 2 },
  '5': { key: '5', label: '5', color: '#f2994a', pay: 5 },
  '10': { key: '10', label: '10', color: '#eb5757', pay: 10 },
  coin: { key: 'coin', label: 'Coin Flip', color: '#2d9cdb', pay: 0, bonus: true },
  pachinko: { key: 'pachinko', label: 'Pachinko', color: '#9b51e0', pay: 0, bonus: true },
  cash: { key: 'cash', label: 'Cash Hunt', color: '#219653', pay: 0, bonus: true },
  crazy: { key: 'crazy', label: 'Crazy Time', color: '#bb6bd9', pay: 0, bonus: true },
};
// reparto de las 54 casillas de la rueda (como el juego real)
const CT_WHEEL: string[] = [];
for (const [k, n] of [['1', 21], ['2', 13], ['5', 7], ['10', 4], ['coin', 4], ['pachinko', 2], ['cash', 2], ['crazy', 1]] as const) {
  for (let i = 0; i < n; i++) CT_WHEEL.push(k);
}
// entrelaza para que no salgan juntas
CT_WHEEL.sort(() => Math.random() - 0.5);

export function crazyTimePanel(game: Game) {
  const { hud } = game;
  const bets: Record<string, number> = {};
  let spinning = false;
  const history: string[] = [];
  hud.openPanel('Crazy Time', (body) => {
    const bar = chipBar(game);
    const sel = betSelector([1, 5, 25, 100, 500]);
    const canvas = el('canvas', 'ct-wheel') as HTMLCanvasElement;
    canvas.width = canvas.height = 520;
    const topslot = el('div', 'ct-topslot');
    const result = el('div', 'wheel-result', 'Apuesta a un número o a un bonus y gira la rueda');
    const grid = el('div', 'ct-grid');
    const cells: Record<string, HTMLElement> = {};
    const order = ['1', '2', '5', '10', 'coin', 'pachinko', 'cash', 'crazy'];
    for (const k of order) {
      const t = CT_TYPES[k];
      const c = el('button', 'ct-cell' + (t.bonus ? ' bonus' : ''));
      c.style.background = t.color;
      c.innerHTML = `<b>${t.label}</b><span class="ct-stake"></span>`;
      c.onclick = () => {
        if (spinning) return;
        const v = sel.get();
        if (!spend(game, v)) return;
        bets[k] = (bets[k] ?? 0) + v;
        c.querySelector('.ct-stake')!.textContent = `🪙 ${bets[k]}`;
        bar.textContent = `🪙 ${chips(game.state.data.chips)}`;
      };
      cells[k] = c;
      grid.append(c);
    }
    const seg = (Math.PI * 2) / CT_WHEEL.length;
    const draw = (angle: number) => {
      const ctx = canvas.getContext('2d')!;
      const R = 125, c = 130;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, 520, 520);
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.beginPath(); ctx.arc(c, c, R + 3, 0, Math.PI * 2); ctx.fillStyle = '#2a1a06'; ctx.fill();
      CT_WHEEL.forEach((k, i) => {
        const t = CT_TYPES[k];
        ctx.beginPath(); ctx.moveTo(c, c);
        ctx.arc(c, c, R, angle + i * seg, angle + (i + 1) * seg);
        ctx.fillStyle = t.color; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.save(); ctx.translate(c, c);
        ctx.rotate(angle + (i + 0.5) * seg + Math.PI / 2);
        ctx.fillStyle = t.bonus ? '#fff' : '#1a1205';
        ctx.font = `800 ${t.bonus ? 8 : 13}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(t.bonus ? t.label.split(' ')[0].toUpperCase() : t.label, 0, -R + 16);
        ctx.restore();
      });
      ctx.beginPath(); ctx.arc(c, c, 34, 0, Math.PI * 2);
      const gr = ctx.createRadialGradient(c - 10, c - 10, 5, c, c, 34);
      gr.addColorStop(0, '#f6d365'); gr.addColorStop(1, '#8a5a12');
      ctx.fillStyle = gr; ctx.fill();
      // puntero arriba
      ctx.beginPath(); ctx.moveTo(c, 6); ctx.lineTo(c - 11, 26); ctx.lineTo(c + 11, 26); ctx.closePath();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
    };
    let angle = 0;
    draw(angle);

    const runBonus = (k: string, done: (mult: number) => void) => {
      hud.openPanel(CT_TYPES[k].label + ' · BONUS', (bb) => {
        if (k === 'coin') {
          const red = 2 + Math.floor(Math.random() * 40), blue = 2 + Math.floor(Math.random() * 60);
          bb.append(el('p', '', 'Se lanza la moneda…'), el('div', 'ct-coins', `🔴 x${red}   🔵 x${blue}`));
          setTimeout(() => done(Math.random() < 0.5 ? red : blue), 1200);
        } else if (k === 'pachinko') {
          const mults = [5, 10, 2, 25, 4, 15, 8];
          bb.append(el('p', '', 'Cae el disco por el Pachinko…'), el('div', 'ct-coins', mults.map((m) => `x${m}`).join('  ')));
          setTimeout(() => done(mults[Math.floor(Math.random() * mults.length)]), 1400);
        } else if (k === 'cash') {
          bb.append(el('p', '', '¡Dispara a un símbolo! (elige uno)'));
          const wrap = el('div', 'ct-hunt');
          const opts = Array.from({ length: 9 }, () => 3 + Math.floor(Math.random() * 50));
          opts.forEach((m) => {
            const b = button('🎯', () => done(m), 'btn small');
            wrap.append(b);
          });
          bb.append(wrap);
        } else {
          // Crazy Time: rueda gigante con multiplicadores enormes
          const big = [20, 50, 100, 40, 60, 200, 30, 80];
          bb.append(el('p', '', '¡CRAZY TIME! La rueda gigante decide…'), el('div', 'ct-coins', big.map((m) => `x${m}`).join('  ')));
          setTimeout(() => done(big[Math.floor(Math.random() * big.length)]), 1600);
        }
      });
    };

    // top slot: multiplica un tipo al azar antes de girar
    let topType = order[Math.floor(Math.random() * 4)];
    let topMult = [2, 3, 4, 5, 7, 10][Math.floor(Math.random() * 6)];
    const paintTop = () => { topslot.innerHTML = `TOP SLOT · <b>${CT_TYPES[topType].label}</b> × <b>${topMult}</b>`; };
    paintTop();

    const spinBtn = button('GIRAR', () => {
      if (spinning) return;
      if (!Object.keys(bets).length) return hud.toast('Pon fichas en algún sitio', 'bad');
      spinning = true; spinBtn.disabled = true;
      const idx = Math.floor(Math.random() * CT_WHEEL.length);
      const winner = CT_WHEEL[idx];
      const targetAngle = -Math.PI / 2 - (idx + 0.5) * seg; // casilla bajo el puntero
      const turns = 5 + Math.random() * 2;
      const start = angle;
      const end = targetAngle - Math.PI * 2 * turns;
      const T0 = performance.now();
      const dur = 4200;
      const anim = (now: number) => {
        const p = Math.min(1, (now - T0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        angle = start + (end - start) * e;
        draw(angle);
        if (p < 1) return requestAnimationFrame(anim);
        history.unshift(winner);
        const pay = (mult: number) => {
          const stake = bets[winner] ?? 0;
          let topBoost = topType === winner ? topMult : 1;
          const won = stake * mult * topBoost;
          if (won) win(game, won);
          result.innerHTML = `Sale <b>${CT_TYPES[winner].label}</b>${topBoost > 1 ? ` (TOP ×${topMult})` : ''} · ${won ? `¡GANAS ${chips(won)}!` : 'nada para ti'} <span class="muted">· ${history.slice(0, 12).map((h) => CT_TYPES[h].label[0]).join(' ')}</span>`;
          for (const k of order) { delete bets[k]; cells[k].querySelector('.ct-stake')!.textContent = ''; }
          bar.textContent = `🪙 ${chips(game.state.data.chips)}`;
          spinning = false; spinBtn.disabled = false;
          topType = order[Math.floor(Math.random() * 4)];
          topMult = [2, 3, 4, 5, 7, 10][Math.floor(Math.random() * 6)];
          paintTop();
        };
        if (CT_TYPES[winner].bonus) {
          if (bets[winner]) {
            runBonus(winner, (mult) => {
              // reabrimos el panel principal con el premio ya pagado
              const stake = bets[winner];
              const won = stake * mult * (topType === winner ? topMult : 1);
              win(game, won);
              game.state.addNews('casino', '🎰', `¡Bonus ${CT_TYPES[winner].label} en Crazy Time! Premio ×${mult} = ${chips(won)}.`);
              crazyTimePanel(game);
              game.hud.toast(`${CT_TYPES[winner].label}: ×${mult} · +${chips(won)}`, 'ok');
            });
          } else {
            result.textContent = `Sale ${CT_TYPES[winner].label} pero no habías apostado ahí.`;
            for (const k of order) { delete bets[k]; cells[k].querySelector('.ct-stake')!.textContent = ''; }
            spinning = false; spinBtn.disabled = false;
          }
        } else pay(CT_TYPES[winner].pay);
      };
      requestAnimationFrame(anim);
    });

    body.closest('.panel')?.classList.add('casino-live');
    const wterm = el('div', 'wheel-live');
    const wstage = el('div', 'wheel-stage');
    wstage.append(topslot, canvas, result);
    const wdeck = el('div', 'wheel-deck');
    const wdL = el('div', 'wheel-deck-left'); wdL.append(bar);
    const wdC = el('div', 'wheel-deck-center'); wdC.append(grid);
    const wdR = el('div', 'wheel-deck-right'); wdR.append(el('div', 'mf-tray-label', 'VALOR DE LA FICHA'), sel.row, spinBtn);
    wdeck.append(wdL, wdC, wdR);
    wterm.append(wstage, wdeck);
    body.append(wterm);
  });
}

// --- Speed Baccarat (punto y banca) ---
const bacValue = (h: Card[]) => h.reduce((s, c) => s + (c.r >= 10 ? (c.r === 14 ? 1 : 0) : c.r), 0) % 10;

export function baccaratPanel(game: Game, onClose?: () => void) {
  const { hud } = game;
  let bet: 'jugador' | 'banca' | 'empate' | null = null;
  const history: string[] = [];
  hud.openPanel('Speed Baccarat', (body) => {
    const bar = chipBar(game);
    const sel = betSelector([5, 25, 100, 500, 1000]);
    const table = el('div', 'baccarat');
    const pRow = el('div', 'hand');
    const bRow = el('div', 'hand');
    const msg = el('div', 'muted', 'Apuesta: Jugador (1:1), Banca (0,95:1) o Empate (8:1).');
    const picks = el('div', 'row');
    const mkPick = (k: 'jugador' | 'banca' | 'empate', label: string) => button(label, () => { bet = k; paint(); }, 'bc-pick');
    const pick = { jugador: mkPick('jugador', 'JUGADOR'), banca: mkPick('banca', 'BANCA'), empate: mkPick('empate', 'EMPATE 8:1') };
    picks.append(pick.jugador, pick.banca, pick.empate);
    const paint = () => {
      for (const k of ['jugador', 'banca', 'empate'] as const) pick[k].classList.toggle('on', bet === k);
    };
    const deal = button('Repartir', () => {
      if (!bet) return hud.toast('Elige dónde apuestas', 'bad');
      const stake = sel.get();
      if (!spend(game, stake)) return;
      const d = deck();
      const player = [d.pop()!, d.pop()!];
      const banker = [d.pop()!, d.pop()!];
      // reglas de la tercera carta
      const pv0 = bacValue(player), bv0 = bacValue(banker);
      const natural = pv0 >= 8 || bv0 >= 8;
      let pThird: Card | null = null;
      if (!natural) {
        if (pv0 <= 5) { pThird = d.pop()!; player.push(pThird); }
        const bv = bacValue(banker);
        const pt = pThird ? (pThird.r >= 10 ? (pThird.r === 14 ? 1 : 0) : pThird.r) : null;
        let bankerDraws = false;
        if (pThird === null) bankerDraws = bv <= 5;
        else if (bv <= 2) bankerDraws = true;
        else if (bv === 3) bankerDraws = pt !== 8;
        else if (bv === 4) bankerDraws = pt! >= 2 && pt! <= 7;
        else if (bv === 5) bankerDraws = pt! >= 4 && pt! <= 7;
        else if (bv === 6) bankerDraws = pt! === 6 || pt! === 7;
        if (bankerDraws) banker.push(d.pop()!);
      }
      const pv = bacValue(player), bv = bacValue(banker);
      const winner = pv > bv ? 'jugador' : bv > pv ? 'banca' : 'empate';
      pRow.innerHTML = ''; player.forEach((c) => pRow.append(cardEl(c)));
      pRow.append(el('span', 'bj-val', String(pv)));
      bRow.innerHTML = ''; banker.forEach((c) => bRow.append(cardEl(c)));
      bRow.append(el('span', 'bj-val', String(bv)));
      let won = 0;
      if (winner === bet) won = bet === 'empate' ? stake * 9 : bet === 'banca' ? Math.floor(stake * 1.95) : stake * 2;
      else if (winner === 'empate' && bet !== 'empate') won = stake; // empate devuelve la apuesta en jugador/banca
      if (won) win(game, won);
      history.unshift(winner[0].toUpperCase());
      msg.innerHTML = `Gana <b class="bc-win-${winner}">${winner.toUpperCase()}</b> (${pv}-${bv}) · ${won ? `ganas ${chips(won)}` : 'pierdes'}`;
      bar.textContent = `🪙 ${chips(game.state.data.chips)}`;
      drawRoad();
    });

    body.closest('.panel')?.classList.add('casino-live');
    const road = el('div', 'bc-road');
    const drawRoad = () => {
      road.innerHTML = '';
      for (const r of history.slice(0, 40)) {
        road.append(el('div', 'bc-bead ' + (r === 'J' ? 'j' : r === 'B' ? 'b' : 'e'), r));
      }
    };
    const term = el('div', 'bj-live');
    const stage = el('div', 'bj-stage bc-stage');
    const sides = el('div', 'bc-sides');
    const pSide = el('div', 'bc-seat');
    pSide.append(el('div', 'bc-side', 'Jugador'), pRow);
    const bSide = el('div', 'bc-seat');
    bSide.append(el('div', 'bc-side banca', 'Banca'), bRow);
    sides.append(pSide, bSide);
    stage.append(el('div', 'bj-rules', 'Jugador paga 1:1 · Banca 0,95:1 · Empate 8:1'), sides, msg, el('div', 'bc-road-label', 'Historial'), road);

    const bjDeck = el('div', 'bj-deck');
    const dkLeft = el('div', 'bj-deck-left');
    dkLeft.append(bar);
    const dkCenter = el('div', 'bj-deck-center');
    dkCenter.append(el('div', 'mf-tray-label', 'VALOR DE LA FICHA'), sel.row);
    const dkRight = el('div', 'bj-deck-right');
    dkRight.append(picks, deal);
    bjDeck.append(dkLeft, dkCenter, dkRight);

    term.append(stage, bjDeck);
    body.append(term);
    paint();
    drawRoad();
  }, onClose);
}

// --- tragaperras: tres máquinas propias, cada una con su mecánica ---
interface SlotGame {
  id: string;
  name: string;
  theme: string;
  cols: number;
  rows: number;
  symbols: { icon: string; weight: number; pay3: number }[];
  wild?: string;
  scatter?: string;
  // texto de ayuda
  rules: string;
}

const SLOTS: SlotGame[] = [
  {
    id: 'frutas', name: 'Broker Fruits', theme: 'linear-gradient(135deg,#e8392a,#8a0f12)', cols: 3, rows: 1,
    symbols: [
      { icon: '🍒', weight: 30, pay3: 5 }, { icon: '🍋', weight: 22, pay3: 8 }, { icon: '🍉', weight: 16, pay3: 12 },
      { icon: '🔔', weight: 12, pay3: 20 }, { icon: '⭐', weight: 9, pay3: 40 }, { icon: '💎', weight: 5, pay3: 80 }, { icon: '7️⃣', weight: 3, pay3: 150 },
    ],
    rules: '3 iguales pagan. Dos 🍒 ya dan premio. El 7️⃣ es el gordo (x150).',
  },
  {
    id: 'oro', name: 'Golden Vegas 5x3', theme: 'linear-gradient(135deg,#f7b733,#8a5a00)', cols: 5, rows: 3,
    symbols: [
      { icon: '🔟', weight: 26, pay3: 3 }, { icon: '🅰️', weight: 22, pay3: 4 }, { icon: '🔔', weight: 16, pay3: 8 },
      { icon: '💰', weight: 12, pay3: 15 }, { icon: '💎', weight: 8, pay3: 30 }, { icon: '👑', weight: 4, pay3: 60 },
    ],
    wild: '🃏', scatter: '🎁',
    rules: '5 rodillos, 3 filas. Gana por líneas (3,4,5 iguales de izq. a dcha.). El 🃏 sustituye a cualquier símbolo. Tres 🎁 dan 10 giros gratis.',
  },
  {
    id: 'cripto', name: 'Crypto Cascade', theme: 'linear-gradient(135deg,#16c79a,#07373a)', cols: 5, rows: 4,
    symbols: [
      { icon: '🟢', weight: 26, pay3: 2 }, { icon: '🔷', weight: 20, pay3: 4 }, { icon: '🟠', weight: 15, pay3: 7 },
      { icon: 'Ξ', weight: 11, pay3: 14 }, { icon: '₿', weight: 7, pay3: 28 }, { icon: '🚀', weight: 4, pay3: 70 },
    ],
    rules: 'Pagan 8+ símbolos iguales por toda la rejilla; ganan, desaparecen y caen nuevos (cascada). Cadenas seguidas suben el multiplicador x1, x2, x3, x5.',
  },
];

function pickSymbol(g: SlotGame) {
  const total = g.symbols.reduce((s, x) => s + x.weight, 0) + (g.wild ? 6 : 0) + (g.scatter ? 4 : 0);
  let r = Math.random() * total;
  if (g.wild && (r -= 6) < 0) return g.wild;
  if (g.scatter && (r -= 4) < 0) return g.scatter;
  for (const x of g.symbols) if ((r -= x.weight) < 0) return x.icon;
  return g.symbols[0].icon;
}

export function slotsMenu(game: Game) {
  game.hud.openPanel('Tragaperras', (body) => {
    body.append(el('div', 'muted', 'Elige máquina. Cada una juega distinto. Todo con fichas del casino.'));
    // destacada: Slots MegaFire (misma estética que la ruleta en fuego)
    const feat = el('button', 'slot-pick mfs-pick');
    feat.innerHTML = `<b>🔥 Slots MegaFire</b><span>🔥 💰 ⭐ 🎁</span><small>Orbes con multiplicador, colector, tiradas gratis y bonus ×10…×1000.</small>`;
    feat.onclick = () => megaFireSlotsPanel(game);
    body.append(feat);
    for (const g of SLOTS) {
      const card = el('button', 'slot-pick');
      card.style.background = g.theme;
      card.innerHTML = `<b>${g.name}</b><span>${g.symbols.slice(-3).map((s) => s.icon).join(' ')}</span><small>${g.rules}</small>`;
      card.onclick = () => slotMachine(game, g);
      body.append(card);
    }
  });
}

function slotMachine(game: Game, g: SlotGame) {
  const { hud } = game;
  hud.openPanel(g.name, (body) => {
    const bar = chipBar(game);
    const sel = betSelector([1, 5, 10, 50, 100]);
    const grid = el('div', 'slot-grid');
    grid.style.gridTemplateColumns = `repeat(${g.cols}, 1fr)`;
    grid.style.background = g.theme;
    const cells: HTMLElement[] = [];
    for (let i = 0; i < g.cols * g.rows; i++) {
      const c = el('div', 'slot-cell', g.symbols[i % g.symbols.length].icon);
      cells.push(c);
      grid.append(c);
    }
    const msg = el('div', 'muted', g.rules);
    let freeSpins = 0;
    const payFor = (icon: string) => g.symbols.find((s) => s.icon === icon)?.pay3 ?? 0;

    const settle = (board: string[], bet: number) => {
      let prize = 0;
      const winners = new Set<number>();
      if (g.id === 'frutas') {
        if (board[0] === board[1] && board[1] === board[2]) { prize = bet * payFor(board[0]); [0, 1, 2].forEach((i) => winners.add(i)); }
        else if (board.filter((x) => x === '🍒').length >= 2) { prize = bet * 2; board.forEach((x, i) => x === '🍒' && winners.add(i)); }
      } else if (g.id === 'oro') {
        // 3 líneas horizontales + 2 diagonales; el wild sustituye
        const lines = [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [0, 6, 12, 8, 4], [10, 6, 2, 8, 14]];
        for (const line of lines) {
          const syms = line.map((i) => board[i]);
          const base = syms.find((x) => x !== g.wild) ?? g.wild!;
          if (base === g.scatter) continue;
          let run = 0;
          for (const x of syms) { if (x === base || x === g.wild) run++; else break; }
          if (run >= 3) { prize += bet * payFor(base) * (run === 5 ? 3 : run === 4 ? 1.5 : 1); line.slice(0, run).forEach((i) => winners.add(i)); }
        }
        const scatters = board.filter((x) => x === g.scatter).length;
        if (scatters >= 3) { freeSpins += 10; board.forEach((x, i) => x === g.scatter && winners.add(i)); }
      }
      return { prize: Math.floor(prize), winners };
    };

    const spin = button('TIRAR', async () => {
      const bet = sel.get();
      const free = freeSpins > 0;
      if (free) freeSpins--;
      else if (!spend(game, bet)) return;
      spin.disabled = true;
      // animación de rodillos
      for (let t = 0; t < 14; t++) {
        cells.forEach((c, i) => { if (t < 6 + (i % g.cols) * 2) c.textContent = pickSymbol(g); });
        await new Promise((r) => setTimeout(r, 55));
      }
      if (g.id === 'cripto') {
        // cascada: rellenar, pagar grupos de 8+, repetir
        let board = cells.map(() => pickSymbol(g));
        let totalPrize = 0, mult = 1;
        let chain = true;
        while (chain) {
          cells.forEach((c, i) => (c.textContent = board[i]));
          await new Promise((r) => setTimeout(r, 180));
          const counts = new Map<string, number[]>();
          board.forEach((x, i) => counts.set(x, [...(counts.get(x) ?? []), i]));
          let hit: number[] = [];
          let roundPrize = 0;
          for (const [icon, idx] of counts) if (idx.length >= 8) { roundPrize += bet * payFor(icon) * (idx.length / 8); hit.push(...idx); }
          if (roundPrize > 0) {
            totalPrize += Math.floor(roundPrize * mult);
            hit.forEach((i) => cells[i].classList.add('slot-win'));
            await new Promise((r) => setTimeout(r, 300));
            hit.forEach((i) => cells[i].classList.remove('slot-win'));
            board = board.map((x, i) => (hit.includes(i) ? pickSymbol(g) : x));
            mult = mult >= 5 ? 5 : mult >= 3 ? 5 : mult >= 2 ? 3 : 2;
          } else chain = false;
        }
        if (totalPrize) win(game, totalPrize);
        msg.textContent = totalPrize ? `💥 ¡Cascada! +${chips(totalPrize)} (x${mult} máx)` : 'Sin premio. Otra vez.';
      } else {
        const board = cells.map(() => pickSymbol(g));
        cells.forEach((c, i) => (c.textContent = board[i]));
        const { prize, winners } = settle(board, bet);
        winners.forEach((i) => cells[i].classList.add('slot-win'));
        setTimeout(() => winners.forEach((i) => cells[i].classList.remove('slot-win')), 900);
        if (prize) win(game, prize);
        msg.textContent = prize ? `🎉 ¡Premio! +${chips(prize)}${freeSpins ? ` · ${freeSpins} giros gratis` : ''}` : freeSpins ? `🎁 ${freeSpins} giros gratis` : 'Sin premio. Otra vez.';
      }
      bar.textContent = `🪙 ${chips(game.state.data.chips)}${freeSpins ? ` · 🎁${freeSpins}` : ''}`;
      spin.disabled = false;
    });
    const spinFree = () => freeSpins > 0;
    body.closest('.panel')?.classList.add('casino-live');
    const sterm = el('div', 'slot-live');
    const sstage = el('div', 'slot-stage');
    sstage.append(grid, msg);
    const sdeck = el('div', 'slot-deck');
    const sdL = el('div', 'slot-deck-left'); sdL.append(bar);
    const sdC = el('div', 'slot-deck-center'); sdC.append(el('div', 'mf-tray-label', 'VALOR DE LA FICHA'), sel.row);
    const sdR = el('div', 'slot-deck-right'); sdR.append(spin, button('‹ Otras máquinas', () => slotsMenu(game), 'btn ghost'));
    sdeck.append(sdL, sdC, sdR);
    sterm.append(sstage, sdeck);
    body.append(sterm);
    void spinFree;
  });
}

// --- Slots MegaFire: orbes con multiplicador, colector, tiradas gratis y bonus
// (misma estética que la ruleta MegaFire) ---------------------------------
interface MfsSym { icon: string; weight: number; pay: number }
const MFS_NORMAL: MfsSym[] = [
  { icon: '🔟', weight: 32, pay: 0.5 },
  { icon: '🅰️', weight: 24, pay: 0.8 },
  { icon: '🔔', weight: 18, pay: 1.5 },
  { icon: '💎', weight: 12, pay: 3 },
  { icon: '👑', weight: 7, pay: 6 },
];
const MFS_ORB_VALUES = [2, 3, 5, 10, 25, 50, 100];
const MFS_ORB_WEIGHTS = [30, 24, 18, 12, 8, 5, 3];
interface MfsCell { kind: 'n' | 'orb' | 'collect' | 'scatter' | 'bonus'; icon: string; val?: number }

function mfsPickCell(fs: boolean): MfsCell {
  const r = Math.random() * 100;
  const orbRate = fs ? 14 : 8;          // en tiradas gratis caen más orbes
  const collectRate = fs ? 5 : 3;
  if (r < orbRate) {
    if (Math.random() < 0.05) return { kind: 'bonus', icon: '🎁' };
    return { kind: 'orb', icon: '🔥', val: mfPick(MFS_ORB_VALUES, MFS_ORB_WEIGHTS) };
  }
  if (r < orbRate + collectRate) return { kind: 'collect', icon: '💰' };
  if (r < orbRate + collectRate + 2.5) return { kind: 'scatter', icon: '⭐' };
  const idx = mfPick(MFS_NORMAL.map((_, i) => i), MFS_NORMAL.map((s) => s.weight));
  return { kind: 'n', icon: MFS_NORMAL[idx].icon };
}

export function megaFireSlotsPanel(game: Game) {
  const { hud } = game;
  let closed = false;
  const timers = new Set<number>();
  const after = (ms: number, fn: () => void) => { const id = window.setTimeout(() => { timers.delete(id); if (!closed) fn(); }, ms); timers.add(id); return id; };
  const sleep = (ms: number) => new Promise<void>((res) => after(ms, res));

  const COLS = 5, ROWS = 4, N = COLS * ROWS;
  let freeSpins = 0, fsMult = 1, busy = false;

  hud.openPanel('Slots MegaFire', (body) => {
    const bar = chipBar(game);
    const sel = betSelector([5, 25, 100, 500, 1000]);
    const grid = el('div', 'slot-grid mfs-grid');
    grid.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
    const cells: HTMLElement[] = [];
    for (let i = 0; i < N; i++) { const c = el('div', 'slot-cell mfs-cell'); c.textContent = MFS_NORMAL[i % MFS_NORMAL.length].icon; cells.push(c); grid.append(c); }
    const msg = el('div', 'muted', '🔥 orbes = multiplicadores · 💰 colector = los cobra todos · 3+ ⭐ = tiradas gratis · 🎁 = bonus. Todo con fichas.');
    const bonusWrap = el('div', 'mfs-bonus-slot');
    const refreshBar = () => { bar.textContent = `🪙 ${chips(game.state.data.chips)}${freeSpins ? ` · 🎁 ${freeSpins} gratis ×${fsMult}` : ''}`; };

    const paintCell = (i: number, c: MfsCell) => {
      const e = cells[i];
      e.className = 'slot-cell mfs-cell ' + (c.kind === 'orb' ? 'orb' : c.kind === 'collect' ? 'collect' : c.kind === 'scatter' ? 'scatter' : c.kind === 'bonus' ? 'bonus' : '');
      e.innerHTML = c.kind === 'orb' ? `🔥<span class="mfs-val">×${c.val}</span>` : c.icon;
    };

    const runBonus = (cb: (v: number) => void) => {
      bonusWrap.innerHTML = '';
      const bonus = el('div', 'mf-bonus');
      const strip = el('div', 'mf-bonus-strip');
      const bcells = MF_BONUS.map((v) => { const c = el('div', 'mf-bonus-cell', '×' + v); strip.append(c); return c; });
      bonus.append(el('div', 'mf-bonus-title', '🎁 BONUS MEGAFIRE'), strip);
      bonusWrap.append(bonus);
      const winner = mfPick(MF_BONUS, MF_BONUS_WEIGHTS);
      let i = 0, ticks = 0;
      const total = 26 + Math.floor(Math.random() * MF_BONUS.length);
      const hop = () => {
        bcells.forEach((c) => c.classList.remove('on'));
        bcells[i % bcells.length].classList.add('on');
        if (ticks >= total && MF_BONUS[i % bcells.length] === winner) { after(700, () => { after(900, () => bonus.remove()); cb(winner); }); return; }
        ticks++; i++;
        after(ticks > total - 7 ? 170 : 60, hop);
      };
      hop();
    };

    const settle = async (stake: number) => {
      // animación de rodillos
      for (let t = 0; t < 12; t++) { cells.forEach((c, i) => { if (t < 5 + (i % COLS) * 2) c.textContent = mfsPickCell(freeSpins > 0).icon; }); await sleep(45); }
      const board: MfsCell[] = Array.from({ length: N }, () => mfsPickCell(freeSpins > 0));
      board.forEach((c, i) => paintCell(i, c));
      await sleep(250);

      let won = 0;
      // racimos de 8+ del mismo símbolo normal
      const counts = new Map<string, number[]>();
      board.forEach((c, i) => { if (c.kind === 'n') counts.set(c.icon, [...(counts.get(c.icon) ?? []), i]); });
      for (const [icon, idx] of counts) if (idx.length >= 8) {
        won += stake * (MFS_NORMAL.find((s) => s.icon === icon)!.pay) * (idx.length - 7);
        idx.forEach((i) => cells[i].classList.add('slot-win'));
      }
      // orbes + colector
      const orbs = board.map((c, i) => ({ c, i })).filter((x) => x.c.kind === 'orb');
      const collectors = board.map((c, i) => i).filter((i) => board[i].kind === 'collect');
      const hasBonus = board.some((c) => c.kind === 'bonus');
      let collectMsg = '';
      if (collectors.length && (orbs.length || hasBonus)) {
        cells.forEach((c) => c.classList.remove('slot-win'));
        collectors.forEach((i) => cells[i].classList.add('mfs-collecting'));
        orbs.forEach((o) => cells[o.i].classList.add('mfs-collecting'));
        await sleep(650);
        const orbSum = orbs.reduce((s, o) => s + (o.c.val || 0), 0);
        const collected = stake * orbSum * collectors.length * fsMult;
        if (collected) won += collected;
        collectMsg = `💰 colecta ×${orbSum}${collectors.length > 1 ? ` ×${collectors.length} colectores` : ''}${fsMult > 1 ? ` ×${fsMult}` : ''} = ${chips(collected)}`;
        if (hasBonus) {
          await sleep(300);
          await new Promise<void>((res) => runBonus((v) => { const bw = stake * v * fsMult; won += bw; collectMsg += ` · 🎁 ×${v} = ${chips(bw)}`; res(); }));
        }
      }
      // scatters → tiradas gratis
      const scatters = board.filter((c) => c.kind === 'scatter').length;
      let fsMsg = '';
      if (scatters >= 3) {
        board.forEach((c, i) => { if (c.kind === 'scatter') cells[i].classList.add('slot-win'); });
        if (freeSpins > 0) { freeSpins += 5; fsMsg = ' · 🎁 +5 tiradas gratis'; }
        else { freeSpins = 8; fsMult = 1; fsMsg = ' · 🎁 ¡8 TIRADAS GRATIS! Los colectores suben el multiplicador'; }
      }
      if (won) win(game, won);
      refreshBar();
      msg.innerHTML = `${won ? `🎉 +${chips(won)}` : 'Sin premio'}${collectMsg ? ` · ${collectMsg}` : ''}${fsMsg}`;
      setTimeout(() => cells.forEach((c) => c.classList.remove('slot-win', 'mfs-collecting')), 1200);
    };

    const spin = button('TIRAR', async () => {
      if (busy) return;
      const free = freeSpins > 0;
      const stake = sel.get();
      if (!free && !spend(game, stake)) return;
      busy = true; spin.disabled = true;
      if (free) { freeSpins--; }
      await settle(stake);
      if (free) fsMult++; // en tiradas gratis el multiplicador crece
      busy = false; spin.disabled = false;
      refreshBar();
      if (freeSpins > 0) { msg.innerHTML += ` · quedan ${freeSpins} gratis ×${fsMult}`; }
      else if (free) { fsMult = 1; }
    });

    refreshBar();
    body.closest('.panel')?.classList.add('casino-live');
    const sterm = el('div', 'slot-live');
    const sstage = el('div', 'slot-stage');
    sstage.append(grid, bonusWrap, msg);
    const sdeck = el('div', 'slot-deck');
    const sdL = el('div', 'slot-deck-left'); sdL.append(bar);
    const sdC = el('div', 'slot-deck-center'); sdC.append(el('div', 'mf-tray-label', 'VALOR DE LA FICHA'), sel.row);
    const sdR = el('div', 'slot-deck-right'); sdR.append(spin, button('‹ Otras máquinas', () => slotsMenu(game), 'btn ghost'));
    sdeck.append(sdL, sdC, sdR);
    sterm.append(sstage, sdeck);
    body.append(sterm);
  }, () => { closed = true; timers.forEach((t) => clearTimeout(t)); timers.clear(); });
}

// --- Gemas (Mines): descubre gemas y evita las bombas; retírate cuando quieras
export function minesPanel(game: Game) {
  const { hud } = game;
  const T = 25;
  hud.openPanel('Gemas', (body) => {
    const bar = chipBar(game);
    const sel = betSelector([5, 25, 100, 500, 1000]);
    let bombsN = 5;
    let active = false, mult = 1, bet = 0, picks = 0;
    const bombs = new Set<number>();
    const grid = el('div', 'mines-grid');
    const cells: HTMLButtonElement[] = [];
    const msg = el('div', 'muted', 'Elige apuesta y número de bombas. Cada gema sube el premio; retírate antes de pillar una bomba.');
    const cashBtn = button('Retirar', () => cashOut(), 'btn');
    const bombSel = el('div', 'row');

    const fairMultAfter = (k: number) => {
      let m = 1;
      for (let i = 0; i < k; i++) m *= (T - i) / (T - bombsN - i);
      return Math.round(m * 0.97 * 100) / 100; // 3 % de ventaja de la casa
    };
    const paint = () => {
      bar.textContent = `🪙 ${chips(game.state.data.chips)}`;
      cashBtn.disabled = !active || picks === 0;
      cashBtn.textContent = active && picks > 0 ? `Retirar ${chips(Math.floor(bet * mult))} (×${mult})` : 'Retirar';
    };
    const revealAll = () => {
      cells.forEach((c, i) => {
        c.disabled = true;
        if (bombs.has(i)) { c.textContent = '💣'; c.classList.add('bomb'); }
        else if (!c.classList.contains('gem')) c.textContent = '💎', c.classList.add('faint');
      });
    };
    const cashOut = () => {
      if (!active || picks === 0) return;
      const wonAmt = Math.floor(bet * mult);
      win(game, wonAmt);
      active = false;
      revealAll();
      msg.innerHTML = `✅ Te retiras con <b>${chips(wonAmt)}</b> (×${mult})`;
      paint();
    };
    const pick = (i: number) => {
      if (!active) return;
      const c = cells[i];
      if (bombs.has(i)) {
        active = false;
        c.textContent = '💥'; c.classList.add('bomb');
        revealAll();
        msg.innerHTML = '💣 ¡BOOM! Pierdes la apuesta. Otra vez.';
        paint();
        return;
      }
      c.textContent = '💎'; c.classList.add('gem'); c.disabled = true;
      picks++;
      mult = fairMultAfter(picks);
      if (picks === T - bombsN) { // todas las gemas
        win(game, Math.floor(bet * mult));
        active = false;
        revealAll();
        msg.innerHTML = `🏆 ¡Todas las gemas! +${chips(Math.floor(bet * mult))}`;
      } else {
        msg.innerHTML = `💎 Gema ${picks} · premio actual ${chips(Math.floor(bet * mult))} (×${mult})`;
      }
      paint();
    };
    const newGame = () => {
      bet = sel.get();
      if (!spend(game, bet)) return;
      bombs.clear();
      while (bombs.size < bombsN) bombs.add(Math.floor(Math.random() * T));
      active = true; mult = 1; picks = 0;
      cells.forEach((c) => { c.textContent = ''; c.className = 'mine-cell'; c.disabled = false; });
      msg.textContent = `En juego · ${bombsN} bombas. Descubre gemas.`;
      paint();
    };
    const startBtn = button('JUGAR', newGame);

    for (let i = 0; i < T; i++) {
      const c = el('button', 'mine-cell') as HTMLButtonElement;
      c.onclick = () => pick(i);
      cells.push(c); grid.append(c);
    }
    const renderBombSel = () => {
      bombSel.innerHTML = '';
      for (const n of [3, 5, 10]) bombSel.append(button(`${n} bombas`, () => { if (!active) { bombsN = n; renderBombSel(); } }, 'btn small' + (bombsN === n ? ' on' : '')));
    };
    renderBombSel();
    body.closest('.panel')?.classList.add('casino-live');
    const mterm = el('div', 'slot-live');
    const mstage = el('div', 'slot-stage');
    mstage.append(grid, msg);
    const mdeck = el('div', 'slot-deck');
    const mdL = el('div', 'slot-deck-left'); mdL.append(bar);
    const mdC = el('div', 'slot-deck-center'); mdC.append(el('div', 'mf-tray-label', 'VALOR DE LA FICHA'), sel.row, el('div', 'mf-tray-label', 'BOMBAS'), bombSel);
    const mdR = el('div', 'slot-deck-right'); mdR.append(startBtn, cashBtn);
    mdeck.append(mdL, mdC, mdR);
    mterm.append(mstage, mdeck);
    body.append(mterm);
    paint();
  });
}

// --- Mega Wheel: rueda del dinero con multiplicador en el top slot ---
const MW_SEGMENTS = [1, 2, 1, 5, 1, 2, 1, 10, 2, 1, 5, 2, 1, 20, 1, 2, 5, 1, 40, 2];
const MW_VALUES = [1, 2, 5, 10, 20, 40];
const MW_COLORS: Record<number, string> = { 1: '#2d9cdb', 2: '#6fcf97', 5: '#f2c94c', 10: '#f2994a', 20: '#eb5757', 40: '#9b51e0' };
export function megaWheelPanel(game: Game) {
  const { hud } = game;
  const bets: Record<number, number> = {};
  let spinning = false;
  const history: number[] = [];
  hud.openPanel('Mega Wheel', (body) => {
    const bar = chipBar(game);
    const sel = betSelector([1, 5, 25, 100, 500]);
    const canvas = el('canvas', 'ct-wheel') as HTMLCanvasElement;
    canvas.width = canvas.height = 520;
    const topslot = el('div', 'ct-topslot');
    const result = el('div', 'wheel-result', 'Apuesta a un número y gira. El top slot multiplica un número al azar.');
    const grid = el('div', 'mw-grid');
    const cells: Record<number, HTMLElement> = {};
    for (const v of MW_VALUES) {
      const c = el('button', 'mw-cell');
      c.style.background = MW_COLORS[v];
      c.innerHTML = `<b>×${v}</b><span class="ct-stake"></span>`;
      c.onclick = () => {
        if (spinning) return;
        const val = sel.get();
        if (!spend(game, val)) return;
        bets[v] = (bets[v] ?? 0) + val;
        c.querySelector('.ct-stake')!.textContent = `🪙 ${bets[v]}`;
        bar.textContent = `🪙 ${chips(game.state.data.chips)}`;
      };
      cells[v] = c; grid.append(c);
    }
    const seg = (Math.PI * 2) / MW_SEGMENTS.length;
    const draw = (angle: number) => {
      const ctx = canvas.getContext('2d')!;
      const R = 125, c = 130;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, 520, 520);
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.beginPath(); ctx.arc(c, c, R + 3, 0, Math.PI * 2); ctx.fillStyle = '#2a1a06'; ctx.fill();
      MW_SEGMENTS.forEach((v, i) => {
        ctx.beginPath(); ctx.moveTo(c, c);
        ctx.arc(c, c, R, angle + i * seg, angle + (i + 1) * seg);
        ctx.fillStyle = MW_COLORS[v]; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.stroke();
        ctx.save(); ctx.translate(c, c); ctx.rotate(angle + (i + 0.5) * seg + Math.PI / 2);
        ctx.fillStyle = '#1a1205'; ctx.font = '800 13px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('×' + v, 0, -R + 16); ctx.restore();
      });
      ctx.beginPath(); ctx.arc(c, c, 32, 0, Math.PI * 2);
      const gr = ctx.createRadialGradient(c - 10, c - 10, 5, c, c, 32); gr.addColorStop(0, '#f6d365'); gr.addColorStop(1, '#8a5a12');
      ctx.fillStyle = gr; ctx.fill();
      ctx.beginPath(); ctx.moveTo(c, 6); ctx.lineTo(c - 11, 26); ctx.lineTo(c + 11, 26); ctx.closePath();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
    };
    let angle = 0; draw(angle);
    let topVal = MW_VALUES[Math.floor(Math.random() * MW_VALUES.length)];
    let topMult = [2, 3, 5, 10][Math.floor(Math.random() * 4)];
    const paintTop = () => { topslot.innerHTML = `TOP SLOT · <b>×${topVal}</b> gana <b>×${topMult}</b>`; };
    paintTop();
    const spinBtn = button('GIRAR', () => {
      if (spinning) return;
      if (!Object.keys(bets).length) return hud.toast('Pon fichas en algún número', 'bad');
      spinning = true; spinBtn.disabled = true;
      const idx = Math.floor(Math.random() * MW_SEGMENTS.length);
      const winner = MW_SEGMENTS[idx];
      const target = -Math.PI / 2 - (idx + 0.5) * seg;
      const turns = 5 + Math.random() * 2;
      const start = angle, end = target - Math.PI * 2 * turns;
      const T0 = performance.now(), dur = 4000;
      const anim = (now: number) => {
        const p = Math.min(1, (now - T0) / dur);
        angle = start + (end - start) * (1 - Math.pow(1 - p, 3));
        draw(angle);
        if (p < 1) return requestAnimationFrame(anim);
        history.unshift(winner);
        const stake = bets[winner] ?? 0;
        const boost = topVal === winner ? topMult : 1;
        const won = stake * winner * boost;
        if (won) win(game, won);
        result.innerHTML = `Sale <b>×${winner}</b>${boost > 1 ? ` (TOP ×${topMult})` : ''} · ${won ? `¡GANAS ${chips(won)}!` : 'nada'} <span class="muted">· ${history.slice(0, 12).map((h) => '×' + h).join(' ')}</span>`;
        for (const v of MW_VALUES) { delete bets[v]; cells[v].querySelector('.ct-stake')!.textContent = ''; }
        bar.textContent = `🪙 ${chips(game.state.data.chips)}`;
        spinning = false; spinBtn.disabled = false;
        topVal = MW_VALUES[Math.floor(Math.random() * MW_VALUES.length)];
        topMult = [2, 3, 5, 10][Math.floor(Math.random() * 4)];
        paintTop();
      };
      requestAnimationFrame(anim);
    });
    body.closest('.panel')?.classList.add('casino-live');
    const wterm = el('div', 'wheel-live');
    const wstage = el('div', 'wheel-stage');
    wstage.append(topslot, canvas, result);
    const wdeck = el('div', 'wheel-deck');
    const wdL = el('div', 'wheel-deck-left'); wdL.append(bar);
    const wdC = el('div', 'wheel-deck-center'); wdC.append(grid);
    const wdR = el('div', 'wheel-deck-right'); wdR.append(el('div', 'mf-tray-label', 'VALOR DE LA FICHA'), sel.row, spinBtn);
    wdeck.append(wdL, wdC, wdR);
    wterm.append(wstage, wdeck);
    body.append(wterm);
  });
}

// --- póker Texas Hold'em contra dos jugadores del casino ---
function handRank(cards: Card[]): number[] {
  // mejor mano de 5 entre las cartas disponibles: devuelve [categoría, desempates…]
  const n = cards.length;
  if (n < 5) {
    // antes del flop: valor aproximado (pareja + cartas altas) para los bots
    const rs = cards.map((c) => c.r).sort((a, b) => b - a);
    const pair = cards.length === 2 && cards[0].r === cards[1].r ? 1 : 0;
    return [pair, ...rs];
  }
  let best: number[] = [-1];
  const pick = (start: number, acc: number[]): void => {
    if (acc.length === 5) {
      const r = rank5(acc.map((i) => cards[i]));
      if (compare(r, best) > 0) best = r;
      return;
    }
    for (let i = start; i < n; i++) pick(i + 1, [...acc, i]);
  };
  pick(0, []);
  return best;
}
function rank5(c: Card[]): number[] {
  const rs = c.map((x) => x.r).sort((a, b) => b - a);
  const flush = c.every((x) => x.s === c[0].s);
  const uniq = [...new Set(rs)];
  let straightHigh = 0;
  if (uniq.length === 5 && rs[0] - rs[4] === 4) straightHigh = rs[0];
  if (uniq.length === 5 && rs[0] === 14 && rs[1] === 5) straightHigh = 5;
  const counts = uniq.map((r) => [rs.filter((x) => x === r).length, r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const byCount = counts.map((x) => x[1]);
  if (straightHigh && flush) return [8, straightHigh];
  if (counts[0][0] === 4) return [7, ...byCount];
  if (counts[0][0] === 3 && counts[1][0] === 2) return [6, ...byCount];
  if (flush) return [5, ...rs];
  if (straightHigh) return [4, straightHigh];
  if (counts[0][0] === 3) return [3, ...byCount];
  if (counts[0][0] === 2 && counts[1][0] === 2) return [2, ...byCount];
  if (counts[0][0] === 2) return [1, ...byCount];
  return [0, ...rs];
}
function compare(a: number[], b: number[]) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? -1) !== (b[i] ?? -1)) return (a[i] ?? -1) - (b[i] ?? -1);
  return 0;
}
const HAND_NAMES = ['Carta alta', 'Pareja', 'Doble pareja', 'Trío', 'Escalera', 'Color', 'Full', 'Póker', 'Escalera de color'];

export function pokerPanel(game: Game, onClose?: () => void) {
  const { hud } = game;
  const BLIND = 50;
  hud.openPanel('Póker Texas Hold\'em', (body) => {
    const bots = [{ name: 'Tony «el Tiburón»', chips: 3000 }, { name: 'Lucía «All-in»', chips: 3000 }];
    let d: Card[] = [], hole: Card[] = [], botHoles: Card[][] = [], board: Card[] = [], pot = 0, stage = -1, folded: boolean[] = [];
    const bar = chipBar(game);
    const botsRow = el('div', 'pk-opps');
    const boardRow = el('div', 'hand');
    const myRow = el('div', 'hand');
    const potEl = el('div', 'pk-pot');
    const msg = el('div', 'bj-msg', 'Nueva mano para empezar. Ciega de 50 fichas, contra dos jugadores del casino.');
    const actions = el('div', 'bj-actions');
    const strength = (cards: Card[]) => {
      const r = handRank(cards);
      return r[0] + (r[1] ?? 0) / 20;
    };
    const render = (showdown = false) => {
      bar.textContent = `🪙 ${chips(game.state.data.chips)}`;
      potEl.innerHTML = `<span>BOTE</span><b>${chips(pot)}</b>`;
      botsRow.innerHTML = '';
      bots.forEach((b, i) => {
        const box = el('div', 'bot');
        box.append(el('div', '', `${b.name}${folded[i + 1] ? ' (se retira)' : ''}`), el('div', 'muted', chips(b.chips)));
        const h = el('div', 'hand');
        (botHoles[i] ?? []).forEach((c) => h.append(cardEl(showdown && !folded[i + 1] ? c : null)));
        box.append(h);
        botsRow.append(box);
      });
      boardRow.innerHTML = '';
      board.forEach((c) => boardRow.append(cardEl(c)));
      myRow.innerHTML = '';
      hole.forEach((c) => myRow.append(cardEl(c)));
      actions.innerHTML = '';
      if (stage < 0 || stage > 3) actions.append(button('Nueva mano', newHand));
      else actions.append(button(stage === 0 ? 'Ver (50)' : 'Pasar / ver (50)', () => act(false)), button('Subir (150)', () => act(true), 'btn ghost'), button('Retirarse', fold, 'btn ghost'));
    };
    const newHand = () => {
      if (!spend(game, BLIND)) return;
      d = deck();
      hole = [d.pop()!, d.pop()!];
      botHoles = bots.map(() => [d.pop()!, d.pop()!]);
      board = [];
      pot = BLIND * 3;
      bots.forEach((b) => (b.chips -= BLIND));
      folded = [false, false, false];
      stage = 0;
      msg.textContent = 'Tus cartas. ¿Ves, subes o te retiras?';
      render();
    };
    const act = (raise: boolean) => {
      const cost = raise ? 150 : 50;
      if (!spend(game, cost)) return;
      pot += cost;
      // los bots deciden con la fuerza de su mano (y un poco de farol)
      bots.forEach((b, i) => {
        if (folded[i + 1]) return;
        const s = strength([...botHoles[i], ...board]) + Math.random() * 1.2;
        if (s < (raise ? 1.1 : 0.6) && stage > 0) {
          folded[i + 1] = true;
        } else {
          b.chips -= cost;
          pot += cost;
        }
      });
      if (folded[1] && folded[2]) return finish(true);
      stage++;
      if (stage === 1) board.push(d.pop()!, d.pop()!, d.pop()!);
      else if (stage === 2 || stage === 3) board.push(d.pop()!);
      else return finish(false);
      msg.textContent = ['', 'Flop', 'Turn', 'River'][stage];
      render();
    };
    const fold = () => {
      folded[0] = true;
      stage = 4;
      // el bote se lo lleva el mejor bot que siga
      const alive = bots.map((b, i) => ({ b, i })).filter(({ i }) => !folded[i + 1]);
      const winner = alive.sort((x, y) => compare(handRank([...botHoles[y.i], ...board]), handRank([...botHoles[x.i], ...board])))[0];
      if (winner) winner.b.chips += pot;
      msg.textContent = `Te retiras. ${winner?.b.name ?? 'La mesa'} se lleva ${chips(pot)}.`;
      pot = 0;
      render();
    };
    const finish = (allFolded: boolean) => {
      stage = 4;
      while (board.length < 5) board.push(d.pop()!);
      if (allFolded) {
        win(game, pot);
        msg.textContent = `Todos se retiran: te llevas ${chips(pot)}`;
        pot = 0;
        return render(false);
      }
      const mine = handRank([...hole, ...board]);
      const contenders = [{ name: 'Tú', rank: mine, i: -1 }, ...bots.map((b, i) => ({ name: b.name, rank: handRank([...botHoles[i], ...board]), i })).filter((x) => !folded[x.i + 1])];
      contenders.sort((a, b) => compare(b.rank, a.rank));
      const top = contenders[0];
      if (top.i === -1) win(game, pot);
      else bots[top.i].chips += pot;
      msg.textContent = `${top.name === 'Tú' ? '¡Ganas tú' : `Gana ${top.name}`} con ${HAND_NAMES[top.rank[0]]}! Bote: ${chips(pot)}. Tú tenías ${HAND_NAMES[mine[0]]}.`;
      pot = 0;
      render(true);
    };
    body.closest('.panel')?.classList.add('casino-live');
    const term = el('div', 'bj-live');
    const pkStage = el('div', 'bj-stage pk-stage');
    const center = el('div', 'pk-center');
    center.append(potEl, el('div', 'bj-seat-label', 'Mesa'), boardRow);
    const me = el('div', 'bj-area');
    me.append(myRow, el('div', 'bj-seat-label', 'Tus cartas'));
    pkStage.append(botsRow, center, me, msg);

    const bjDeck = el('div', 'bj-deck');
    const dkLeft = el('div', 'bj-deck-left');
    dkLeft.append(bar);
    const dkRight = el('div', 'bj-deck-right');
    dkRight.append(actions);
    bjDeck.append(dkLeft, el('div', 'bj-deck-center'), dkRight);

    term.append(pkStage, bjDeck);
    body.append(term);
    render();
  }, onClose);
}

// --- apuestas deportivas: partidos reales que se juegan en 5 minutos ---
interface MatchEvent { min: number; team: 0 | 1; who: string }
interface Match {
  comp: string;
  home: string;
  away: string;
  odds: [number, number, number];
  minutes: 90 | 120;
  goals: MatchEvent[];
  note?: string;
}

// resultados y goleadores reales (los nombres de equipos se pueden cambiar aquí)
export const MATCHES: Match[] = [
  { comp: 'Champions League · octavos (vuelta)', home: 'FC Barcelona', away: 'Paris Saint-Germain', odds: [1.8, 3.8, 4.2], minutes: 90, goals: [
    { min: 3, team: 0, who: 'Suárez' }, { min: 40, team: 0, who: 'Kurzawa (p.p.)' }, { min: 50, team: 0, who: 'Messi (p.)' }, { min: 62, team: 1, who: 'Cavani' },
    { min: 88, team: 0, who: 'Neymar' }, { min: 90, team: 0, who: 'Neymar (p.)' }, { min: 90, team: 0, who: 'Sergi Roberto' }] },
  { comp: 'Champions League · semifinal (vuelta)', home: 'Liverpool', away: 'FC Barcelona', odds: [2.6, 3.5, 2.6], minutes: 90, goals: [
    { min: 7, team: 0, who: 'Origi' }, { min: 54, team: 0, who: 'Wijnaldum' }, { min: 56, team: 0, who: 'Wijnaldum' }, { min: 79, team: 0, who: 'Origi' }] },
  { comp: 'Mundial · semifinal', home: 'Brasil', away: 'Alemania', odds: [2.2, 3.3, 3.2], minutes: 90, goals: [
    { min: 11, team: 1, who: 'Müller' }, { min: 23, team: 1, who: 'Klose' }, { min: 24, team: 1, who: 'Kroos' }, { min: 26, team: 1, who: 'Kroos' },
    { min: 29, team: 1, who: 'Khedira' }, { min: 69, team: 1, who: 'Schürrle' }, { min: 79, team: 1, who: 'Schürrle' }, { min: 90, team: 0, who: 'Óscar' }] },
  { comp: 'Mundial · final (con prórroga)', home: 'Países Bajos', away: 'España', odds: [3.6, 3.1, 2.2], minutes: 120, goals: [{ min: 116, team: 1, who: 'Iniesta' }] },
  { comp: 'Champions League · final (con prórroga)', home: 'Real Madrid', away: 'Atlético de Madrid', odds: [2.1, 3.3, 3.6], minutes: 120, goals: [
    { min: 36, team: 1, who: 'Godín' }, { min: 90, team: 0, who: 'Sergio Ramos' }, { min: 110, team: 0, who: 'Bale' }, { min: 118, team: 0, who: 'Marcelo' }, { min: 120, team: 0, who: 'Cristiano Ronaldo (p.)' }] },
  { comp: 'Mundial · final (con prórroga y penaltis)', home: 'Argentina', away: 'Francia', odds: [2.6, 3.0, 2.9], minutes: 120, note: 'Argentina gana 4-2 en los penaltis', goals: [
    { min: 23, team: 0, who: 'Messi (p.)' }, { min: 36, team: 0, who: 'Di María' }, { min: 80, team: 1, who: 'Mbappé (p.)' }, { min: 81, team: 1, who: 'Mbappé' },
    { min: 108, team: 0, who: 'Messi' }, { min: 118, team: 1, who: 'Mbappé (p.)' }] },
  { comp: 'Premier League · última jornada', home: 'Manchester City', away: 'QPR', odds: [1.2, 6.5, 13], minutes: 90, goals: [
    { min: 39, team: 0, who: 'Zabaleta' }, { min: 48, team: 1, who: 'Cissé' }, { min: 66, team: 1, who: 'Mackie' }, { min: 90, team: 0, who: 'Džeko' }, { min: 90, team: 0, who: 'Agüero' }] },
  { comp: 'LaLiga · El Clásico', home: 'FC Barcelona', away: 'Real Madrid', odds: [2.0, 3.4, 3.6], minutes: 90, goals: [
    { min: 10, team: 0, who: 'Xavi' }, { min: 18, team: 0, who: 'Pedro' }, { min: 55, team: 0, who: 'Villa' }, { min: 58, team: 0, who: 'Villa' }, { min: 90, team: 0, who: 'Jeffren' }] },
  { comp: 'Mundial · final (con prórroga)', home: 'Alemania', away: 'Argentina', odds: [2.3, 3.1, 3.4], minutes: 120, goals: [{ min: 113, team: 0, who: 'Götze' }] },
  { comp: 'Champions League · final (con prórroga y penaltis)', home: 'AC Milan', away: 'Liverpool', odds: [1.9, 3.4, 4.0], minutes: 120, note: 'Liverpool gana 3-2 en los penaltis', goals: [
    { min: 1, team: 0, who: 'Maldini' }, { min: 39, team: 0, who: 'Crespo' }, { min: 44, team: 0, who: 'Crespo' }, { min: 54, team: 1, who: 'Gerrard' }, { min: 56, team: 1, who: 'Šmicer' }, { min: 60, team: 1, who: 'Xabi Alonso' }] },
];

const LIVE_SECONDS = 180; // cada partido dura ~3 minutos reales

// el partido que se juega ahora en las pantallas (uno cada 5 minutos)
export class Sportsbook {
  index = Math.floor(Math.random() * MATCHES.length);
  elapsed = 0;
  bets: { pick: string; amount: number; odds: number; match: number }[] = [];
  private onEnd: ((text: string) => void)[] = [];

  get match() {
    return MATCHES[this.index];
  }

  get minute() {
    return Math.min(this.match.minutes, Math.floor((this.elapsed / LIVE_SECONDS) * this.match.minutes));
  }

  score(min = this.minute): [number, number] {
    const s: [number, number] = [0, 0];
    for (const g of this.match.goals) if (g.min <= min) s[g.team]++;
    return s;
  }

  ended(fn: (text: string) => void) {
    this.onEnd.push(fn);
  }

  tick(dt: number, game: Game) {
    this.elapsed += dt;
    if (this.elapsed < LIVE_SECONDS) return;
    // final: se pagan las apuestas de este partido y empieza otro
    const [h, a] = this.score(999);
    const result = h > a ? '1' : h < a ? '2' : 'X';
    const goals = h + a;
    let paid = 0;
    for (const b of this.bets.filter((x) => x.match === this.index)) {
      const ok = b.pick === result || (b.pick === '+2.5' && goals > 2.5) || (b.pick === '-2.5' && goals < 2.5);
      if (ok) paid += Math.floor(b.amount * b.odds);
    }
    const had = this.bets.some((x) => x.match === this.index);
    this.bets = [];
    if (paid) win(game, paid);
    const text = `${this.match.home} ${h}-${a} ${this.match.away}${this.match.note ? ` (${this.match.note})` : ''}`;
    if (had) game.phone.notify('⚽ Apuestas', paid ? `${text} · ¡Cobras ${chips(paid)}!` : `${text} · Apuesta perdida`);
    for (const fn of this.onEnd) fn(text);
    // los partidos se juegan en orden (así se conoce el calendario del día)
    this.index = (this.index + 1) % MATCHES.length;
    this.elapsed = 0;
  }

  // índices de los próximos n partidos (en orden de calendario)
  nextIndices(n: number): number[] {
    return Array.from({ length: n }, (_, i) => (this.index + 1 + i) % MATCHES.length);
  }

  // segundos reales hasta el saque del k-ésimo próximo partido (k=1 el siguiente)
  secsToKickoff(k: number): number {
    return Math.max(0, LIVE_SECONDS - this.elapsed) + (k - 1) * LIVE_SECONDS;
  }
}

// un único partido en juego para toda la torre
export const sportsbook = new Sportsbook();

export function sportsbookPanel(game: Game, book: Sportsbook = sportsbook) {
  const { hud } = game;
  let timer = 0;
  hud.openPanel('Apuestas deportivas', (body) => {
    const bar = chipBar(game);
    const live = el('div', 'scoreboard');
    const feed = el('div', 'muted');
    const sel = betSelector();
    const markets = el('div', 'row');
    const render = () => {
      const m = book.match;
      const [h, a] = book.score();
      bar.textContent = `🪙 ${chips(game.state.data.chips)}`;
      live.innerHTML = `<div class="muted">${m.comp}</div><div class="score"><span>${m.home}</span><b>${h} - ${a}</b><span>${m.away}</span></div><div class="minute">${book.minute}'</div>`;
      feed.textContent = m.goals.filter((g) => g.min <= book.minute).map((g) => `⚽ ${g.min}' ${g.who}`).join('  ·  ') || 'Sin goles todavía';
    };
    const odd = (o: number) => o.toFixed(2);
    const m = book.match;
    const place = (pick: string, odds: number) => {
      // las apuestas se cierran pasado el minuto 10 (luego sería trampa ver el marcador)
      if (book.minute > 10) return hud.toast('Apuestas cerradas: espera al próximo partido', 'bad');
      const v = sel.get();
      if (!spend(game, v)) return;
      book.bets.push({ pick, amount: v, odds, match: book.index });
      hud.toast(`Apuesta: ${pick} a ${odd(odds)} · ${chips(v)}`, 'ok');
      render();
    };
    markets.append(
      button(`1 · ${m.home} (${odd(m.odds[0])})`, () => place('1', m.odds[0])),
      button(`X · Empate (${odd(m.odds[1])})`, () => place('X', m.odds[1])),
      button(`2 · ${m.away} (${odd(m.odds[2])})`, () => place('2', m.odds[2])),
      button('Más de 2,5 goles (1.85)', () => place('+2.5', 1.85), 'btn ghost'),
      button('Menos de 2,5 goles (1.95)', () => place('-2.5', 1.95), 'btn ghost'),
    );
    // apuestas a partidos que aún no han empezado (siempre abiertas)
    const prePlace = (idx: number, pick: string, odds: number) => {
      const v = sel.get();
      if (!spend(game, v)) return;
      book.bets.push({ pick, amount: v, odds, match: idx });
      hud.toast(`Apuesta ${pick} a ${odd(odds)} · ${chips(v)}`, 'ok');
      render();
    };
    const fixtures = el('div', 'fixtures');
    const myBets = el('div', 'muted');
    const fmtCountdown = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const renderFixtures = () => {
      fixtures.innerHTML = '';
      book.nextIndices(3).forEach((idx, i) => {
        const fm = MATCHES[idx];
        const card = el('div', 'fixture');
        card.append(el('div', 'fx-comp', `${fm.comp} · empieza en ${fmtCountdown(book.secsToKickoff(i + 1))}`));
        card.append(el('div', 'fx-teams', `${fm.home} vs ${fm.away}`));
        const row = el('div', 'row');
        row.append(
          button(`1 (${odd(fm.odds[0])})`, () => prePlace(idx, '1', fm.odds[0]), 'btn small'),
          button(`X (${odd(fm.odds[1])})`, () => prePlace(idx, 'X', fm.odds[1]), 'btn small'),
          button(`2 (${odd(fm.odds[2])})`, () => prePlace(idx, '2', fm.odds[2]), 'btn small'),
        );
        card.append(row);
        fixtures.append(card);
      });
      const mine = book.bets.filter((b) => b.match !== book.index);
      myBets.textContent = mine.length ? `Tienes ${mine.length} apuesta(s) a partidos futuros.` : '';
    };
    const fullRender = () => { render(); renderFixtures(); };
    body.append(bar, live, feed, el('div', 'section', 'Apostar al partido en juego (cierra en el min 10)'), markets, sel.row,
      el('div', 'section', 'Próximos partidos'), fixtures, myBets,
      el('p', 'muted', 'Partidos reales con su resultado y goleadores de verdad, en ~3 minutos cada uno, uno tras otro todo el día. Puedes apostar al que se juega o a los próximos. Se paga al final (prórroga incluida; penaltis = empate).'));
    fullRender();
    timer = window.setInterval(fullRender, 500);
  }, () => clearInterval(timer));
}

// --- bar ---
const DRINKS = [
  { name: 'Mojito', icon: '🍹', price: 12, energy: 5 },
  { name: 'Whisky con hielo', icon: '🥃', price: 18, energy: 0 },
  { name: 'Champán (copa)', icon: '🥂', price: 25, energy: 5 },
  { name: 'Botella de champán VIP', icon: '🍾', price: 450, energy: 10 },
  { name: 'Red Bull', icon: '⚡', price: 6, energy: 30 },
];

export function barPanel(game: Game) {
  const { state, hud } = game;
  hud.openPanel('Bar del casino', (body) => {
    body.append(el('div', 'muted', `Se paga en efectivo · llevas ${euros(state.data.cash)}`));
    for (const d of DRINKS) {
      const row = el('div', 'item');
      row.append(el('span', 'icon', d.icon), el('span', '', d.name), el('span', 'muted', euros(d.price)), button('Pedir', () => {
        if (!state.payCash(d.price)) return hud.toast('No llevas efectivo', 'bad');
        state.data.energy = Math.min(100, state.data.energy + d.energy);
        state.persist();
        hud.toast(`${d.icon} ¡Salud!`, 'ok');
      }));
      body.append(row);
    }
  });
}
