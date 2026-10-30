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
      s.style.background = amount >= 5000 ? '#0f8a4a' : amount >= 1000 ? '#c8a14a' : amount >= 500 ? '#7d2ae8' : amount >= 100 ? '#111' : amount >= 25 ? '#1f5fae' : '#b3202a';
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
    const spinBtn = button('🎡 ¡Girar!', () => {
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
          result.innerHTML = `Ha salido <b class="rn ${n === 0 ? 'g' : RED.has(n) ? 'r' : 'b'}">${n}</b>${litHit ? ` ⚡×${litHit}` : ''} ${won ? `· ¡GANAS ${chips(won)}! 🎉` : '· gana la banca'} <span class="muted">· ${history.slice(0, 10).join(' ')}</span>`;
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
  if (!c) return el('div', 'card back', '🂠');
  const e = el('div', 'card' + (c.s === 1 || c.s === 2 ? ' redc' : ''), `${rankText(c.r)}${SUITS[c.s]}`);
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

export function blackjackPanel(game: Game) {
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
    const msg = el('div', 'muted', 'Blackjack paga 3:2. La banca se planta en 17. Puedes doblar, dividir y pedir seguro.');
    const actions = el('div', 'row');

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
        hd.append(cards, el('div', 'muted', `${hands.length > 1 ? `Mano ${i + 1} · ` : ''}${bjValue(h)}${bjValue(h) > 21 ? ' 💥' : ''} · ${chips(bets[i])}`));
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
      if (bjValue(hands[0]) === 21) { playing = false; return finishAll('¡BLACKJACK! 🃏'); }
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
        if (dealer.length === 2 && dv === 21) { totalWin += insurance * 3; results.push('seguro ✓'); }
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
    body.append(bar, el('div', 'section', 'Banca'), dealerRow, el('div', 'section', 'Tú'), handsWrap, msg, sel.row, actions);
    render();
  });
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
    canvas.width = canvas.height = 260;
    const topslot = el('div', 'ct-topslot');
    const result = el('div', 'muted', 'Apuesta a un número o a un bonus y gira la rueda');
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
      ctx.clearRect(0, 0, 260, 260);
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

    const spinBtn = button('🎡 ¡Girar!', () => {
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
          result.innerHTML = `Sale <b>${CT_TYPES[winner].label}</b>${topBoost > 1 ? ` (TOP ×${topMult})` : ''} · ${won ? `¡GANAS ${chips(won)}! 🎉` : 'nada para ti'} <span class="muted">· ${history.slice(0, 12).map((h) => CT_TYPES[h].label[0]).join(' ')}</span>`;
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

    body.append(bar, topslot, canvas, el('div', 'muted', 'Valor de la ficha:'), sel.row, grid, spinBtn, result);
  });
}

// --- Speed Baccarat (punto y banca) ---
const bacValue = (h: Card[]) => h.reduce((s, c) => s + (c.r >= 10 ? (c.r === 14 ? 1 : 0) : c.r), 0) % 10;

export function baccaratPanel(game: Game) {
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
      msg.innerHTML = `Gana <b>${winner}</b> (${pv}-${bv}) · ${won ? `+${chips(won)} 🎉` : 'pierdes'} <span class="muted">· ${history.slice(0, 14).join(' ')}</span>`;
      bar.textContent = `🪙 ${chips(game.state.data.chips)}`;
    });
    table.append(el('div', 'bc-side', 'Jugador'), pRow, el('div', 'bc-side banca', 'Banca'), bRow);
    body.append(bar, table, msg, el('div', 'muted', 'Valor de la ficha:'), sel.row, picks, deal);
    paint();
  });
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

    const spin = button('🎰 Tirar', async () => {
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
    body.append(bar, grid, msg, sel.row, spin, button('‹ Otras máquinas', () => slotsMenu(game), 'btn ghost'));
    void spinFree;
  });
}

// --- póker Texas Hold'em contra dos jugadores del casino ---
function handRank(cards: Card[]): number[] {
  // mejor mano de 5 entre 7 cartas: devuelve [categoría, desempates…]
  let best: number[] = [-1];
  const n = cards.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const five = cards.filter((_, i) => i !== a && i !== b);
    const r = rank5(five);
    if (compare(r, best) > 0) best = r;
  }
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

export function pokerPanel(game: Game) {
  const { hud } = game;
  const BLIND = 50;
  hud.openPanel('Póker Texas Hold\'em', (body) => {
    const bots = [{ name: 'Tony «el Tiburón»', chips: 3000 }, { name: 'Lucía «All-in»', chips: 3000 }];
    let d: Card[] = [], hole: Card[] = [], botHoles: Card[][] = [], board: Card[] = [], pot = 0, stage = -1, folded: boolean[] = [];
    const bar = chipBar(game);
    const botsRow = el('div', 'row');
    const boardRow = el('div', 'hand');
    const myRow = el('div', 'hand');
    const msg = el('div', 'muted', 'Ciega de 50 fichas. Contra dos jugadores del casino. Con el multijugador, mesas con tus colegas.');
    const actions = el('div', 'row');
    const strength = (cards: Card[]) => {
      const r = handRank(cards);
      return r[0] + (r[1] ?? 0) / 20;
    };
    const render = (showdown = false) => {
      bar.textContent = `🪙 ${chips(game.state.data.chips)} · bote ${chips(pot)}`;
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
        msg.textContent = `Todos se retiran: te llevas ${chips(pot)} 💰`;
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
    body.append(bar, botsRow, el('div', 'section', 'Mesa'), boardRow, el('div', 'section', 'Tus cartas'), myRow, msg, actions);
    render();
  });
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

const LIVE_SECONDS = 300;

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
    this.index = (this.index + 1 + Math.floor(Math.random() * (MATCHES.length - 1))) % MATCHES.length;
    this.elapsed = 0;
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
    body.append(bar, live, feed, el('div', 'section', 'Apostar (cierra en el minuto 10)'), markets, sel.row, el('p', 'muted', 'Partidos reales con su resultado y goleadores de verdad, resumidos en 5 minutos. Se paga el resultado al final (prórroga incluida; los penaltis cuentan como empate).'));
    render();
    timer = window.setInterval(render, 500);
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
