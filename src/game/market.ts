import { button, el, euros } from './hud';
import type { Position } from './state';
import type { Game } from './world';

// Mercado simulado: los precios se mueven siempre (aunque no estés en la
// mesa) con tendencias y noticias. En la mesa de trading apuestas a que
// sube (largo) o baja (corto), con apalancamiento.

interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
}

interface Asset {
  symbol: string;
  name: string;
  price: number;
  vol: number;
  drift: number;
  candles: Candle[];
}

const NEWS = [
  { text: 'Rumores de que un gran banco va a comprar', impact: 0.04 },
  { text: 'Un regulador amenaza con prohibirlo', impact: -0.05 },
  { text: 'Un famoso lo recomienda en directo', impact: 0.06 },
  { text: 'Hackean un exchange importante', impact: -0.07 },
  { text: 'Datos de inflación mejores de lo esperado', impact: 0.03 },
  { text: 'Una ballena vende un paquete enorme', impact: -0.04 },
];

const CANDLE_SECONDS = 2;

export class Market {
  assets: Asset[] = [
    { symbol: 'BTC', name: 'Bitcoin', price: 64000, vol: 0.004, drift: 0, candles: [] },
    { symbol: 'ETH', name: 'Ethereum', price: 3200, vol: 0.005, drift: 0, candles: [] },
    { symbol: 'BRKS', name: 'BrokerCoin (memecoin)', price: 0.42, vol: 0.014, drift: 0, candles: [] },
    { symbol: 'ORO', name: 'Oro (onza)', price: 2350, vol: 0.0015, drift: 0, candles: [] },
  ];
  private acc = 0;
  private onNews: ((text: string) => void)[] = [];

  constructor() {
    // historia inicial para que el gráfico no salga vacío
    for (const a of this.assets) for (let i = 0; i < 80; i++) this.step(a);
  }

  get(symbol: string) {
    return this.assets.find((a) => a.symbol === symbol)!;
  }

  newsListener(fn: (text: string) => void) {
    this.onNews.push(fn);
  }

  private step(a: Asset) {
    // la tendencia cambia poco a poco y de vez en cuando hay noticia
    a.drift = a.drift * 0.97 + (Math.random() - 0.5) * a.vol * 0.25;
    const o = a.price;
    let p = o;
    let h = o, l = o;
    for (let i = 0; i < 6; i++) {
      p *= 1 + a.drift + (Math.random() - 0.5) * a.vol * 2;
      h = Math.max(h, p);
      l = Math.min(l, p);
    }
    a.price = p;
    a.candles.push({ o, h, l, c: p });
    if (a.candles.length > 120) a.candles.shift();
  }

  tick(dt: number) {
    this.acc += dt;
    while (this.acc >= CANDLE_SECONDS) {
      this.acc -= CANDLE_SECONDS;
      for (const a of this.assets) this.step(a);
      if (Math.random() < 0.02) {
        const a = this.assets[Math.floor(Math.random() * this.assets.length)];
        const n = NEWS[Math.floor(Math.random() * NEWS.length)];
        a.drift += n.impact / 6;
        for (const fn of this.onNews) fn(`${a.symbol}: ${n.text}`);
      }
    }
  }

  // ganancia o pérdida de una posición al precio actual
  pnl(p: Position) {
    const a = this.get(p.symbol);
    const change = (a.price - p.entry) / p.entry;
    return p.stake * p.leverage * change * (p.side === 'long' ? 1 : -1);
  }
}

function fmt(price: number) {
  return price >= 100 ? price.toLocaleString('es-ES', { maximumFractionDigits: 0 }) : price.toLocaleString('es-ES', { maximumFractionDigits: 4 });
}

function drawChart(canvas: HTMLCanvasElement, a: Asset, positions: Position[]) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#0d131c';
  ctx.fillRect(0, 0, w, h);
  const candles = a.candles.slice(-70);
  const hi = Math.max(...candles.map((c) => c.h));
  const lo = Math.min(...candles.map((c) => c.l));
  const pad = (hi - lo) * 0.1 || 1;
  const y = (v: number) => h - 20 - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (h - 30);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 5; i++) {
    const yy = 10 + (i * (h - 30)) / 4;
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(w, yy);
    ctx.stroke();
  }
  const cw = (w - 60) / candles.length;
  candles.forEach((c, i) => {
    const x = i * cw + cw / 2;
    const up = c.c >= c.o;
    ctx.strokeStyle = ctx.fillStyle = up ? '#26c281' : '#e5484d';
    ctx.beginPath();
    ctx.moveTo(x, y(c.h));
    ctx.lineTo(x, y(c.l));
    ctx.stroke();
    const top = y(Math.max(c.o, c.c));
    ctx.fillRect(x - cw * 0.35, top, cw * 0.7, Math.max(1, y(Math.min(c.o, c.c)) - top));
  });
  // líneas de entrada de las posiciones abiertas
  for (const p of positions) {
    if (p.symbol !== a.symbol) continue;
    ctx.strokeStyle = p.side === 'long' ? '#26c281' : '#e5484d';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y(p.entry));
    ctx.lineTo(w - 60, y(p.entry));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // precio actual
  ctx.fillStyle = '#f2c14e';
  ctx.fillRect(w - 58, y(a.price) - 9, 56, 18);
  ctx.fillStyle = '#111';
  ctx.font = '700 11px sans-serif';
  ctx.fillText(fmt(a.price), w - 54, y(a.price) + 4);
}

type OpenPosition = Position;

export function tradingTerminal(game: Game, market: Market, onClose: () => void) {
  const { state, hud } = game;
  let symbol = 'BTC';
  let timer = 0;
  hud.openPanel('Terminal de trading', (body) => {
    const tabs = el('div', 'row');
    const canvas = el('canvas', 'chart') as HTMLCanvasElement;
    canvas.width = 520;
    canvas.height = 190;
    const info = el('div', 'row');
    const stake = el('input', 'field') as HTMLInputElement;
    stake.type = 'number';
    stake.value = '100';
    const lev = el('select', 'field') as HTMLSelectElement;
    for (const l of [1, 5, 10, 25, 50]) lev.append(new Option(`x${l}`, String(l)));
    const positionsBox = el('div', 'items');
    const renderTabs = () => {
      tabs.innerHTML = '';
      for (const a of market.assets) tabs.append(button(a.symbol, () => { symbol = a.symbol; renderTabs(); draw(); }, a.symbol === symbol ? 'btn small' : 'btn ghost small'));
    };
    const open = (side: 'long' | 'short') => {
      const n = Number(stake.value);
      if (!(n > 0)) return hud.toast('Pon cuánto quieres apostar', 'bad');
      if (!state.payCard(n, `Margen ${side === 'long' ? 'largo' : 'corto'} ${symbol}`)) return hud.toast('No tienes saldo en el banco', 'bad');
      const p: OpenPosition = { id: Math.random().toString(36).slice(2, 7), side, stake: n, leverage: Number(lev.value), entry: market.get(symbol).price, symbol };
      state.data.positions.push(p);
      state.persist();
      hud.toast(`${side === 'long' ? '📈 Largo' : '📉 Corto'} ${symbol} x${p.leverage} · ${euros(n)}`, 'ok');
      draw();
    };
    const close = (p: OpenPosition) => {
      const pnl = market.pnl(p);
      state.data.positions = state.data.positions.filter((x) => x.id !== p.id);
      const back = Math.max(0, p.stake + pnl);
      state.data.tradingPnl += pnl;
      if (back > 0) state.income(back, `Cierre ${p.side === 'long' ? 'largo' : 'corto'} ${p.symbol} (${pnl >= 0 ? '+' : ''}${euros(pnl)})`);
      else state.persist();
      state.complete('trading');
      hud.toast(`${pnl >= 0 ? '✅ Ganas' : '❌ Pierdes'} ${euros(Math.abs(pnl))}`, pnl >= 0 ? 'ok' : 'bad');
      draw();
    };
    const draw = () => {
      const a = market.get(symbol);
      const positions = state.data.positions as OpenPosition[];
      // liquidación: si pierdes todo el margen, se cierra sola
      for (const p of [...positions]) if (market.pnl(p) <= -p.stake) {
        state.data.positions = state.data.positions.filter((x) => x.id !== p.id);
        state.data.tradingPnl -= p.stake;
        state.persist();
        hud.toast(`💀 Liquidado: ${p.symbol} x${p.leverage}, pierdes ${euros(p.stake)}`, 'bad');
      }
      drawChart(canvas, a, state.data.positions as OpenPosition[]);
      const last = a.candles[a.candles.length - 1];
      const ch = ((a.price - a.candles[a.candles.length - 30].c) / a.candles[a.candles.length - 30].c) * 100;
      info.innerHTML = `<strong>${a.name}</strong><span>${fmt(last.c)} €</span><span class="${ch >= 0 ? 'pos' : 'neg'}">${ch >= 0 ? '+' : ''}${ch.toFixed(2)} %</span><span class="muted">Saldo ${euros(state.data.bank)}</span>`;
      positionsBox.innerHTML = '';
      for (const p of state.data.positions as OpenPosition[]) {
        const pnl = market.pnl(p);
        const row = el('div', 'item');
        row.append(el('span', 'icon', p.side === 'long' ? '📈' : '📉'), el('span', '', `${p.symbol} x${p.leverage} · ${euros(p.stake)}\nentrada ${fmt(p.entry)}`), el('span', pnl >= 0 ? 'pos' : 'neg', `${pnl >= 0 ? '+' : ''}${euros(pnl)}`), button('Cerrar', () => close(p), 'btn small'));
        positionsBox.append(row);
      }
      if (!state.data.positions.length) positionsBox.append(el('div', 'muted', 'Sin posiciones abiertas'));
    };
    renderTabs();
    const controls = el('div', 'row');
    controls.append(el('span', 'muted', 'Apuesta €'), stake, el('span', 'muted', 'Apalancamiento'), lev);
    const actions = el('div', 'row');
    actions.append(button('📈 Comprar (sube)', () => open('long'), 'btn buy'), button('📉 Vender (baja)', () => open('short'), 'btn sell'));
    body.append(tabs, info, canvas, controls, actions, el('div', 'section', 'Posiciones abiertas'), positionsBox, el('p', 'muted', `PnL total: ${euros(state.data.tradingPnl)} · Con apalancamiento ganas y pierdes más rápido. Si pierdes todo el margen te liquidan.`));
    draw();
    timer = window.setInterval(draw, 1000);
  }, () => {
    clearInterval(timer);
    onClose();
  });
}
