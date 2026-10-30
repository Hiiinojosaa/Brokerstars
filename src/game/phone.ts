import { el } from './hud';
import type { GameState, Message } from './state';

// El móvil del jugador, estilo iPhone: pantalla de inicio con widgets, dock,
// apps a pantalla completa y notificaciones que caen desde la Dynamic
// Island. Se abre con M (o el botón 📱). Las apps se registran con `addApp`.

export interface PhoneApp {
  id: string;
  name: string;
  icon: string;
  // fondo del icono (cualquier valor de `background` de CSS)
  color: string;
  badge?: () => number;
  // si va en el dock de abajo
  dock?: boolean;
  // tema de la app: oscuro (por defecto) o claro
  light?: boolean;
  render(body: HTMLElement, phone: Phone): void;
}

export class Phone {
  private root = el('div', 'phone');
  private screen = el('div', 'phone-screen');
  private island = el('div', 'phone-island');
  private notif = el('div', 'phone-notif');
  private statusTime = el('span', 'st-time');
  private toggleBtn = el('button', 'phone-toggle', '📱');
  private apps: PhoneApp[] = [];
  private current: PhoneApp | null = null;
  open = false;

  constructor(ui: HTMLElement, private state: GameState) {
    const frame = el('div', 'phone-frame');
    const status = el('div', 'phone-status');
    status.append(this.statusTime, el('span', 'st-icons', '▂▄▆ 5G ▰▰▰▱'));
    const home = el('button', 'phone-homebar');
    home.onclick = () => this.home();
    frame.append(this.screen, status, this.island, home);
    this.root.append(frame);
    ui.append(this.root, this.notif, this.toggleBtn);
    this.toggleBtn.onclick = () => this.toggle();
    const updateStatus = () => {
      this.statusTime.textContent = state.clock();
      const n = state.unread;
      this.toggleBtn.dataset.badge = n ? String(n) : '';
    };
    state.onChange(updateStatus);
    updateStatus();
    state.onMessage((m) => this.notify(m.from, m.text));
  }

  addApp(app: PhoneApp) {
    this.apps.push(app);
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

  private icon(app: PhoneApp) {
    const b = el('button', 'phone-app');
    const icon = el('span', 'phone-icon', app.icon);
    icon.style.background = app.color;
    const n = app.badge?.() ?? 0;
    if (n) icon.dataset.badge = String(n);
    b.append(icon, el('span', 'phone-app-name', app.name));
    b.onclick = () => this.openApp(app.id);
    return b;
  }

  private render() {
    this.screen.innerHTML = '';
    this.screen.className = 'phone-screen';
    this.root.dataset.app = this.current?.id ?? 'home';
    if (!this.current) {
      this.screen.classList.add('home');
      // widgets: reloj grande y objetivo
      const clock = el('div', 'widget-clock');
      clock.append(el('div', 'wc-date', `Día ${this.state.day}`), el('div', 'wc-time', this.state.clock()));
      this.screen.append(clock);
      const obj = this.state.currentObjective();
      const widget = el('div', 'widget');
      widget.append(el('div', 'widget-title', obj ? '🎯 Objetivo' : '😎 Libre'), el('div', '', obj ? obj.text : 'Haz dinero y gástatelo.'));
      this.screen.append(widget);
      const grid = el('div', 'phone-grid');
      for (const app of this.apps.filter((a) => !a.dock)) grid.append(this.icon(app));
      const dock = el('div', 'phone-dock');
      for (const app of this.apps.filter((a) => a.dock)) dock.append(this.icon(app));
      this.screen.append(grid, dock);
      return;
    }
    if (this.current.light) this.screen.classList.add('light');
    const head = el('div', 'phone-head');
    const back = el('button', 'phone-back', '‹');
    back.onclick = () => this.home();
    head.append(back, el('strong', '', this.current.name));
    const body = el('div', 'phone-body');
    this.screen.append(head, body);
    this.current.render(body, this);
  }

  notify(from: string, text: string) {
    this.notif.innerHTML = '';
    const head = el('div', 'pn-head');
    head.append(el('strong', '', from), el('span', 'muted', 'ahora'));
    this.notif.append(head, el('div', '', text.length > 120 ? text.slice(0, 120) + '…' : text));
    this.notif.classList.add('show');
    this.island.classList.add('wide');
    clearTimeout((this.notif as any)._t);
    (this.notif as any)._t = setTimeout(() => {
      this.notif.classList.remove('show');
      this.island.classList.remove('wide');
    }, 4500);
    this.notif.onclick = () => this.openApp('mensajes');
    this.toggleBtn.classList.add('ring');
    setTimeout(() => this.toggleBtn.classList.remove('ring'), 900);
  }

  renderMessages(body: HTMLElement) {
    const msgs = this.state.data.messages;
    if (!msgs.length) body.append(el('p', 'muted', 'Sin mensajes'));
    // agrupados por remitente, como una lista de chats
    const byFrom = new Map<string, Message[]>();
    for (const m of msgs as Message[]) byFrom.set(m.from, [...(byFrom.get(m.from) ?? []), m]);
    for (const [from, list] of byFrom) {
      const chat = el('div', 'chat-thread');
      const unread = list.filter((m) => !m.read).length;
      chat.append(el('div', 'chat-from', `${from}${unread ? ` · ${unread} nuevo${unread > 1 ? 's' : ''}` : ''}`));
      for (const m of list.slice(0, 6).reverse()) {
        chat.append(el('div', 'imsg', m.text), el('div', 'imsg-time', this.state.clock(m.t)));
        m.read = true;
      }
      body.append(chat);
    }
    this.state.persist();
  }
}
