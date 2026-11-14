import { describe, it, expect } from 'vitest';
import { applyBodyEdit, canHaveRing, defaultRing, editValues, RING_OUTER, RING_TILT } from '../../src/game/editing';
import { placeMoon, placePlanet } from '../../src/game/placement';
import { createStarSystem } from '../../src/sim/stars';
import { PLANET_PRESETS } from '../../src/sim/planetTypes';

function system() {
  const w = createStarSystem('sunLike');
  const saturn = placePlanet(w, PLANET_PRESETS.gasGiant, 5, 0);
  const moon = placeMoon(w, saturn, PLANET_PRESETS.moon, 5.01, 0);
  w.removeNetMomentum();
  return { w, saturn, moon };
}

describe('anillos', () => {
  it('los planetas nuevos no tienen anillos ni textura', () => {
    const { saturn } = system();
    expect(saturn.ring).toBeNull();
    expect(saturn.texture).toBeNull();
  });

  it('solo los planetas pueden tener anillos', () => {
    const { w, saturn, moon } = system();
    expect(canHaveRing(saturn)).toBe(true);
    expect(canHaveRing(moon)).toBe(false);
    expect(canHaveRing(w.stars()[0])).toBe(false);
  });

  it('se ponen, se ajustan a los límites y se quitan sin mover el planeta', () => {
    const { w, saturn } = system();
    const x = saturn.x;
    applyBodyEdit(w, saturn, { ...editValues(w, saturn), ring: { color: 0x123456, outer: 99, tilt: -10 } });
    expect(saturn.ring).toEqual({ color: 0x123456, outer: RING_OUTER.max, tilt: RING_TILT.min });
    expect(saturn.x).toBe(x);
    applyBodyEdit(w, saturn, { ...editValues(w, saturn), ring: null });
    expect(saturn.ring).toBeNull();
  });

  it('una luna nunca queda con anillos', () => {
    const { w, moon } = system();
    applyBodyEdit(w, moon, { ...editValues(w, moon), ring: defaultRing(moon) });
    expect(moon.ring).toBeNull();
  });

  it('editValues devuelve una copia de los anillos', () => {
    const { w, saturn } = system();
    saturn.ring = defaultRing(saturn);
    const v = editValues(w, saturn);
    v.ring!.outer = 3;
    expect(saturn.ring!.outer).not.toBe(3);
  });
});

describe('texturas incluidas', () => {
  it('cada tipo de planeta nace con su textura', () => {
    const { saturn, moon } = system();
    expect(saturn.surface).toBe('storm');
    expect(moon.surface).toBe('craters');
  });

  it('se cambia la textura y el color a la vez, sin mover el planeta', () => {
    const { w, saturn } = system();
    const x = saturn.x;
    applyBodyEdit(w, saturn, { ...editValues(w, saturn), surface: 'bands', color: 0x8844aa });
    expect(saturn).toMatchObject({ surface: 'bands', color: 0x8844aa, x });
  });

  it('ignora texturas que no existen', () => {
    const { w, saturn } = system();
    applyBodyEdit(w, saturn, { ...editValues(w, saturn), surface: 'nada' as never });
    expect(saturn.surface).toBe('storm');
  });
});

describe('texturas', () => {
  it('se guardan y se quitan', () => {
    const { w, moon } = system();
    const url = 'data:image/jpeg;base64,AAAA';
    applyBodyEdit(w, moon, { ...editValues(w, moon), texture: url });
    expect(moon.texture).toBe(url);
    applyBodyEdit(w, moon, { ...editValues(w, moon), texture: null });
    expect(moon.texture).toBeNull();
  });
});
