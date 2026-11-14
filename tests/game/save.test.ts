import { describe, it, expect } from 'vitest';
import { isValidSave, restoreWorld, snapshot } from '../../src/game/save';
import { placeMoon, placePlanet } from '../../src/game/placement';
import { createStarSystem } from '../../src/sim/stars';
import { PLANET_PRESETS } from '../../src/sim/planetTypes';
import { DT } from '../../src/sim/units';

function game() {
  const w = createStarSystem('binary');
  const saturn = placePlanet(w, PLANET_PRESETS.gasGiant, 5, 0);
  saturn.ring = { color: 0xabcdef, outer: 2.5, tilt: 30 };
  saturn.texture = 'data:image/jpeg;base64,AAAA';
  const moon = placeMoon(w, saturn, PLANET_PRESETS.moon, 5.01, 0);
  w.removeNetMomentum();
  for (let i = 0; i < 50; i++) w.step(DT);
  return { w, saturn, moon };
}

describe('guardar partidas', () => {
  it('al cargar queda el mismo sistema, con anillos, textura y lunas', () => {
    const { w, saturn, moon } = game();
    const data = JSON.parse(JSON.stringify(snapshot(w, { name: 'Mi sistema', systemName: 'Sistema doble', speedIndex: 3 })));
    const loaded = restoreWorld(data);
    expect(loaded.time).toBe(w.time);
    expect(loaded.bodies).toHaveLength(w.bodies.length);
    const s = loaded.get(saturn.id)!;
    expect(s).toMatchObject({ name: saturn.name, x: saturn.x, vz: saturn.vz, ring: saturn.ring, texture: saturn.texture });
    expect(loaded.get(moon.id)!.parentId).toBe(saturn.id);
    expect(data).toMatchObject({ name: 'Mi sistema', systemName: 'Sistema doble', speedIndex: 3 });
  });

  it('la simulación sigue igual que sin guardar', () => {
    const { w } = game();
    const loaded = restoreWorld(snapshot(w, { name: 'a', systemName: 'b', speedIndex: 1 }));
    for (let i = 0; i < 200; i++) {
      w.step(DT);
      loaded.step(DT);
    }
    for (const b of w.bodies) {
      const c = loaded.get(b.id)!;
      expect(c.x).toBeCloseTo(b.x, 12);
      expect(c.z).toBeCloseTo(b.z, 12);
    }
  });

  it('los cuerpos nuevos no repiten ids de la partida cargada', () => {
    const { w } = game();
    const loaded = restoreWorld(snapshot(w, { name: 'a', systemName: 'b', speedIndex: 1 }));
    const added = placePlanet(loaded, PLANET_PRESETS.earthLike, 1, 0);
    const maxId = Math.max(...w.bodies.map((b) => b.id));
    expect(added.id).toBeGreaterThan(maxId);
  });

  it('cambiar la partida cargada no cambia la guardada', () => {
    const { w, saturn } = game();
    const data = snapshot(w, { name: 'a', systemName: 'b', speedIndex: 1 });
    const loaded = restoreWorld(data);
    loaded.get(saturn.id)!.ring!.outer = 3.4;
    expect(data.bodies.find((b) => b.id === saturn.id)!.ring!.outer).toBe(2.5);
  });

  it('un púlsar sigue siendo púlsar al cargar; las partidas viejas no traen púlsares', () => {
    const w = createStarSystem('pulsar');
    const data = JSON.parse(JSON.stringify(snapshot(w, { name: 'a', systemName: 'Púlsar', speedIndex: 1 })));
    expect(restoreWorld(data).bodies[0].pulsar).toBe(true);
    delete data.bodies[0].pulsar;
    expect(restoreWorld(data).bodies[0].pulsar).toBe(false);
  });

  it('guarda la textura incluida; las partidas viejas reciben la de su tipo', () => {
    const { w, saturn, moon } = game();
    saturn.surface = 'ice';
    const data = JSON.parse(JSON.stringify(snapshot(w, { name: 'a', systemName: 'b', speedIndex: 1 })));
    expect(restoreWorld(data).get(saturn.id)!.surface).toBe('ice');
    for (const b of data.bodies) delete b.surface;
    const old = restoreWorld(data);
    expect(old.get(saturn.id)!.surface).toBe('bands');
    expect(old.get(moon.id)!.surface).toBe('craters');
  });

  it('rechaza datos dañados', () => {
    const { w } = game();
    const good = snapshot(w, { name: 'a', systemName: 'b', speedIndex: 1 });
    expect(isValidSave(good)).toBe(true);
    expect(isValidSave(null)).toBe(false);
    expect(isValidSave({ ...good, version: 99 })).toBe(false);
    expect(isValidSave({ ...good, bodies: [{ ...good.bodies[0], x: NaN }] })).toBe(false);
    expect(isValidSave({ ...good, bodies: [{ ...good.bodies[0], parentId: 999 }] })).toBe(false);
    expect(() => restoreWorld({ ...good, version: 0 })).toThrow();
  });
});
