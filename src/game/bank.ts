import { BANK_NAME, LATE_DAILY, LATE_FEE, LOAN_OFFERS, MAX_LOANS, SEIZE_AFTER_DAYS } from './config';
import { button, el, euros } from './hud';
import type { Game } from './world';

// Ventanilla, gestor de préstamos y cajero automático del banco.

function input(placeholder: string, type = 'text') {
  const i = el('input', 'field') as HTMLInputElement;
  i.placeholder = placeholder;
  i.type = type;
  return i;
}

export function tellerPanel(game: Game) {
  const { state, hud } = game;
  hud.openPanel(`${BANK_NAME} · Ventanilla`, (body) => {
    const d = state.data;
    if (!d.hasAccount) {
      body.append(
        el('p', '', `Bienvenido a ${BANK_NAME}. Para trabajar en la torre necesitas una cuenta: te damos número de cuenta, tarjeta de débito con PIN y 500 € de bienvenida.`),
        button('Abrir mi cuenta', () => {
          state.openAccount();
          hud.toast('Cuenta abierta · +500 € · tarjeta al inventario', 'ok');
          tellerPanel(game);
        }),
      );
      return;
    }
    body.append(el('div', 'muted', 'Tu cuenta'), el('div', 'mono big-mono', d.account), el('div', 'big', euros(d.bank)));
    if (!state.hasCard) {
      body.append(button('Pedir tarjeta nueva (15 €)', () => {
        if (!state.payCard(15, 'Emisión de tarjeta')) return hud.toast('No tienes saldo', 'bad');
        state.addItem('tarjeta');
        hud.toast('💳 Tarjeta nueva al inventario', 'ok');
        tellerPanel(game);
      }));
    }
    body.append(el('div', 'section', 'Transferencia'));
    const to = input('Cuenta de destino (ES…)');
    const amount = input('Cantidad en €', 'number');
    const concept = input('Concepto');
    body.append(to, amount, concept, button('Enviar transferencia', () => {
      const n = Number(amount.value);
      if (!to.value.trim() || !(n > 0)) return hud.toast('Rellena la cuenta y la cantidad', 'bad');
      if (!state.transfer(n, to.value.trim(), concept.value.trim())) return hud.toast('No tienes saldo suficiente', 'bad');
      hud.toast(`Transferencia de ${euros(n)} enviada`, 'ok');
      tellerPanel(game);
    }));
    body.append(el('p', 'muted', 'Cuando juegues con tus colegas el dinero les llegará al momento. Préstamos: con el gestor, en el despacho de cristal.'));
  });
}

export function loansPanel(game: Game) {
  const { state, hud } = game;
  hud.openPanel(`${BANK_NAME} · Gestor de préstamos`, (body) => {
    const d = state.data;
    if (!d.hasAccount) {
      body.append(el('p', '', 'Primero abre una cuenta en la ventanilla.'));
      return;
    }
    body.append(el('p', 'muted', `Máximo ${MAX_LOANS} préstamos a la vez. Si no devuelves a tiempo: recargo del ${LATE_FEE * 100} %, un ${LATE_DAILY * 100} % más por cada día de retraso y a los ${SEIZE_AFTER_DAYS} días embargo del saldo. Devolver a tiempo te baja el interés de los siguientes.`));
    if (d.loans.length) {
      body.append(el('div', 'section', 'Tus préstamos'));
      for (const l of d.loans) {
        const late = d.time > l.dueAt;
        const row = el('div', 'item');
        row.append(el('span', 'icon', late ? '🚨' : '📄'), el('span', '', `${l.label} ${l.id}\nDebes ${euros(l.owed)} · vence día ${Math.floor(l.dueAt / 1440) + 1} a las ${state.clock(l.dueAt)}${late ? ' · VENCIDO' : ''}`));
        row.append(el('span', ''), button('Devolver todo', () => {
          if (d.bank < l.owed) return hud.toast(`Te faltan ${euros(l.owed - d.bank)} en la cuenta`, 'bad');
          state.repay(l.id, l.owed);
          hud.toast('Préstamo devuelto', 'ok');
          loansPanel(game);
        }));
        body.append(row);
      }
    }
    body.append(el('div', 'section', 'Ofertas'));
    const blocked = state.canBorrow();
    for (const [i, o] of LOAN_OFFERS.entries()) {
      const rate = Math.max(0.04, o.rate - d.loansRepaid * 0.01);
      const row = el('div', 'item');
      row.append(el('span', 'icon', '💶'), el('span', '', `${o.label}: ${euros(o.amount)}\nInterés ${Math.round(rate * 100)} % · devuelves ${euros(o.amount * (1 + rate))} en ${o.days} días`), el('span', ''));
      const b = button('Pedir', () => {
        if (state.borrow(i)) {
          hud.toast(`+${euros(o.amount)} en tu cuenta`, 'ok');
          loansPanel(game);
        }
      });
      b.disabled = !!blocked;
      row.append(b);
      body.append(row);
    }
    if (blocked) body.append(el('p', 'bad-text', blocked));
  });
}

export function atmPanel(game: Game) {
  const { hud } = game;
  hud.openPanel(`Cajero ${BANK_NAME}`, (body) => atmIntro(game, body));
}

// pantalla de inicio: insertar tarjeta o ingresar a un IBAN sin tarjeta
function atmIntro(game: Game, body: HTMLElement) {
  const { state, hud } = game;
  body.innerHTML = '';
  body.append(el('div', 'atm-screen', `${BANK_NAME}\nInserte su tarjeta`));
  body.append(el('p', 'muted', 'Opere con su cuenta insertando la tarjeta, o ingrese efectivo a un IBAN sin tarjeta.'));
  body.append(button('💳 Insertar tarjeta', () => {
    if (!state.data.hasAccount) return hud.toast('No tienes cuenta: ábrela en la ventanilla del banco', 'bad');
    if (!state.hasCard) return hud.toast('No llevas la tarjeta encima. Pide otra en la ventanilla.', 'bad');
    atmPin(game, body);
  }));
  body.append(button('🏦 Ingresar efectivo a un IBAN (sin tarjeta)', () => atmIbanDeposit(game, body), 'btn ghost'));
}

// teclado del PIN
function atmPin(game: Game, body: HTMLElement) {
  const { state, hud } = game;
  body.innerHTML = '';
  const screen = el('div', 'atm-screen');
  let pin = '';
  const show = () => (screen.innerHTML = `<div>Introduzca su PIN</div><div class="atm-pin">${'●'.repeat(pin.length)}${'○'.repeat(4 - pin.length)}</div><div class="muted">Te lo mandó el banco al móvil</div>`);
  show();
  const keypad = el('div', 'keypad');
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK']) {
    keypad.append(button(k, () => {
      if (k === '⌫') pin = pin.slice(0, -1);
      else if (k === 'OK') {
        if (pin === state.data.pin) return atmMenu(game, body);
        pin = '';
        hud.toast('PIN incorrecto', 'bad');
      } else if (pin.length < 4) pin += k;
      show();
      if (pin.length === 4 && pin === state.data.pin) atmMenu(game, body);
    }, 'key'));
  }
  body.append(screen, keypad, button('‹ Cancelar', () => atmIntro(game, body), 'btn ghost'));
}

// ingreso de efectivo a un IBAN ajeno, sin necesidad de tarjeta
function atmIbanDeposit(game: Game, body: HTMLElement) {
  const { state, hud } = game;
  body.innerHTML = '';
  body.append(el('div', 'atm-screen', `Ingreso a IBAN\nEfectivo: ${euros(state.data.cash)}`));
  const iban = input('IBAN de destino (ES…)');
  const amount = input('Cantidad en efectivo', 'number');
  body.append(el('p', 'muted', 'El cajero cuenta tu efectivo y lo ingresa en esa cuenta.'), iban, amount);
  body.append(button('Ingresar', () => {
    const dest = iban.value.trim();
    const n = Math.floor(Number(amount.value));
    if (!dest) return hud.toast('Escribe el IBAN de destino', 'bad');
    if (!(n > 0)) return hud.toast('Escribe una cantidad', 'bad');
    if (!state.deposit(n, dest)) return hud.toast('No llevas tanto efectivo', 'bad');
    hud.toast(`✅ Ingresados ${euros(n)} en ${dest}`, 'ok');
    atmIntro(game, body);
  }));
  body.append(button('‹ Volver', () => atmIntro(game, body), 'btn ghost'));
}

function atmMenu(game: Game, body: HTMLElement) {
  const { state, hud } = game;
  const d = state.data;
  body.innerHTML = '';
  body.append(el('div', 'atm-screen', `SALDO ${euros(d.bank)} · EFECTIVO ${euros(d.cash)}`));
  body.append(el('div', 'section', 'Sacar efectivo'));
  const row = el('div', 'row');
  for (const amount of [20, 50, 100, 200, 500]) {
    const b = button(`${amount} €`, () => {
      if (!state.withdraw(amount)) return hud.toast('Saldo insuficiente', 'bad');
      state.complete('sacar');
      hud.toast(`💶 Has sacado ${amount} €`, 'ok');
      atmMenu(game, body);
    });
    b.disabled = d.bank < amount;
    row.append(b);
  }
  body.append(row);
  body.append(el('div', 'section', 'Ingresar efectivo'));
  const amount = input('Cantidad (vacío = todo)', 'number');
  const to = input('Cuenta de destino (vacío = la tuya)');
  body.append(amount, to, button('Ingresar', () => {
    const n = amount.value ? Number(amount.value) : d.cash;
    if (!(n > 0)) return hud.toast('No tienes efectivo para ingresar', 'bad');
    if (!state.deposit(n, to.value.trim() || undefined)) return hud.toast('No llevas tanto efectivo', 'bad');
    hud.toast(to.value.trim() ? `Ingresados ${euros(n)} en ${to.value.trim()}` : `Ingresados ${euros(n)} en tu cuenta`, 'ok');
    atmMenu(game, body);
  }));
  body.append(el('div', 'section', 'Últimos movimientos'));
  for (const mv of d.movements.slice(0, 5)) {
    const r = el('div', 'mov');
    r.append(el('span', '', mv.concept), el('span', mv.amount < 0 ? 'neg' : 'pos', euros(mv.amount)));
    body.append(r);
  }
  body.append(button('Retirar tarjeta', () => hud.closePanel(), 'btn ghost'));
}
