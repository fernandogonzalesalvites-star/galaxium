import type { Body } from '../sim/body';
import type { Vec3 } from '../sim/vec';
import type { World } from '../sim/world';
import type { PlanetPreset } from '../sim/planetTypes';
import {
  centerOfMass, centralMassFor, relativeOrbit, circularSpeed, hillRadius, rocheLimit,
} from '../sim/elements';
import { visualRadius } from '../sim/scale';
import { EARTH_MASS, EARTH_RADIUS_AU, SOLAR_RADIUS_AU } from '../sim/units';
import type { StarSpec } from '../sim/stars';

export interface PlacementCheck {
  ok: boolean;
  warning: string | null;
  /** Radio de la órbita resultante (UA) */
  radius: number;
  /** Centro de la órbita (coordenadas de simulación) */
  center: Vec3;
}

/** No se puede colocar a menos de 3 radios visuales de una estrella */
const MIN_STAR_CLEARANCE = 3;

export function presetRadius(preset: PlanetPreset): number {
  return preset.radiusEarth * EARTH_RADIUS_AU;
}

function presetMass(preset: PlanetPreset): number {
  return preset.massEarth * EARTH_MASS;
}

export function nextName(world: World, prefix: string): string {
  const names = new Set(world.bodies.map((b) => b.name));
  let n = 1;
  while (names.has(`${prefix} ${n}`)) n++;
  return `${prefix} ${n}`;
}

/** Como mucho tantas estrellas en un sistema (más se vuelve un caos ingobernable) */
export const MAX_STARS = 4;

/** Radio dibujado (UA) de una estrella nueva de ese tipo. */
export function starVisualRadius(spec: StarSpec): number {
  return visualRadius({ kind: 'star', radius: spec.radiusSolar * SOLAR_RADIUS_AU });
}

/**
 * ¿Se puede poner aquí una estrella nueva? Orbitará alrededor de las
 * estrellas que ya hay. No puede quedar pegada a otra estrella ni a un planeta;
 * si hay planetas a una distancia parecida, avisa de que pueden salir despedidos.
 */
export function checkStarPlacement(world: World, spec: StarSpec, x: number, z: number): PlacementCheck {
  const stars = world.stars();
  if (stars.length === 0) {
    return { ok: false, warning: 'No hay ninguna estrella', radius: 0, center: { x: 0, y: 0, z: 0 } };
  }
  const c = centerOfMass(stars);
  const center = { x: c.x, y: c.y, z: c.z };
  const radius = Math.hypot(x - c.x, z - c.z);
  const own = starVisualRadius(spec);
  if (stars.some((s) => Math.hypot(x - s.x, z - s.z) < (visualRadius(s) + own) * MIN_STAR_CLEARANCE)) {
    return { ok: false, warning: 'Demasiado cerca de otra estrella', radius, center };
  }
  if (world.bodies.some((b) => b.kind !== 'star' && Math.hypot(x - b.x, z - b.z) < own * MIN_STAR_CLEARANCE + visualRadius(b))) {
    return { ok: false, warning: 'Demasiado cerca de un planeta', radius, center };
  }
  const disturbed = world.bodies.some((b) => {
    if (b.kind === 'star' || b.parentId !== null) return false;
    const r = Math.hypot(b.x - c.x, b.z - c.z);
    return r > radius / 3 && r < radius * 3;
  });
  return { ok: true, warning: disturbed ? 'Los planetas cercanos pueden salir despedidos' : null, radius, center };
}

/** Nombre de la estrella nueva: «Gigante roja», o «Gigante roja 2» si ya hay una. */
function starName(world: World, base: string): string {
  const names = new Set(world.bodies.map((b) => b.name));
  if (!names.has(base)) return base;
  let n = 2;
  while (names.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/**
 * Añade una estrella en órbita circular alrededor de las que ya hay (como un
 * sistema doble). Después hay que llamar a removeNetMomentum para que el
 * conjunto no se desplace.
 */
export function placeStar(world: World, spec: StarSpec, x: number, z: number): Body {
  const c = centerOfMass(world.stars());
  const dx = x - c.x, dz = z - c.z;
  const r = Math.hypot(dx, dz);
  const v = circularSpeed(c.mass, spec.mass, r);
  return world.add({
    name: starName(world, spec.name),
    kind: 'star',
    mass: spec.mass,
    radius: spec.radiusSolar * SOLAR_RADIUS_AU,
    luminosity: spec.luminosity,
    color: spec.color,
    pulsar: spec.pulsar ?? false,
    blackHole: spec.blackHole ?? false,
    x, y: c.y, z,
    vx: c.vx + (v * dz) / r,
    vy: c.vy,
    vz: c.vz - (v * dx) / r,
  });
}

export function checkPlanetPlacement(world: World, x: number, z: number): PlacementCheck {
  const stars = world.stars();
  if (stars.length === 0) {
    return { ok: false, warning: 'No hay ninguna estrella', radius: 0, center: { x: 0, y: 0, z: 0 } };
  }
  const c = centerOfMass(stars);
  const center = { x: c.x, y: c.y, z: c.z };
  const radius = Math.hypot(x - c.x, z - c.z);
  const tooClose = stars.some((s) =>
    Math.hypot(x - s.x, z - s.z) < visualRadius(s) * MIN_STAR_CLEARANCE);
  if (tooClose) {
    return { ok: false, warning: 'Demasiado cerca de la estrella', radius, center };
  }
  if (stars.length >= 2) {
    const [a, b] = stars;
    const separation = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    if (radius < 3 * separation) {
      return { ok: true, warning: 'Zona inestable: demasiado cerca de las dos estrellas', radius, center };
    }
  }
  return { ok: true, warning: null, radius, center };
}

export function placePlanet(world: World, preset: PlanetPreset, x: number, z: number): Body {
  const c = centerOfMass(world.stars());
  const dx = x - c.x, dz = z - c.z;
  const r = Math.hypot(dx, dz);
  const mass = presetMass(preset);
  const v = circularSpeed(c.mass, mass, r);
  return world.add({
    name: nextName(world, 'Planeta'),
    kind: preset.kind,
    mass,
    radius: presetRadius(preset),
    x, y: c.y, z,
    vx: c.vx + (v * dz) / r,
    vy: c.vy,
    vz: c.vz - (v * dx) / r,
    color: preset.color,
    atmosphere: preset.atmosphere,
    water: preset.water,
    surface: preset.surface,
  });
}

/** Distancias mínima y máxima (UA) a las que puede orbitar una luna de ese tipo. */
export function moonBand(world: World, planet: Body, preset: PlanetPreset): { min: number; max: number } {
  return moonBandFor(world, planet, { kind: preset.kind, mass: presetMass(preset), radius: presetRadius(preset) });
}

/** Igual que moonBand, para una luna con la masa y el radio dados. */
export function moonBandFor(
  world: World, planet: Body, moon: Pick<Body, 'kind' | 'mass' | 'radius'>,
): { min: number; max: number } {
  const min = 1.2 * rocheLimit(planet, moon);
  const central = centralMassFor(world, planet);
  if (!central) return { min, max: Infinity };
  const a = relativeOrbit(planet, central).distance;
  return { min, max: 0.5 * hillRadius(a, planet.mass, central.mass) };
}

export function checkMoonPlacement(
  world: World, planet: Body, preset: PlanetPreset, x: number, z: number,
): PlacementCheck {
  const center = { x: planet.x, y: planet.y, z: planet.z };
  const radius = Math.hypot(x - planet.x, z - planet.z);
  const { min, max } = moonBand(world, planet, preset);
  if (min >= max) return { ok: false, warning: 'Este planeta no puede tener lunas de ese tamaño', radius, center };
  if (radius < min) return { ok: false, warning: 'Demasiado cerca: la luna se rompería', radius, center };
  if (radius > max) return { ok: false, warning: 'Demasiado lejos: la luna se escaparía', radius, center };
  return { ok: true, warning: null, radius, center };
}

export function placeMoon(world: World, planet: Body, preset: PlanetPreset, x: number, z: number): Body {
  const dx = x - planet.x, dz = z - planet.z;
  const r = Math.hypot(dx, dz);
  const mass = presetMass(preset);
  const v = circularSpeed(planet.mass, mass, r);
  return world.add({
    name: nextName(world, 'Luna'),
    kind: preset.kind,
    mass,
    radius: presetRadius(preset),
    x, y: planet.y, z,
    vx: planet.vx + (v * dz) / r,
    vy: planet.vy,
    vz: planet.vz - (v * dx) / r,
    parentId: planet.id,
    color: preset.color,
    atmosphere: preset.atmosphere,
    water: preset.water,
    surface: preset.surface,
  });
}
