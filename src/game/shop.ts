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
  otros: 'Otros',
};

export class ShopCart {
  items: Record<string, number> = {};
  active = false;
  private mesh: THREE.Group | null = null;

  get total() {
    return Object.entries(this.items).reduce((sum, [id, n]) => sum + ITEMS[id].price * n, 0);
  }

  get count() {
    return Object.values(this.items).reduce((a, b) => a + b, 0);
  }

  // carro de la compra que va delante del personaje
  attach(root: THREE.Object3D) {
    if (this.mesh) return;
    const g = new THREE.Group();
    const wire = new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.8, roughness: 0.3, wireframe: true });
    const solid = new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.8, roughness: 0.3 });
    const red = new THREE.MeshStandardMaterial({ color: '#d63a2f', roughness: 0.5 });
    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.8, 4, 3, 5), wire);
    basket.position.set(0, 0.78, 0.62);
    g.add(basket);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 0.8), solid);
    bottom.position.set(0, 0.56, 0.62);
    g.add(bottom);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8), red);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, 1.02, 0.18);
    g.add(handle);
    for (const [x, z] of [[-0.22, 0.3], [0.22, 0.3], [-0.22, 0.95], [0.22, 0.95]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), new THREE.MeshStandardMaterial({ color: '#222' }));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.05, z);
      g.add(wheel);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), solid);
      leg.position.set(x, 0.32, z);
      g.add(leg);
    }
    this.mesh = g;
    root.add(g);
    this.active = true;
  }

  detach() {
    this.mesh?.removeFromParent();
    this.mesh = null;
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
        shelfPanel(game, cart, shelf);
      }, 'btn ghost small');
      minus.disabled = !inCart;
      const plus = button('+', () => {
        if (!state.takeStock(item.id)) return hud.toast('No queda en la estantería', 'bad');
        cart.items[item.id] = inCart + 1;
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

export function checkoutPanel(game: Game, cart: ShopCart) {
  const { state, hud } = game;
  if (!cart.active || !cart.count) return hud.toast('El carro está vacío', 'bad');
  hud.openPanel(`${SHOP_NAME} · Caja`, (body) => {
    const ticket = el('div', 'ticket');
    ticket.append(el('div', 'ticket-head', `${SHOP_NAME} 24 H · TICKET`));
    for (const [id, n] of Object.entries(cart.items)) {
      const r = el('div', 'mov');
      r.append(el('span', '', `${n} × ${ITEMS[id].name}`), el('span', '', euros(ITEMS[id].price * n)));
      ticket.append(r);
    }
    const tot = el('div', 'mov ticket-total');
    tot.append(el('span', '', 'TOTAL'), el('span', '', euros(cart.total)));
    ticket.append(tot);
    body.append(ticket);
    const pay = (method: 'cash' | 'card') => {
      const ok = method === 'cash' ? state.payCash(cart.total) : state.hasCard && state.payCard(cart.total, `Compra ${SHOP_NAME}`);
      if (!ok) return hud.toast(method === 'cash' ? 'No llevas efectivo suficiente' : 'Tarjeta rechazada (¿llevas tarjeta y saldo?)', 'bad');
      for (const [id, n] of Object.entries(cart.items)) state.addItem(id, n);
      state.complete('comprar');
      hud.toast(`Pagado ${euros(cart.total)} · todo al inventario`, 'ok');
      cart.detach();
      game.player.slow = false;
      hud.closePanel();
    };
    const row = el('div', 'row');
    row.append(button(`Pagar en efectivo (${euros(state.data.cash)})`, () => pay('cash')), button('Pagar con tarjeta', () => pay('card'), 'btn ghost'));
    body.append(row);
  });
}
