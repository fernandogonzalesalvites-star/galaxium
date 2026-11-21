import { describe, it, expect } from 'vitest';
import { canRotate, defaultDayHours, flattening, formatDayHours, parseDayHours } from '../../src/sim/rotation';
import { placeMoon, placePlanet } from '../../src/game/placement';
import { restoreWorld, snapshot } from '../../src/game/save';
import { createStarSystem } from '../../src/sim/stars';
import { createGalaxyUniverse } from '../../src/sim/galaxies';
import { PLANET_PRESETS } from '../../src/sim/planetTypes';
import { describeBody } from '../../src/ui/bodyInfo';

describe('rotación', () => {
  it('cada tipo nace con su día: Tierra 24 h, gigante gaseoso 10 h, luna 655 h; estrellas no giran', () => {
    const w = createStarSystem('sunLike');
    const earth = placePlanet(w, PLANET_PRESETS.earthLike, 1, 0);
    const moon = placeMoon(w, earth, PLANET_PRESETS.moon, 1.003, 0);
    const jupiter = placePlanet(w, PLANET_PRESETS.gasGiant, 5, 0);
    expect(earth.dayHours).toBe(24);
    expect(jupiter.dayHours).toBe(10);
    expect(moon.dayHours).toBe(655);
    expect(w.stars()[0].dayHours).toBe(0);
    expect(canRotate(w.stars()[0])).toBe(false);
    expect(canRotate(createGalaxyUniverse().bodies[0])).toBe(false);
    expect(canRotate(earth)).toBe(true);
  });

  it('lee lo escrito: con coma o punto, y dice cómo arreglar lo que no sirve', () => {
    expect(parseDayHours('24')).toEqual({ hours: 24 });
    expect(parseDayHours(' 24,6 ')).toEqual({ hours: 24.6 });
    expect(parseDayHours('9.84')).toEqual({ hours: 9.8 });
    expect(parseDayHours('')).toHaveProperty('error');
    expect(parseDayHours('hola')).toHaveProperty('error');
    expect((parseDayHours('0') as { error: string }).error).toMatch(/entre 1 y 2000/);
    expect(parseDayHours('5000')).toHaveProperty('error');
  });

  it('se muestra en horas, y en días si es largo', () => {
    expect(formatDayHours(24)).toBe('24 h');
    expect(formatDayHours(24.6)).toBe('24,6 h');
    expect(formatDayHours(655)).toBe('655 h (27,3 días)');
    expect(formatDayHours(0)).toBe('No gira');
  });

  it('la ficha muestra el día y permite el botón de rotación', () => {
    const w = createStarSystem('sunLike');
    const earth = placePlanet(w, PLANET_PRESETS.earthLike, 1, 0);
    const info = describeBody(w, earth);
    expect(info.rows).toContainEqual(['Día', '24 h']);
    expect(info.canRotate).toBe(true);
    expect(describeBody(w, w.stars()[0]).canRotate ?? false).toBe(false);
  });

  it('con días de 5 h o menos se achata, más cuanto más rápido gira', () => {
    expect(flattening(24)).toBe(0);
    expect(flattening(5.1)).toBe(0);
    expect(flattening(5)).toBeCloseTo(0.08, 9);
    expect(flattening(3)).toBeGreaterThan(flattening(5));
    expect(flattening(1)).toBeCloseTo(0.35, 9);
    expect(flattening(0)).toBe(0);
    const w = createStarSystem('sunLike');
    const earth = placePlanet(w, PLANET_PRESETS.earthLike, 1, 0);
    expect(describeBody(w, earth).rows.some(([k]) => k === 'Forma')).toBe(false);
    earth.dayHours = 3;
    expect(describeBody(w, earth).rows.find(([k]) => k === 'Forma')![1]).toMatch(/Achatado \d+ %/);
  });

  it('se guarda; las partidas viejas reciben el día de su tipo', () => {
    const w = createStarSystem('sunLike');
    const earth = placePlanet(w, PLANET_PRESETS.earthLike, 1, 0);
    earth.dayHours = 7.5;
    const data = JSON.parse(JSON.stringify(snapshot(w, { name: 'a', systemName: 'b', speedIndex: 1 })));
    expect(restoreWorld(data).get(earth.id)!.dayHours).toBe(7.5);
    for (const b of data.bodies) delete b.dayHours;
    expect(restoreWorld(data).get(earth.id)!.dayHours).toBe(defaultDayHours('rocky', false));
  });
});
