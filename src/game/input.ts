// Controles: teclado + ratón en PC, joystick y botones táctiles en móvil.

export class Input {
  private keys = new Set<string>();
  // movimiento del joystick táctil, de -1 a 1
  private stick = { x: 0, y: 0 };
  // giro de cámara acumulado desde el último frame
  look = { x: 0, y: 0 };
  zoom = 0;
  private handlers: Record<string, (() => void)[]> = {};
  enabled = true;

  constructor(canvas: HTMLElement, root: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.emit(k);
      this.keys.add(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());

    // arrastrar con el ratón o el dedo para girar la cámara
    let dragId: number | null = null;
    let last = { x: 0, y: 0 };
    canvas.addEventListener('pointerdown', (e) => {
      dragId = e.pointerId;
      last = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== dragId) return;
      this.look.x += e.clientX - last.x;
      this.look.y += e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId === dragId) dragId = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', (e) => {
      this.zoom += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });

    this.buildTouchControls(root);
  }

  private buildTouchControls(root: HTMLElement) {
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!touch) return;
    const pad = document.createElement('div');
    pad.className = 'stick';
    const knob = document.createElement('div');
    knob.className = 'stick-knob';
    pad.appendChild(knob);
    root.appendChild(pad);
    let id: number | null = null;
    const move = (e: PointerEvent) => {
      const r = pad.getBoundingClientRect();
      let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      this.stick = { x, y };
      knob.style.transform = `translate(${x * 34}px, ${y * 34}px)`;
    };
    pad.addEventListener('pointerdown', (e) => {
      id = e.pointerId;
      pad.setPointerCapture(id);
      move(e);
      e.stopPropagation();
    });
    pad.addEventListener('pointermove', (e) => e.pointerId === id && move(e));
    const release = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      this.stick = { x: 0, y: 0 };
      knob.style.transform = '';
    };
    pad.addEventListener('pointerup', release);
    pad.addEventListener('pointercancel', release);

    const buttons = document.createElement('div');
    buttons.className = 'touch-buttons';
    for (const [key, label] of [['e', 'E'], ['i', '🎒'], ['shift', '🏃']] as const) {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (key === 'shift') this.keys.add('shift');
        else this.emit(key);
      });
      b.addEventListener('pointerup', () => key === 'shift' && this.keys.delete('shift'));
      buttons.appendChild(b);
    }
    root.appendChild(buttons);
  }

  on(key: string, fn: () => void) {
    (this.handlers[key] ??= []).push(fn);
  }

  private emit(key: string) {
    for (const fn of this.handlers[key] ?? []) fn();
  }

  // dirección de movimiento: x a la derecha, y hacia delante
  move() {
    if (!this.enabled) return { x: 0, y: 0, run: false };
    const k = this.keys;
    let x = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    let y = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    x += this.stick.x;
    y -= this.stick.y;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y, run: k.has('shift') };
  }

  takeLook() {
    const l = this.look;
    this.look = { x: 0, y: 0 };
    return l;
  }

  takeZoom() {
    const z = this.zoom;
    this.zoom = 0;
    return z;
  }
}
