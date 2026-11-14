import type { Body } from './body';
import { World } from './world';
import { centerOfMass, circularSpeed } from './elements';

/**
 * Modo galaxias. Se usa el mismo simulador con otra escala, elegida para que la
 * constante G sea la misma (4π²):
 *   1 unidad de distancia = 1 kiloparsec (3.262 años luz)
 *   1 unidad de masa      = 10 000 millones de soles
 *   1 unidad de tiempo    ≈ 29,6 millones de años
 */
export const LY_PER_UNIT = 3261.6;
export const SOLAR_MASSES_PER_UNIT = 1e10;
export const MYR_PER_UNIT = 29.62;
/** Suavizado gravitatorio: las galaxias no son puntos (≈5 kpc) */
export const GALAXY_SOFTENING2 = 25;
export const MAX_GALAXIES = 12;
/** Dos galaxias se fusionan si sus centros se acercan a esta fracción de la suma de sus radios */
const MERGE_FRACTION = 0.3;

export type GalaxyType = 'spiral' | 'barred' | 'elliptical' | 'irregular' | 'dwarf';
export const GALAXY_TYPES: readonly GalaxyType[] = ['spiral', 'barred', 'elliptical', 'irregular', 'dwarf'];

export interface GalaxySpec {
  label: string;
  /** Unidades de 10 000 millones de soles */
  mass: number;
  /** Radio en kpc */
  radius: number;
  color: number;
}

export const GALAXY_SPECS: Record<GalaxyType, GalaxySpec> = {
  spiral: { label: 'Espiral', mass: 100, radius: 25, color: 0xc4d6ff },
  barred: { label: 'Espiral barrada', mass: 80, radius: 22, color: 0xd6dcff },
  elliptical: { label: 'Elíptica gigante', mass: 300, radius: 35, color: 0xffd8a8 },
  irregular: { label: 'Irregular', mass: 5, radius: 8, color: 0xb0ccff },
  dwarf: { label: 'Enana', mass: 0.5, radius: 3, color: 0xe2e6ff },
};

export function isGalaxyType(v: unknown): v is GalaxyType {
  return typeof v === 'string' && (GALAXY_TYPES as readonly string[]).includes(v);
}

export function galaxies(world: World): Body[] {
  return world.bodies.filter((b) => b.kind === 'galaxy');
}

/** Universo inicial: la Vía Láctea con la Gran Nube de Magallanes dando vueltas. */
export function createGalaxyUniverse(): World {
  const w = new World();
  w.softening2 = GALAXY_SOFTENING2;
  const mw = GALAXY_SPECS.spiral;
  w.add({ name: 'Vía Láctea', kind: 'galaxy', galaxyType: 'spiral', mass: mw.mass, radius: mw.radius, color: mw.color });
  placeGalaxy(w, 'irregular', 50, 0, 'Nube de Magallanes');
  w.removeNetMomentum();
  w.snapRenderState();
  return w;
}

function nameFor(world: World, base: string): string {
  const names = new Set(world.bodies.map((b) => b.name));
  if (!names.has(base)) return base;
  let n = 2;
  while (names.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

export interface GalaxyCheck {
  ok: boolean;
  warning: string | null;
  radius: number;
  center: { x: number; y: number; z: number };
}

/** ¿Se puede poner aquí una galaxia nueva? No puede quedar encima de otra. */
export function checkGalaxyPlacement(world: World, type: GalaxyType, x: number, z: number): GalaxyCheck {
  const gs = galaxies(world);
  const c = gs.length ? centerOfMass(gs) : { x: 0, y: 0, z: 0, mass: 0, vx: 0, vy: 0, vz: 0 };
  const center = { x: c.x, y: c.y, z: c.z };
  const radius = Math.hypot(x - c.x, z - c.z);
  const own = GALAXY_SPECS[type].radius;
  if (gs.some((g) => Math.hypot(x - g.x, z - g.z) < (g.radius + own) * 0.8)) {
    return { ok: false, warning: 'Demasiado cerca: quedaría encima de otra galaxia', radius, center };
  }
  const close = gs.some((g) => Math.hypot(x - g.x, z - g.z) < (g.radius + own) * 1.6);
  return { ok: true, warning: close ? 'Muy cerca: pronto chocarán y se fusionarán' : null, radius, center };
}

/** Añade una galaxia en órbita circular alrededor de las que ya hay. */
export function placeGalaxy(world: World, type: GalaxyType, x: number, z: number, name?: string): Body {
  const spec = GALAXY_SPECS[type];
  const gs = galaxies(world);
  const c = gs.length ? centerOfMass(gs) : null;
  let vx = 0, vz = 0, y = 0;
  if (c && c.mass > 0) {
    const dx = x - c.x, dz = z - c.z;
    const r = Math.hypot(dx, dz) || 1;
    const v = circularSpeed(c.mass, spec.mass, r);
    vx = c.vx + (v * dz) / r;
    vz = c.vz - (v * dx) / r;
    y = c.y;
  }
  return world.add({
    name: name ?? nameFor(world, spec.label),
    kind: 'galaxy', galaxyType: type,
    mass: spec.mass, radius: spec.radius, color: spec.color,
    x, y, z, vx, vz,
  });
}

/** Cambia el tipo de una galaxia (masa, tamaño y color de ese tipo). */
export function applyGalaxyType(world: World, g: Body, type: GalaxyType): void {
  const spec = GALAXY_SPECS[type];
  g.galaxyType = type;
  g.mass = spec.mass;
  g.radius = spec.radius;
  g.color = spec.color;
  world.invalidate();
}

function mixColor(a: number, b: number, t: number): number {
  const ch = (c: number, s: number) => (c >> s) & 255;
  const m = (s: number) => Math.round(ch(a, s) * (1 - t) + ch(b, s) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

/**
 * Fusiona las galaxias que se han acercado demasiado: se conservan la masa y el
 * momento. Si eran parecidas, el resultado es una elíptica; si una era mucho
 * mayor, se la «come» y conserva su forma. Devuelve los nombres fusionados.
 */
export function mergeGalaxies(world: World): { into: string; eaten: string }[] {
  const merged: { into: string; eaten: string }[] = [];
  let again = true;
  while (again) {
    again = false;
    const gs = galaxies(world);
    outer: for (let i = 0; i < gs.length; i++) {
      for (let j = i + 1; j < gs.length; j++) {
        const a = gs[i], b = gs[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        if (d > MERGE_FRACTION * (a.radius + b.radius)) continue;
        const [big, small] = a.mass >= b.mass ? [a, b] : [b, a];
        const m = big.mass + small.mass;
        const t = small.mass / m;
        big.x = (big.x * big.mass + small.x * small.mass) / m;
        big.y = (big.y * big.mass + small.y * small.mass) / m;
        big.z = (big.z * big.mass + small.z * small.mass) / m;
        big.vx = (big.vx * big.mass + small.vx * small.mass) / m;
        big.vy = (big.vy * big.mass + small.vy * small.mass) / m;
        big.vz = (big.vz * big.mass + small.vz * small.mass) / m;
        big.px = big.x; big.py = big.y; big.pz = big.z;
        big.mass = m;
        big.radius = Math.cbrt(big.radius ** 3 + small.radius ** 3);
        big.color = mixColor(big.color, small.color, t);
        // Fusión entre iguales (menos de 4 a 1): queda una elíptica
        if (small.mass * 4 > big.mass) big.galaxyType = 'elliptical';
        merged.push({ into: big.name, eaten: small.name });
        world.remove(small.id);
        again = true;
        break outer;
      }
    }
  }
  return merged;
}
