import type { Body } from './body';

/** Los planetas y lunas se dibujan 10 veces más grandes de lo real */
export const PLANET_VISUAL_SCALE = 10;
/** Las estrellas se dibujan 5 veces más grandes de lo real */
export const STAR_VISUAL_SCALE = 5;

/** Radio dibujado en UA. También es el radio de choque. */
export function visualRadius(b: Pick<Body, 'kind' | 'radius'>): number {
  // Las galaxias se dibujan a su tamaño real (en kpc)
  if (b.kind === 'galaxy') return b.radius;
  return b.radius * (b.kind === 'star' ? STAR_VISUAL_SCALE : PLANET_VISUAL_SCALE);
}
