import { describe, it, expect } from 'vitest';
import {
  checkPlanetPlacement, checkMoonPlacement, moonBand, placePlanet, placeMoon, nextName,
} from '../../src/game/placement';
import { createStarSystem } from '../../src/sim/stars';
import { PLANET_PRESETS } from '../../src/sim/planetTypes';
import { centralMassFor, relativeOrbit } from '../../src/sim/elements';
import { DT } from '../../src/sim/units';

describe('planetas', () => {
  it('un planeta colocado a 1 UA sigue en órbita circular tras 1 año', () => {
    const w = createStarSystem('sunLike');
    const p = placePlanet(w, PLANET_PRESETS.earthLike, 1, 0);
    w.removeNetMomentum();
    for (let i = 0; i < 2000; i++) w.step(DT);
    const o = relativeOrbit(p, centralMassFor(w, p)!);
    expect(o.eccentricity).toBeLessThan(0.01);
    expect(o.semiMajorAxis).toBeCloseTo(1, 2);
  });

  it('pone nombres consecutivos', () => {
    const w = createStarSystem('sunLike');
    expect(placePlanet(w, PLANET_PRESETS.earthLike, 1, 0).name).toBe('Planeta 1');
    expect(placePlanet(w, PLANET_PRESETS.gasGiant, 0, 5).name).toBe('Planeta 2');
    expect(nextName(w, 'Luna')).toBe('Luna 1');
  });

  it('copia masa, radio y aspecto de la plantilla', () => {
    const w = createStarSystem('sunLike');
    const p = placePlanet(w, PLANET_PRESETS.earthLike, 1, 0);
    expect(p.mass).toBeCloseTo(3.003e-6, 12);
    expect(p).toMatchObject({ kind: 'rocky', atmosphere: 0.3, water: 0.7, parentId: null });
  });

  it('bloquea colocar pegado a la estrella', () => {
    const w = createStarSystem('sunLike');
    const c = checkPlanetPlacement(w, 0.01, 0);
    expect(c.ok).toBe(false);
    expect(c.warning).toBe('Demasiado cerca de la estrella');
  });

  it('avisa (sin bloquear) cerca de las dos estrellas de un sistema doble', () => {
    const w = createStarSystem('binary');
    const near = checkPlanetPlacement(w, 0.4, 0);
    expect(near.ok).toBe(true);
    expect(near.warning).toContain('inestable');
    const far = checkPlanetPlacement(w, 1, 0);
    expect(far).toMatchObject({ ok: true, warning: null });
    expect(far.radius).toBeCloseTo(1, 12);
  });
});

describe('lunas', () => {
  function sunEarth() {
    const w = createStarSystem('sunLike');
    const earth = placePlanet(w, PLANET_PRESETS.earthLike, 1, 0);
    return { w, earth };
  }

  it('la franja permitida va de 1,2×Roche a 0,5×Hill', () => {
    const { w, earth } = sunEarth();
    const band = moonBand(w, earth, PLANET_PRESETS.moon);
    expect(band.min).toBeGreaterThan(0.0013);
    expect(band.min).toBeLessThan(0.0016);
    expect(band.max).toBeCloseTo(0.005, 4);
  });

  it('acepta dentro de la franja y rechaza fuera', () => {
    const { w, earth } = sunEarth();
    expect(checkMoonPlacement(w, earth, PLANET_PRESETS.moon, 1.003, 0)).toMatchObject({ ok: true, warning: null });
    const tooClose = checkMoonPlacement(w, earth, PLANET_PRESETS.moon, 1.0005, 0);
    expect(tooClose.ok).toBe(false);
    expect(tooClose.warning).toContain('cerca');
    const tooFar = checkMoonPlacement(w, earth, PLANET_PRESETS.moon, 1.02, 0);
    expect(tooFar.ok).toBe(false);
    expect(tooFar.warning).toContain('lejos');
  });

  it('una luna colocada sigue ligada a su planeta tras 1 año', () => {
    const { w, earth } = sunEarth();
    const moon = placeMoon(w, earth, PLANET_PRESETS.moon, 1.003, 0);
    expect(moon.parentId).toBe(earth.id);
    expect(moon.name).toBe('Luna 1');
    w.removeNetMomentum();
    for (let i = 0; i < 2000; i++) w.step(DT);
    const o = relativeOrbit(moon, earth);
    expect(o.bound).toBe(true);
    expect(o.eccentricity).toBeLessThan(0.1);
    expect(o.distance).toBeGreaterThan(0.0015);
    expect(o.distance).toBeLessThan(0.0045);
  });
});
