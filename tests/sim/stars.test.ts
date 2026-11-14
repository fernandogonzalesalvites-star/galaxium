import { describe, it, expect } from 'vitest';
import { createStarSystem, BINARY_STAR, STAR_CHOICES } from '../../src/sim/stars';
import { PLANET_PRESETS, PLANET_TYPES } from '../../src/sim/planetTypes';
import { centerOfMass } from '../../src/sim/elements';
import { DT } from '../../src/sim/units';
import { habitableZone } from '../../src/life/habitability';
import { visualRadius } from '../../src/sim/scale';

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

  it('hay seis opciones de estrella', () => {
    expect(STAR_CHOICES.map((c) => c.type)).toEqual(['redDwarf', 'sunLike', 'redGiant', 'blueGiant', 'pulsar', 'binary']);
  });

  it('la gigante roja es enorme y brillante, con la zona habitable entre ~10 y ~20 UA', () => {
    const s = createStarSystem('redGiant').bodies[0];
    expect(s).toMatchObject({ name: 'Gigante roja', luminosity: 300, pulsar: false });
    const z = habitableZone(s.luminosity);
    expect(z.inner).toBeGreaterThan(8);
    expect(z.outer).toBeLessThan(22);
    // Se puede colocar un planeta en la zona habitable sin chocar con la estrella
    expect(visualRadius(s) * 3).toBeLessThan(z.inner);
  });

  it('el púlsar es un púlsar, pesa 1,4 M☉ y su zona habitable está muy cerca', () => {
    const s = createStarSystem('pulsar').bodies[0];
    expect(s).toMatchObject({ name: 'Púlsar', mass: 1.4, pulsar: true });
    const z = habitableZone(s.luminosity);
    expect(z.inner).toBeGreaterThan(0.1);
    expect(z.outer).toBeLessThan(0.45);
    expect(visualRadius(s) * 3).toBeLessThan(z.inner);
  });

  it('las demás estrellas no son púlsares', () => {
    for (const t of ['redDwarf', 'sunLike', 'blueGiant', 'binary'] as const) {
      expect(createStarSystem(t).bodies.every((b) => !b.pulsar)).toBe(true);
    }
  });
});

describe('plantillas de planetas', () => {
  it('hay una plantilla por tipo y solo la luna es luna', () => {
    expect(PLANET_TYPES).toHaveLength(6);
    expect(PLANET_TYPES.filter((t) => PLANET_PRESETS[t].isMoon)).toEqual(['moon']);
    expect(PLANET_PRESETS.earthLike.massEarth).toBe(1);
  });
});
