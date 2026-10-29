// Minijuego de llamadas de venta del puesto de operador. Cada cliente tiene
// dos momentos y en cada uno hay una respuesta buena, una regular y una mala.

export interface CallStep {
  client: string;
  options: { text: string; score: number }[];
}

export interface Call {
  name: string;
  who: string;
  product: string;
  steps: CallStep[];
}

export const CALLS: Call[] = [
  {
    name: 'Doña Carmen', who: 'jubilada, 72 años', product: 'Plan de fibra + móvil',
    steps: [
      { client: '¿Sí? ¿Quién es? No me interesa nada, que siempre llamáis a la hora de comer.', options: [
        { text: 'Perdone la hora, Carmen. Solo un minuto: le puedo bajar la factura a la mitad.', score: 2 },
        { text: 'Le llamo de Brokerstars para ofrecerle nuestros servicios.', score: 1 },
        { text: 'Pues haber cogido el teléfono antes, señora.', score: -2 },
      ] },
      { client: '¿A la mitad? Mi nieto dice que no me fíe de nadie por teléfono…', options: [
        { text: 'Hace bien. Se lo mando por escrito y lo mira con él antes de firmar.', score: 2 },
        { text: 'Confíe en mí, es una oferta única de hoy.', score: 1 },
        { text: 'Su nieto no tiene ni idea.', score: -2 },
      ] },
    ],
  },
  {
    name: 'Iván', who: 'autónomo con prisa', product: 'Software de facturación',
    steps: [
      { client: 'Al grano, que estoy conduciendo.', options: [
        { text: 'Le ahorro 5 horas al mes de facturas por 9 € al mes. ¿Le llamo luego?', score: 2 },
        { text: 'Tenemos el mejor software del mercado.', score: 1 },
        { text: 'Pues pare el coche y escúcheme.', score: -2 },
      ] },
      { client: 'Vale, 9 €… ¿y si no me sirve?', options: [
        { text: 'Primer mes gratis y se da de baja con un clic.', score: 2 },
        { text: 'Le va a servir, se lo garantizo.', score: 1 },
        { text: 'Eso es problema suyo.', score: -2 },
      ] },
    ],
  },
  {
    name: 'Laura', who: 'directora de un gimnasio', product: 'Campaña de anuncios',
    steps: [
      { client: 'Ya tenemos agencia de marketing, gracias.', options: [
        { text: 'Lo entiendo. ¿Le funciona en enero y en septiembre? Ahí es donde marcamos la diferencia.', score: 2 },
        { text: 'Nosotros somos mejores que su agencia.', score: 1 },
        { text: 'Seguro que es una agencia malísima.', score: -2 },
      ] },
      { client: 'Hmm… este septiembre fue flojo, la verdad.', options: [
        { text: 'Le preparo una prueba de dos semanas y comparamos números.', score: 2 },
        { text: 'Firme hoy y le hago descuento.', score: 1 },
        { text: 'Normal, con esa agencia…', score: -1 },
      ] },
    ],
  },
  {
    name: 'Manolo', who: 'dueño de un bar', product: 'Datáfono y TPV',
    steps: [
      { client: '¡Que tengo el bar lleno, macho! ¿Qué quieres?', options: [
        { text: 'Que cobre más rápido con tarjeta y pierda menos mesas. Le llamo a las 5, ¿vale?', score: 2 },
        { text: 'Ofrecerle un datáfono nuevo.', score: 1 },
        { text: 'Nada, nada, ya llamo otro día…', score: -1 },
      ] },
      { client: 'A las 5 bien. ¿Cuánto me cuesta?', options: [
        { text: 'Sin cuota los tres primeros meses, y luego 0,5 % por cobro.', score: 2 },
        { text: 'Muy barato, ya verá.', score: 1 },
        { text: 'Eso se lo digo cuando firme.', score: -2 },
      ] },
    ],
  },
];

export function randomCall() {
  return CALLS[Math.floor(Math.random() * CALLS.length)];
}
