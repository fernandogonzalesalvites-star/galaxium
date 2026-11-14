import { describe, it, expect } from 'vitest';
import { applyStarLook, applyStarType, starRadiusRange, starTypeOf, STAR_RADIUS_LIMITS } from '../../src/game/editing';
import { placePlanet } from '../../src/game/placement';
import { createStarSystem } from '../../src/sim/stars';
import { PLANET_PRESETS } from '../../src/sim/planetTypes';
import { habitableZone } from '../../src/life/habitability';
import { visualRadius } from '../../src/sim/scale';
import { SOLAR_RADIUS_AU } from '../../src/sim/units';

describe('tamaño y color de una estrella', () => {
  it('se cambian sin tocar su brillo, su masa ni su tipo', () => {
    const w = createStarSystem('sunLike');
    const sun = w.stars()[0];
    const before = { mass: sun.mass, luminosity: sun.luminosity };
    const clamped = applyStarLook(w, sun, 3, 0x33ccff);
    expect(clamped).toBe(false);
    expect(sun.radius / SOLAR_RADIUS_AU).toBeCloseTo(3, 9);
    expect(sun).toMatchObject({ color: 0x33ccff, ...before });
    expect(starTypeOf(sun)).toBe('sunLike');
  });

  it('sola en el sistema puede llegar al máximo', () => {
    const w = createStarSystem('sunLike');
    expect(starRadiusRange(w, w.stars()[0])).toEqual(STAR_RADIUS_LIMITS);
  });

  it('no puede crecer hasta tapar a sus planetas', () => {
    const w = createStarSystem('sunLike');
    const sun = w.stars()[0];
    const planet = placePlanet(w, PLANET_PRESETS.earthLike, 1, 0);
    const clamped = applyStarLook(w, sun, 60, sun.color);
    expect(clamped).toBe(true);
    const d = Math.hypot(planet.x - sun.x, planet.z - sun.z);
    expect(visualRadius(sun)).toBeLessThan(d * 0.5);
  });

  it('en un sistema doble no tapa a la otra estrella', () => {
    const w = createStarSystem('binary');
    const [a, b] = w.stars();
    applyStarLook(w, a, 60, a.color);
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    expect(visualRadius(a) + visualRadius(b)).toBeLessThan(d);
  });

  it('volverla gigante roja junto a un planeta cercano la deja de un tamaño que no lo tapa', () => {
    const w = createStarSystem('sunLike');
    const sun = w.stars()[0];
    placePlanet(w, PLANET_PRESETS.earthLike, 1, 0);
    applyStarType(w, sun, 'redGiant', sun.name);
    const clamped = applyStarLook(w, sun, 40, sun.color);
    expect(clamped).toBe(true);
    expect(sun.luminosity).toBe(300);
    expect(habitableZone(sun.luminosity).inner).toBeGreaterThan(5);
  });
});
