import { button, el, euros } from './hud';
import type { StoreProduct } from './state';
import type { Game } from './world';

// Dropshipping: buscas productos en tendencia, los publicas en tu tienda
// con un precio y un presupuesto de anuncios, y las ventas te llegan al
// móvil. Cada venta deja precio − coste − comisión de pasarela.

interface Catalog {
  id: string;
  name: string;
  icon: string;
  cost: number;
  trend: number; // 0-100
  competition: number; // 0-100
}

const CATALOG: Catalog[] = [
  { id: 'lampara', name: 'Lámpara de luna 3D', icon: '🌕', cost: 6.2, trend: 72, competition: 55 },
  { id: 'corrector', name: 'Corrector de postura', icon: '🧍', cost: 3.9, trend: 64, competition: 70 },
  { id: 'masajeador', name: 'Pistola de masaje mini', icon: '💆', cost: 14.5, trend: 81, competition: 62 },
  { id: 'proyector', name: 'Proyector de galaxias', icon: '🌌', cost: 9.8, trend: 77, competition: 48 },
  { id: 'botella', name: 'Botella motivacional 2 L', icon: '🍶', cost: 4.1, trend: 58, competition: 75 },
  { id: 'funda', name: 'Funda de móvil con anillo', icon: '📱', cost: 1.6, trend: 45, competition: 90 },
  { id: 'cepillo', name: 'Cepillo quitapelos de mascotas', icon: '🐶', cost: 3.2, trend: 69, competition: 52 },
  { id: 'licuadora', name: 'Licuadora portátil USB', icon: '🥤', cost: 8.7, trend: 74, competition: 66 },
  { id: 'anillo', name: 'Anillo inteligente de sueño', icon: '💍', cost: 21, trend: 86, competition: 35 },
  { id: 'gafas', name: 'Gafas antiluz azul', icon: '👓', cost: 2.9, trend: 51, competition: 80 },
  { id: 'aspiradora', name: 'Mini aspiradora para coche', icon: '🚗', cost: 7.4, trend: 63, competition: 58 },
  { id: 'tira', name: 'Tira LED para gaming', icon: '🌈', cost: 5.5, trend: 70, competition: 72 },
];

const FEE = 0.04; // comisión de la pasarela de pago

export function storeTick(game: Game, hours: number) {
  const { state, phone } = game;
  const store = state.data.store;
  if (!store.length) return;
  for (const p of store) {
    if (p.ads <= 0 && Math.random() > 0.15) continue;
    // anuncios: se cobran por hora
    const adCost = (p.ads / 24) * hours;
    if (p.ads > 0 && !state.payCard(adCost, `Anuncios · ${p.name}`)) {
      p.ads = 0;
      phone.notify('Tienda', `Sin saldo para anuncios: pausados en ${p.name}`);
      continue;
    }
    // demanda: tendencia, margen razonable y anuncios
    const ratio = p.price / p.cost;
    const priceFactor = ratio < 1.5 ? 1.3 : ratio < 3 ? 1 : ratio < 5 ? 0.55 : 0.15;
    const expected = hours * (p.demand / 100) * priceFactor * (0.15 + Math.sqrt(p.ads) * 0.09);
    let sales = 0;
    for (let i = 0; i < Math.ceil(expected * 2); i++) if (Math.random() < expected / Math.ceil(expected * 2)) sales++;
    for (let i = 0; i < sales; i++) {
      const profit = p.price * (1 - FEE) - p.cost;
      p.sold++;
      p.revenue += profit;
      state.income(p.price * (1 - FEE) - p.cost, `Venta tienda · ${p.name}`);
      phone.notify(`🛍️ ${state.data.storeName || 'Tu tienda'}`, `¡Nueva venta! ${p.icon} ${p.name} por ${euros(p.price)} · beneficio ${euros(profit)}`);
    }
    // la moda se va pasando
    p.demand = Math.max(5, p.demand - hours * 0.15);
  }
  state.persist();
}

export function dropshipPc(game: Game, onClose: () => void) {
  const { state, hud } = game;
  let tab: 'buscar' | 'tienda' = state.data.store.length ? 'tienda' : 'buscar';
  hud.openPanel('PC · Dropshipping', (body) => {
    const render = () => {
      body.innerHTML = '';
      if (!state.data.storeName) {
        body.append(el('p', '', 'Ponle nombre a tu tienda online:'));
        const name = el('input', 'field') as HTMLInputElement;
        name.placeholder = 'Ej: TrendyShop';
        body.append(name, button('Crear tienda', () => {
          if (!name.value.trim()) return;
          state.data.storeName = name.value.trim();
          state.persist();
          render();
        }));
        return;
      }
      const tabs = el('div', 'row');
      tabs.append(button('🔎 Buscar productos', () => { tab = 'buscar'; render(); }, tab === 'buscar' ? 'btn small' : 'btn ghost small'));
      tabs.append(button(`🛍️ ${state.data.storeName}`, () => { tab = 'tienda'; render(); }, tab === 'tienda' ? 'btn small' : 'btn ghost small'));
      body.append(tabs);
      if (tab === 'buscar') {
        body.append(el('p', 'muted', 'Productos del proveedor. Tendencia alta y poca competencia = se vende más.'));
        const list = el('div', 'items');
        for (const c of CATALOG) {
          const listed = state.data.store.some((p) => p.id === c.id);
          const row = el('div', 'item');
          row.append(el('span', 'icon', c.icon), el('span', '', `${c.name}\nCoste ${euros(c.cost)} · tendencia ${c.trend} · competencia ${c.competition}`), el('span', ''));
          const b = button(listed ? 'En tu tienda' : 'Añadir', () => {
            const product: StoreProduct = { id: c.id, name: c.name, icon: c.icon, cost: c.cost, price: Math.round(c.cost * 3) - 0.01, ads: 10, demand: c.trend * (1 - c.competition / 200), sold: 0, revenue: 0 };
            state.data.store.push(product);
            state.complete('tienda');
            state.persist();
            hud.toast(`${c.icon} ${c.name} publicado en tu tienda`, 'ok');
            tab = 'tienda';
            render();
          }, listed ? 'btn ghost small' : 'btn small');
          b.disabled = listed;
          row.append(b);
          list.append(row);
        }
        body.append(list);
        return;
      }
      const total = state.data.store.reduce((s, p) => s + p.revenue, 0);
      body.append(el('div', 'row'), el('div', 'big', euros(total)), el('div', 'muted', 'beneficio total de la tienda · las ventas te llegan al móvil'));
      if (!state.data.store.length) body.append(el('p', 'muted', 'Tu tienda está vacía: añade productos.'));
      for (const p of state.data.store) {
        const card = el('div', 'store-card');
        card.append(el('div', '', `${p.icon} <b>${p.name}</b>`));
        (card.firstChild as HTMLElement).innerHTML = `${p.icon} <b>${p.name}</b> · vendidos ${p.sold} · demanda ${Math.round(p.demand)}`;
        const row = el('div', 'row');
        const price = el('input', 'field small') as HTMLInputElement;
        price.type = 'number';
        price.step = '0.5';
        price.value = String(p.price);
        const ads = el('input', 'field small') as HTMLInputElement;
        ads.type = 'number';
        ads.value = String(p.ads);
        row.append(el('span', 'muted', 'Precio €'), price, el('span', 'muted', 'Anuncios €/día'), ads, button('Guardar', () => {
          p.price = Math.max(p.cost, Number(price.value) || p.price);
          p.ads = Math.max(0, Number(ads.value) || 0);
          state.persist();
          hud.toast('Cambios guardados', 'ok');
        }, 'btn small'), button('Quitar', () => {
          state.data.store = state.data.store.filter((x) => x !== p);
          state.persist();
          render();
        }, 'btn ghost small'));
        card.append(row, el('div', 'muted', `Coste ${euros(p.cost)} · margen por venta ${euros(p.price * (1 - FEE) - p.cost)}`));
        body.append(card);
      }
    };
    render();
  }, onClose);
}

export function storeApp(game: Game) {
  return {
    id: 'tienda', name: 'Mi tienda', icon: '🛍️', color: 'linear-gradient(135deg,#c86dd7,#3023ae)',
    render: (body: HTMLElement) => {
      const { state } = game;
      if (!state.data.storeName) {
        body.append(el('p', 'muted', 'Aún no tienes tienda. Monta una en las mesas de dropshipping de la Planta 1.'));
        return;
      }
      const total = state.data.store.reduce((s, p) => s + p.revenue, 0);
      body.append(el('div', 'bank-card'), el('div', 'section', state.data.storeName));
      (body.firstChild as HTMLElement).innerHTML = `<div class="muted">Beneficio</div><div class="big">${euros(total)}</div>`;
      for (const p of state.data.store) body.append(el('div', 'msg', `${p.icon} ${p.name} · ${p.sold} vendidos · ${euros(p.price)}`));
    },
  };
}
