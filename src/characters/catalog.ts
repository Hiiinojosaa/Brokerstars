import type { CharacterConfig } from './types';

// Opciones que muestra el creador. La clave es el valor guardado y
// el texto es lo que ve el jugador.

export const OPTIONS = {
  build: { flaco: 'Flaco', normal: 'Normal', grande: 'Grande' },
  hat: { ninguno: 'Nada', gorra: 'Gorra plana', gorra_atras: 'Gorra hacia atrás', gorro: 'Gorro', pescador: 'Pescador' },
  glasses: { ninguna: 'Nada', oscuras: 'Gafas oscuras', sin_montura: 'Sin montura' },
  top: { camiseta: 'Camiseta oversize', manga_larga: 'Manga larga', sudadera: 'Sudadera', camiseta_sobre_larga: 'Camiseta + manga larga' },
  print: { ninguno: 'Liso', hamsa: 'Hamsa', hand: 'HAND', gh: 'GH', brokerstars: 'Brokerstars', dolar: '$' },
  pants: { anchos: 'Vaqueros anchos', rectos: 'Rectos', jorts: 'Jorts' },
  shoes: { bajas: 'Bajas', botas_altas: 'Botas altas' },
  chain: { ninguna: 'Nada', oro: 'Cadena oro', cubana: 'Cubana', colgante: 'Con colgante' },
  watch: { ninguno: 'Nada', rolex_oro: 'Rolex oro', rolex_plata: 'Rolex plata' },
} as const;

export const COLORS = {
  skin: ['#f1c9a5', '#d9a77e', '#b97f55', '#8d5a3b', '#5e3a26', '#3d2519'],
  hair: ['#111111', '#3b2414', '#6b4423', '#c9a15b', '#d8d8d8'],
  cloth: ['#f2f2f2', '#9a9a9a', '#1c1c1c', '#1d2440', '#7a1f1f', '#3e4a2c', '#c9b48c', '#5a3d6e', '#d9822b', '#2e6f9e'],
  denim: ['#2f4d7a', '#3e5f8f', '#1f2c45', '#6d87ad', '#c9b48c', '#8a8a8a', '#1c1c1c'],
};

export const DEFAULT_CHARACTER: CharacterConfig = {
  name: 'Nuevo broker',
  build: 'normal',
  skin: COLORS.skin[2],
  hair: COLORS.hair[0],
  hat: 'gorra',
  hatColor: '#1c1c1c',
  glasses: 'ninguna',
  top: 'camiseta',
  topColor: '#f2f2f2',
  sleeveColor: '#f2f2f2',
  print: 'brokerstars',
  pants: 'anchos',
  pantsColor: COLORS.denim[0],
  shoes: 'bajas',
  shoesColor: '#f2f2f2',
  chain: 'oro',
  watch: 'ninguno',
};

// Personajes de ejemplo inspirados en las referencias del proyecto.
export const PRESETS: CharacterConfig[] = [
  {
    ...DEFAULT_CHARACTER,
    name: 'Ronin',
    hat: 'ninguno',
    top: 'manga_larga',
    topColor: '#9a9a9a',
    sleeveColor: '#1c1c1c',
    print: 'hand',
    pants: 'jorts',
    pantsColor: '#3e5f8f',
    shoes: 'botas_altas',
    shoesColor: '#1c1c1c',
    chain: 'ninguna',
  },
  {
    ...DEFAULT_CHARACTER,
    name: 'Ojo',
    build: 'grande',
    hat: 'gorra',
    hatColor: '#3e4a2c',
    top: 'sudadera',
    topColor: '#1d2440',
    sleeveColor: '#1d2440',
    print: 'hamsa',
    pants: 'rectos',
    pantsColor: '#1f2c45',
    shoes: 'bajas',
    shoesColor: '#1c1c1c',
    chain: 'ninguna',
  },
  {
    ...DEFAULT_CHARACTER,
    name: 'GH',
    hat: 'ninguno',
    top: 'camiseta_sobre_larga',
    topColor: '#1c1c1c',
    sleeveColor: '#f2f2f2',
    print: 'gh',
    pants: 'anchos',
    pantsColor: '#3e5f8f',
    shoes: 'bajas',
    shoesColor: '#1c1c1c',
    chain: 'ninguna',
  },
  {
    ...DEFAULT_CHARACTER,
    name: 'Fabio',
    skin: COLORS.skin[2],
    hat: 'gorra',
    hatColor: '#1c1c1c',
    glasses: 'sin_montura',
    top: 'camiseta',
    topColor: '#f2f2f2',
    print: 'ninguno',
    pants: 'anchos',
    pantsColor: '#c9b48c',
    shoes: 'bajas',
    shoesColor: '#f2f2f2',
    chain: 'colgante',
    watch: 'rolex_oro',
  },
];
