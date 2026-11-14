import type { Body, BodyKind } from '../sim/body';
import { World } from '../sim/world';

export const SAVE_VERSION = 1;

/** Lo que se guarda de cada cuerpo: todo menos lo que se recalcula al cargar. */
export type SavedBody = Omit<Body, 'ax' | 'ay' | 'az' | 'px' | 'py' | 'pz'>;

/** Una partida guardada. Es JSON puro: se puede guardar tal cual en IndexedDB. */
export interface SaveData {
  version: number;
  /** Nombre que le dio el jugador */
  name: string;
  /** Nombre del sistema que se muestra arriba («Tipo Sol», «Sistema doble»…) */
  systemName: string;
  /** Fecha de guardado (ms desde 1970) */
  savedAt: number;
  /** Tiempo simulado en años */
  time: number;
  speedIndex: number;
  bodies: SavedBody[];
}

const KINDS: readonly BodyKind[] = ['star', 'rocky', 'gas', 'ice'];

export function snapshot(world: World, meta: { name: string; systemName: string; speedIndex: number; savedAt?: number }): SaveData {
  return {
    version: SAVE_VERSION,
    name: meta.name,
    systemName: meta.systemName,
    savedAt: meta.savedAt ?? Date.now(),
    time: world.time,
    speedIndex: meta.speedIndex,
    bodies: world.bodies.map((b) => ({
      id: b.id, name: b.name, kind: b.kind, mass: b.mass, radius: b.radius,
      x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz,
      parentId: b.parentId, luminosity: b.luminosity, color: b.color,
      atmosphere: b.atmosphere, water: b.water,
      ring: b.ring ? { ...b.ring } : null,
      texture: b.texture,
    })),
  };
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Comprueba que los datos tienen forma de partida válida. */
export function isValidSave(data: unknown): data is SaveData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Partial<SaveData>;
  if (d.version !== SAVE_VERSION || !finite(d.time) || !Array.isArray(d.bodies)) return false;
  const ids = new Set<number>();
  for (const b of d.bodies) {
    if (!b || !finite(b.id) || ids.has(b.id) || !KINDS.includes(b.kind)) return false;
    if (![b.mass, b.radius, b.x, b.y, b.z, b.vx, b.vy, b.vz].every(finite)) return false;
    ids.add(b.id);
  }
  return d.bodies.every((b) => b.parentId === null || ids.has(b.parentId));
}

/** Vuelve a montar el mundo de una partida guardada. */
export function restoreWorld(data: SaveData): World {
  if (!isValidSave(data)) throw new Error('La partida guardada está dañada o es de otra versión');
  const world = new World();
  world.load(
    data.bodies.map((b) => ({
      ...b,
      ring: b.ring ? { ...b.ring } : null,
      texture: b.texture ?? null,
      ax: 0, ay: 0, az: 0,
      px: b.x, py: b.y, pz: b.z,
    })),
    data.time,
  );
  return world;
}
