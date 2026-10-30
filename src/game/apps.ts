import { baccaratPanel, blackjackPanel, cashierPanel, crazyTimePanel, pokerPanel, roulettePanel, slotsMenu, sportsbookPanel } from './casino';
import { BANK_NAME, LOAN_OFFERS } from './config';
import { button, el, euros } from './hud';
import type { Market } from './market';
import type { Phone, PhoneApp } from './phone';
import type { Game } from './world';

// Apps del móvil: banco, Wallet de cripto, mensajes y ajustes.

const FEE = 0.005; // comisión de la Wallet al comprar o vender

function sparkline(values: number[], w = 260, h = 70, color = '#26c281') {
  const c = el('canvas', 'spark') as HTMLCanvasElement;
  c.width = w * 2;
  c.height = h * 2;
  const ctx = c.getContext('2d')!;
  const hi = Math.max(...values), lo = Math.min(...values);
  const y = (v: number) => c.height - 8 - ((v - lo) / (hi - lo || 1)) * (c.height - 16);
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, color + '66');
  grad.addColorStop(1, color + '00');
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * c.width;
    if (i) ctx.lineTo(x, y(v));
    else ctx.moveTo(x, y(v));
  });
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.lineTo(c.width, c.height);
  ctx.lineTo(0, c.height);
  ctx.fillStyle = grad;
  ctx.fill();
  return c;
}

// icono del movimiento según su concepto
function movIcon(concept: string) {
  const c = concept.toLowerCase();
  if (c.includes('préstamo') || c.includes('embargo')) return '📄';
  if (c.includes('cajero') || c.includes('retirada')) return '🏧';
  if (c.includes('comisi') || c.includes('venta')) return '💼';
  if (c.includes('megamart') || c.includes('compra')) return '🛒';
  if (c.includes('casino') || c.includes('fichas')) return '🎰';
  if (c.includes('boutique')) return '💎';
  if (c.includes('transferencia') || c.includes('envío')) return '↗️';
  if (c.includes('wallet') || c.includes('cripto') || c.includes('otc')) return '🪙';
  return '💳';
}

export function bankApp(game: Game): PhoneApp {
  let tab: 'inicio' | 'enviar' | 'prestamos' | 'tarjeta' = 'inicio';
  let filter: 'todo' | 'in' | 'out' = 'todo';
  return {
    id: 'banco', name: BANK_NAME, icon: '🏦', color: 'linear-gradient(135deg,#1464c8,#072146)', dock: true, light: true,
    render: (body, phone) => {
      const { state, hud } = game;
      const d = state.data;
      if (!d.hasAccount) {
        body.append(el('div', 'bk-hero'), el('p', 'muted', `Aún no tienes cuenta. Ábrela en la oficina de ${BANK_NAME}, en la Planta 0.`));
        (body.firstChild as HTMLElement).innerHTML = `<div class="bk-logo">${BANK_NAME}</div>`;
        return;
      }
      const hero = el('div', 'bk-hero');
      hero.innerHTML = `<div class="bk-logo">${BANK_NAME}</div><div class="bk-label">Cuenta Online</div><div class="bk-balance">${euros(d.bank)}</div><div class="bk-iban">${d.account}</div>`;
      body.append(hero);
      const tabs = el('div', 'bk-tabs');
      for (const [id, label, icon] of [['inicio', 'Inicio', '🏠'], ['enviar', 'Enviar', '↗️'], ['prestamos', 'Préstamos', '📄'], ['tarjeta', 'Tarjeta', '💳']] as const) {
        const b = el('button', 'bk-tab' + (tab === id ? ' on' : ''));
        b.innerHTML = `<span>${icon}</span>${label}`;
        b.onclick = () => { tab = id; phone.refresh(); };
        tabs.append(b);
      }
      body.append(tabs);
      if (tab === 'inicio') {
        // ingresos y gastos de los últimos movimientos
        const income = d.movements.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
        const spent = -d.movements.filter((m) => m.amount < 0).reduce((s, m) => s + m.amount, 0);
        const summary = el('div', 'bk-summary');
        const max = Math.max(income, spent, 1);
        summary.innerHTML = `<div><span>Ingresos</span><b class="pos">${euros(income)}</b><i style="width:${(income / max) * 100}%;background:#1aa260"></i></div><div><span>Gastos</span><b class="neg">${euros(spent)}</b><i style="width:${(spent / max) * 100}%;background:#e5484d"></i></div>`;
        body.append(summary);
        // evolución del saldo
        let bal = d.bank;
        const series = [bal];
        for (const m of d.movements.slice(0, 30)) {
          bal -= m.amount;
          series.unshift(bal);
        }
        if (series.length > 2) body.append(sparkline(series, 260, 60, '#1464c8'));
        const pockets = el('div', 'bk-pockets');
        pockets.innerHTML = `<div>💵<b>${euros(d.cash)}</b><span>Efectivo</span></div><div>🪙<b>${euros(d.crypto)}</b><span>USDT</span></div><div>📄<b>${d.loans.length}/3</b><span>Préstamos</span></div>`;
        body.append(pockets);
        const f = el('div', 'seg');
        for (const [id, label] of [['todo', 'Todo'], ['in', 'Ingresos'], ['out', 'Gastos']] as const) {
          const b = el('button', filter === id ? 'on' : '', label);
          b.onclick = () => { filter = id; phone.refresh(); };
          f.append(b);
        }
        body.append(f);
        const list = d.movements.filter((m) => filter === 'todo' || (filter === 'in' ? m.amount > 0 : m.amount < 0)).slice(0, 25);
        if (!list.length) body.append(el('p', 'muted', 'Sin movimientos'));
        for (const mv of list) {
          const row = el('div', 'bk-mov');
          row.innerHTML = `<span class="bk-ic">${movIcon(mv.concept)}</span><span class="bk-c"><b>${mv.concept}</b><small>Día ${Math.floor(mv.t / 1440) + 1} · ${state.clock(mv.t)}</small></span><span class="${mv.amount < 0 ? 'neg' : 'pos'}">${mv.amount > 0 ? '+' : ''}${euros(mv.amount)}</span>`;
          body.append(row);
        }
      } else if (tab === 'enviar') {
        body.append(el('p', 'muted', 'Envía dinero a la cuenta de un colega al momento.'));
        const to = el('input', 'field') as HTMLInputElement;
        to.placeholder = 'IBAN de destino (ES…)';
        const amount = el('input', 'field') as HTMLInputElement;
        amount.type = 'number';
        amount.placeholder = 'Importe €';
        const concept = el('input', 'field') as HTMLInputElement;
        concept.placeholder = 'Concepto';
        body.append(to, amount, concept, button('Enviar', () => {
          const n = Number(amount.value);
          if (!to.value.trim() || !(n > 0)) return hud.toast('Pon el IBAN y el importe', 'bad');
          if (!state.transfer(n, to.value.trim(), concept.value.trim())) return hud.toast('Saldo insuficiente', 'bad');
          hud.toast(`↗️ ${euros(n)} enviados`, 'ok');
          tab = 'inicio';
          phone.refresh();
        }));
        body.append(el('div', 'bk-mov'));
        (body.lastChild as HTMLElement).innerHTML = `<span class="bk-ic">🔗</span><span class="bk-c"><b>Tu IBAN</b><small>${d.account}</small></span>`;
      } else if (tab === 'prestamos') {
        if (!d.loans.length) body.append(el('p', 'muted', 'No tienes préstamos.'));
        for (const l of d.loans) {
          const late = d.time > l.dueAt;
          const left = l.dueAt - d.time;
          const card = el('div', 'bk-loan' + (late ? ' late' : ''));
          card.innerHTML = `<b>${l.label} · ${l.id}</b><span>Debes <b>${euros(l.owed)}</b></span><small>${late ? '⚠️ VENCIDO' : `Vence en ${Math.floor(left / 1440)} d ${Math.floor((left % 1440) / 60)} h`}</small>`;
          const pay = button('Devolver', () => {
            if (d.bank < l.owed) return hud.toast(`Te faltan ${euros(l.owed - d.bank)}`, 'bad');
            state.repay(l.id, l.owed);
            hud.toast('Préstamo devuelto', 'ok');
            phone.refresh();
          }, 'btn small');
          card.append(pay);
          body.append(card);
        }
        body.append(el('p', 'muted', `Para pedir uno nuevo habla con el gestor en la oficina (hasta ${euros(LOAN_OFFERS[LOAN_OFFERS.length - 1].amount)}).`));
      } else {
        const card = el('div', 'bk-card' + (d.cardBlocked ? ' blocked' : ''));
        card.innerHTML = `<div class="bk-chip"></div><div class="bk-num">•••• •••• •••• ${d.account.slice(-4)}</div><div class="bk-name">${game.player.character.config.name.toUpperCase()}</div><div class="bk-brand">${BANK_NAME} · DÉBITO</div>`;
        body.append(card);
        let showPin = false;
        const pinRow = el('div', 'bk-mov');
        const renderPin = () => (pinRow.innerHTML = `<span class="bk-ic">🔑</span><span class="bk-c"><b>PIN</b><small>${showPin ? d.pin : '••••'}</small></span>`);
        renderPin();
        pinRow.onclick = () => { showPin = !showPin; renderPin(); };
        body.append(pinRow, button(d.cardBlocked ? 'Desbloquear tarjeta' : 'Bloquear tarjeta', () => {
          d.cardBlocked = !d.cardBlocked;
          state.persist();
          hud.toast(d.cardBlocked ? '🔒 Tarjeta bloqueada' : '🔓 Tarjeta activa', 'ok');
          phone.refresh();
        }, 'btn ghost'));
      }
    },
  };
}

export function walletApp(game: Game, market: Market): PhoneApp {
  let selected = 'BTC';
  let tab: 'activos' | 'futuros' = 'activos';
  return {
    id: 'wallet', name: 'Wallet', icon: '🪙', color: 'linear-gradient(135deg,#f7b733,#8a5a00)', dock: true,
    render: (body, phone) => {
      const { state, hud } = game;
      const d = state.data;
      const value = (sym: string) => (d.wallet[sym] ?? 0) * market.get(sym).price;
      const total = d.crypto + market.assets.reduce((s, a) => s + value(a.symbol), 0);
      const hero = el('div', 'wl-hero');
      hero.innerHTML = `<span>Saldo total</span><b>${euros(total)}</b><small class="mono">0x${d.account.replace(/\D/g, '').slice(0, 10)}…${d.account.slice(-4)}</small>`;
      body.append(hero);
      const seg = el('div', 'seg');
      for (const [id, label] of [['activos', 'Activos'], ['futuros', 'Futuros']] as const) {
        const b = el('button', tab === id ? 'on' : '', label);
        b.onclick = () => { tab = id; phone.refresh(); };
        seg.append(b);
      }
      body.append(seg);
      if (tab === 'futuros') {
        if (!d.positions.length) body.append(el('p', 'muted', 'Sin posiciones. Ábrelas en una mesa de trading de la Planta 1.'));
        for (const p of d.positions) {
          const pnl = market.pnl(p);
          const row = el('div', 'bk-mov');
          row.innerHTML = `<span class="bk-ic">${p.side === 'long' ? '📈' : '📉'}</span><span class="bk-c"><b>${p.symbol} x${p.leverage}</b><small>margen ${euros(p.stake)}</small></span><span class="${pnl >= 0 ? 'pos' : 'neg'}">${pnl >= 0 ? '+' : ''}${euros(pnl)}</span>`;
          body.append(row);
        }
        return;
      }
      // activo seleccionado con su gráfico
      const a = market.get(selected);
      const closes = a.candles.slice(-60).map((c) => c.c);
      const ch = ((a.price - closes[0]) / closes[0]) * 100;
      const head = el('div', 'wl-asset-head');
      head.innerHTML = `<b>${a.name}</b><span>${a.price >= 100 ? a.price.toFixed(2) : a.price.toFixed(4)} €</span><span class="${ch >= 0 ? 'pos' : 'neg'}">${ch >= 0 ? '+' : ''}${ch.toFixed(2)} %</span>`;
      body.append(head, sparkline(closes, 260, 80, ch >= 0 ? '#26c281' : '#e5484d'));
      const amount = el('input', 'field') as HTMLInputElement;
      amount.type = 'number';
      amount.placeholder = 'Importe en €';
      const row = el('div', 'row');
      row.append(
        button('Comprar', () => {
          const n = Number(amount.value);
          if (!(n > 0)) return hud.toast('Pon un importe', 'bad');
          // se paga primero con USDT y, si no llega, con el banco
          if (d.crypto >= n) d.crypto -= n;
          else if (!state.payCard(n, `Wallet · compra ${selected}`)) return hud.toast('No tienes saldo (USDT o banco)', 'bad');
          d.wallet[selected] = (d.wallet[selected] ?? 0) + (n * (1 - FEE)) / a.price;
          state.persist();
          hud.toast(`🪙 Comprado ${selected} por ${euros(n)}`, 'ok');
          phone.refresh();
        }, 'btn buy small'),
        button('Vender todo', () => {
          const v = value(selected);
          if (v <= 0) return hud.toast(`No tienes ${selected}`, 'bad');
          d.wallet[selected] = 0;
          d.crypto += v * (1 - FEE);
          state.persist();
          hud.toast(`Vendido ${selected}: +${euros(v * (1 - FEE))} en USDT`, 'ok');
          phone.refresh();
        }, 'btn sell small'),
      );
      body.append(amount, row);
      // lista de activos
      const usdt = el('div', 'bk-mov');
      usdt.innerHTML = `<span class="bk-ic">💵</span><span class="bk-c"><b>USDT</b><small>dólar digital</small></span><span>${euros(d.crypto)}</span>`;
      body.append(usdt);
      for (const asset of market.assets) {
        const rowA = el('button', 'bk-mov wl-row' + (asset.symbol === selected ? ' on' : ''));
        const prev = asset.candles[asset.candles.length - 30]?.c ?? asset.price;
        const c = ((asset.price - prev) / prev) * 100;
        rowA.innerHTML = `<span class="bk-ic">${{ BTC: '₿', ETH: 'Ξ', BRKS: '🚀', ORO: '🥇' }[asset.symbol] ?? '🪙'}</span><span class="bk-c"><b>${asset.symbol}</b><small>${(d.wallet[asset.symbol] ?? 0).toFixed(asset.price > 100 ? 5 : 2)} · <i class="${c >= 0 ? 'pos' : 'neg'}">${c >= 0 ? '+' : ''}${c.toFixed(2)}%</i></small></span><span>${euros(value(asset.symbol))}</span>`;
        rowA.onclick = () => { selected = asset.symbol; phone.refresh(); };
        body.append(rowA);
      }
      body.append(button('Pasar USDT a mi cuenta del banco (cambista OTC, Planta 2)', () => hud.toast('Ve a la mesa OTC de la Planta 2', ''), 'btn ghost small'));
    },
  };
}

export function messagesApp(phone: Phone, game: Game): PhoneApp {
  return {
    id: 'mensajes', name: 'Mensajes', icon: '💬', color: 'linear-gradient(135deg,#5ff777,#1fb73c)', dock: true, light: true,
    badge: () => game.state.unread,
    render: (body) => phone.renderMessages(body),
  };
}

// Casino en el móvil: juega desde cualquier planta a los mismos juegos
export function casinoApp(game: Game): PhoneApp {
  const GAMES: { icon: string; name: string; sub: string; run: () => void }[] = [
    { icon: '🎡', name: 'Crazy Time', sub: 'Rueda del dinero + bonus', run: () => crazyTimePanel(game) },
    { icon: '🃏', name: 'Speed Baccarat', sub: 'Jugador · Banca · Empate', run: () => baccaratPanel(game) },
    { icon: '🎯', name: 'Ruleta', sub: 'Europea, bola física', run: () => roulettePanel(game) },
    { icon: '🂡', name: 'Blackjack', sub: '3:2 · split y seguro', run: () => blackjackPanel(game) },
    { icon: '🎰', name: 'Tragaperras', sub: '3 máquinas propias', run: () => slotsMenu(game) },
    { icon: '♠️', name: 'Póker', sub: 'contra la casa', run: () => pokerPanel(game) },
    { icon: '⚽', name: 'Apuestas', sub: 'partidos en directo', run: () => sportsbookPanel(game) },
  ];
  return {
    id: 'casino', name: 'Casino', icon: '🎰', color: 'linear-gradient(135deg,#f6d365,#b3202a)',
    render: (body) => {
      const chips = game.state.data.chips;
      const head = el('div', 'casino-head');
      head.innerHTML = `<div><small>Fichas</small><b>🪙 ${chips.toLocaleString('es-ES')}</b></div>`;
      head.append(button('Caja', () => { game.phone.toggle(false); cashierPanel(game); }, 'btn ghost small'));
      body.append(head);
      const grid = el('div', 'casino-apps');
      for (const gm of GAMES) {
        const b = el('button', 'casino-tile');
        b.innerHTML = `<span class="ci">${gm.icon}</span><b>${gm.name}</b><small>${gm.sub}</small>`;
        b.onclick = () => { game.phone.toggle(false); gm.run(); };
        grid.append(b);
      }
      body.append(grid, el('p', 'muted', 'Juega desde aquí o en vivo en la Planta 3. Todo con fichas del casino.'));
    },
  };
}

// Noticias: feed de todo lo que pasa (mercado, tienda, casino, lado gris…)
export function newsApp(game: Game): PhoneApp {
  const CAT: Record<string, string> = { mercado: '📈 Mercado', tienda: '📦 Tienda', casino: '🎰 Casino', gris: '🕶️ Gris', banco: '🏦 Banco', ciudad: '🏙️ Ciudad' };
  return {
    id: 'noticias', name: 'Noticias', icon: '📰', color: 'linear-gradient(135deg,#ff8a5b,#d7263d)', light: true,
    badge: () => 0,
    render: (body) => {
      const news = game.state.data.news;
      if (!news.length) { body.append(el('p', 'muted', 'Todavía no ha pasado nada. Haz negocios y aquí saldrá todo.')); return; }
      const list = el('div', 'news-list');
      for (const n of news.slice(0, 40)) {
        const row = el('div', 'news-item');
        row.append(
          el('span', 'news-ic', n.icon),
          el('span', 'news-body', n.text),
        );
        const meta = el('div', 'news-meta');
        meta.append(el('span', 'news-cat', CAT[n.cat] ?? n.cat), el('span', 'muted', game.state.clock(n.t)));
        row.append(meta);
        list.append(row);
      }
      body.append(list);
    },
  };
}

// Chat con los colegas (local; con multijugador llegará del servidor)
const CHAT_BOTS = ['Marcos', 'Lucía', 'Dani', 'Sofía'];
export function chatApp(game: Game): PhoneApp {
  return {
    id: 'chat', name: 'Colegas', icon: '🗨️', color: 'linear-gradient(135deg,#7f7fd5,#2d9cdb)', light: true,
    badge: () => 0,
    render: (body) => {
      const feed = el('div', 'chat-feed');
      const paint = () => {
        feed.innerHTML = '';
        for (const m of game.state.data.chat.slice(-40)) {
          const row = el('div', 'chat-msg' + (m.me ? ' me' : ''));
          if (!m.me) row.append(el('span', 'chat-who', m.from));
          row.append(el('span', 'chat-bubble', m.text));
          feed.append(row);
        }
        feed.scrollTop = feed.scrollHeight;
      };
      paint();
      const barEl = el('div', 'chat-input');
      const input = el('input', 'field') as HTMLInputElement;
      input.placeholder = 'Escribe a los colegas…';
      const send = () => {
        const text = input.value.trim();
        if (!text) return;
        game.state.chatSay('Tú', text, true);
        input.value = '';
        paint();
        // respuesta de un colega (placeholder hasta el multijugador real)
        setTimeout(() => {
          const who = CHAT_BOTS[Math.floor(Math.random() * CHAT_BOTS.length)];
          const replies = ['jajaja brutal', 'paso ahora por tu edificio', 'cuánto llevas hoy?', 'yo con el dropshipping a tope', 'subo al casino, te vienes?', 'me han embargado el préstamo 💀', 'tengo método nuevo, luego te cuento'];
          game.state.chatSay(who, replies[Math.floor(Math.random() * replies.length)]);
          paint();
        }, 900 + Math.random() * 900);
      };
      input.onkeydown = (e) => { if (e.key === 'Enter') send(); };
      barEl.append(input, button('Enviar', send, 'btn small'));
      body.append(feed, barEl, el('p', 'muted', 'Chat local por ahora. Con el multijugador verás a tus colegas de verdad y os pasaréis métodos.'));
    },
  };
}

export function settingsApp(game: Game): PhoneApp {
  return {
    id: 'ajustes', name: 'Ajustes', icon: '⚙️', color: 'linear-gradient(135deg,#a6a6ab,#5b5b60)', dock: true, light: true,
    render: (body) => {
      body.append(el('div', 'bk-mov'));
      (body.firstChild as HTMLElement).innerHTML = `<span class="bk-ic">📱</span><span class="bk-c"><b>${game.state.data.phoneModel}</b><small>Brokerstars OS · demo 0.3</small></span>`;
      const reset = button('Empezar partida nueva', () => {
        reset.textContent = 'Pulsa otra vez para confirmar';
        reset.onclick = () => {
          game.state.reset();
          location.reload();
        };
      }, 'btn ghost');
      body.append(reset);
    },
  };
}
