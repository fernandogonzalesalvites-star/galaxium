import type { Body } from './body';
import type { World } from './world';
import { visualRadius } from './scale';
import { EARTH_MASS, EARTH_RADIUS_AU } from './units';

export type ProjectileType = 'asteroid' | 'small' | 'medium' | 'large';
export const PROJECTILE_TYPES: readonly ProjectileType[] = ['asteroid', 'small', 'medium', 'large'];

export interface ProjectileSpec {
  label: string;
  /** Tamaños posibles y el que se propone (radios terrestres) */
  min: number;
  max: number;
  radius: number;
  color: number;
  /** Densidad relativa a la Tierra (los asteroides son más livianos) */
  density: number;
}

export const PROJECTILE_SPECS: Record<ProjectileType, ProjectileSpec> = {
  asteroid: { label: 'Asteroide', min: 0.02, max: 0.12, radius: 0.06, color: 0x8a7f72, density: 0.5 },
  small: { label: 'Rocoso pequeño', min: 0.12, max: 0.5, radius: 0.3, color: 0xa0522d, density: 0.8 },
  medium: { label: 'Rocoso mediano', min: 0.5, max: 1.2, radius: 0.8, color: 0x7d8c6a, density: 1 },
  large: { label: 'Rocoso grande', min: 1.2, max: 2.5, radius: 1.7, color: 0x9b6b4a, density: 1 },
};

/** Desde cuántos radios (dibujados) del objetivo sale el proyectil */
export const LAUNCH_DISTANCE = 30;

/** Masa (masas solares) de un cuerpo rocoso de ese radio (radios terrestres) y densidad. */
export function rockyMass(radiusEarth: number, density: number): number {
  return radiusEarth ** 3 * density * EARTH_MASS;
}

function nameFor(world: World, base: string): string {
  const names = new Set(world.bodies.map((b) => b.name));
  let n = 1;
  while (names.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/**
 * Lanza un proyectil contra `target`: sale a 30 radios del objetivo, en una
 * dirección al azar del plano de las órbitas, y va directo hacia él a la
 * velocidad justa para chocar en `travelYears` (tiempo simulado).
 */
export function launchProjectile(
  world: World,
  target: Body,
  opts: { type: ProjectileType; radiusEarth: number; color: number; travelYears: number },
  random: () => number = Math.random,
): Body {
  const spec = PROJECTILE_SPECS[opts.type];
  const r = Math.min(spec.max, Math.max(spec.min, opts.radiusEarth));
  const distance = visualRadius(target) * LAUNCH_DISTANCE;
  const angle = random() * Math.PI * 2;
  const ux = Math.cos(angle), uz = Math.sin(angle);
  const speed = distance / opts.travelYears;
  return world.add({
    name: nameFor(world, spec.label),
    kind: 'rocky',
    mass: rockyMass(r, spec.density),
    radius: r * EARTH_RADIUS_AU,
    x: target.x + ux * distance, y: target.y, z: target.z + uz * distance,
    // Con la velocidad del objetivo más la de acercamiento: en el sistema del objetivo va en línea recta
    vx: target.vx - ux * speed, vy: target.vy, vz: target.vz - uz * speed,
    color: opts.color,
    surface: 'craters',
    dayHours: opts.type === 'asteroid' ? 6 : 20,
  });
}
