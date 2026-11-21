import { describe, it, expect } from 'vitest';
import { computeEclipses } from '../../src/sim/eclipses';
import { createStarSystem } from '../../src/sim/stars';
import { placeMoon, placePlanet } from '../../src/game/placement';
import { PLANET_PRESETS } from '../../src/sim/planetTypes';
import { visualRadius } from '../../src/sim/scale';

/** Sol en el origen, Tierra a 1 UA en +x y la Luna a la distancia dada sobre el eje x. */
function lineUp(moonOffsetX: number, moonOffsetZ = 0) {
  const w = createStarSystem('sunLike');
  const earth = placePlanet(w, PLANET_PRESETS.earthLike, 1, 0);
  const moon = placeMoon(w, earth, PLANET_PRESETS.moon, 1 + moonOffsetX, moonOffsetZ);
  return { w, earth, moon };
}

describe('eclipses', () => {
  it('luna entre el Sol y el planeta: su sombra cae en la cara iluminada', () => {
    const { w, earth, moon } = lineUp(-0.003);
    const e = computeEclipses(w.bodies);
    expect(e.solar).toHaveLength(1);
    expect(e.solar[0]).toMatchObject({ planetId: earth.id, moonId: moon.id });
    // La sombra mira hacia el Sol (−x)
    expect(e.solar[0].normal.x).toBeCloseTo(-1, 6);
    expect(e.lunar.size).toBe(0);
  });

  it('luna detrás del planeta: se pone roja del todo', () => {
    const { w, moon } = lineUp(0.003);
    const e = computeEclipses(w.bodies);
    expect(e.lunar.get(moon.id)).toBe(1);
    expect(e.solar).toHaveLength(0);
  });

  it('luna a un lado: no hay eclipse', () => {
    const { w } = lineUp(0, 0.003);
    const e = computeEclipses(w.bodies);
    expect(e.solar).toHaveLength(0);
    expect(e.lunar.size).toBe(0);
  });

  it('entrando en la sombra se pone roja poco a poco', () => {
    const base = lineUp(0.003);
    const rp = visualRadius(base.earth), rm = visualRadius(base.moon);
    // Justo en el borde de la sombra: a medias
    const { w, moon } = lineUp(0.003, rp);
    const amount = computeEclipses(w.bodies).lunar.get(moon.id)!;
    expect(amount).toBeGreaterThan(0.3);
    expect(amount).toBeLessThan(0.7);
    // Fuera de la sombra del todo
    const far = lineUp(0.003, rp + rm * 1.5);
    expect(computeEclipses(far.w.bodies).lunar.size).toBe(0);
  });

  it('sin estrellas que alumbren no hay eclipses', () => {
    const { w } = lineUp(0.003);
    w.stars()[0].luminosity = 0;
    expect(computeEclipses(w.bodies).lunar.size).toBe(0);
  });
});
