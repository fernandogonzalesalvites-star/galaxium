import type { SurfaceStyle } from './surfaces';

import type { GalaxyType } from './galaxies';

export type BodyKind = 'star' | 'rocky' | 'gas' | 'ice' | 'galaxy';

/** Anillos de un planeta (solo se dibujan; no afectan a la simulación). */
export interface Ring {
  /** Color 0xRRGGBB */
  color: number;
  /** Radio exterior, en radios del planeta */
  outer: number;
  /** Inclinación respecto al plano de la órbita, en grados */
  tilt: number;
}

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
  /** Anillos (null si no tiene) */
  ring: Ring | null;
  /** Imagen de la superficie como data URL (null = usa la textura incluida `surface`) */
  texture: string | null;
  /** Textura incluida, teñida con `color` */
  surface: SurfaceStyle;
  /** Solo estrellas: es un púlsar (se dibuja con haces girando) */
  pulsar: boolean;
  /** Solo «estrellas»: es un agujero negro (no da luz; se dibuja con su disco) */
  blackHole: boolean;
  /** Solo en el modo galaxias: forma de la galaxia */
  galaxyType: GalaxyType | null;
  /** Vegetación de un cuerpo rocoso: 0 = no tiene; otro número = semilla del dibujo al azar */
  vegetation: number;
  /** Duración del día en horas (planetas y lunas; 0 = no gira). En pantalla, 1 hora = 1 segundo */
  dayHours: number;
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
  ring?: Ring | null;
  texture?: string | null;
  surface?: SurfaceStyle;
  pulsar?: boolean;
  blackHole?: boolean;
  galaxyType?: GalaxyType | null;
  vegetation?: number;
  dayHours?: number;
}
