import * as THREE from 'three';
import { SHOP_NAME } from './config';
import { button, el, euros } from './hud';
import { ITEMS, type Shelf } from './state';
import type { Game } from './world';

// El MegaMart: coges un carro en la entrada, lo llenas en las estanterías
// y pagas en caja (en efectivo o con tarjeta). Si sales sin pagar, el
// guardia te para.

export const SHELF_NAMES: Record<Shelf, string> = {
  congelados: 'Congelados',
  snacks: 'Snacks y dulces',
  bebidas: 'Bebidas frías',
  fiesta: 'Fiesta',
  estanco: 'Estanco',
  electronica: 'Electrónica',
  armeria: 'Armería',
  fresco: 'Frescos',
  hogar: 'Hogar y limpieza',
  otros: 'Otros',
};

export class ShopCart {
  items: Record<string, number> = {};
  active = false;
  private mesh: THREE.Group | null = null;
  // montón de productos que se ve dentro de la cesta
  private pile: THREE.Group | null = null;

  get total() {
    return Object.entries(this.items).reduce((sum, [id, n]) => sum + ITEMS[id].price * n, 0);
  }

  get count() {
    return Object.values(this.items).reduce((a, b) => a + b, 0);
  }

  // carro de la compra grande que va POR DELANTE del personaje (no lo pisa):
  // la cesta arranca en z≈0.95 y el asa queda justo al alcance de las manos
  attach(root: THREE.Object3D) {
    if (this.mesh) return;
    const g = new THREE.Group();
    const wire = new THREE.MeshStandardMaterial({ color: '#d2d7df', metalness: 0.85, roughness: 0.3, wireframe: true });
    const solid = new THREE.MeshStandardMaterial({ color: '#d2d7df', metalness: 0.85, roughness: 0.3 });
    const red = new THREE.MeshStandardMaterial({ color: '#d63a2f', roughness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.6 });
    // cesta grande, inclinada: más alta por detrás (hacia el asa) que por delante
    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.5, 0.9, 5, 3, 6), wire);
    basket.position.set(0, 0.82, 1.0);
    basket.rotation.x = -0.12;
    g.add(basket);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.02, 0.9), solid);
    bottom.position.set(0, 0.56, 1.02);
    bottom.rotation.x = -0.12;
    g.add(bottom);
    // montón de productos (se rellena en refill)
    this.pile = new THREE.Group();
    this.pile.position.set(0, 0.62, 1.0);
    g.add(this.pile);
    // asa roja al alcance de las dos manos
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.62, 10), red);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, 1.04, 0.5);
    g.add(handle);
    // bastidor en diagonal del asa a la cesta
    for (const s of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 6), solid);
      bar.position.set(s * 0.31, 0.92, 0.72);
      bar.rotation.x = 0.7;
      g.add(bar);
    }
    for (const [x, z] of [[-0.27, 0.6], [0.27, 0.6], [-0.27, 1.35], [0.27, 1.35]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.045, 12), dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.06, z);
      g.add(wheel);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.52, 6), solid);
      leg.position.set(x, 0.33, z);
      g.add(leg);
    }
    this.mesh = g;
    root.add(g);
    this.active = true;
    this.refill();
  }

  // apila cajitas de colores en la cesta, una por producto (hasta ~18)
  refill() {
    if (!this.pile) return;
    for (const c of [...this.pile.children]) {
      (c as THREE.Mesh).geometry?.dispose?.();
      this.pile.remove(c);
    }
    const ids: string[] = [];
    for (const [id, n] of Object.entries(this.items)) for (let i = 0; i < n; i++) ids.push(id);
    const show = ids.slice(0, 18);
    show.forEach((id, i) => {
      const hue = Math.abs([...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 360;
      const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${hue},62%,58%)`), roughness: 0.6 });
      const w = 0.14 + (i % 3) * 0.03;
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1 + (i % 2) * 0.05, w), m);
      const col = i % 4, row = Math.floor(i / 4);
      box.position.set(-0.21 + col * 0.14, row * 0.09, -0.3 + (i % 5) * 0.14);
      box.rotation.y = (hue / 180) * Math.PI;
      this.pile!.add(box);
    });
  }

  detach() {
    this.mesh?.removeFromParent();
    this.mesh = null;
    this.pile = null;
    this.active = false;
    this.items = {};
  }
}

export function takeCart(game: Game, cart: ShopCart) {
  if (cart.active) {
    cart.detach();
    game.player.slow = false;
    game.player.character.pose = 'quieto';
    return game.hud.toast('Has dejado el carro', '');
  }
  cart.attach(game.player.character.root);
  game.player.slow = true;
  game.player.character.pose = 'carro';
  game.hud.toast('🛒 Carro listo: llénalo en las estanterías y paga en caja', 'ok');
}

export function shelfPanel(game: Game, cart: ShopCart, shelf: Shelf) {
  const { state, hud } = game;
  if (!cart.active) return hud.toast('Coge un carro en la entrada del súper', 'bad');
  hud.openPanel(`${SHOP_NAME} · ${SHELF_NAMES[shelf]}`, (body) => {
    const list = el('div', 'items');
    for (const item of Object.values(ITEMS)) {
      if (item.shelf !== shelf || item.hidden) continue;
      const stock = state.stockOf(item.id);
      const inCart = cart.items[item.id] ?? 0;
      const row = el('div', 'item');
      row.append(el('span', 'icon', item.icon), el('span', '', `${item.name}\nQuedan ${stock}${inCart ? ` · en el carro ${inCart}` : ''}`), el('span', 'muted', euros(item.price)));
      const controls = el('div', 'row');
      const minus = button('−', () => {
        if (!inCart) return;
        cart.items[item.id] = inCart - 1;
        if (!cart.items[item.id]) delete cart.items[item.id];
        state.data.stock[item.id] = stock + 1;
        cart.refill();
        shelfPanel(game, cart, shelf);
      }, 'btn ghost small');
      minus.disabled = !inCart;
      const plus = button('+', () => {
        if (!state.takeStock(item.id)) return hud.toast('No queda en la estantería', 'bad');
        cart.items[item.id] = inCart + 1;
        cart.refill();
        shelfPanel(game, cart, shelf);
      }, 'btn small');
      plus.disabled = stock <= 0;
      controls.append(minus, plus);
      row.append(controls);
      list.append(row);
    }
    body.append(list, el('div', 'cart-total', `🛒 ${cart.count} productos · ${euros(cart.total)}`));
  });
}

const STORE_DISCOUNT = 0.08; // tarjeta de cliente: −8 %

export function checkoutPanel(game: Game, cart: ShopCart, mode: 'self' | 'staffed' = 'self') {
  const { state, hud } = game;
  if (!cart.active || !cart.count) return hud.toast('El carro está vacío', 'bad');
  let useCard = state.data.storeCard;      // usa la tarjeta de cliente si la tienes
  let scanned = mode === 'self';            // en caja atendida hay que esperar al cajero
  hud.openPanel(`${SHOP_NAME} · ${mode === 'self' ? 'Autopago' : 'Caja atendida'}`, (body) => {
    const ticket = () => {
      const discount = useCard && state.data.storeCard ? Math.round(cart.total * STORE_DISCOUNT * 100) / 100 : 0;
      const total = Math.round((cart.total - discount) * 100) / 100;
      const t = el('div', 'ticket');
      t.append(el('div', 'ticket-head', `${SHOP_NAME} 24 H · TICKET`));
      for (const [id, n] of Object.entries(cart.items)) {
        const r = el('div', 'mov');
        r.append(el('span', '', `${n} × ${ITEMS[id].name}`), el('span', '', euros(ITEMS[id].price * n)));
        t.append(r);
      }
      if (discount) {
        const r = el('div', 'mov');
        r.append(el('span', '', 'TARJETA CLIENTE −8%'), el('span', 'pos', `−${euros(discount)}`));
        t.append(r);
      }
      const tot = el('div', 'mov ticket-total');
      tot.append(el('span', '', 'TOTAL'), el('span', '', euros(total)));
      t.append(tot);
      return { el: t, total };
    };

    const render = () => {
      body.innerHTML = '';
      const { el: tk, total } = ticket();
      body.append(tk);
      // tarjeta de cliente
      if (state.data.storeCard) {
        const toggle = button(`💳 Tarjeta de la tienda: ${useCard ? 'aplicada ✓' : 'sin aplicar'}`, () => { useCard = !useCard; render(); }, 'btn ghost small');
        body.append(toggle);
      } else {
        body.append(button('💳 Hazte la tarjeta de la tienda (gratis, −8%)', () => {
          state.data.storeCard = true; useCard = true; state.persist();
          hud.toast('💳 Tarjeta de cliente activada', 'ok');
          render();
        }, 'btn ghost small'));
      }
      // caja atendida: el cajero pasa los artículos antes de poder pagar
      if (mode === 'staffed' && !scanned) {
        body.append(el('p', 'muted', 'Deja los artículos en la cinta; el cajero los va pasando. El carrito se queda al lado.'));
        const barWrap = el('div', 'scan-bar');
        const fill = el('div', 'scan-fill');
        barWrap.append(fill);
        body.append(barWrap);
        requestAnimationFrame(() => (fill.style.width = '100%'));
        setTimeout(() => { scanned = true; render(); }, 1800);
        return;
      }
      const pay = (method: 'cash' | 'card') => {
        const ok = method === 'cash' ? state.payCash(total) : state.hasCard && state.payCard(total, `Compra ${SHOP_NAME}`);
        if (!ok) return hud.toast(method === 'cash' ? 'No llevas efectivo suficiente' : 'Tarjeta rechazada (¿llevas tarjeta y saldo?)', 'bad');
        for (const [id, n] of Object.entries(cart.items)) state.addItem(id, n);
        state.complete('comprar');
        // ticket impreso de confirmación
        body.innerHTML = '';
        const { el: paid } = ticket();
        paid.classList.add('paid');
        paid.append(el('div', 'ticket-stamp', `PAGADO · ${method === 'cash' ? 'EFECTIVO' : 'TARJETA'}`));
        body.append(paid, el('p', 'muted', 'Gracias por su compra. Todo va a tu inventario.'), button('Coger el ticket y salir', () => {
          cart.detach();
          game.player.slow = false;
          hud.closePanel();
        }));
      };
      const row = el('div', 'row');
      row.append(button(`Pagar en efectivo (${euros(state.data.cash)})`, () => pay('cash')), button('Pagar con tarjeta', () => pay('card'), 'btn ghost'));
      body.append(row);
    };
    render();
  });
}
