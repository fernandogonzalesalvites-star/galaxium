import { describe, it, expect } from 'vitest';
import {
  applyBodyEdit, applyStarType, deleteBody, distanceOf, editRanges, editValues, previewHabitability,
} from '../../src/game/editing';
import { placeMoon, placePlanet } from '../../src/game/placement';
import { createStarSystem } from '../../src/sim/stars';
import { PLANET_PRESETS } from '../../src/sim/planetTypes';
import { centralMassFor, relativeOrbit } from '../../src/sim/elements';
import { DT } from '../../src/sim/units';

function sunEarthMoon() {
  const w = createStarSystem('sunLike');
  const earth = placePlanet(w, PLANET_PRESETS.earthLike, 1, 0);
  const moon = placeMoon(w, earth, PLANET_PRESETS.moon, 1.003, 0);
  w.removeNetMomentum();
  return { w, earth, moon };
}

describe('editar planetas', () => {
  it('los valores del editor reflejan el cuerpo', () => {
    const { w, earth } = sunEarthMoon();
    const v = editValues(w, earth);
    expect(v.massEarth).toBeCloseTo(1, 6);
    expect(v.radiusEarth).toBeCloseTo(1, 6);
    expect(v.distance).toBeCloseTo(1, 3);
    expect(v).toMatchObject({ name: 'Planeta 1', atmosphere: 0.3, water: 0.7 });
  });

  it('cambia nombre, atmósfera, agua y color sin moverlo', () => {
    const { w, earth } = sunEarthMoon();
    const x = earth.x;
    applyBodyEdit(w, earth, { ...editValues(w, earth), name: ' Gaia ', atmosphere: 0.6, water: 0.2, color: 0x123456 });
    expect(earth).toMatchObject({ name: 'Gaia', atmosphere: 0.6, water: 0.2, color: 0x123456 });
    expect(earth.x).toBe(x);
  });

  it('al cambiar la distancia queda en órbita circular y su luna lo acompaña', () => {
    const { w, earth, moon } = sunEarthMoon();
    const before = relativeOrbit(moon, earth);
    applyBodyEdit(w, earth, { ...editValues(w, earth), distance: 2 });
    w.removeNetMomentum();
    expect(distanceOf(w, earth)).toBeCloseTo(2, 6);
    const after = relativeOrbit(moon, earth);
    expect(after.distance).toBeCloseTo(before.distance, 9);
    for (let i = 0; i < 4000; i++) w.step(DT);
    const o = relativeOrbit(earth, centralMassFor(w, earth)!);
    expect(o.eccentricity).toBeLessThan(0.01);
    expect(o.semiMajorAxis).toBeCloseTo(2, 2);
    expect(relativeOrbit(moon, earth).bound).toBe(true);
  });

  it('una luna no se puede alejar más allá de su franja', () => {
    const { w, moon } = sunEarthMoon();
    const max = editRanges(w, moon).distance.max;
    const clamped = applyBodyEdit(w, moon, { ...editValues(w, moon), distance: 0.5 });
    expect(clamped).toBe(true);
    expect(distanceOf(w, moon)).toBeCloseTo(max, 9);
  });

  it('el gaseoso no tiene agua', () => {
    const w = createStarSystem('sunLike');
    const jupiter = placePlanet(w, PLANET_PRESETS.gasGiant, 5, 0);
    applyBodyEdit(w, jupiter, { ...editValues(w, jupiter), water: 0.9 });
    expect(jupiter.water).toBe(0);
  });

  it('la vista previa avisa si la nueva distancia es demasiado fría', () => {
    const { w, earth } = sunEarthMoon();
    expect(previewHabitability(w, earth, editValues(w, earth)).habitable).toBe(true);
    expect(previewHabitability(w, earth, { ...editValues(w, earth), distance: 4 }).reason).toBe('Demasiado frío');
  });

  it('eliminar un planeta deja a su luna sin padre', () => {
    const { w, earth, moon } = sunEarthMoon();
    deleteBody(w, earth.id);
    expect(w.get(earth.id)).toBeUndefined();
    expect(moon.parentId).toBeNull();
  });
});

describe('editar estrellas', () => {
  it('cambiar el tipo cambia masa, luminosidad y nombre por defecto', () => {
    const w = createStarSystem('sunLike');
    const sun = w.stars()[0];
    applyStarType(w, sun, 'blueGiant', sun.name);
    expect(sun).toMatchObject({ name: 'Gigante azul', mass: 10, luminosity: 5000 });
  });

  it('respeta un nombre puesto por el jugador', () => {
    const w = createStarSystem('sunLike');
    const sun = w.stars()[0];
    applyStarType(w, sun, 'redDwarf', 'Helios');
    expect(sun.name).toBe('Helios');
  });
});
