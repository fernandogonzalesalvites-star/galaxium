import { describe, it, expect } from 'vitest';
import { addClouds, canHaveClouds, removeClouds } from '../../src/game/vegetation';
import { placeMoon, placePlanet } from '../../src/game/placement';
import { restoreWorld, snapshot } from '../../src/game/save';
import { createStarSystem } from '../../src/sim/stars';
import { PLANET_PRESETS } from '../../src/sim/planetTypes';
import { describeBody } from '../../src/ui/bodyInfo';
import { cloudMap } from '../../src/render/surfaceMaps';

function system() {
  const w = createStarSystem('sunLike');
  const earth = placePlanet(w, PLANET_PRESETS.earthLike, 1, 0);
  const moon = placeMoon(w, earth, PLANET_PRESETS.moon, 1.003, 0);
  const jupiter = placePlanet(w, PLANET_PRESETS.gasGiant, 5, 0);
  return { w, earth, moon, jupiter };
}

describe('nubes', () => {
  it('se añaden en planetas con atmósfera (rocosos o gaseosos), no en una luna sin aire', () => {
    const { earth, moon, jupiter } = system();
    expect(earth.clouds).toBe(0);
    expect(addClouds(earth)).toBe(true);
    expect(addClouds(jupiter)).toBe(true);
    expect(addClouds(moon)).toBe(false);
    expect(moon.clouds).toBe(0);
    expect(canHaveClouds(moon)).toBe(false);
  });

  it('cada vez salen otras al azar, y se pueden quitar', () => {
    const { earth } = system();
    addClouds(earth);
    const first = earth.clouds;
    addClouds(earth);
    expect(earth.clouds).not.toBe(first);
    removeClouds(earth);
    expect(earth.clouds).toBe(0);
  });

  it('la ficha sabe si se pueden añadir', () => {
    const { w, earth, moon } = system();
    expect(describeBody(w, earth).clouds).toBe('none');
    addClouds(earth);
    expect(describeBody(w, earth).clouds).toBe('added');
    expect(describeBody(w, moon).clouds).toBe('unavailable');
  });

  it('se guardan; las partidas viejas cargan sin nubes', () => {
    const { w, earth } = system();
    addClouds(earth);
    const data = JSON.parse(JSON.stringify(snapshot(w, { name: 'a', systemName: 'b', speedIndex: 1 })));
    expect(restoreWorld(data).get(earth.id)!.clouds).toBe(earth.clouds);
    for (const b of data.bodies) delete b.clouds;
    expect(restoreWorld(data).get(earth.id)!.clouds).toBe(0);
  });

  it('el dibujo es blanco y cubre parte del cielo', () => {
    const w = 128, h = 64;
    const map = cloudMap(987, w, h);
    let covered = 0;
    for (let i = 0; i < w * h; i++) {
      if (map[i * 4 + 3] > 100) {
        covered++;
        expect(map[i * 4]).toBe(map[i * 4 + 1]);
        expect(map[i * 4]).toBeGreaterThan(200);
      }
    }
    const frac = covered / (w * h);
    expect(frac).toBeGreaterThan(0.1);
    expect(frac).toBeLessThan(0.8);
  });
});
