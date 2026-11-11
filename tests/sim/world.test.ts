import { describe, it, expect } from 'vitest';
import { World } from '../../src/sim/world';
import { G, EARTH_MASS, DT } from '../../src/sim/units';

function sunEarth(): World {
  const w = new World();
  w.add({ name: 'Sol', kind: 'star', mass: 1, radius: 0.00465 });
  const v = Math.sqrt((G * (1 + EARTH_MASS)) / 1);
  w.add({ name: 'Tierra', kind: 'rocky', mass: EARTH_MASS, radius: 4.26e-5, x: 1, vz: -v });
  return w;
}

describe('World', () => {
  it('asigna ids únicos y crecientes', () => {
    const w = sunEarth();
    expect(w.bodies.map((b) => b.id)).toEqual([1, 2]);
  });

  it('la Tierra tarda 1 año en dar la vuelta', () => {
    const w = sunEarth();
    const [sun, earth] = w.bodies;
    let prevZ = earth.z - sun.z;
    let period = 0;
    for (let i = 0; i < 4000 && period === 0; i++) {
      w.step(DT);
      const z = earth.z - sun.z;
      if (prevZ > 0 && z <= 0) period = w.time - DT * (z / (z - prevZ));
      prevZ = z;
    }
    expect(period).toBeGreaterThan(0.995);
    expect(period).toBeLessThan(1.005);
  });

  it('la energía cambia menos de un 0,1 % tras 1000 órbitas', () => {
    const w = sunEarth();
    const e0 = w.totalEnergy();
    for (let i = 0; i < 2_000_000; i++) w.step(DT);
    expect(Math.abs((w.totalEnergy() - e0) / e0)).toBeLessThan(1e-3);
  });

  it('conserva el momento total', () => {
    const w = new World();
    w.add({ name: 'A', kind: 'star', mass: 1, radius: 0.004, vx: 0.1 });
    w.add({ name: 'B', kind: 'rocky', mass: 0.001, radius: 1e-4, x: 1, vz: -6 });
    w.add({ name: 'C', kind: 'gas', mass: 0.0005, radius: 1e-4, x: -2, z: 0.5, vz: 4 });
    const p0 = w.totalMomentum();
    for (let i = 0; i < 5000; i++) w.step(DT);
    const p1 = w.totalMomentum();
    expect(p1.x).toBeCloseTo(p0.x, 10);
    expect(p1.y).toBeCloseTo(p0.y, 10);
    expect(p1.z).toBeCloseTo(p0.z, 10);
  });

  it('removeNetMomentum deja el momento total en cero', () => {
    const w = sunEarth();
    w.removeNetMomentum();
    const p = w.totalMomentum();
    expect(Math.hypot(p.x, p.y, p.z)).toBeLessThan(1e-15);
  });

  it('al eliminar un planeta sus lunas pasan a no tener padre', () => {
    const w = sunEarth();
    const moon = w.add({ name: 'Luna', kind: 'rocky', mass: 3.7e-8, radius: 1.16e-5, x: 1.003, parentId: 2 });
    w.remove(2);
    expect(w.get(2)).toBeUndefined();
    expect(moon.parentId).toBeNull();
  });

  it('step guarda la posición anterior y snapRenderState la iguala a la actual', () => {
    const w = sunEarth();
    const earth = w.bodies[1];
    w.step(DT);
    expect(earth.px).toBe(1);
    expect(earth.x).not.toBe(1);
    w.snapRenderState();
    expect(earth.px).toBe(earth.x);
  });
});
