import type { Body } from './body';
import type { Vec3 } from './vec';
import type { World } from './world';
import { G } from './units';
import { visualRadius } from './scale';

export interface MassPoint extends Vec3 {
  mass: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface OrbitInfo {
  /** Distancia actual al centro (UA) */
  distance: number;
  /** Velocidad relativa (UA/año) */
  speed: number;
  /** Semieje mayor (UA); Infinity si no está ligada */
  semiMajorAxis: number;
  eccentricity: number;
  /** Periodo (años); Infinity si no está ligada */
  period: number;
  bound: boolean;
}

export function centerOfMass(points: readonly MassPoint[]): MassPoint {
  let m = 0, x = 0, y = 0, z = 0, vx = 0, vy = 0, vz = 0;
  for (const p of points) {
    m += p.mass;
    x += p.mass * p.x; y += p.mass * p.y; z += p.mass * p.z;
    vx += p.mass * p.vx; vy += p.mass * p.vy; vz += p.mass * p.vz;
  }
  if (m === 0) return { mass: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
  return { mass: m, x: x / m, y: y / m, z: z / m, vx: vx / m, vy: vy / m, vz: vz / m };
}

/** Cuerpo o centro de masas alrededor del que orbita `body`. */
export function centralMassFor(world: World, body: Body): MassPoint | null {
  if (body.parentId !== null) {
    const parent = world.get(body.parentId);
    if (parent) return parent;
  }
  const stars = world.stars().filter((s) => s.id !== body.id);
  if (stars.length === 0) return null;
  return centerOfMass(stars);
}

export function relativeOrbit(body: MassPoint, central: MassPoint): OrbitInfo {
  const rx = body.x - central.x, ry = body.y - central.y, rz = body.z - central.z;
  const vx = body.vx - central.vx, vy = body.vy - central.vy, vz = body.vz - central.vz;
  const r = Math.hypot(rx, ry, rz);
  const v2 = vx * vx + vy * vy + vz * vz;
  const mu = G * (central.mass + body.mass);
  const energy = v2 / 2 - mu / r;
  const rv = rx * vx + ry * vy + rz * vz;
  const k = v2 - mu / r;
  const ex = (k * rx - rv * vx) / mu;
  const ey = (k * ry - rv * vy) / mu;
  const ez = (k * rz - rv * vz) / mu;
  const bound = energy < 0;
  const a = bound ? -mu / (2 * energy) : Infinity;
  return {
    distance: r,
    speed: Math.sqrt(v2),
    semiMajorAxis: a,
    eccentricity: Math.hypot(ex, ey, ez),
    period: bound ? 2 * Math.PI * Math.sqrt((a * a * a) / mu) : Infinity,
    bound,
  };
}

export function circularSpeed(centralMass: number, bodyMass: number, r: number): number {
  return Math.sqrt((G * (centralMass + bodyMass)) / r);
}

/** Radio de Hill: zona donde domina la gravedad de un cuerpo de masa m que orbita a M a distancia a. */
export function hillRadius(a: number, m: number, M: number): number {
  return a * Math.cbrt(m / (3 * M));
}

/** Límite de Roche (UA) usando radios visuales. */
export function rocheLimit(
  planet: Pick<Body, 'kind' | 'mass' | 'radius'>,
  moon: Pick<Body, 'kind' | 'mass' | 'radius'>,
): number {
  const rp = visualRadius(planet);
  const rm = visualRadius(moon);
  const densityRatio = (planet.mass / (rp * rp * rp)) / (moon.mass / (rm * rm * rm));
  return 2.44 * rp * Math.cbrt(densityRatio);
}
