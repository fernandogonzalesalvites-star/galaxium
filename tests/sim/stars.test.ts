import { describe, it, expect } from 'vitest';
import { createStarSystem, BINARY_STAR, STAR_CHOICES } from '../../src/sim/stars';
import { PLANET_PRESETS, PLANET_TYPES } from '../../src/sim/planetTypes';
import { centerOfMass } from '../../src/sim/elements';
import { DT } from '../../src/sim/units';

describe('createStarSystem', () => {
  it('crea una estrella tipo Sol con 1 M☉ y 1 L☉', () => {
    const w = createStarSystem('sunLike');
    expect(w.bodies).toHaveLength(1);
    expect(w.bodies[0]).toMatchObject({ kind: 'star', mass: 1, luminosity: 1, name: 'Sol' });
  });

  it('la gigante azul tiene 10 M☉ y 5000 L☉', () => {
    const s = createStarSystem('blueGiant').bodies[0];
    expect(s.mass).toBe(10);
    expect(s.luminosity).toBe(5000);
  });

  it('el sistema doble está centrado, sin momento y mantiene su separación', () => {
    const w = createStarSystem('binary');
    expect(w.bodies).toHaveLength(2);
    const c = centerOfMass(w.bodies);
    expect(Math.hypot(c.x, c.y, c.z)).toBeLessThan(1e-12);
    expect(Math.hypot(c.vx, c.vy, c.vz)).toBeLessThan(1e-12);
    for (let i = 0; i < 300; i++) w.step(DT);
    const [a, b] = w.bodies;
    const sep = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    expect(Math.abs(sep - BINARY_STAR.separation) / BINARY_STAR.separation).toBeLessThan(0.01);
  });

  it('hay cuatro opciones de estrella', () => {
    expect(STAR_CHOICES.map((c) => c.type)).toEqual(['redDwarf', 'sunLike', 'blueGiant', 'binary']);
  });
});

describe('plantillas de planetas', () => {
  it('hay una plantilla por tipo y solo la luna es luna', () => {
    expect(PLANET_TYPES).toHaveLength(6);
    expect(PLANET_TYPES.filter((t) => PLANET_PRESETS[t].isMoon)).toEqual(['moon']);
    expect(PLANET_PRESETS.earthLike.massEarth).toBe(1);
  });
});
