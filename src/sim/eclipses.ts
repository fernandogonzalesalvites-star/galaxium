import type { Body } from './body';
import type { Vec3 } from './vec';
import { visualRadius } from './scale';

/** Sombra de una luna sobre su planeta (eclipse de sol visto desde el planeta). */
export interface SolarEclipse {
  planetId: number;
  moonId: number;
  /** Dirección (unitaria) desde el centro del planeta hasta donde cae la sombra */
  normal: Vec3;
  /** Radio de la sombra (UA, en la escala del dibujo) */
  radius: number;
}

export interface Eclipses {
  solar: SolarEclipse[];
  /** Lunas dentro de la sombra de su planeta: id → cuánto (0 a 1; 1 = del todo, se pone roja) */
  lunar: Map<number, number>;
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: Vec3) => Math.sqrt(dot(a, a));
const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const unit = (a: Vec3): Vec3 => scale(a, 1 / (len(a) || 1));

/** De dónde viene la luz: centro de las estrellas que alumbran, pesado por su brillo. */
export function lightSource(bodies: readonly Body[]): Vec3 | null {
  let l = 0, x = 0, y = 0, z = 0;
  for (const s of bodies) {
    if (s.kind !== 'star' || s.luminosity <= 0) continue;
    l += s.luminosity;
    x += s.x * s.luminosity; y += s.y * s.luminosity; z += s.z * s.luminosity;
  }
  return l > 0 ? { x: x / l, y: y / l, z: z / l } : null;
}

/**
 * Eclipses entre cada luna y su planeta, con los tamaños del dibujo (los
 * planetas y lunas se ven 10 veces más grandes) y luz paralela desde las estrellas.
 */
export function computeEclipses(bodies: readonly Body[]): Eclipses {
  const result: Eclipses = { solar: [], lunar: new Map() };
  const star = lightSource(bodies);
  if (!star) return result;
  const byId = new Map(bodies.map((b) => [b.id, b]));
  for (const moon of bodies) {
    if (moon.parentId === null) continue;
    const planet = byId.get(moon.parentId);
    if (!planet) continue;
    const rp = visualRadius(planet), rm = visualRadius(moon);

    // Eclipse de luna: la luna detrás del planeta, dentro de su sombra
    const u = unit(sub(planet, star));
    const mp = sub(moon, planet);
    const behind = dot(mp, u);
    if (behind > 0) {
      const off = len(sub(mp, scale(u, behind)));
      const amount = Math.min(1, Math.max(0, (rp + rm - off) / (2 * rm)));
      if (amount > 0) result.lunar.set(moon.id, amount);
    }

    // Eclipse de sol: la luna entre la estrella y el planeta; su sombra cae sobre él
    const v = unit(sub(moon, star));
    const pm = sub(planet, moon);
    const ahead = dot(pm, v);
    if (ahead > 0) {
      const q = sub(scale(v, ahead), pm); // del centro del planeta a la línea de la sombra
      const off = len(q);
      if (off < rp + rm) {
        // Punto de la cara iluminada donde cae el centro de la sombra (o el borde si roza)
        const normal = off < rp
          ? unit(sub(q, scale(v, Math.sqrt(rp * rp - off * off))))
          : unit(q);
        result.solar.push({ planetId: planet.id, moonId: moon.id, normal, radius: rm * 1.15 });
      }
    }
  }
  return result;
}
