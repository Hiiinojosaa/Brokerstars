import { OBJECTIVES, type GameState } from './state';

// Interfaz del juego por encima del 3D: dinero, necesidades, objetivos,
// el aviso de "pulsa E", mensajes y ventanas (cajero, tienda, PC…).

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export function button(text: string, onClick: () => void, cls = 'btn') {
  const b = el('button', cls, text);
  b.type = 'button';
  b.onclick = onClick;
  return b;
}

export const euros = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

export class Hud {
  private cash = el('div', 'money');
  private bank = el('div', 'money');
  private floor = el('div', 'floor-name');
  private hunger = el('div', 'bar-fill');
  private energy = el('div', 'bar-fill');
  private objectives = el('ol', 'objectives');
  private prompt = el('div', 'prompt');
  private toasts = el('div', 'toasts');
  private overlay = el('div', 'overlay');
  private fadeEl = el('div', 'fade');
  private panelOnClose: (() => void) | null = null;

  constructor(root: HTMLElement, private state: GameState) {
    const top = el('div', 'hud-top');
    const money = el('div', 'hud-money');
    money.append(this.cash, this.bank);
    const needs = el('div', 'hud-needs');
    for (const [label, fill, color] of [['Hambre', this.hunger, '#e67e22'], ['Energía', this.energy, '#f1c40f']] as const) {
      const row = el('div', 'need');
      const bar = el('div', 'bar');
      fill.style.background = color;
      bar.append(fill);
      row.append(el('span', '', label), bar);
      needs.append(row);
    }
    top.append(this.floor, money, needs);
    const obj = el('div', 'hud-objectives');
    obj.append(el('div', 'obj-title', 'Objetivos'), this.objectives);
    const help = el('div', 'help', 'WASD moverse · Shift correr · ratón girar cámara · E interactuar · I inventario');
    root.append(top, obj, this.prompt, this.toasts, this.overlay, this.fadeEl, help);
    state.onChange(() => this.refresh());
    this.refresh();
  }

  setFloor(name: string) {
    this.floor.textContent = name;
  }

  refresh() {
    const d = this.state.data;
    this.cash.innerHTML = `<span>Efectivo</span>${euros(d.cash)}`;
    this.bank.innerHTML = `<span>Banco</span>${d.hasAccount ? euros(d.bank) : 'sin cuenta'}`;
    this.hunger.style.width = `${d.hunger}%`;
    this.energy.style.width = `${d.energy}%`;
    const html = OBJECTIVES.map((o) => `<li class="${d.done[o.id] ? 'done' : ''}">${o.text}</li>`).join('');
    if (this.objectives.innerHTML !== html) this.objectives.innerHTML = html;
  }

  showPrompt(text: string | null) {
    this.prompt.textContent = text ? `E · ${text}` : '';
    this.prompt.style.opacity = text ? '1' : '0';
  }

  toast(text: string, kind: 'ok' | 'bad' | '' = '') {
    const t = el('div', 'toast ' + kind, text);
    this.toasts.append(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  get panelOpen() {
    return this.overlay.classList.contains('open');
  }

  // abre una ventana; `build` rellena el cuerpo y recibe la función de cerrar
  openPanel(title: string, build: (body: HTMLElement, close: () => void) => void, onClose?: () => void) {
    // si se sustituye una ventana por otra, la anterior no cuenta como cerrada
    this.panelOnClose = null;
    this.closePanel();
    this.overlay.innerHTML = '';
    const panel = el('div', 'panel');
    const head = el('div', 'panel-head');
    head.append(el('h2', '', title), button('✕', () => this.closePanel(), 'close'));
    const body = el('div', 'panel-body');
    panel.append(head, body);
    this.overlay.append(panel);
    this.overlay.classList.add('open');
    this.panelOnClose = onClose ?? null;
    build(body, () => this.closePanel());
  }

  closePanel() {
    if (!this.panelOpen) return;
    this.overlay.classList.remove('open');
    this.overlay.innerHTML = '';
    const cb = this.panelOnClose;
    this.panelOnClose = null;
    cb?.();
  }

  // fundido a negro, cambia algo y vuelve
  async fade(during: () => void) {
    this.fadeEl.classList.add('on');
    await new Promise((r) => setTimeout(r, 450));
    during();
    await new Promise((r) => setTimeout(r, 150));
    this.fadeEl.classList.remove('on');
  }
}
