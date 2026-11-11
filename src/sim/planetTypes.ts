import type { BodyKind } from './body';

export type PlanetType = 'smallRocky' | 'earthLike' | 'superEarth' | 'gasGiant' | 'iceGiant' | 'moon';

export interface PlanetPreset {
  label: string;
  kind: BodyKind;
  /** Masa en masas terrestres */
  massEarth: number;
  /** Radio en radios terrestres */
  radiusEarth: number;
  color: number;
  atmosphere: number;
  water: number;
  isMoon: boolean;
}

export const PLANET_PRESETS: Record<PlanetType, PlanetPreset> = {
  smallRocky: { label: 'Rocoso pequeño', kind: 'rocky', massEarth: 0.1, radiusEarth: 0.53, color: 0xb5651d, atmosphere: 0.05, water: 0, isMoon: false },
  earthLike: { label: 'Tipo Tierra', kind: 'rocky', massEarth: 1, radiusEarth: 1, color: 0x2e6fd8, atmosphere: 0.3, water: 0.7, isMoon: false },
  superEarth: { label: 'Supertierra', kind: 'rocky', massEarth: 5, radiusEarth: 1.6, color: 0x7f9a65, atmosphere: 0.5, water: 0.4, isMoon: false },
  gasGiant: { label: 'Gigante gaseoso', kind: 'gas', massEarth: 318, radiusEarth: 11.2, color: 0xd8b384, atmosphere: 1, water: 0, isMoon: false },
  iceGiant: { label: 'Gigante helado', kind: 'ice', massEarth: 17, radiusEarth: 3.9, color: 0x7fd3e6, atmosphere: 1, water: 0, isMoon: false },
  moon: { label: 'Luna', kind: 'rocky', massEarth: 0.0123, radiusEarth: 0.273, color: 0xbfbfbf, atmosphere: 0, water: 0, isMoon: true },
};

export const PLANET_TYPES: PlanetType[] = ['smallRocky', 'earthLike', 'superEarth', 'gasGiant', 'iceGiant', 'moon'];
