// Descripción de un personaje. Es JSON plano para poder guardarlo,
// mandarlo por red en el multijugador y cargarlo en cualquier escena.

export type Build = 'flaco' | 'normal' | 'grande';
export type Face = 'normal' | 'chulo' | 'feliz' | 'serio' | 'enfadado';
export type HairStyle = 'rapado' | 'degradado' | 'rizos' | 'trenzas' | 'pinchos' | 'calvo';
export type FacialHair = 'nada' | 'bigote' | 'perilla' | 'barba';
export type Hat = 'ninguno' | 'gorra' | 'gorra_atras' | 'gorro' | 'pescador' | 'cascos';
export type Glasses = 'ninguna' | 'oscuras' | 'sin_montura';
export type TopType = 'camiseta' | 'manga_larga' | 'sudadera' | 'camiseta_sobre_larga';
export type Print = 'ninguno' | 'hamsa' | 'hand' | 'gh' | 'brokerstars' | 'dolar' | 'mono';
export type PantsType = 'anchos' | 'rectos' | 'pitillo' | 'jorts';
export type ShoesType = 'bajas' | 'botas_altas';
export type Chain = 'ninguna' | 'oro' | 'cubana' | 'colgante';
export type Watch = 'ninguno' | 'rolex_oro' | 'rolex_plata' | 'digital';

export interface CharacterConfig {
  name: string;
  build: Build;
  skin: string;
  hair: string;
  face: Face;
  hairStyle: HairStyle;
  facialHair: FacialHair;
  hat: Hat;
  hatColor: string;
  glasses: Glasses;
  top: TopType;
  topColor: string;
  sleeveColor: string;
  print: Print;
  pants: PantsType;
  pantsColor: string;
  shoes: ShoesType;
  shoesColor: string;
  chain: Chain;
  watch: Watch;
}
