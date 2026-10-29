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
  hud.openPanel('Ruleta europea', (body) => {
    const bar = chipBar(game);
    const sel = betSelector();
    const wheel = el('canvas', 'wheel') as HTMLCanvasElement;
    wheel.width = wheel.height = 220;
    const result = el('div', 'muted', 'Haz tus apuestas');
    const betList = el('div', 'muted');
    const board = el('div', 'roulette');
    const place = (label: string, numbers: number[], payout: number) => {
      const v = sel.get();
      if (!spend(game, v)) return;
      const existing = bets.find((b) => b.label === label);
      if (existing) existing.amount += v;
      else bets.push({ label, numbers, payout, amount: v });
      refresh();
    };
    const cell = (text: string, cls: string, numbers: number[], payout: number) => {
      const b = button(text, () => place(text, numbers, payout), 'rcell ' + cls);
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
    const outside = el('div', 'row');
    outside.append(
      cell('1-12', 'out', range(1, 12), 2), cell('13-24', 'out', range(13, 24), 2), cell('25-36', 'out', range(25, 36), 2),
      cell('1-18', 'out', range(1, 18), 1), cell('PAR', 'out', range(1, 36).filter((n) => n % 2 === 0), 1),
      cell('ROJO', 'red out', [...RED], 1), cell('NEGRO', 'black out', range(1, 36).filter((n) => !RED.has(n)), 1),
      cell('IMPAR', 'out', range(1, 36).filter((n) => n % 2), 1), cell('19-36', 'out', range(19, 36), 1),
    );
    const drawWheel = (angle: number, ball: number | null) => {
      const ctx = wheel.getContext('2d')!;
      const r = 105, c = 110;
      ctx.clearRect(0, 0, 220, 220);
      const seg = (Math.PI * 2) / WHEEL.length;
      WHEEL.forEach((n, i) => {
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.arc(c, c, r, angle + i * seg, angle + (i + 1) * seg);
        ctx.fillStyle = n === 0 ? '#0f8a4a' : RED.has(n) ? '#b3202a' : '#141414';
        ctx.fill();
        ctx.save();
        ctx.translate(c, c);
        ctx.rotate(angle + (i + 0.5) * seg);
        ctx.fillStyle = '#fff';
        ctx.font = '700 10px sans-serif';
        ctx.fillText(String(n), r - 20, 4);
        ctx.restore();
      });
      ctx.beginPath();
      ctx.arc(c, c, 45, 0, Math.PI * 2);
      ctx.fillStyle = '#6b4a22';
      ctx.fill();
      if (ball !== null) {
        const i = WHEEL.indexOf(ball);
        const a = angle + (i + 0.5) * seg;
        ctx.beginPath();
        ctx.arc(c + Math.cos(a) * (r - 34), c + Math.sin(a) * (r - 34), 6, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
    };
    drawWheel(0, null);
    const refresh = () => {
      bar.textContent = `🪙 ${chips(game.state.data.chips)}`;
      betList.textContent = bets.length ? 'Apuestas: ' + bets.map((b) => `${b.label} (${b.amount})`).join(' · ') : 'Sin apuestas';
    };
    const spinBtn = button('🎡 ¡Girar!', () => {
      if (!bets.length) return hud.toast('Pon alguna apuesta', 'bad');
      spinBtn.disabled = true;
      const n = WHEEL[Math.floor(Math.random() * WHEEL.length)];
      let angle = 0, speed = 0.5;
      const anim = () => {
        angle += speed;
        speed *= 0.985;
        drawWheel(angle, speed < 0.02 ? n : null);
        if (speed > 0.008) requestAnimationFrame(anim);
        else {
          drawWheel(angle, n);
          let won = 0;
          for (const b of bets) if (b.numbers.includes(n)) won += b.amount * (b.payout + 1);
          if (won) win(game, won);
          history.unshift(n);
          result.innerHTML = `Ha salido <b class="${n === 0 ? 'pos' : RED.has(n) ? 'neg' : ''}">${n}</b> ${won ? `· ¡Ganas ${chips(won)}! 🎉` : '· La banca gana'} <span class="muted">· últimos: ${history.slice(0, 8).join(', ')}</span>`;
          bets.length = 0;
          refresh();
          spinBtn.disabled = false;
        }
      };
      anim();
    });
    body.append(bar, el('div', 'row roulette-top'), board, outside, sel.row, betList, result);
    (body.children[1] as HTMLElement).append(wheel, el('div', 'col', ''));
    ((body.children[1] as HTMLElement).lastChild as HTMLElement).append(spinBtn, button('Quitar apuestas', () => {
      for (const b of bets) win(game, b.amount);
      bets.length = 0;
      refresh();
    }, 'btn ghost'));
    refresh();
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
    let d = deck(), player: Card[] = [], dealer: Card[] = [], bet = 0, playing = false;
    const bar = chipBar(game);
    const dealerRow = el('div', 'hand'), playerRow = el('div', 'hand');
    const msg = el('div', 'muted', 'La banca se planta en 17. Blackjack paga 3 a 2.');
    const actions = el('div', 'row');
    const render = (reveal = false) => {
      bar.textContent = `🪙 ${chips(game.state.data.chips)}`;
      dealerRow.innerHTML = '';
      dealer.forEach((c, i) => dealerRow.append(cardEl(i === 1 && !reveal ? null : c)));
      playerRow.innerHTML = '';
      player.forEach((c) => playerRow.append(cardEl(c)));
      actions.innerHTML = '';
      if (!playing) {
        actions.append(button('Repartir', deal));
      } else {
        actions.append(button('Pedir', hit), button('Plantarse', stand, 'btn ghost'));
        if (player.length === 2 && game.state.data.chips >= bet) actions.append(button('Doblar', double, 'btn ghost'));
      }
    };
    const finish = (text: string, payout: number) => {
      playing = false;
      if (payout) win(game, payout);
      msg.textContent = `${text} · tú ${bjValue(player)} · banca ${bjValue(dealer)}`;
      render(true);
    };
    const deal = () => {
      bet = sel.get();
      if (!spend(game, bet)) return;
      if (d.length < 15) d = deck();
      player = [d.pop()!, d.pop()!];
      dealer = [d.pop()!, d.pop()!];
      playing = true;
      msg.textContent = `Apuesta ${chips(bet)}`;
      if (bjValue(player) === 21) return finish('¡BLACKJACK! 🃏', Math.floor(bet * 2.5));
      render();
    };
    const hit = () => {
      player.push(d.pop()!);
      if (bjValue(player) > 21) return finish('Te pasas 💥', 0);
      render();
    };
    const stand = () => {
      while (bjValue(dealer) < 17) dealer.push(d.pop()!);
      const p = bjValue(player), q = bjValue(dealer);
      if (q > 21 || p > q) finish('¡Ganas! 🎉', bet * 2);
      else if (p === q) finish('Empate', bet);
      else finish('Gana la banca', 0);
    };
    const double = () => {
      if (!spend(game, bet)) return;
      bet *= 2;
      player.push(d.pop()!);
      if (bjValue(player) > 21) return finish('Te pasas 💥', 0);
      stand();
    };
    body.append(bar, el('div', 'section', 'Banca'), dealerRow, el('div', 'section', 'Tú'), playerRow, msg, sel.row, actions);
    render();
  });
}

// --- tragaperras ---
const SLOT = ['🍒', '🍋', '🍉', '🔔', '⭐', '💎', '7️⃣'];
const SLOT_PAY: Record<string, number> = { '🍒': 5, '🍋': 8, '🍉': 10, '🔔': 15, '⭐': 25, '💎': 50, '7️⃣': 100 };

export function slotsPanel(game: Game) {
  const { hud } = game;
  hud.openPanel('Tragaperras «Lucky Broker»', (body) => {
    const bar = chipBar(game);
    const sel = betSelector([1, 5, 10, 50, 100]);
    const reels = el('div', 'reels');
    const cells = [0, 1, 2].map(() => el('div', 'reel', '7️⃣'));
    reels.append(...cells);
    const msg = el('div', 'muted', '3 iguales: premio gordo (7️⃣ paga x100) · 2 cerezas: x2');
    const spin = button('🎰 Tirar', () => {
      const bet = sel.get();
      if (!spend(game, bet)) return;
      spin.disabled = true;
      // los símbolos raros salen menos
      const pick = () => {
        const r = Math.random();
        return SLOT[r < 0.3 ? 0 : r < 0.5 ? 1 : r < 0.66 ? 2 : r < 0.79 ? 3 : r < 0.9 ? 4 : r < 0.97 ? 5 : 6];
      };
      const final = [pick(), pick(), pick()];
      let t = 0;
      const timer = setInterval(() => {
        t++;
        cells.forEach((c, i) => (c.textContent = t > 8 + i * 5 ? final[i] : SLOT[Math.floor(Math.random() * SLOT.length)]));
        if (t > 20) {
          clearInterval(timer);
          let prize = 0;
          if (final[0] === final[1] && final[1] === final[2]) prize = bet * SLOT_PAY[final[0]];
          else if (final.filter((s) => s === '🍒').length === 2) prize = bet * 2;
          if (prize) win(game, prize);
          msg.textContent = prize ? `¡PREMIO! +${chips(prize)} 🎉` : 'Nada… otra más 😏';
          bar.textContent = `🪙 ${chips(game.state.data.chips)}`;
          spin.disabled = false;
        }
      }, 70);
      bar.textContent = `🪙 ${chips(game.state.data.chips)}`;
    });
    body.append(bar, reels, msg, sel.row, spin);
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
