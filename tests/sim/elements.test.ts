import { describe, it, expect } from 'vitest';
import {
  centerOfMass, centralMassFor, relativeOrbit, circularSpeed, hillRadius, rocheLimit,
} from '../../src/sim/elements';
import { visualRadius } from '../../src/sim/scale';
import { World } from '../../src/sim/world';
import { G, EARTH_MASS, EARTH_RADIUS_AU } from '../../src/sim/units';

const sun = { mass: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };

describe('relativeOrbit', () => {
  it('reconoce una órbita circular a 1 UA', () => {
    const v = circularSpeed(1, 0, 1);
    const o = relativeOrbit({ mass: 0, x: 1, y: 0, z: 0, vx: 0, vy: 0, vz: -v }, sun);
    expect(o.bound).toBe(true);
    expect(o.eccentricity).toBeLessThan(1e-12);
    expect(o.semiMajorAxis).toBeCloseTo(1, 10);
    expect(o.period).toBeCloseTo(1, 10);
    expect(o.distance).toBeCloseTo(1, 12);
  });

  it('calcula una órbita excéntrica e = 0,5', () => {
    const v = Math.sqrt(G * 1.5);
    const o = relativeOrbit({ mass: 0, x: 1, y: 0, z: 0, vx: 0, vy: 0, vz: -v }, sun);
    expect(o.eccentricity).toBeCloseTo(0.5, 10);
    expect(o.semiMajorAxis).toBeCloseTo(2, 10);
  });

  it('detecta una trayectoria de escape', () => {
    const v = Math.sqrt(2 * G) * 1.01;
    const o = relativeOrbit({ mass: 0, x: 1, y: 0, z: 0, vx: 0, vy: 0, vz: -v }, sun);
    expect(o.bound).toBe(false);
    expect(o.period).toBe(Infinity);
  });
});

describe('escala, Hill y Roche', () => {
  it('el radio visual es ×10 para planetas y ×5 para estrellas', () => {
    expect(visualRadius({ kind: 'rocky', radius: 1 })).toBe(10);
    expect(visualRadius({ kind: 'star', radius: 1 })).toBe(5);
  });

  it('el radio de Hill de la Tierra es ≈0,01 UA', () => {
    expect(hillRadius(1, EARTH_MASS, 1)).toBeCloseTo(0.01, 4);
  });

  it('con densidades iguales el límite de Roche es 2,44 radios visuales', () => {
    const planet = { kind: 'rocky' as const, mass: EARTH_MASS, radius: EARTH_RADIUS_AU };
    const moon = { kind: 'rocky' as const, mass: EARTH_MASS / 8, radius: EARTH_RADIUS_AU / 2 };
    expect(rocheLimit(planet, moon)).toBeCloseTo(2.44 * visualRadius(planet), 12);
  });
});

describe('centros', () => {
  it('centerOfMass pondera por masa', () => {
    const c = centerOfMass([
      { mass: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
      { mass: 3, x: 4, y: 0, z: 0, vx: 0, vy: 0, vz: 2 },
    ]);
    expect(c.mass).toBe(4);
    expect(c.x).toBe(3);
    expect(c.vz).toBe(1.5);
  });

  it('el centro de una luna es su planeta y el de un planeta son las estrellas', () => {
    const w = new World();
    w.add({ name: 'A', kind: 'star', mass: 0.8, radius: 0.004, x: 0.1 });
    w.add({ name: 'B', kind: 'star', mass: 0.8, radius: 0.004, x: -0.1 });
    const p = w.add({ name: 'P', kind: 'rocky', mass: EARTH_MASS, radius: EARTH_RADIUS_AU, x: 1 });
    const m = w.add({ name: 'L', kind: 'rocky', mass: 1e-8, radius: 1e-5, x: 1.003, parentId: p.id });
    const cp = centralMassFor(w, p)!;
    expect(cp.mass).toBeCloseTo(1.6, 12);
    expect(cp.x).toBeCloseTo(0, 12);
    expect(centralMassFor(w, m)).toBe(p);
  });

  it('una estrella sola no tiene centro', () => {
    const w = new World();
    const s = w.add({ name: 'S', kind: 'star', mass: 1, radius: 0.004 });
    expect(centralMassFor(w, s)).toBeNull();
  });
});
