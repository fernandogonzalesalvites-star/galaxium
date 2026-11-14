import { describe, it, expect } from 'vitest';
import {
  checkGalaxyPlacement, createGalaxyUniverse, galaxies, GALAXY_SOFTENING2, mergeGalaxies, placeGalaxy,
} from '../../src/sim/galaxies';
import { restoreWorld, snapshot } from '../../src/game/save';
import { describeBody } from '../../src/ui/bodyInfo';
import { DT } from '../../src/sim/units';

describe('modo galaxias', () => {
  it('empieza con la Vía Láctea y la Nube de Magallanes, sin estrellas', () => {
    const w = createGalaxyUniverse();
    expect(galaxies(w).map((g) => g.name)).toEqual(['Vía Láctea', 'Nube de Magallanes']);
    expect(w.stars()).toHaveLength(0);
    expect(w.softening2).toBe(GALAXY_SOFTENING2);
  });

  it('la Nube de Magallanes da vueltas a la Vía Láctea sin escaparse ni chocar', () => {
    const w = createGalaxyUniverse();
    const [mw, lmc] = galaxies(w);
    const d0 = Math.hypot(lmc.x - mw.x, lmc.z - mw.z);
    for (let i = 0; i < 20000; i++) w.step(DT);
    expect(mergeGalaxies(w)).toEqual([]);
    const d = Math.hypot(lmc.x - mw.x, lmc.z - mw.z);
    expect(d / d0).toBeGreaterThan(0.9);
    expect(d / d0).toBeLessThan(1.1);
  });

  it('dos galaxias que chocan se fusionan conservando masa y momento; iguales dan una elíptica', () => {
    const w = createGalaxyUniverse();
    const a = placeGalaxy(w, 'spiral', 200, 0);
    const b = placeGalaxy(w, 'spiral', 203, 0);
    const mass = a.mass + b.mass;
    const p = a.mass * a.vz + b.mass * b.vz;
    const merged = mergeGalaxies(w);
    expect(merged).toHaveLength(1);
    const survivor = w.get(a.id) ?? w.get(b.id)!;
    expect(survivor.mass).toBeCloseTo(mass, 9);
    expect(survivor.mass * survivor.vz).toBeCloseTo(p, 9);
    expect(survivor.galaxyType).toBe('elliptical');
  });

  it('no deja poner una galaxia encima de otra', () => {
    const w = createGalaxyUniverse();
    expect(checkGalaxyPlacement(w, 'spiral', 5, 0).ok).toBe(false);
    expect(checkGalaxyPlacement(w, 'dwarf', 300, 0)).toMatchObject({ ok: true, warning: null });
  });

  it('se guarda como partida de galaxias y la ficha habla en años luz', () => {
    const w = createGalaxyUniverse();
    const data = JSON.parse(JSON.stringify(snapshot(w, { name: 'u', systemName: 'Galaxias', speedIndex: 5, universe: 'galaxies' })));
    const loaded = restoreWorld(data);
    expect(loaded.softening2).toBe(GALAXY_SOFTENING2);
    expect(galaxies(loaded)[0].galaxyType).toBe('spiral');
    const info = describeBody(loaded, galaxies(loaded)[0]);
    expect(info.kindLabel).toBe('Galaxia espiral');
    expect(info.rows.find(([k]) => k === 'Diámetro')![1]).toMatch(/años luz/);
  });
});
