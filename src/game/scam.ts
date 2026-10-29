import { button, el, euros } from './hud';
import type { Mule } from './state';
import type { Game } from './world';

// La Planta Gris: el ordenador del estafador con sus apps. Todo es una
// mecánica de juego abstracta con bancos, nombres y víctimas inventados.
// - Sender: lanza una campaña y consigue accesos a cuentas.
// - Banca: con un acceso, preparas la transferencia a la cuenta de una mula
//   y llamas a la víctima para que la apruebe.
// - Telegram: compras mulas (cada una con su porcentaje y su forma de pago).
// - La mula paga en cripto al momento o baja en efectivo a la Planta 0.
// Cada golpe sube tu nivel de busca; con busca alta hay redadas.

const FAKE_BANKS = ['Banco Sol', 'CaixaNorte', 'Unibank Ibérica', 'Banco Brisa', 'NeoCaja'];
const NAMES = ['Antonio P.', 'Rosa M.', 'Fernando G.', 'Pilar S.', 'Julián R.', 'Montse T.', 'Ramón V.', 'Encarna L.', 'Tomás B.', 'Isabel C.'];

interface Account {
  id: string;
  name: string;
  bank: string;
  balance: number;
  trait: 'confiado' | 'desconfiado' | 'nervioso';
}

interface Campaign {
  sentAt: number;
  readyAt: number;
  size: number;
}

// lo que no hace falta guardar entre sesiones vive aquí
const runtime = { accounts: [] as Account[], campaigns: [] as Campaign[] };

const MARKET: Omit<Mule, 'id'>[] = [
  { name: 'Kevin (19, Móstoles)', cut: 30, reliability: 62, pays: 'efectivo' },
  { name: 'Yeray (22, Alcorcón)', cut: 25, reliability: 74, pays: 'efectivo' },
  { name: 'Cuenta de empresa «Import SL»', cut: 20, reliability: 85, pays: 'cripto' },
  { name: 'Andrea (24, Getafe)', cut: 18, reliability: 80, pays: 'cripto' },
  { name: 'Iván «el Rápido»', cut: 35, reliability: 93, pays: 'efectivo' },
];
const MULE_PRICE = 250;

function heatStars(n: number) {
  return '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
}

function addHeat(game: Game, n: number) {
  const d = game.state.data;
  d.heat = Math.min(5, d.heat + n);
  game.state.persist();
}

// cada hora de juego: campañas que llegan, mulas que pagan y redadas
export function scamTick(game: Game) {
  const { state, phone } = game;
  const d = state.data;
  for (const c of [...runtime.campaigns]) {
    if (d.time < c.readyAt) continue;
    runtime.campaigns = runtime.campaigns.filter((x) => x !== c);
    const hits = Math.max(0, Math.round(c.size * (0.0002 + Math.random() * 0.0006)));
    for (let i = 0; i < hits; i++) {
      runtime.accounts.push({
        id: Math.random().toString(36).slice(2, 7),
        name: NAMES[Math.floor(Math.random() * NAMES.length)],
        bank: FAKE_BANKS[Math.floor(Math.random() * FAKE_BANKS.length)],
        balance: Math.round(400 + Math.random() * 6000),
        trait: (['confiado', 'desconfiado', 'nervioso'] as const)[Math.floor(Math.random() * 3)],
      });
    }
    phone.notify('📨 Sender', hits ? `Campaña terminada: ${hits} accesos nuevos en la app Banca.` : 'Campaña terminada sin resultados. Prueba con otra lista.');
  }
  for (const del of [...d.deliveries]) {
    if (d.time < del.arriveAt) continue;
    const mule = d.mules.find((m) => m.id === del.mule);
    if (!mule) continue;
    const roll = Math.random() * 100;
    if (roll > mule.reliability + 5) {
      d.deliveries = d.deliveries.filter((x) => x !== del);
      phone.notify('Telegram', `💀 ${mule.name} ha desaparecido con ${euros(del.amount)}. No contesta.`);
      d.mules = d.mules.filter((m) => m !== mule);
    } else if (roll > mule.reliability) {
      d.deliveries = d.deliveries.filter((x) => x !== del);
      addHeat(game, 1);
      phone.notify('Telegram', `🚔 Han pillado a ${mule.name} en el cajero. Pierdes ${euros(del.amount)} y sube tu busca.`);
      d.mules = d.mules.filter((m) => m !== mule);
    } else if (mule.pays === 'cripto') {
      d.deliveries = d.deliveries.filter((x) => x !== del);
      d.crypto += del.amount;
      phone.notify('Telegram', `🪙 ${mule.name} te ha enviado ${euros(del.amount)} en cripto (ya descontado su ${mule.cut} %).`);
    } else if (!del.waiting) {
      del.waiting = true;
      phone.notify('Telegram', `💵 ${mule.name} está abajo en la entrada de la Planta 0 con ${euros(del.amount)} en efectivo. Baja a por ello.`);
    }
  }
  // rigs de minado: cripto cada hora a cambio de la factura de la luz
  const rigs = d.owned.filter((o) => o === 'rig').length;
  if (rigs) {
    d.crypto += rigs * 9;
    if (d.hasAccount) state.payCard(rigs * 2, 'Factura de la luz (rigs)');
  }
  // la busca baja poco a poco; con mucha, redada
  d.heat = Math.max(0, d.heat - 0.04);
  if (d.heat >= 3 && Math.random() < 0.02 * d.heat) {
    const lostCash = Math.round(d.cash * 0.5);
    const lostCrypto = Math.round(d.crypto * 0.3);
    d.cash -= lostCash;
    d.crypto -= lostCrypto;
    d.heat = Math.max(0, d.heat - 2);
    phone.notify('🚨 POLICÍA', `Redada en la torre. Te requisan ${euros(lostCash)} en efectivo y ${euros(lostCrypto)} en cripto.`);
  }
  state.persist();
}

// la mula que paga en efectivo espera en la entrada de la Planta 0
export function waitingCash(game: Game) {
  return game.state.data.deliveries.filter((d) => d.waiting);
}

export function collectCash(game: Game) {
  const ready = waitingCash(game);
  const total = ready.reduce((s, d) => s + d.amount, 0);
  game.state.data.deliveries = game.state.data.deliveries.filter((d) => !ready.includes(d));
  game.state.data.cash += total;
  game.state.persist();
  game.hud.toast(`💵 La mula te da ${euros(total)} en efectivo`, 'ok');
}

export function scamPc(game: Game, onClose: () => void) {
  const { state, hud } = game;
  let app: 'escritorio' | 'sender' | 'banca' | 'telegram' = 'escritorio';
  hud.openPanel('PC · Escritorio', (body) => {
    const render = () => {
      body.innerHTML = '';
      const d = state.data;
      const top = el('div', 'row');
      top.append(el('div', 'pill', `Busca ${heatStars(d.heat)}`), el('div', 'pill', `Cripto ${euros(d.crypto)}`), el('div', 'pill', `Mulas ${d.mules.length}`));
      body.append(top);
      if (app !== 'escritorio') body.append(button('‹ Escritorio', () => { app = 'escritorio'; render(); }, 'btn ghost small'));
      if (app === 'escritorio') {
        const grid = el('div', 'desktop');
        for (const [id, icon, name] of [['sender', '📨', 'Sender'], ['banca', '🏦', 'Banca'], ['telegram', '✈️', 'Telegram']] as const) {
          const b = el('button', 'desk-app');
          b.append(el('span', 'phone-icon', icon), el('span', '', name));
          b.onclick = () => { app = id; render(); };
          grid.append(b);
        }
        body.append(grid, el('p', 'muted', 'Sender consigue accesos · en Banca preparas la transferencia a tu mula y llamas a la víctima para que la apruebe · en Telegram compras mulas.'));
        return;
      }
      if (app === 'sender') {
        body.append(el('p', '', 'Lanza una campaña de mensajes masivos. Cuanto más grande la lista, más accesos… y más busca.'));
        for (const [size, cost] of [[1000, 60], [5000, 250], [20000, 800]] as const) {
          body.append(button(`Lista de ${size.toLocaleString('es-ES')} contactos · ${euros(cost)}`, () => {
            if (d.crypto >= cost) d.crypto -= cost;
            else if (!state.payCash(cost)) return hud.toast('Necesitas cripto o efectivo para comprar la lista', 'bad');
            runtime.campaigns.push({ sentAt: d.time, readyAt: d.time + 60 + Math.random() * 120, size });
            addHeat(game, size / 20000);
            hud.toast('📨 Campaña enviada. Te aviso al móvil cuando haya resultados.', 'ok');
            render();
          }, 'btn ghost'));
        }
        if (runtime.campaigns.length) body.append(el('p', 'muted', `${runtime.campaigns.length} campaña(s) en marcha…`));
        return;
      }
      if (app === 'telegram') {
        body.append(el('div', 'section', 'Canal «Mulas Disponibles»'));
        for (const m of MARKET) {
          const row = el('div', 'item');
          row.append(el('span', 'icon', '👤'), el('span', '', `${m.name}\nSe queda el ${m.cut} % · fiabilidad ${m.reliability} % · paga en ${m.pays}`), el('span', 'muted', euros(MULE_PRICE)), button('Contratar', () => {
            if (d.crypto >= MULE_PRICE) d.crypto -= MULE_PRICE;
            else if (!state.payCash(MULE_PRICE)) return hud.toast('Paga en cripto o efectivo', 'bad');
            d.mules.push({ ...m, id: Math.random().toString(36).slice(2, 7) });
            state.persist();
            hud.toast(`👤 ${m.name} trabaja para ti`, 'ok');
            render();
          }, 'btn small'));
          body.append(row);
        }
        if (d.mules.length) {
          body.append(el('div', 'section', 'Tus mulas'));
          for (const m of d.mules) body.append(el('div', 'msg', `${m.name} · ${m.cut} % · ${m.pays}`));
        }
        return;
      }
      // banca
      if (!runtime.accounts.length) {
        body.append(el('p', 'muted', 'No tienes accesos. Lanza una campaña con Sender.'));
        return;
      }
      if (!d.mules.length) body.append(el('p', 'bad-text', 'Necesitas al menos una mula (Telegram) para recibir el dinero.'));
      for (const a of runtime.accounts) {
        const row = el('div', 'item');
        row.append(el('span', 'icon', '👤'), el('span', '', `${a.name} · ${a.bank}\nSaldo ${euros(a.balance)} · perfil ${a.trait}`), el('span', ''));
        const b = button('Operar', () => victimCall(game, a, () => scamPc(game, onClose)), 'btn small');
        b.disabled = !d.mules.length;
        row.append(b);
        body.append(row);
      }
    };
    render();
  }, onClose);
}

// llamada para que la víctima apruebe la operación (minijuego de decisiones)
function victimCall(game: Game, a: Account, back: () => void) {
  const { state, hud } = game;
  const d = state.data;
  const mule = d.mules[0];
  const amount = Math.round(a.balance * 0.8);
  const steps = [
    { q: '«¿Quién es? No le conozco.»', opts: [['Hablar con calma y seguridad', 2], ['Meter prisa', a.trait === 'nervioso' ? 2 : 0], ['Ponerse técnico', a.trait === 'desconfiado' ? 2 : 1]] },
    { q: '«¿Y por qué tengo que aprobar yo eso?»', opts: [['Tranquilizar', a.trait === 'confiado' ? 2 : 1], ['Presionar más', a.trait === 'nervioso' ? 1 : -1], ['Cambiar de tema', 0]] },
    { q: '«Vale… ¿qué tengo que hacer?»', opts: [['Guiar paso a paso', 2], ['Colgar y volver a llamar', 0], ['Improvisar', 1]] },
  ] as const;
  let i = 0, score = 0;
  hud.openPanel(`📞 Llamada · ${a.name}`, (body) => {
    const render = () => {
      body.innerHTML = '';
      body.append(el('div', 'screen', `${a.bank} · operación de ${euros(amount)} a la cuenta de ${mule.name}\nPerfil: ${a.trait}`));
      if (i < steps.length) {
        body.append(el('div', 'bubble', steps[i].q));
        for (const [text, s] of steps[i].opts) body.append(button(text, () => { score += s; i++; render(); }, 'choice'));
        return;
      }
      runtime.accounts = runtime.accounts.filter((x) => x !== a);
      addHeat(game, 0.8);
      const ok = score >= 4 || (score >= 3 && Math.random() < 0.5);
      if (ok) {
        const net = Math.round(amount * (1 - mule.cut / 100));
        d.deliveries.push({ id: Math.random().toString(36).slice(2, 7), mule: mule.id, amount: net, arriveAt: d.time + 60 + Math.random() * 180 });
        d.victims++;
        state.persist();
        body.append(el('p', 'big', '✅'), el('p', '', `Operación aprobada. ${mule.name} recibe ${euros(amount)}, se queda su ${mule.cut} % y te enviará ${euros(net)} en ${mule.pays}.`));
      } else {
        state.persist();
        body.append(el('p', 'big', '☎️'), el('p', '', 'Ha colgado y ha llamado a su banco. Acceso quemado.'));
      }
      body.append(button('Volver al PC', back));
    };
    render();
  }, () => undefined);
}

// mesa OTC: cambiar cripto por euros en tu cuenta (con comisión)
export function otcPanel(game: Game) {
  const { state, hud } = game;
  hud.openPanel('Mesa OTC · Cambista', (body) => {
    const d = state.data;
    body.append(el('div', 'bubble', '«Cripto por euros limpios en tu cuenta. Me quedo el 12 %, sin preguntas.»'), el('div', 'big', euros(d.crypto)), el('div', 'muted', 'en cripto'));
    const b = button('Cambiar todo a euros', () => {
      const net = Math.round(d.crypto * 0.88);
      d.crypto = 0;
      state.income(net, 'Venta OTC de cripto');
      addHeat(game, 0.3);
      hud.toast(`+${euros(net)} en tu cuenta`, 'ok');
      otcPanel(game);
    });
    b.disabled = d.crypto <= 0 || !d.hasAccount;
    body.append(b, el('p', 'muted', 'Con el multijugador, los brokers de la Planta 1 podrán hacer de cambistas y quedarse la comisión.'));
  });
}

// cuarto del hacker: de momento rigs de minado; los contratos llegan pronto
export function hackerPanel(game: Game) {
  const { state, hud } = game;
  hud.openPanel('Cuarto del hacker', (body) => {
    const rigs = state.data.owned.filter((o) => o === 'rig').length;
    body.append(el('div', 'bubble', '«Si quieres que entre en algún sitio, primero monta tus rigs. Los contratos llegan cuando haya más gente en la torre.»'));
    body.append(el('div', 'muted', `Rigs de minado: ${rigs} · cada uno da unos 9 € en cripto por hora y gasta 2 € de luz.`));
    body.append(button('Comprar rig de minado (1.500 €, con tarjeta)', () => {
      if (!state.hasCard || !state.payCard(1500, 'Rig de minado')) return hud.toast('Tarjeta rechazada', 'bad');
      state.data.owned.push('rig');
      state.persist();
      hud.toast('🖥️ Rig instalado. Empieza a minar.', 'ok');
      hackerPanel(game);
    }));
    body.append(el('div', 'section', 'Próximamente'), el('p', 'muted', 'Hackear la web del político, robar bases de leads para vender a estafadores y dropshippers, tumbar la tienda de un rival o cobrar por proteger a otros jugadores.'));
  });
}

export function politicianPanel(game: Game) {
  game.hud.openPanel('Despacho del alcalde', (body) => {
    body.append(el('div', 'bubble', '«Aquí se firman los contratos que importan. Vuelve cuando seas alguien.»'));
    body.append(el('div', 'section', 'Próximamente'), el('p', 'muted', 'Rol de político: campaña, ruedas de prensa, «donaciones», contratos públicos y leyes que afectan a toda la torre (impuestos, policía, licencia del casino). La prensa y el hacker pueden destaparte.'));
  });
}
