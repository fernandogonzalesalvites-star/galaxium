import type { Body, Ring } from '../sim/body';
import type { World } from '../sim/world';
import { centerOfMass, centralMassFor, circularSpeed } from '../sim/elements';
import { visualRadius } from '../sim/scale';
import { EARTH_MASS, EARTH_RADIUS_AU, SOLAR_RADIUS_AU } from '../sim/units';
import { SINGLE_STARS, type StarType } from '../sim/stars';
import { evaluateHabitability, habitableZone, type Habitability } from '../life/habitability';
import { moonBandFor } from './placement';

export type SingleStarType = Exclude<StarType, 'binary'>;
export const SINGLE_STAR_TYPES: SingleStarType[] = ['redDwarf', 'sunLike', 'blueGiant'];

export interface Range {
  min: number;
  max: number;
}

/** Valores del editor para un planeta o una luna. */
export interface BodyEdit {
  name: string;
  /** Masas terrestres */
  massEarth: number;
  /** Radios terrestres */
  radiusEarth: number;
  /** Distancia a su estrella (planeta) o a su planeta (luna), en UA */
  distance: number;
  atmosphere: number;
  water: number;
  color: number;
  /** Anillos (solo planetas; null = sin anillos) */
  ring: Ring | null;
  /** Imagen de la superficie como data URL (null = color liso) */
  texture: string | null;
}

/** Límites de los anillos: radio exterior (en radios del planeta) e inclinación (grados). */
export const RING_OUTER: Range = { min: 1.6, max: 3.5 };
export const RING_TILT: Range = { min: 0, max: 60 };
/** Radio interior de los anillos, en radios del planeta */
export const RING_INNER = 1.25;

/** Anillos con los que empieza un planeta al activarlos. */
export function defaultRing(body: Pick<Body, 'kind'>): Ring {
  return body.kind === 'ice'
    ? { color: 0x9fb8c8, outer: 2, tilt: 25 }
    : { color: 0xd9c7a0, outer: 2.4, tilt: 20 };
}

/** Puede tener anillos: planetas (no estrellas ni lunas). */
export function canHaveRing(body: Pick<Body, 'kind' | 'parentId'>): boolean {
  return body.kind !== 'star' && body.parentId === null;
}

export interface EditRanges {
  mass: Range;
  radius: Range;
  distance: Range;
}

/** No se puede acercar a menos de 3 radios visuales de una estrella */
const MIN_STAR_CLEARANCE = 3;

function clamp(v: number, r: Range): number {
  return Math.min(r.max, Math.max(r.min, v));
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Amplía el rango para que incluya el valor actual. */
function including(r: Range, value: number): Range {
  return { min: Math.min(r.min, value), max: Math.max(r.max, value) };
}

export function isMoon(body: Body): boolean {
  return body.parentId !== null;
}

export function editValues(world: World, body: Body): BodyEdit {
  return {
    name: body.name,
    massEarth: body.mass / EARTH_MASS,
    radiusEarth: body.radius / EARTH_RADIUS_AU,
    distance: distanceOf(world, body),
    atmosphere: body.atmosphere,
    water: body.water,
    color: body.color,
    ring: body.ring ? { ...body.ring } : null,
    texture: body.texture,
  };
}

/** Distancia actual a su centro (estrellas o planeta), en UA. */
export function distanceOf(world: World, body: Body): number {
  const c = centralMassFor(world, body);
  if (!c) return 0;
  return Math.hypot(body.x - c.x, body.y - c.y, body.z - c.z);
}

/** Límite a partir del que un cuerpo sale despedido del sistema (UA). */
export function escapeDistance(world: World): number {
  let luminosity = 0;
  for (const s of world.stars()) luminosity += s.luminosity;
  return Math.max(50, 10 * habitableZone(luminosity).outer);
}

/** Rangos permitidos en el editor para la masa, el radio y la distancia. */
export function editRanges(world: World, body: Body, massEarth?: number, radiusEarth?: number): EditRanges {
  const values = editValues(world, body);
  const mass = massEarth ?? values.massEarth;
  const radius = radiusEarth ?? values.radiusEarth;
  const moon = isMoon(body);
  const massRange: Range =
    body.kind === 'gas' ? { min: 10, max: 4000 }
      : body.kind === 'ice' ? { min: 2, max: 100 }
        : moon ? { min: 0.0005, max: 2 } : { min: 0.01, max: 20 };
  const radiusRange: Range =
    body.kind === 'gas' ? { min: 3, max: 25 }
      : body.kind === 'ice' ? { min: 1.5, max: 8 }
        : { min: 0.05, max: 3 };
  let distance: Range;
  if (moon) {
    const parent = world.get(body.parentId!)!;
    distance = moonBandFor(world, parent, { kind: body.kind, mass: mass * EARTH_MASS, radius: radius * EARTH_RADIUS_AU });
  } else {
    const stars = world.stars();
    const c = centerOfMass(stars);
    let min = 0;
    for (const s of stars) {
      min = Math.max(min, Math.hypot(s.x - c.x, s.y - c.y, s.z - c.z) + visualRadius(s) * MIN_STAR_CLEARANCE);
    }
    distance = { min: min * 1.05, max: escapeDistance(world) * 0.9 };
  }
  return {
    mass: including(massRange, values.massEarth),
    radius: including(radiusRange, values.radiusEarth),
    distance: Number.isFinite(distance.max) && distance.min < distance.max ? distance : { min: values.distance, max: values.distance },
  };
}

/** Posición y velocidad de una órbita circular a distancia r, en el mismo ángulo que ahora. */
function circularStateAt(world: World, body: Body, r: number) {
  const c = centralMassFor(world, body);
  if (!c) return null;
  let dx = body.x - c.x, dz = body.z - c.z;
  let len = Math.hypot(dx, dz);
  if (len === 0) { dx = 1; dz = 0; len = 1; }
  const ux = dx / len, uz = dz / len;
  const v = circularSpeed(c.mass, body.mass, r);
  return {
    x: c.x + ux * r, y: c.y, z: c.z + uz * r,
    vx: c.vx + v * uz, vy: c.vy, vz: c.vz - v * ux,
  };
}

/** Recoloca el cuerpo en órbita circular a distancia r. Sus lunas lo acompañan. */
export function moveToDistance(world: World, body: Body, r: number): void {
  const s = circularStateAt(world, body, r);
  if (!s) return;
  const dx = s.x - body.x, dy = s.y - body.y, dz = s.z - body.z;
  const dvx = s.vx - body.vx, dvy = s.vy - body.vy, dvz = s.vz - body.vz;
  for (const b of world.bodies) {
    if (b !== body && b.parentId !== body.id) continue;
    b.x += dx; b.y += dy; b.z += dz;
    b.vx += dvx; b.vy += dvy; b.vz += dvz;
  }
  world.invalidate();
}

/**
 * Aplica los cambios del editor a un planeta o una luna.
 * La masa nueva conserva la velocidad; la distancia nueva lo recoloca en órbita circular.
 * Devuelve true si hubo que ajustar la distancia al rango permitido.
 */
export function applyBodyEdit(world: World, body: Body, edit: BodyEdit): boolean {
  const before = distanceOf(world, body);
  body.name = edit.name.trim() || body.name;
  body.mass = edit.massEarth * EARTH_MASS;
  body.radius = edit.radiusEarth * EARTH_RADIUS_AU;
  body.atmosphere = clamp01(edit.atmosphere);
  body.water = body.kind === 'rocky' ? clamp01(edit.water) : 0;
  body.color = edit.color;
  body.ring = edit.ring && canHaveRing(body)
    ? { color: edit.ring.color, outer: clamp(edit.ring.outer, RING_OUTER), tilt: clamp(edit.ring.tilt, RING_TILT) }
    : null;
  body.texture = edit.texture;
  world.invalidate();
  if (Math.abs(edit.distance - before) <= before * 1e-6) return false;
  const range = editRanges(world, body).distance;
  const distance = clamp(edit.distance, range);
  moveToDistance(world, body, distance);
  return distance !== edit.distance;
}

/** Cambia el tipo de una estrella. Los planetas conservan su velocidad. */
export function applyStarType(world: World, star: Body, type: SingleStarType, name: string): void {
  const oldDefault = Object.values(SINGLE_STARS).some((s) => s.name === star.name);
  const spec = SINGLE_STARS[type];
  star.mass = spec.mass;
  star.luminosity = spec.luminosity;
  star.radius = spec.radiusSolar * SOLAR_RADIUS_AU;
  star.color = spec.color;
  const trimmed = name.trim();
  star.name = oldDefault && (trimmed === '' || trimmed === star.name) ? spec.name : trimmed || star.name;
  world.invalidate();
}

/** Tipo de estrella más parecido a una estrella dada (por luminosidad). */
export function starTypeOf(star: Body): SingleStarType | null {
  return SINGLE_STAR_TYPES.find((t) => SINGLE_STARS[t].luminosity === star.luminosity) ?? null;
}

/** Habitabilidad que tendría el cuerpo con esos valores, en órbita circular. */
export function previewHabitability(world: World, body: Body, edit: BodyEdit): Habitability {
  const s = circularStateAt(world, body, edit.distance) ?? body;
  const candidate: Body = {
    ...body,
    x: s.x, y: s.y, z: s.z,
    mass: edit.massEarth * EARTH_MASS,
    atmosphere: clamp01(edit.atmosphere),
    water: body.kind === 'rocky' ? clamp01(edit.water) : 0,
  };
  return evaluateHabitability(world, candidate, { assumeCircular: true });
}

/** Zona habitable del sistema si una estrella pasara a ser de ese tipo. */
export function previewZone(world: World, star: Body, type: SingleStarType): { inner: number; outer: number } {
  let luminosity = SINGLE_STARS[type].luminosity;
  for (const s of world.stars()) if (s.id !== star.id) luminosity += s.luminosity;
  return habitableZone(luminosity);
}

export function deleteBody(world: World, id: number): void {
  world.remove(id);
  world.removeNetMomentum();
}
