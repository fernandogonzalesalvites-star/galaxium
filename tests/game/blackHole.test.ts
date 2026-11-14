import { describe, it, expect } from 'vitest';
import { placePlanet, placeStar } from '../../src/game/placement';
import { applyStarType, starTypeOf } from '../../src/game/editing';
import { restoreWorld, snapshot } from '../../src/game/save';
import { createStarSystem, SINGLE_STARS } from '../../src/sim/stars';
import { PLANET_PRESETS } from '../../src/sim/planetTypes';
import { temperatureAt } from '../../src/life/habitability';
import { describeBody } from '../../src/ui/bodyInfo';
import { DT } from '../../src/sim/units';

describe('agujeros negros', () => {
  it('se añaden como una estrella más: mucha masa y nada de luz', () => {
    const w = createStarSystem('sunLike');
    const bh = placeStar(w, SINGLE_STARS.blackHole, 5, 0);
    w.removeNetMomentum();
    expect(bh).toMatchObject({ kind: 'star', name: 'Agujero negro', mass: 10, luminosity: 0, blackHole: true, pulsar: false });
    expect(starTypeOf(bh)).toBe('blackHole');
    // No calienta: la temperatura cerca del Sol es la misma con o sin agujero negro
    const sunOnly = createStarSystem('sunLike');
    const p = { x: 1, y: 0, z: 0 };
    expect(temperatureAt(w.stars().filter((s) => !s.blackHole), p, 0.3)).toBeCloseTo(temperatureAt(sunOnly.stars(), p, 0.3), 6);
  });

  it('su gravedad manda: el Sol pasa a girar alrededor de él', () => {
    const w = createStarSystem('sunLike');
    const sun = w.stars()[0];
    placeStar(w, SINGLE_STARS.blackHole, 5, 0);
    w.removeNetMomentum();
    const start = { x: sun.x, z: sun.z };
    for (let i = 0; i < 3000; i++) w.step(DT);
    expect(Math.hypot(sun.x - start.x, sun.z - start.z)).toBeGreaterThan(1);
  });

  it('una estrella se puede convertir en agujero negro y la ficha lo dice', () => {
    const w = createStarSystem('sunLike');
    placePlanet(w, PLANET_PRESETS.earthLike, 1, 0);
    const sun = w.stars()[0];
    applyStarType(w, sun, 'blackHole', sun.name);
    expect(sun.blackHole).toBe(true);
    const info = describeBody(w, sun);
    expect(info.kindLabel).toBe('Agujero negro');
    expect(info.rows).toContainEqual(['Luminosidad', 'No emite luz']);
    expect(info.rows).toContainEqual(['Zona habitable', 'No hay (sin luz)']);
    // Y vuelve a ser estrella normal al elegir otro tipo
    applyStarType(w, sun, 'sunLike', sun.name);
    expect(sun.blackHole).toBe(false);
  });

  it('se guarda en las partidas; las viejas no traen agujeros negros', () => {
    const w = createStarSystem('sunLike');
    const bh = placeStar(w, SINGLE_STARS.blackHole, 5, 0);
    const data = JSON.parse(JSON.stringify(snapshot(w, { name: 'a', systemName: 'b', speedIndex: 1 })));
    expect(restoreWorld(data).get(bh.id)!.blackHole).toBe(true);
    for (const b of data.bodies) delete b.blackHole;
    expect(restoreWorld(data).get(bh.id)!.blackHole).toBe(false);
  });
});
