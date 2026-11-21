import type { Body } from '../sim/body';

/** La vegetación solo crece en cuerpos rocosos (planetas y lunas), nunca en gigantes de gas o hielo. */
export function canGrowVegetation(body: Pick<Body, 'kind'>): boolean {
  return body.kind === 'rocky';
}

/**
 * Hace crecer vegetación al azar: cada vez un dibujo distinto.
 * Devuelve false si el cuerpo no es rocoso (y no le cambia nada).
 */
export function growVegetation(body: Body, random: () => number = Math.random): boolean {
  if (!canGrowVegetation(body)) return false;
  let seed = 0;
  // Semilla distinta de 0 (0 = sin vegetación) y distinta de la que ya tenía
  while (seed === 0 || seed === body.vegetation) seed = 1 + Math.floor(random() * 2_000_000_000);
  body.vegetation = seed;
  return true;
}

export function removeVegetation(body: Body): void {
  body.vegetation = 0;
}

/** Las nubes necesitan atmósfera (planetas y lunas con algo de aire). */
export function canHaveClouds(body: Pick<Body, 'kind' | 'atmosphere'>): boolean {
  return body.kind !== 'star' && body.kind !== 'galaxy' && body.atmosphere > 0;
}

/**
 * Añade nubes al azar: cada vez un cielo distinto.
 * Devuelve false si el cuerpo no tiene atmósfera (y no le cambia nada).
 */
export function addClouds(body: Body, random: () => number = Math.random): boolean {
  if (!canHaveClouds(body)) return false;
  let seed = 0;
  while (seed === 0 || seed === body.clouds) seed = 1 + Math.floor(random() * 2_000_000_000);
  body.clouds = seed;
  return true;
}

export function removeClouds(body: Body): void {
  body.clouds = 0;
}
