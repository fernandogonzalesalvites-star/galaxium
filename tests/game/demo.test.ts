import { describe, it, expect } from 'vitest';
import { createDemoSystem } from '../../src/game/demo';
import { centralMassFor, relativeOrbit } from '../../src/sim/elements';
import { DT } from '../../src/sim/units';

describe('fondo del menú', () => {
  it('dos estrellas y dos planetas, uno con anillos', () => {
    const w = createDemoSystem();
    expect(w.stars()).toHaveLength(2);
    const planets = w.bodies.filter((b) => b.kind !== 'star');
    expect(planets).toHaveLength(2);
    expect(planets.some((p) => p.ring !== null)).toBe(true);
  });

  it('los planetas siguen en órbita tras 20 años (un buen rato en el menú)', () => {
    const w = createDemoSystem();
    const start = new Map(w.bodies.map((b) => [b.id, Math.hypot(b.x, b.z)]));
    const steps = Math.round(20 / DT);
    for (let i = 0; i < steps; i++) w.step(DT);
    for (const b of w.bodies) {
      if (b.kind === 'star') continue;
      const o = relativeOrbit(b, centralMassFor(w, b)!);
      expect(o.bound).toBe(true);
      expect(Math.hypot(b.x, b.z)).toBeLessThan(start.get(b.id)! * 1.5);
    }
  });
});
