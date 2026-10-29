import {
  BANK_NAME,
  GAME_MINUTES_PER_SECOND,
  LATE_DAILY,
  LATE_FEE,
  LOAN_OFFERS,
  MAX_LOANS,
  SEIZE_AFTER_DAYS,
} from './config';

// Estado de la partida: dinero, banco y préstamos, inventario, móvil,
// negocios y necesidades. Se guarda en el navegador; con multijugador lo
// llevará el servidor.

export type Shelf = 'congelados' | 'snacks' | 'bebidas' | 'fiesta' | 'estanco' | 'otros';

export interface Item {
  id: string;
  name: string;
  icon: string;
  price: number;
  shelf: Shelf;
  hunger?: number;
  energy?: number;
  // si hay que calentarlo antes, en qué se convierte
  heatsInto?: string;
  // efecto temporal al consumirlo
  effect?: Effect;
  // no se vende (se consigue de otra forma)
  hidden?: boolean;
}

export type Effect = 'purpura' | 'risa' | 'relax' | 'subidon';

export const EFFECTS: Record<Effect, { name: string; icon: string; minutes: number; text: string }> = {
  purpura: { name: 'Púrpura', icon: '💜', minutes: 120, text: 'Todo va a cámara lenta y morado' },
  risa: { name: 'Gas de la risa', icon: '🎈', minutes: 30, text: 'No puedes parar de reír' },
  relax: { name: 'Relajado', icon: '🌿', minutes: 180, text: 'Más ánimo, menos concentración' },
  subidon: { name: 'Subidón', icon: '⚡', minutes: 90, text: 'Energía a tope' },
};

export const ITEMS: Record<string, Item> = {
  // congelados
  lasana: { id: 'lasana', name: 'Lasaña boloñesa congelada', icon: '🧊', price: 4.5, shelf: 'congelados', heatsInto: 'lasana_caliente' },
  burrito: { id: 'burrito', name: 'Burrito de pollo congelado', icon: '🧊', price: 3, shelf: 'congelados', heatsInto: 'burrito_caliente' },
  pizza: { id: 'pizza', name: 'Pizza barbacoa congelada', icon: '🧊', price: 3.8, shelf: 'congelados', heatsInto: 'pizza_caliente' },
  nuggets: { id: 'nuggets', name: 'Nuggets de pollo (20 u.)', icon: '🧊', price: 4.2, shelf: 'congelados', heatsInto: 'nuggets_calientes' },
  lasana_caliente: { id: 'lasana_caliente', name: 'Lasaña caliente', icon: '🍝', price: 0, shelf: 'congelados', hunger: 45, energy: 5, hidden: true },
  burrito_caliente: { id: 'burrito_caliente', name: 'Burrito caliente', icon: '🌯', price: 0, shelf: 'congelados', hunger: 35, hidden: true },
  pizza_caliente: { id: 'pizza_caliente', name: 'Pizza caliente', icon: '🍕', price: 0, shelf: 'congelados', hunger: 40, hidden: true },
  nuggets_calientes: { id: 'nuggets_calientes', name: 'Nuggets calientes', icon: '🍗', price: 0, shelf: 'congelados', hunger: 38, hidden: true },
  // snacks
  patatas: { id: 'patatas', name: 'Patatas fritas jamón', icon: '🥔', price: 1.8, shelf: 'snacks', hunger: 12 },
  chocolatina: { id: 'chocolatina', name: 'Chocolatina con caramelo', icon: '🍫', price: 1.2, shelf: 'snacks', hunger: 8, energy: 6 },
  gominolas: { id: 'gominolas', name: 'Gominolas ácidas', icon: '🍬', price: 1.5, shelf: 'snacks', hunger: 5, energy: 4 },
  sandwich: { id: 'sandwich', name: 'Sándwich mixto envasado', icon: '🥪', price: 2.5, shelf: 'snacks', hunger: 22 },
  frutos: { id: 'frutos', name: 'Frutos secos variados', icon: '🥜', price: 2.2, shelf: 'snacks', hunger: 14 },
  // bebidas
  sprunk: { id: 'sprunk', name: 'Sprunk lima-limón', icon: '🥤', price: 1.2, shelf: 'bebidas', hunger: 3, energy: 10 },
  cola: { id: 'cola', name: 'eCola', icon: '🥤', price: 1.2, shelf: 'bebidas', hunger: 3, energy: 10 },
  melon: { id: 'melon', name: 'Refresco de melón japonés', icon: '🍈', price: 3.5, shelf: 'bebidas', hunger: 4, energy: 14 },
  lichi: { id: 'lichi', name: 'Refresco de lichi chino', icon: '🧃', price: 3.5, shelf: 'bebidas', hunger: 4, energy: 14 },
  energetica: { id: 'energetica', name: 'Bebida energética', icon: '⚡', price: 2.2, shelf: 'bebidas', energy: 30, effect: 'subidon' },
  agua: { id: 'agua', name: 'Agua mineral', icon: '💧', price: 0.8, shelf: 'bebidas', energy: 4 },
  cafe_lata: { id: 'cafe_lata', name: 'Café en lata', icon: '☕', price: 1.5, shelf: 'bebidas', energy: 20 },
  // fiesta
  jarabe: { id: 'jarabe', name: 'Jarabe para la tos (morado)', icon: '🧪', price: 7.5, shelf: 'fiesta' },
  globos: { id: 'globos', name: 'Globos de gas de la risa (x3)', icon: '🎈', price: 9, shelf: 'fiesta', effect: 'risa' },
  purpura: { id: 'purpura', name: 'Púrpura (jarabe + Sprunk)', icon: '💜', price: 0, shelf: 'fiesta', energy: -5, effect: 'purpura', hidden: true },
  // estanco
  hierba: { id: 'hierba', name: 'Hierba (1 g)', icon: '🌿', price: 10, shelf: 'estanco', effect: 'relax', hunger: -10 },
  papel: { id: 'papel', name: 'Papel de liar', icon: '📄', price: 1, shelf: 'estanco' },
  // otros
  tarjeta: { id: 'tarjeta', name: `Tarjeta de débito ${BANK_NAME}`, icon: '💳', price: 0, shelf: 'otros', hidden: true },
};

// Recetas: dos cosas del inventario se mezclan en una.
export const RECIPES = [{ a: 'jarabe', b: 'sprunk', result: 'purpura' }];

export interface Movement {
  t: number;
  concept: string;
  amount: number;
}

export interface Loan {
  id: string;
  label: string;
  principal: number;
  owed: number;
  takenAt: number;
  dueAt: number;
  lateFeeApplied: boolean;
}

export interface Message {
  id: string;
  from: string;
  text: string;
  t: number;
  read: boolean;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  stake: number;
  leverage: number;
  entry: number;
}

export interface StoreProduct {
  id: string;
  name: string;
  icon: string;
  cost: number;
  price: number;
  ads: number;
  demand: number;
  sold: number;
  revenue: number;
}

export interface Mule {
  id: string;
  name: string;
  cut: number;
  reliability: number;
  pays: 'efectivo' | 'cripto';
}

export interface Delivery {
  id: string;
  mule: string;
  amount: number;
  arriveAt: number;
  // la mula de efectivo ya está esperando en la Planta 0
  waiting?: boolean;
}

export type ObjectiveId =
  | 'cuenta' | 'sacar' | 'comprar' | 'subir' | 'venta' | 'comision' | 'comer' | 'trading' | 'tienda' | 'casino';

// Los objetivos llegan como mensajes al móvil, uno detrás de otro.
export const OBJECTIVES: { id: ObjectiveId; text: string; from: string; message: string }[] = [
  { id: 'cuenta', text: `Abre tu cuenta en el banco ${BANK_NAME}`, from: 'Sr. Ruiz (supervisor)', message: `Bienvenido a la Torre Brokerstars, chaval. Lo primero: baja al banco ${BANK_NAME} de la Planta 0 y ábrete una cuenta, que aquí se cobra por transferencia.` },
  { id: 'sacar', text: 'Saca efectivo en un cajero', from: 'Sr. Ruiz (supervisor)', message: 'Perfecto. Te han dado tarjeta: está en tu inventario. Saca algo de efectivo en el cajero, que en el súper se paga en mano.' },
  { id: 'comprar', text: 'Coge un carro y haz la compra en el MegaMart', from: 'Sr. Ruiz (supervisor)', message: 'Ahora pásate por el MegaMart: coge un carro, llénalo y paga en caja. Un congelado para el microondas de la oficina no te vendría mal.' },
  { id: 'subir', text: 'Sube a la Planta 1 en el ascensor', from: 'Sr. Ruiz (supervisor)', message: 'Sube a la Planta 1. Pulsa el botón del ascensor, entra y marca tu planta.' },
  { id: 'venta', text: 'Llama a un lead del Excel y cierra una venta', from: 'Sr. Ruiz (supervisor)', message: 'Siéntate en una mesa de ventas, abre el CRM, marca el número de un lead y véndele una automatización. Sin venta no hay comisión.' },
  { id: 'comision', text: 'Cobra tu comisión en el despacho del supervisor', from: 'Sr. Ruiz (supervisor)', message: '¡Así se hace! Pásate por mi despacho a cobrar tu comisión.' },
  { id: 'comer', text: 'Calienta comida en el microondas y come', from: 'Sr. Ruiz (supervisor)', message: 'Come algo, que con el estómago vacío no se vende. Microondas en la cocina.' },
  { id: 'trading', text: 'Abre y cierra una operación en una mesa de trading', from: 'Lucía (trader)', message: 'Oye, nuevo, si te aburres de llamar pásate por las mesas de trading. Apuesta a si sube o baja y cierra cuando quieras.' },
  { id: 'tienda', text: 'Publica un producto en tu tienda de dropshipping', from: 'Marcos (dropshipper)', message: 'Bro, en las mesas de dropshipping te montas una tienda en 2 minutos. Busca producto, ponle precio y te van llegando ventas al móvil.' },
  { id: 'casino', text: 'Juega en el Casino Royale (Planta 3)', from: 'Sr. Ruiz (supervisor)', message: 'Y ahora a lo que vamos todos: arriba está el casino. Ahí se queda medio sueldo de esta planta.' },
];

interface SaveData {
  version: 2;
  time: number;
  hasAccount: boolean;
  account: string;
  bank: number;
  cash: number;
  crypto: number;
  chips: number;
  movements: Movement[];
  loans: Loan[];
  loansRepaid: number;
  inventory: Record<string, number>;
  hunger: number;
  energy: number;
  effects: Partial<Record<Effect, number>>;
  messages: Message[];
  done: Partial<Record<ObjectiveId, boolean>>;
  sales: number;
  pendingCommission: number;
  calledLeads: string[];
  positions: Position[];
  tradingPnl: number;
  store: StoreProduct[];
  storeName: string;
  heat: number;
  mules: Mule[];
  deliveries: Delivery[];
  victims: number;
  owned: string[];
  pin: string;
  // stock de cada producto del súper; se repone cada día
  stock: Record<string, number>;
  stockDay: number;
}

const KEY = 'brokerstars.partida.v2';

function accountNumber() {
  let s = 'ES';
  for (let i = 0; i < 22; i++) s += Math.floor(Math.random() * 10);
  return s.replace(/(.{4})/g, '$1 ').trim();
}

function fresh(): SaveData {
  return {
    version: 2, time: 8 * 60, hasAccount: false, account: accountNumber(), bank: 0, cash: 20, crypto: 0, chips: 0,
    movements: [], loans: [], loansRepaid: 0, inventory: {}, hunger: 70, energy: 80, effects: {}, messages: [], done: {},
    sales: 0, pendingCommission: 0, calledLeads: [], positions: [], tradingPnl: 0, store: [], storeName: '', heat: 0,
    mules: [], deliveries: [], victims: 0, owned: [],
    pin: String(1000 + Math.floor(Math.random() * 9000)), stock: {}, stockDay: 0,
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

export class GameState {
  data: SaveData;
  private listeners: (() => void)[] = [];
  private messageListeners: ((m: Message) => void)[] = [];

  constructor() {
    this.data = fresh();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...fresh(), ...JSON.parse(raw) };
    } catch {
      // sin almacenamiento: partida nueva
    }
    if (!this.data.messages.length) this.sendObjectiveMessage();
  }

  onChange(fn: () => void) {
    this.listeners.push(fn);
  }

  onMessage(fn: (m: Message) => void) {
    this.messageListeners.push(fn);
  }

  changed() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // no se pudo guardar; se juega igual
    }
    for (const fn of this.listeners) fn();
  }

  reset() {
    this.data = fresh();
    this.sendObjectiveMessage();
    this.changed();
  }

  // --- tiempo ---
  get day() {
    return Math.floor(this.data.time / 1440) + 1;
  }

  clock(t = this.data.time) {
    const m = Math.floor(t % 1440);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  // --- móvil ---
  message(from: string, text: string) {
    const m: Message = { id: Math.random().toString(36).slice(2), from, text, t: this.data.time, read: false };
    this.data.messages.unshift(m);
    this.data.messages = this.data.messages.slice(0, 60);
    this.changed();
    for (const fn of this.messageListeners) fn(m);
  }

  get unread() {
    return this.data.messages.filter((m) => !m.read).length;
  }

  // --- objetivos ---
  currentObjective() {
    return OBJECTIVES.find((o) => !this.data.done[o.id]) ?? null;
  }

  private sendObjectiveMessage() {
    const o = this.currentObjective();
    if (o) this.message(o.from, o.message);
  }

  complete(id: ObjectiveId) {
    if (this.data.done[id]) return false;
    const wasCurrent = this.currentObjective()?.id === id;
    this.data.done[id] = true;
    this.changed();
    if (wasCurrent) this.sendObjectiveMessage();
    return true;
  }

  // --- banco ---
  private move(concept: string, amount: number) {
    this.data.movements.unshift({ t: this.data.time, concept, amount: round(amount) });
    this.data.movements = this.data.movements.slice(0, 80);
  }

  openAccount() {
    this.data.hasAccount = true;
    this.data.bank += 500;
    this.move('Bono de bienvenida', 500);
    this.data.inventory.tarjeta = 1;
    this.complete('cuenta');
    this.message(BANK_NAME, `Tu cuenta ${this.data.account} ya está activa. Te hemos ingresado 500 € de bienvenida. Tu tarjeta está en el inventario y tu PIN es ${this.data.pin}. No se lo digas a nadie.`);
    this.changed();
  }

  get hasCard() {
    return (this.data.inventory.tarjeta ?? 0) > 0;
  }

  // cajero: sacar efectivo
  withdraw(amount: number) {
    if (this.data.bank < amount) return false;
    this.data.bank = round(this.data.bank - amount);
    this.data.cash = round(this.data.cash + amount);
    this.move('Retirada en cajero', -amount);
    this.changed();
    return true;
  }

  // cajero: ingresar efectivo en tu cuenta o en la de otro
  deposit(amount: number, toAccount?: string) {
    if (this.data.cash < amount || amount <= 0) return false;
    this.data.cash = round(this.data.cash - amount);
    const own = !toAccount || toAccount.replace(/\s/g, '') === this.data.account.replace(/\s/g, '');
    if (own) {
      this.data.bank = round(this.data.bank + amount);
      this.move('Ingreso en cajero', amount);
    } else {
      // hasta que haya multijugador el dinero sale de tu bolsillo hacia esa cuenta
      this.move(`Ingreso a ${toAccount}`, 0);
    }
    this.changed();
    return true;
  }

  transfer(amount: number, toAccount: string, concept: string) {
    if (this.data.bank < amount || amount <= 0) return false;
    this.data.bank = round(this.data.bank - amount);
    this.move(`Transferencia a ${toAccount}${concept ? ' · ' + concept : ''}`, -amount);
    this.changed();
    return true;
  }

  // ingreso en el banco por trabajo o negocio
  income(amount: number, concept: string) {
    if (this.data.hasAccount) {
      this.data.bank = round(this.data.bank + amount);
      this.move(concept, amount);
    } else {
      this.data.cash = round(this.data.cash + amount);
    }
    this.changed();
  }

  payCash(amount: number) {
    if (this.data.cash < amount) return false;
    this.data.cash = round(this.data.cash - amount);
    this.changed();
    return true;
  }

  payCard(amount: number, concept: string) {
    if (!this.data.hasAccount || this.data.bank < amount) return false;
    this.data.bank = round(this.data.bank - amount);
    this.move(concept, -amount);
    this.changed();
    return true;
  }

  // --- préstamos ---
  get activeLoans() {
    return this.data.loans;
  }

  canBorrow() {
    if (!this.data.hasAccount) return 'Necesitas una cuenta';
    if (this.data.loans.length >= MAX_LOANS) return `Ya tienes ${MAX_LOANS} préstamos: devuelve alguno antes`;
    if (this.data.loans.some((l) => this.data.time > l.dueAt)) return 'Tienes un préstamo vencido: el banco no te da más';
    return null;
  }

  borrow(index: number) {
    const offer = LOAN_OFFERS[index];
    if (this.canBorrow()) return false;
    // con historial de devoluciones el banco ofrece más barato
    const rate = Math.max(0.04, offer.rate - this.data.loansRepaid * 0.01);
    const loan: Loan = {
      id: Math.random().toString(36).slice(2, 8).toUpperCase(),
      label: offer.label,
      principal: offer.amount,
      owed: round(offer.amount * (1 + rate)),
      takenAt: this.data.time,
      dueAt: this.data.time + offer.days * 1440,
      lateFeeApplied: false,
    };
    this.data.loans.push(loan);
    this.data.bank = round(this.data.bank + offer.amount);
    this.move(`Préstamo ${loan.id}`, offer.amount);
    this.message(BANK_NAME, `Préstamo ${loan.id} concedido: ${offer.amount} €. Devuelves ${loan.owed} € antes del día ${Math.floor(loan.dueAt / 1440) + 1} a las ${this.clock(loan.dueAt)}. Si te retrasas hay recargo.`);
    this.changed();
    return true;
  }

  repay(id: string, amount: number) {
    const loan = this.data.loans.find((l) => l.id === id);
    if (!loan || amount <= 0) return false;
    const pay = Math.min(amount, loan.owed, this.data.bank);
    if (pay <= 0) return false;
    this.data.bank = round(this.data.bank - pay);
    loan.owed = round(loan.owed - pay);
    this.move(`Devolución préstamo ${loan.id}`, -pay);
    if (loan.owed <= 0.001) {
      this.data.loans = this.data.loans.filter((l) => l !== loan);
      if (this.data.time <= loan.dueAt) this.data.loansRepaid++;
      this.message(BANK_NAME, `Préstamo ${loan.id} devuelto. Gracias por confiar en nosotros.`);
    }
    this.changed();
    return true;
  }

  // recargos, intereses de demora y embargo
  private checkLoans(prevTime: number) {
    for (const loan of this.data.loans) {
      if (this.data.time <= loan.dueAt) continue;
      if (!loan.lateFeeApplied) {
        loan.lateFeeApplied = true;
        loan.owed = round(loan.owed * (1 + LATE_FEE));
        this.message(BANK_NAME, `⚠️ Tu préstamo ${loan.id} ha vencido. Recargo del ${LATE_FEE * 100} %. Debes ${loan.owed} €. Cada día de retraso suma un ${LATE_DAILY * 100} %.`);
      }
      const dayNow = Math.floor((this.data.time - loan.dueAt) / 1440);
      const dayBefore = Math.floor((prevTime - loan.dueAt) / 1440);
      if (dayNow > dayBefore && dayNow >= 1) {
        loan.owed = round(loan.owed * (1 + LATE_DAILY));
        if (dayNow >= SEIZE_AFTER_DAYS && this.data.bank > 0) {
          const seized = Math.min(this.data.bank, loan.owed);
          this.data.bank = round(this.data.bank - seized);
          loan.owed = round(loan.owed - seized);
          this.move(`Embargo préstamo ${loan.id}`, -seized);
          this.message(BANK_NAME, `🚨 Embargo: te hemos retirado ${seized} € de la cuenta por el préstamo ${loan.id}. Quedan ${loan.owed} €.`);
        }
      }
    }
    this.data.loans = this.data.loans.filter((l) => l.owed > 0.001);
  }

  // --- inventario ---
  addItem(id: string, n = 1) {
    this.data.inventory[id] = (this.data.inventory[id] ?? 0) + n;
    this.changed();
  }

  removeItem(id: string, n = 1) {
    const left = (this.data.inventory[id] ?? 0) - n;
    if (left < 0) return false;
    if (left === 0) delete this.data.inventory[id];
    else this.data.inventory[id] = left;
    this.changed();
    return true;
  }

  // come, bebe o consume; devuelve un mensaje de error si no se puede
  consume(id: string): string | null {
    const item = ITEMS[id];
    if (!item) return 'No existe';
    if (item.heatsInto) return 'Está congelado: caliéntalo en un microondas';
    if (!item.hunger && !item.energy && !item.effect) return 'Esto no se consume';
    if (!this.removeItem(id)) return 'No te queda';
    const d = this.data;
    d.hunger = Math.max(0, Math.min(100, d.hunger + (item.hunger ?? 0)));
    d.energy = Math.max(0, Math.min(100, d.energy + (item.energy ?? 0)));
    if (item.effect) d.effects[item.effect] = d.time + EFFECTS[item.effect].minutes;
    if ((item.hunger ?? 0) >= 30) this.complete('comer');
    this.changed();
    return null;
  }

  mix(a: string, b: string) {
    const recipe = RECIPES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
    if (!recipe) return null;
    if (!this.removeItem(recipe.a)) return null;
    if (!this.removeItem(recipe.b)) {
      this.addItem(recipe.a);
      return null;
    }
    this.addItem(recipe.result);
    return ITEMS[recipe.result];
  }

  activeEffects() {
    return (Object.entries(this.data.effects) as [Effect, number][]).filter(([, until]) => until > this.data.time);
  }

  // --- trabajo ---
  addSale(commission: number) {
    this.data.sales++;
    this.data.pendingCommission = round(this.data.pendingCommission + commission);
    this.complete('venta');
    this.changed();
  }

  collectCommission() {
    const c = this.data.pendingCommission;
    if (c <= 0) return 0;
    this.data.pendingCommission = 0;
    this.income(c, 'Comisiones de ventas · Brokerstars');
    this.complete('comision');
    return c;
  }

  // stock del súper: se repone al empezar cada día
  stockOf(id: string) {
    if (this.data.stockDay !== this.day) {
      this.data.stockDay = this.day;
      this.data.stock = {};
    }
    return this.data.stock[id] ?? (this.data.stock[id] = 4 + ((id.length * 7 + this.day * 3) % 9));
  }

  takeStock(id: string, n = 1) {
    const left = this.stockOf(id) - n;
    if (left < 0) return false;
    this.data.stock[id] = left;
    return true;
  }

  // --- reloj: el tiempo pasa, bajan las necesidades, vencen préstamos ---
  tick(seconds: number) {
    const d = this.data;
    const prev = d.time;
    d.time += seconds * GAME_MINUTES_PER_SECOND;
    const relaxed = (d.effects.relax ?? 0) > d.time;
    d.hunger = Math.max(0, d.hunger - seconds / (relaxed ? 12 : 18));
    d.energy = Math.max(0, d.energy - seconds / 28);
    this.checkLoans(prev);
    for (const fn of this.listeners) fn();
  }

  persist() {
    this.changed();
  }
}
