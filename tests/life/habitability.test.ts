import { describe, it, expect } from 'vitest';
import {
  climateOf, evaluateHabitability, greenhouse, habitableZone, temperatureAt,
} from '../../src/life/habitability';
import { createStarSystem } from '../../src/sim/stars';
import { PLANET_PRESETS } from '../../src/sim/planetTypes';
import { placePlanet } from '../../src/game/placement';

describe('temperatura', () => {
  it('la Tierra a 1 UA del Sol con atmósfera 0,3 da ≈ 288 K', () => {
    const t = temperatureAt([{ x: 0, y: 0, z: 0, luminosity: 1 }], { x: 1, y: 0, z: 0 }, 0.3);
    expect(t).toBeGreaterThan(285);
    expect(t).toBeLessThan(292);
  });

  it('el invernadero va de 0 a 100 K', () => {
    expect(greenhouse(0)).toBe(0);
    expect(greenhouse(1)).toBeCloseTo(100, 6);
  });

  it('con dos estrellas se suman los flujos', () => {
    const one = temperatureAt([{ x: 0, y: 0, z: 0, luminosity: 2 }], { x: 1, y: 0, z: 0 }, 0);
    const two = temperatureAt(
      [{ x: 0, y: 0, z: 0, luminosity: 1 }, { x: 0, y: 0, z: 0, luminosity: 1 }], { x: 1, y: 0, z: 0 }, 0,
    );
    expect(two).toBeCloseTo(one, 6);
  });

  it('clasifica el clima', () => {
    expect(climateOf(200)).toBe('cold');
    expect(climateOf(300)).toBe('temperate');
    expect(climateOf(400)).toBe('hot');
  });
});

describe('zona habitable', () => {
  it('para el Sol va de ≈ 0,57 a ≈ 1,14 UA, con la Tierra dentro', () => {
    const z = habitableZone(1);
    expect(z.inner).toBeCloseTo(0.565, 2);
    expect(z.outer).toBeCloseTo(1.136, 2);
  });

  it('en sus bordes la temperatura es 373 K y 273 K', () => {
    const z = habitableZone(5000);
    const star = [{ x: 0, y: 0, z: 0, luminosity: 5000 }];
    expect(temperatureAt(star, { x: z.inner, y: 0, z: 0 }, 0.3)).toBeCloseTo(373, 6);
    expect(temperatureAt(star, { x: z.outer, y: 0, z: 0 }, 0.3)).toBeCloseTo(273, 6);
  });

  it('la de la enana roja está mucho más cerca', () => {
    expect(habitableZone(0.012).outer).toBeLessThan(0.15);
  });
});

describe('habitabilidad', () => {
  it('una Tierra a 1 UA es habitable', () => {
    const w = createStarSystem('sunLike');
    const p = placePlanet(w, PLANET_PRESETS.earthLike, 1, 0);
    expect(evaluateHabitability(w, p)).toMatchObject({ habitable: true, reason: null });
  });

  it('da el motivo cuando no lo es', () => {
    const w = createStarSystem('sunLike');
    expect(evaluateHabitability(w, placePlanet(w, PLANET_PRESETS.earthLike, 0.3, 0)).reason).toBe('Demasiado caliente');
    expect(evaluateHabitability(w, placePlanet(w, PLANET_PRESETS.earthLike, 3, 0)).reason).toBe('Demasiado frío');
    expect(evaluateHabitability(w, placePlanet(w, PLANET_PRESETS.gasGiant, 0, 1)).reason).toBe('Gaseoso');
    expect(evaluateHabitability(w, placePlanet(w, PLANET_PRESETS.smallRocky, -0.8, 0)).reason).toBe('Sin agua');
  });
});
