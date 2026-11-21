import { describe, it, expect } from 'vitest';
import { canGrowVegetation, growVegetation, removeVegetation } from '../../src/game/vegetation';
import { placeMoon, placePlanet } from '../../src/game/placement';
import { restoreWorld, snapshot } from '../../src/game/save';
import { createStarSystem } from '../../src/sim/stars';
import { PLANET_PRESETS } from '../../src/sim/planetTypes';
import { describeBody } from '../../src/ui/bodyInfo';
import { vegetationMap } from '../../src/render/surfaceMaps';

function system() {
  const w = createStarSystem('sunLike');
  const earth = placePlanet(w, PLANET_PRESETS.earthLike, 1, 0);
  const moon = placeMoon(w, earth, PLANET_PRESETS.moon, 1.003, 0);
  const jupiter = placePlanet(w, PLANET_PRESETS.gasGiant, 5, 0);
  const neptune = placePlanet(w, PLANET_PRESETS.iceGiant, 30, 0);
  return { w, earth, moon, jupiter, neptune };
}

describe('vegetación', () => {
  it('los planetas nacen sin vegetación', () => {
    const { earth } = system();
    expect(earth.vegetation).toBe(0);
  });

  it('crece en planetas y lunas rocosos, nunca en gigantes de gas o hielo', () => {
    const { earth, moon, jupiter, neptune } = system();
    expect(growVegetation(earth)).toBe(true);
    expect(growVegetation(moon)).toBe(true);
    expect(earth.vegetation).not.toBe(0);
    expect(growVegetation(jupiter)).toBe(false);
    expect(growVegetation(neptune)).toBe(false);
    expect(jupiter.vegetation).toBe(0);
    expect(canGrowVegetation(neptune)).toBe(false);
  });

  it('cada vez sale al azar una distinta, y se puede quitar', () => {
    const { earth } = system();
    growVegetation(earth);
    const first = earth.vegetation;
    growVegetation(earth);
    expect(earth.vegetation).not.toBe(first);
    // Aunque el azar repita el número, cambia igual
    const repeat = () => (first - 1) / 2_000_000_000;
    earth.vegetation = first;
    growVegetation(earth, (() => { let n = 0; return () => (n++ === 0 ? repeat() : 0.5); })());
    expect(earth.vegetation).not.toBe(first);
    removeVegetation(earth);
    expect(earth.vegetation).toBe(0);
  });

  it('la ficha lo dice y el botón sabe si se puede', () => {
    const { w, earth, jupiter, moon } = system();
    expect(describeBody(w, earth).vegetation).toBe('none');
    growVegetation(earth);
    expect(describeBody(w, earth).vegetation).toBe('grown');
    expect(describeBody(w, earth).rows).toContainEqual(['Vegetación', 'Sí']);
    expect(describeBody(w, moon).vegetation).toBe('none');
    expect(describeBody(w, jupiter).vegetation).toBe('unavailable');
    expect(describeBody(w, w.stars()[0]).vegetation ?? null).toBeNull();
  });

  it('se guarda en las partidas; las viejas cargan sin vegetación', () => {
    const { w, earth } = system();
    growVegetation(earth);
    const data = JSON.parse(JSON.stringify(snapshot(w, { name: 'a', systemName: 'b', speedIndex: 1 })));
    expect(restoreWorld(data).get(earth.id)!.vegetation).toBe(earth.vegetation);
    for (const b of data.bodies) delete b.vegetation;
    expect(restoreWorld(data).get(earth.id)!.vegetation).toBe(0);
  });

  it('el dibujo cubre parte del planeta, no todo ni nada, y es verde', () => {
    const w = 128, h = 64;
    const map = vegetationMap(12345, w, h);
    let covered = 0, green = 0;
    for (let i = 0; i < w * h; i++) {
      if (map[i * 4 + 3] > 128) {
        covered++;
        if (map[i * 4 + 1] > map[i * 4] && map[i * 4 + 1] > map[i * 4 + 2]) green++;
      }
    }
    const frac = covered / (w * h);
    expect(frac).toBeGreaterThan(0.1);
    expect(frac).toBeLessThan(0.75);
    expect(green / covered).toBeGreaterThan(0.95);
  });
});
