import { describe, it, expect } from 'vitest';
import { checkStarPlacement, placePlanet, placeStar } from '../../src/game/placement';
import { createStarSystem, SINGLE_STARS } from '../../src/sim/stars';
import { PLANET_PRESETS } from '../../src/sim/planetTypes';
import { centerOfMass } from '../../src/sim/elements';
import { DT } from '../../src/sim/units';

describe('añadir una estrella', () => {
  it('queda en órbita circular con la que ya había: la separación se mantiene', () => {
    const w = createStarSystem('sunLike');
    const dwarf = placeStar(w, SINGLE_STARS.redDwarf, 0.5, 0);
    w.removeNetMomentum();
    expect(w.stars()).toHaveLength(2);
    expect(dwarf).toMatchObject({ kind: 'star', name: 'Enana roja', mass: 0.3, luminosity: 0.012 });
    const c = centerOfMass(w.bodies);
    expect(Math.hypot(c.vx, c.vz)).toBeLessThan(1e-12);
    const [sun] = w.stars();
    const sep = () => Math.hypot(dwarf.x - sun.x, dwarf.z - sun.z);
    const start = sep();
    let min = Infinity, max = 0;
    for (let i = 0; i < 2000; i++) {
      w.step(DT);
      min = Math.min(min, sep());
      max = Math.max(max, sep());
    }
    expect(min / start).toBeGreaterThan(0.98);
    expect(max / start).toBeLessThan(1.02);
  });

  it('una segunda estrella del mismo tipo lleva un número', () => {
    const w = createStarSystem('sunLike');
    expect(placeStar(w, SINGLE_STARS.sunLike, 2, 0).name).toBe('Sol 2');
    expect(placeStar(w, SINGLE_STARS.sunLike, -4, 0).name).toBe('Sol 3');
  });

  it('un púlsar añadido es púlsar', () => {
    const w = createStarSystem('sunLike');
    expect(placeStar(w, SINGLE_STARS.pulsar, 3, 0).pulsar).toBe(true);
  });

  it('no se puede pegar a otra estrella ni a un planeta, y avisa si hay planetas cerca', () => {
    const w = createStarSystem('sunLike');
    expect(checkStarPlacement(w, SINGLE_STARS.sunLike, 0.01, 0).ok).toBe(false);
    const earth = placePlanet(w, PLANET_PRESETS.earthLike, 1, 0);
    expect(checkStarPlacement(w, SINGLE_STARS.redDwarf, earth.x, earth.z + 0.001).ok).toBe(false);
    const near = checkStarPlacement(w, SINGLE_STARS.redDwarf, 0, 2);
    expect(near.ok).toBe(true);
    expect(near.warning).toMatch(/despedidos/);
    const far = checkStarPlacement(w, SINGLE_STARS.redDwarf, 0, 20);
    expect(far).toMatchObject({ ok: true, warning: null });
  });
});
