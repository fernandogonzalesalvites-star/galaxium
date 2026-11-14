import type { Body } from '../sim/body';
import type { Vec3 } from '../sim/vec';
import type { World } from '../sim/world';
import { centralMassFor, relativeOrbit } from '../sim/elements';
import { EARTH_MASS } from '../sim/units';

/** El agua se congela (K) */
export const T_FREEZE = 273;
/** El agua hierve (K) */
export const T_BOIL = 373;
/** Atmósfera con la que se dibuja la zona habitable (como la terrestre) */
export const REFERENCE_ATMOSPHERE = 0.3;
/** Efecto invernadero máximo (K), con atmósfera 1 */
const GREENHOUSE_MAX_K = 100;
/** Temperatura de equilibrio a 1 UA de una estrella de 1 L☉, con albedo 0,3 */
const T_EQ_1AU = 255;
const MIN_WATER = 0.05;
const MIN_MASS_EARTH = 0.1;
const MAX_MASS_EARTH = 10;
const MAX_ECCENTRICITY = 0.2;

export type Climate = 'cold' | 'temperate' | 'hot';

export interface StarLight extends Vec3 {
  luminosity: number;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Calentamiento por efecto invernadero (K): de 0 a 100 K según la atmósfera. */
export function greenhouse(atmosphere: number): number {
  return GREENHOUSE_MAX_K * Math.pow(clamp01(atmosphere), 0.9);
}

/** Temperatura (K) en un punto, sumando la luz de todas las estrellas. */
export function temperatureAt(stars: readonly StarLight[], pos: Vec3, atmosphere: number): number {
  // 255 · L^¼ / √d = 255 · (L / d²)^¼, así que con varias estrellas se suman los flujos L / d²
  let flux = 0;
  for (const s of stars) {
    const d2 = (pos.x - s.x) ** 2 + (pos.y - s.y) ** 2 + (pos.z - s.z) ** 2;
    if (d2 > 0) flux += s.luminosity / d2;
  }
  return T_EQ_1AU * Math.pow(flux, 0.25) + greenhouse(atmosphere);
}

/** Radios interior y exterior (UA) donde el agua es líquida, para una luminosidad total. */
export function habitableZone(luminosity: number, atmosphere = REFERENCE_ATMOSPHERE): { inner: number; outer: number } {
  const g = greenhouse(atmosphere);
  const base = T_EQ_1AU * Math.pow(Math.max(luminosity, 0), 0.25);
  const at = (t: number) => (t > g ? (base / (t - g)) ** 2 : Infinity);
  return { inner: at(T_BOIL), outer: at(T_FREEZE) };
}

export function climateOf(temperature: number): Climate {
  if (temperature < T_FREEZE) return 'cold';
  if (temperature > T_BOIL) return 'hot';
  return 'temperate';
}

export interface Habitability {
  habitable: boolean;
  /** Motivo por el que no es habitable, o null */
  reason: string | null;
  /** Temperatura actual (K); NaN en estrellas o sin estrellas */
  temperature: number;
}

/** `assumeCircular`: no mira la órbita (para la vista previa del editor, que la deja circular). */
export function evaluateHabitability(world: World, body: Body, options: { assumeCircular?: boolean } = {}): Habitability {
  const stars = world.stars();
  if (body.kind === 'star') return { habitable: false, reason: 'Es una estrella', temperature: NaN };
  if (stars.length === 0) return { habitable: false, reason: 'Sin estrella', temperature: NaN };
  const temperature = temperatureAt(stars, body, body.atmosphere);
  const no = (reason: string): Habitability => ({ habitable: false, reason, temperature });
  if (body.kind !== 'rocky') return no('Gaseoso');
  const massEarth = body.mass / EARTH_MASS;
  if (massEarth < MIN_MASS_EARTH) return no('Muy pequeño');
  if (massEarth > MAX_MASS_EARTH) return no('Muy grande');
  const climate = climateOf(temperature);
  if (climate === 'cold') return no('Demasiado frío');
  if (climate === 'hot') return no('Demasiado caliente');
  if (body.water <= MIN_WATER) return no('Sin agua');
  const central = options.assumeCircular ? null : centralMassFor(world, body);
  if (central) {
    const orbit = relativeOrbit(body, central);
    if (!orbit.bound || orbit.eccentricity >= MAX_ECCENTRICITY) return no('Órbita inestable');
  }
  return { habitable: true, reason: null, temperature };
}
