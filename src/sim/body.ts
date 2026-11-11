export type BodyKind = 'star' | 'rocky' | 'gas' | 'ice';

export interface Body {
  id: number;
  name: string;
  kind: BodyKind;
  /** Masa en masas solares */
  mass: number;
  /** Radio real en UA */
  radius: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  ax: number; ay: number; az: number;
  /** Posición al empezar el último subpaso (para interpolar el dibujo) */
  px: number; py: number; pz: number;
  /** Planeta alrededor del que orbita (lunas); null para estrellas y planetas */
  parentId: number | null;
  /** Luminosidad en L☉ (solo estrellas; 0 en el resto) */
  luminosity: number;
  /** Color base 0xRRGGBB */
  color: number;
  /** Grosor de atmósfera 0..1 */
  atmosphere: number;
  /** Proporción de agua 0..1 */
  water: number;
}

export interface BodyInit {
  name: string;
  kind: BodyKind;
  mass: number;
  radius: number;
  x?: number; y?: number; z?: number;
  vx?: number; vy?: number; vz?: number;
  parentId?: number | null;
  luminosity?: number;
  color?: number;
  atmosphere?: number;
  water?: number;
}
