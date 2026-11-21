import type { Body } from './body';
import type { World } from './world';
import type { Vec3 } from './vec';
import { visualRadius } from './scale';

/** Un choque que ya se resolvió (para dibujar el cráter y los fragmentos). */
export interface Impact {
  /** El que queda (el más grande) */
  survivorId: number;
  survivorName: string;
  /** El que se fundió con él */
  eatenId: number;
  eatenName: string;
  /** Dirección (unitaria) desde el centro del que queda hasta el punto del choque */
  normal: Vec3;
  /** Tamaños dibujados (UA) del que chocó y del que queda, tras la fusión */
  impactorRadius: number;
  survivorRadius: number;
  /** Colores de los dos antes del choque (para los fragmentos) */
  colors: [number, number];
}

/** Los planetas, lunas y asteroides chocan; las estrellas y las galaxias no. */
function canCollide(b: Body): boolean {
  return b.kind === 'rocky' || b.kind === 'gas' || b.kind === 'ice';
}

/** Color al azar, ni muy apagado ni muy chillón, para el planeta que resulta del choque. */
export function randomPlanetColor(random: () => number = Math.random): number {
  const h = random(), s = 0.35 + random() * 0.35, l = 0.42 + random() * 0.2;
  // HSL → RGB
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t: number) => {
    t = (t + 1) % 1;
    const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    return Math.round(v * 255);
  };
  return (ch(h + 1 / 3) << 16) | (ch(h) << 8) | ch(h - 1 / 3);
}

/**
 * Busca cuerpos que se tocan (con sus tamaños dibujados) y los fusiona: se
 * conservan la masa y el movimiento, el grande crece y toma un color al azar.
 * Las lunas del que desaparece pasan a girar alrededor del que queda.
 */
export function mergeCollisions(world: World, random: () => number = Math.random): Impact[] {
  const impacts: Impact[] = [];
  let again = true;
  while (again) {
    again = false;
    const bs = world.bodies.filter(canCollide);
    outer: for (let i = 0; i < bs.length; i++) {
      for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i], b = bs[j];
        const ra = visualRadius(a), rb = visualRadius(b);
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d >= ra + rb) continue;
        const [big, small] = a.mass >= b.mass ? [a, b] : [b, a];
        const sign = big === a ? 1 : -1;
        const n = d > 0 ? { x: (sign * dx) / d, y: (sign * dy) / d, z: (sign * dz) / d } : { x: 1, y: 0, z: 0 };
        const colors: [number, number] = [big.color, small.color];
        const m = big.mass + small.mass;
        big.x = (big.x * big.mass + small.x * small.mass) / m;
        big.y = (big.y * big.mass + small.y * small.mass) / m;
        big.z = (big.z * big.mass + small.z * small.mass) / m;
        big.vx = (big.vx * big.mass + small.vx * small.mass) / m;
        big.vy = (big.vy * big.mass + small.vy * small.mass) / m;
        big.vz = (big.vz * big.mass + small.vz * small.mass) / m;
        big.px = big.x; big.py = big.y; big.pz = big.z;
        big.mass = m;
        big.radius = Math.cbrt(big.radius ** 3 + small.radius ** 3);
        big.color = randomPlanetColor(random);
        // Una imagen propia taparía el color nuevo: vuelve a su textura incluida
        big.texture = null;
        for (const o of world.bodies) if (o.parentId === small.id) o.parentId = big.id === o.id ? null : big.id;
        if (big.parentId === small.id) big.parentId = null;
        impacts.push({
          survivorId: big.id, survivorName: big.name, eatenId: small.id, eatenName: small.name,
          normal: n, impactorRadius: visualRadius(small), survivorRadius: visualRadius(big), colors,
        });
        world.remove(small.id);
        again = true;
        break outer;
      }
    }
  }
  return impacts;
}
