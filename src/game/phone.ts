import { BANK_NAME } from './config';
import { button, el, euros } from './hud';
import type { GameState, Message } from './state';

// El móvil del jugador: se abre con M (o el botón 📱). Las apps de cada
// negocio se registran desde fuera con `addApp`.

export interface PhoneApp {
  id: string;
  name: string;
  icon: string;
  color: string;
  badge?: () => number;
  render(body: HTMLElement, phone: Phone): void;
}

export class Phone {
  private root = el('div', 'phone');
  private screen = el('div', 'phone-screen');
  private notif = el('div', 'phone-notif');
  private toggleBtn = el('button', 'phone-toggle', '📱');
  private apps: PhoneApp[] = [];
  private current: PhoneApp | null = null;
  open = false;

  constructor(ui: HTMLElement, private state: GameState) {
    const frame = el('div', 'phone-frame');
    const status = el('div', 'phone-status');
    frame.append(status, this.screen);
    this.root.append(frame);
    ui.append(this.root, this.notif, this.toggleBtn);
    this.toggleBtn.onclick = () => this.toggle();
    const updateStatus = () => {
      status.textContent = `Día ${state.day} · ${state.clock()}`;
      const n = state.unread;
      this.toggleBtn.dataset.badge = n ? String(n) : '';
    };
    state.onChange(updateStatus);
    updateStatus();
    state.onMessage((m) => this.notify(m.from, m.text));

    this.addApp({
      id: 'mensajes', name: 'Mensajes', icon: '💬', color: '#2ecc71',
      badge: () => state.unread,
      render: (body) => this.renderMessages(body),
    });
    this.addApp({
      id: 'banco', name: BANK_NAME, icon: '🏦', color: '#1f5fae',
      render: (body) => this.renderBank(body),
    });
    this.addApp({
      id: 'ajustes', name: 'Ajustes', icon: '⚙️', color: '#7f8c8d',
      render: (body) => {
        body.append(el('p', 'muted', 'Brokerstars · demo 0.2'));
        const reset = button('Empezar partida nueva', () => {
          reset.textContent = 'Pulsa otra vez para confirmar';
          reset.onclick = () => {
            state.reset();
            location.reload();
          };
        }, 'btn ghost');
        body.append(reset);
      },
    });
  }

  addApp(app: PhoneApp) {
    // las apps del sistema van al final
    const i = this.apps.findIndex((a) => a.id === 'ajustes');
    if (i >= 0) this.apps.splice(i, 0, app);
    else this.apps.push(app);
  }

  toggle(force?: boolean) {
    this.open = force ?? !this.open;
    this.root.classList.toggle('open', this.open);
    if (this.open) this.home();
  }

  openApp(id: string) {
    const app = this.apps.find((a) => a.id === id);
    if (!app) return;
    if (!this.open) this.toggle(true);
    this.current = app;
    this.render();
  }

  home() {
    this.current = null;
    this.render();
  }

  // repinta la app abierta (por ejemplo cuando llega una venta)
  refresh() {
    if (this.open && this.current) this.render();
  }

  private render() {
    this.screen.innerHTML = '';
    if (!this.current) {
      const grid = el('div', 'phone-grid');
      for (const app of this.apps) {
        const b = el('button', 'phone-app');
        const icon = el('span', 'phone-icon', app.icon);
        icon.style.background = app.color;
        const n = app.badge?.() ?? 0;
        if (n) icon.dataset.badge = String(n);
        b.append(icon, el('span', '', app.name));
        b.onclick = () => this.openApp(app.id);
        grid.append(b);
      }
      const obj = this.state.currentObjective();
      if (obj) {
        const card = el('div', 'phone-card');
        card.append(el('div', 'muted', 'Objetivo'), el('div', '', obj.text));
        this.screen.append(card);
      }
      this.screen.append(grid);
      return;
    }
    const head = el('div', 'phone-head');
    head.append(button('‹', () => this.home(), 'phone-back'), el('strong', '', this.current.name));
    const body = el('div', 'phone-body');
    this.screen.append(head, body);
    this.current.render(body, this);
  }

  notify(from: string, text: string) {
    this.notif.innerHTML = '';
    this.notif.append(el('strong', '', from), el('div', '', text.length > 110 ? text.slice(0, 110) + '…' : text));
    this.notif.classList.add('show');
    clearTimeout((this.notif as any)._t);
    (this.notif as any)._t = setTimeout(() => this.notif.classList.remove('show'), 4500);
    this.notif.onclick = () => this.openApp('mensajes');
    this.toggleBtn.classList.add('ring');
    setTimeout(() => this.toggleBtn.classList.remove('ring'), 900);
  }

  private renderMessages(body: HTMLElement) {
    const msgs = this.state.data.messages;
    if (!msgs.length) body.append(el('p', 'muted', 'Sin mensajes'));
    for (const m of msgs as Message[]) {
      const row = el('div', 'msg' + (m.read ? '' : ' unread'));
      row.append(el('div', 'msg-from', `${m.from} · ${this.state.clock(m.t)}`), el('div', '', m.text));
      body.append(row);
      m.read = true;
    }
    this.state.persist();
  }

  private renderBank(body: HTMLElement) {
    const d = this.state.data;
    if (!d.hasAccount) {
      body.append(el('p', 'muted', `Aún no tienes cuenta. Ve a la oficina de ${BANK_NAME} en la Planta 0.`));
      return;
    }
    const card = el('div', 'bank-card');
    card.append(el('div', 'muted', 'Saldo disponible'), el('div', 'big', euros(d.bank)), el('div', 'mono', d.account));
    body.append(card);
    const pockets = el('div', 'row');
    pockets.append(el('div', 'pill', `Efectivo ${euros(d.cash)}`), el('div', 'pill', `Cripto ${euros(d.crypto)}`));
    body.append(pockets);
    if (d.loans.length) {
      body.append(el('div', 'section', 'Préstamos'));
      for (const l of d.loans) {
        const late = d.time > l.dueAt;
        body.append(el('div', 'msg' + (late ? ' danger' : ''), `${l.label} ${l.id} · debes ${euros(l.owed)} · vence día ${Math.floor(l.dueAt / 1440) + 1} ${this.state.clock(l.dueAt)}${late ? ' · VENCIDO' : ''}`));
      }
    }
    body.append(el('div', 'section', 'Movimientos'));
    if (!d.movements.length) body.append(el('p', 'muted', 'Sin movimientos'));
    for (const mv of d.movements.slice(0, 30)) {
      const row = el('div', 'mov');
      row.append(el('span', '', mv.concept), el('span', mv.amount < 0 ? 'neg' : 'pos', (mv.amount > 0 ? '+' : '') + euros(mv.amount)));
      body.append(row);
    }
  }
}
