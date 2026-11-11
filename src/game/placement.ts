import type { Body } from '../sim/body';
import type { Vec3 } from '../sim/vec';
import type { World } from '../sim/world';
import type { PlanetPreset } from '../sim/planetTypes';
import {
  centerOfMass, centralMassFor, relativeOrbit, circularSpeed, hillRadius, rocheLimit,
} from '../sim/elements';
import { visualRadius } from '../sim/scale';
import { EARTH_MASS, EARTH_RADIUS_AU } from '../sim/units';

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
  });
}

/** Distancias mínima y máxima (UA) a las que puede orbitar una luna de ese tipo. */
export function moonBand(world: World, planet: Body, preset: PlanetPreset): { min: number; max: number } {
  const moon = { kind: preset.kind, mass: presetMass(preset), radius: presetRadius(preset) };
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
  });
}
