// Nombres y números que conviene poder cambiar en un solo sitio.
// OJO: antes de publicar el juego, cambia las marcas reales por parodias
// (los bancos, marcas de ropa y relojes reales son marcas registradas).

export const BANK_NAME = 'BBVA SL';
export const SHOP_NAME = 'MegaMart';
export const CASINO_NAME = 'Casino Royale';

// Un día de juego dura 12 minutos reales (1 minuto real = 2 horas de juego).
export const GAME_MINUTES_PER_SECOND = 2;

export const LOAN_OFFERS = [
  { amount: 1000, rate: 0.08, days: 3, label: 'Mini préstamo' },
  { amount: 5000, rate: 0.12, days: 5, label: 'Préstamo personal' },
  { amount: 20000, rate: 0.18, days: 7, label: 'Préstamo emprendedor' },
];
export const MAX_LOANS = 3;
// recargo único al vencer y extra por cada día de retraso
export const LATE_FEE = 0.1;
export const LATE_DAILY = 0.03;
// días de retraso a partir de los que el banco embarga tu saldo
export const SEIZE_AFTER_DAYS = 2;
