import { World } from './world';
import { G, SOLAR_RADIUS_AU } from './units';

export type StarType = 'redDwarf' | 'sunLike' | 'redGiant' | 'blueGiant' | 'pulsar' | 'blackHole' | 'binary';

export interface StarSpec {
  name: string;
  /** M☉ */
  mass: number;
  /** L☉ */
  luminosity: number;
  /** Radio en radios solares */
  radiusSolar: number;
  color: number;
  /** Estrella de neutrones con haces de radiación girando */
  pulsar?: boolean;
  /** Agujero negro: mucha masa y nada de luz */
  blackHole?: boolean;
}

export const SINGLE_STARS: Record<Exclude<StarType, 'binary'>, StarSpec> = {
  redDwarf: { name: 'Enana roja', mass: 0.3, luminosity: 0.012, radiusSolar: 0.3, color: 0xff7a45 },
  sunLike: { name: 'Sol', mass: 1, luminosity: 1, radiusSolar: 1, color: 0xfff1c4 },
  // Una estrella como el Sol al final de su vida: hinchada, fría por fuera y muy brillante
  redGiant: { name: 'Gigante roja', mass: 1.2, luminosity: 300, radiusSolar: 40, color: 0xff5a36 },
  blueGiant: { name: 'Gigante azul', mass: 10, luminosity: 5000, radiusSolar: 6, color: 0xa9c8ff },
  // Estrella de neutrones: apenas da calor. Su radio real (~10 km) sería invisible;
  // se agranda un poco para poder tocarla, y el marcador y los haces la señalan
  pulsar: { name: 'Púlsar', mass: 1.4, luminosity: 0.1, radiusSolar: 0.005, color: 0xc8e4ff, pulsar: true },
  // Agujero negro de 10 masas solares: no da luz (su zona habitable no existe).
  // Su horizonte real mide ~30 km; se dibuja con un disco de acreción que siempre
  // se ve. El color es el del disco (marcador y estela)
  blackHole: { name: 'Agujero negro', mass: 10, luminosity: 0, radiusSolar: 0.005, color: 0xff9a3c, blackHole: true },
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
  { type: 'redGiant', label: 'Gigante roja', description: 'Una estrella vieja e hinchada. Zona habitable lejos (~10–20 UA).', color: SINGLE_STARS.redGiant.color },
  { type: 'blueGiant', label: 'Gigante azul', description: 'Enorme y muy brillante. Zona habitable lejana (~40–80 UA).', color: SINGLE_STARS.blueGiant.color },
  { type: 'pulsar', label: 'Púlsar', description: 'Estrella de neutrones que gira sin parar. Da poco calor: zona habitable muy cerca (~0,2–0,4 UA).', color: SINGLE_STARS.pulsar.color },
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
    world.add({
      name: s.name, kind: 'star', mass: s.mass, radius: s.radiusSolar * SOLAR_RADIUS_AU,
      luminosity: s.luminosity, color: s.color, pulsar: s.pulsar ?? false, blackHole: s.blackHole ?? false,
    });
  }
  return world;
}
