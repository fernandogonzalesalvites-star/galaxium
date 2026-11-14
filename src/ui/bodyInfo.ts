import type { Body } from '../sim/body';
import type { World } from '../sim/world';
import { centralMassFor, relativeOrbit } from '../sim/elements';
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
}

export function kindLabel(body: Body): string {
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
  rows.push(['Temperatura', formatTemperature(h.temperature)], ['Atmósfera', formatPercent(body.atmosphere)]);
  if (body.kind === 'rocky') rows.push(['Agua', formatPercent(body.water)]);
  return {
    name: body.name,
    kindLabel: kindLabel(body),
    rows,
    status: { habitable: h.habitable, text: h.habitable ? 'Habitable' : `No habitable: ${h.reason!.toLowerCase()}` },
  };
}
