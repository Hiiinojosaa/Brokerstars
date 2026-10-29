// Descripción de un personaje. Es JSON plano para poder guardarlo,
// mandarlo por red en el multijugador y cargarlo en cualquier escena.

export type Build = 'flaco' | 'normal' | 'grande';
export type Face = 'normal' | 'concentrado' | 'chulo' | 'feliz' | 'serio' | 'preocupado' | 'sorprendido' | 'enfadado';
export type HairStyle = 'rapado' | 'degradado' | 'rizos' | 'trenzas' | 'pinchos' | 'calvo';
export type FacialHair = 'nada' | 'bigote' | 'perilla' | 'barba';
export type Hat = 'ninguno' | 'gorra' | 'gorra_atras' | 'gorro' | 'pescador' | 'cascos';
export type Glasses = 'ninguna' | 'pasta' | 'oscuras' | 'sin_montura';
export type TopType = 'traje' | 'camiseta' | 'manga_larga' | 'sudadera' | 'camiseta_sobre_larga';
export type Print = 'ninguno' | 'hamsa' | 'hand' | 'gh' | 'brokerstars' | 'dolar' | 'mono';
export type PantsType = 'vestir' | 'anchos' | 'rectos' | 'pitillo' | 'jorts';
export type ShoesType = 'zapatos' | 'bajas' | 'botas_altas';
export type Tie = 'ninguna' | 'negra' | 'granate' | 'azul';
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
  tie: Tie;
}
