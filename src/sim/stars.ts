import { World } from './world';
import { G, SOLAR_RADIUS_AU } from './units';

export type StarType = 'redDwarf' | 'sunLike' | 'blueGiant' | 'binary';

export interface StarSpec {
  name: string;
  /** M☉ */
  mass: number;
  /** L☉ */
  luminosity: number;
  /** Radio en radios solares */
  radiusSolar: number;
  color: number;
}

export const SINGLE_STARS: Record<Exclude<StarType, 'binary'>, StarSpec> = {
  redDwarf: { name: 'Enana roja', mass: 0.3, luminosity: 0.012, radiusSolar: 0.3, color: 0xff7a45 },
  sunLike: { name: 'Sol', mass: 1, luminosity: 1, radiusSolar: 1, color: 0xfff1c4 },
  blueGiant: { name: 'Gigante azul', mass: 10, luminosity: 5000, radiusSolar: 6, color: 0xa9c8ff },
};

export const BINARY_STAR: StarSpec & { separation: number } = {
  name: 'Estrella',
  mass: 0.8,
  luminosity: 0.45,
  radiusSolar: 0.8,
  color: 0xffe2a0,
  separation: 0.2,
};

export const STAR_CHOICES: { type: StarType; label: string; description: string; color: number }[] = [
  { type: 'redDwarf', label: 'Enana roja', description: 'Pequeña y fría. Zona habitable muy cerca (~0,1 UA).', color: SINGLE_STARS.redDwarf.color },
  { type: 'sunLike', label: 'Tipo Sol', description: 'Como nuestro Sol. Zona habitable a ~1 UA.', color: SINGLE_STARS.sunLike.color },
  { type: 'blueGiant', label: 'Gigante azul', description: 'Enorme y muy brillante. Zona habitable lejana (~40–80 UA).', color: SINGLE_STARS.blueGiant.color },
  { type: 'binary', label: 'Sistema doble', description: 'Dos estrellas que giran juntas. Zona habitable a ~1 UA.', color: BINARY_STAR.color },
];

export function createStarSystem(type: StarType): World {
  const world = new World();
  if (type === 'binary') {
    const s = BINARY_STAR;
    const half = s.separation / 2;
    // Cada estrella va a la mitad de la velocidad relativa de una órbita circular
    const v = Math.sqrt((G * 2 * s.mass) / s.separation) / 2;
    const common = { kind: 'star' as const, mass: s.mass, radius: s.radiusSolar * SOLAR_RADIUS_AU, luminosity: s.luminosity, color: s.color };
    world.add({ ...common, name: `${s.name} A`, x: half, vz: -v });
    world.add({ ...common, name: `${s.name} B`, x: -half, vz: v });
  } else {
    const s = SINGLE_STARS[type];
    world.add({ name: s.name, kind: 'star', mass: s.mass, radius: s.radiusSolar * SOLAR_RADIUS_AU, luminosity: s.luminosity, color: s.color });
  }
  return world;
}
