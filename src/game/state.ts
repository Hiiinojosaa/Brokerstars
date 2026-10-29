// Estado de la partida: dinero, inventario, necesidades y objetivos.
// Se guarda en el navegador; cuando haya multijugador lo llevará el servidor.

export interface Item {
  id: string;
  name: string;
  icon: string;
  price: number;
  where: 'shop' | 'fridge';
  hunger: number;
  energy: number;
  // si hay que calentarlo antes, en qué se convierte
  heatsInto?: string;
}

export const ITEMS: Record<string, Item> = {
  lasana: { id: 'lasana', name: 'Lasaña congelada', icon: '🧊', price: 4.5, where: 'shop', hunger: 0, energy: 0, heatsInto: 'lasana_caliente' },
  lasana_caliente: { id: 'lasana_caliente', name: 'Lasaña caliente', icon: '🍝', price: 0, where: 'shop', hunger: 45, energy: 5 },
  burrito: { id: 'burrito', name: 'Burrito congelado', icon: '🧊', price: 3, where: 'shop', hunger: 0, energy: 0, heatsInto: 'burrito_caliente' },
  burrito_caliente: { id: 'burrito_caliente', name: 'Burrito caliente', icon: '🌯', price: 0, where: 'shop', hunger: 35, energy: 0 },
  patatas: { id: 'patatas', name: 'Patatas fritas', icon: '🥔', price: 1.8, where: 'shop', hunger: 12, energy: 0 },
  sandwich: { id: 'sandwich', name: 'Sándwich de máquina', icon: '🥪', price: 2.5, where: 'shop', hunger: 22, energy: 0 },
  sprunk: { id: 'sprunk', name: 'Sprunk (lima-limón)', icon: '🥤', price: 1.2, where: 'fridge', hunger: 3, energy: 10 },
  exotica: { id: 'exotica', name: 'Refresco exótico importado', icon: '🧃', price: 3.5, where: 'fridge', hunger: 4, energy: 14 },
  energetica: { id: 'energetica', name: 'Bebida energética', icon: '⚡', price: 2.2, where: 'fridge', hunger: 0, energy: 30 },
  cafe_lata: { id: 'cafe_lata', name: 'Café en lata', icon: '☕', price: 1.5, where: 'fridge', hunger: 0, energy: 20 },
};

export type ObjectiveId = 'cuenta' | 'sacar' | 'comprar' | 'subir' | 'venta' | 'comer';

export const OBJECTIVES: { id: ObjectiveId; text: string }[] = [
  { id: 'cuenta', text: 'Abre tu cuenta en el Banco Estrella' },
  { id: 'sacar', text: 'Saca efectivo en un cajero' },
  { id: 'comprar', text: 'Compra comida en el MegaMart' },
  { id: 'subir', text: 'Sube a la Planta 1 en el ascensor' },
  { id: 'venta', text: 'Siéntate en un puesto libre y cierra una venta' },
  { id: 'comer', text: 'Calienta la comida en el microondas y come' },
];

interface SaveData {
  version: 1;
  hasAccount: boolean;
  bank: number;
  cash: number;
  inventory: Record<string, number>;
  hunger: number;
  energy: number;
  sales: number;
  done: Partial<Record<ObjectiveId, boolean>>;
}

const KEY = 'brokerstars.partida';

function fresh(): SaveData {
  return { version: 1, hasAccount: false, bank: 0, cash: 20, inventory: {}, hunger: 70, energy: 80, sales: 0, done: {} };
}

export class GameState {
  data: SaveData;
  private listeners: (() => void)[] = [];

  constructor() {
    this.data = fresh();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...fresh(), ...JSON.parse(raw) };
    } catch {
      // sin almacenamiento: partida nueva
    }
  }

  onChange(fn: () => void) {
    this.listeners.push(fn);
  }

  private changed() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // no se pudo guardar; se juega igual
    }
    for (const fn of this.listeners) fn();
  }

  reset() {
    this.data = fresh();
    this.changed();
  }

  complete(id: ObjectiveId) {
    if (this.data.done[id]) return false;
    this.data.done[id] = true;
    this.changed();
    return true;
  }

  openAccount() {
    this.data.hasAccount = true;
    this.data.bank += 500;
    this.complete('cuenta');
    this.changed();
  }

  // pasa dinero del banco al bolsillo (positivo) o al revés (negativo)
  withdraw(amount: number) {
    if (amount > 0 && this.data.bank < amount) return false;
    if (amount < 0 && this.data.cash < -amount) return false;
    this.data.bank -= amount;
    this.data.cash += amount;
    this.changed();
    return true;
  }

  pay(amount: number) {
    if (this.data.cash < amount) return false;
    this.data.cash = Math.round((this.data.cash - amount) * 100) / 100;
    this.changed();
    return true;
  }

  depositToBank(amount: number) {
    this.data.bank = Math.round((this.data.bank + amount) * 100) / 100;
    this.changed();
  }

  addItem(id: string, n = 1) {
    this.data.inventory[id] = (this.data.inventory[id] ?? 0) + n;
    this.changed();
  }

  removeItem(id: string) {
    const left = (this.data.inventory[id] ?? 0) - 1;
    if (left < 0) return false;
    if (left === 0) delete this.data.inventory[id];
    else this.data.inventory[id] = left;
    this.changed();
    return true;
  }

  // come o bebe; devuelve un mensaje si no se puede
  consume(id: string): string | null {
    const item = ITEMS[id];
    if (!item) return 'No existe';
    if (item.heatsInto) return 'Está congelado: caliéntalo en un microondas';
    if (!this.removeItem(id)) return 'No te queda';
    this.data.hunger = Math.min(100, this.data.hunger + item.hunger);
    this.data.energy = Math.min(100, this.data.energy + item.energy);
    if (item.hunger >= 30) this.complete('comer');
    this.changed();
    return null;
  }

  // hambre y energía bajan poco a poco
  tick(dt: number) {
    const d = this.data;
    d.hunger = Math.max(0, d.hunger - dt / 18);
    d.energy = Math.max(0, d.energy - dt / 28);
    for (const fn of this.listeners) fn();
  }

  // guarda de vez en cuando aunque solo cambien las necesidades
  persist() {
    this.changed();
  }
}
