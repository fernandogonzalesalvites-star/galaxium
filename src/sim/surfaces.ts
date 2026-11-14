import type { BodyKind } from './body';

/** Texturas incluidas en el juego. El color del planeta las tiñe. */
export type SurfaceStyle = 'smooth' | 'rocky' | 'craters' | 'continents' | 'bands' | 'storm' | 'ice';

export const SURFACE_STYLES: readonly SurfaceStyle[] = ['smooth', 'rocky', 'craters', 'continents', 'bands', 'storm', 'ice'];

export const SURFACE_LABELS: Record<SurfaceStyle, string> = {
  smooth: 'Lisa',
  rocky: 'Rocosa',
  craters: 'Cráteres',
  continents: 'Continentes',
  bands: 'Bandas',
  storm: 'Tormenta',
  ice: 'Helada',
};

export function isSurfaceStyle(v: unknown): v is SurfaceStyle {
  return typeof v === 'string' && (SURFACE_STYLES as readonly string[]).includes(v);
}

/** Textura con la que nace un cuerpo según su tipo (para partidas viejas que no la guardaban). */
export function defaultSurface(kind: BodyKind, isMoon: boolean): SurfaceStyle {
  if (kind === 'star') return 'smooth';
  if (kind === 'gas') return 'bands';
  if (kind === 'ice') return 'ice';
  return isMoon ? 'craters' : 'rocky';
}
