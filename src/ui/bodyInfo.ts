import type { Body } from '../sim/body';
import type { World } from '../sim/world';
import { centerOfMass, centralMassFor, relativeOrbit } from '../sim/elements';
import { GALAXY_SPECS, galaxies } from '../sim/galaxies';
import { flattening, formatDayHours } from '../sim/rotation';
import { formatGalacticElapsed, formatGalaxyMass, formatLightYears } from './format';
import { EARTH_MASS, EARTH_RADIUS_AU, SOLAR_RADIUS_AU } from '../sim/units';
import { evaluateHabitability, habitableZone } from '../life/habitability';
import { formatDistance, formatPercent, formatPeriod, formatTemperature, num, sig } from './format';

export interface BodyInfo {
  name: string;
  /** Tipo de cuerpo: «Planeta rocoso», «Luna»… */
  kindLabel: string;
  rows: [string, string][];
  /** Estado de habitabilidad, o null en las estrellas */
  status: { habitable: boolean; text: string } | null;
  /**
   * Vegetación: 'none' rocoso sin plantas, 'grown' rocoso con plantas,
   * 'unavailable' gigante de gas o hielo (no crece), null si no es un planeta ni una luna.
   */
  vegetation?: 'none' | 'grown' | 'unavailable' | null;
  /** Se le puede cambiar la rotación (planetas y lunas) */
  canRotate?: boolean;
  /** Nubes: 'none' sin nubes, 'added' con nubes, 'unavailable' sin atmósfera; null si no es planeta ni luna */
  clouds?: 'none' | 'added' | 'unavailable' | null;
}

export function kindLabel(body: Body): string {
  if (body.kind === 'galaxy') return `Galaxia ${GALAXY_SPECS[body.galaxyType ?? 'spiral'].label.toLowerCase()}`;
  if (body.blackHole) return 'Agujero negro';
  if (body.pulsar) return 'Púlsar';
  if (body.kind === 'star') return 'Estrella';
  if (body.parentId !== null) return 'Luna';
  if (body.kind === 'gas') return 'Gigante gaseoso';
  if (body.kind === 'ice') return 'Gigante helado';
  return 'Planeta rocoso';
}

function zoneText(world: World): string {
  let luminosity = 0;
  for (const s of world.stars()) luminosity += s.luminosity;
  if (luminosity <= 0) return 'No hay (sin luz)';
  const z = habitableZone(luminosity);
  return `${formatDistance(z.inner, false).replace(' UA', '')} – ${formatDistance(z.outer, false)}`;
}

export function describeBody(world: World, body: Body): BodyInfo {
  if (body.kind === 'galaxy') {
    const others = galaxies(world).filter((g) => g.id !== body.id);
    const rows: [string, string][] = [
      ['Masa', formatGalaxyMass(body.mass)],
      ['Diámetro', formatLightYears(body.radius * 2)],
    ];
    if (others.length > 0) {
      const c = centerOfMass(others);
      rows.push(['Distancia a las demás', formatLightYears(Math.hypot(body.x - c.x, body.y - c.y, body.z - c.z))]);
      const o = relativeOrbit(body, c);
      rows.push(['Una vuelta', o.bound ? formatGalacticElapsed(o.period) : 'Se aleja']);
    }
    return { name: body.name, kindLabel: kindLabel(body), rows, status: null };
  }
  if (body.kind === 'star') {
    return {
      name: body.name,
      kindLabel: kindLabel(body),
      rows: [
        ['Masa', `${sig(body.mass)} M☉`],
        ['Radio', `${sig(body.radius / SOLAR_RADIUS_AU)} R☉`],
        ['Luminosidad', body.blackHole ? 'No emite luz' : `${sig(body.luminosity)} L☉`],
        ['Zona habitable', zoneText(world)],
      ],
      status: null,
    };
  }
  const moon = body.parentId !== null;
  const central = centralMassFor(world, body);
  const orbit = central ? relativeOrbit(body, central) : null;
  const h = evaluateHabitability(world, body);
  const rows: [string, string][] = [
    ['Masa', `${sig(body.mass / EARTH_MASS)} M⊕`],
    ['Radio', `${sig(body.radius / EARTH_RADIUS_AU)} R⊕`],
  ];
  if (orbit) {
    rows.push(
      [moon ? 'Distancia al planeta' : 'Distancia', formatDistance(orbit.distance, moon)],
      ['Periodo', formatPeriod(orbit.period)],
      ['Excentricidad', orbit.bound ? num(orbit.eccentricity, 3) : 'Sin órbita'],
    );
  }
  rows.push(
    ['Temperatura', formatTemperature(h.temperature)],
    ['Atmósfera', formatPercent(body.atmosphere)],
    ['Día', formatDayHours(body.dayHours)],
  );
  const flat = flattening(body.dayHours);
  if (flat > 0) rows.push(['Forma', `Achatado ${Math.round(flat * 100)} % (gira muy rápido)`]);
  if (body.kind === 'rocky') {
    rows.push(['Agua', formatPercent(body.water)], ['Vegetación', body.vegetation ? 'Sí' : 'No']);
  }
  return {
    name: body.name,
    kindLabel: kindLabel(body),
    rows,
    status: { habitable: h.habitable, text: h.habitable ? 'Habitable' : `No habitable: ${h.reason!.toLowerCase()}` },
    vegetation: body.kind === 'rocky' ? (body.vegetation ? 'grown' : 'none') : 'unavailable',
    canRotate: true,
    clouds: body.atmosphere > 0 ? (body.clouds ? 'added' : 'none') : 'unavailable',
  };
}
