import { describe, it, expect } from 'vitest';
import { mergeCollisions, randomPlanetColor } from '../../src/sim/collisions';
import { launchProjectile, PROJECTILE_SPECS, rockyMass } from '../../src/sim/projectiles';
import { placeMoon, placePlanet } from '../../src/game/placement';
import { createStarSystem } from '../../src/sim/stars';
import { PLANET_PRESETS } from '../../src/sim/planetTypes';
import { EARTH_MASS, EARTH_RADIUS_AU, DT } from '../../src/sim/units';

function system() {
  const w = createStarSystem('sunLike');
  const earth = placePlanet(w, PLANET_PRESETS.earthLike, 1, 0);
  w.removeNetMomentum();
  return { w, earth };
}

describe('choques', () => {
  it('dos cuerpos que se tocan se fusionan: masa y movimiento se conservan, crece y cambia de color', () => {
    const { w, earth } = system();
    const rock = w.add({ name: 'Roca', kind: 'rocky', mass: 0.1 * EARTH_MASS, radius: 0.3 * EARTH_RADIUS_AU, x: earth.x + 0.0001, y: earth.y, z: earth.z, vx: earth.vx + 5, vy: 0, vz: earth.vz, color: 0x123456 });
    const before = { mass: earth.mass + rock.mass, px: earth.mass * earth.vx + rock.mass * rock.vx, r: earth.radius, color: earth.color };
    const impacts = mergeCollisions(w, () => 0.42);
    expect(impacts).toHaveLength(1);
    expect(impacts[0]).toMatchObject({ survivorId: earth.id, eatenName: 'Roca' });
    expect(w.get(rock.id)).toBeUndefined();
    expect(earth.mass).toBeCloseTo(before.mass, 15);
    expect(earth.mass * earth.vx).toBeCloseTo(before.px, 12);
    expect(earth.radius).toBeGreaterThan(before.r);
    expect(earth.color).not.toBe(before.color);
    // El cráter va hacia donde estaba la roca (+x)
    expect(impacts[0].normal.x).toBeGreaterThan(0.99);
  });

  it('las estrellas no chocan y los cuerpos lejanos tampoco', () => {
    const { w } = system();
    placePlanet(w, PLANET_PRESETS.gasGiant, 5, 0);
    expect(mergeCollisions(w)).toEqual([]);
    expect(w.bodies).toHaveLength(3);
  });

  it('las lunas del que desaparece pasan al que queda', () => {
    const { w, earth } = system();
    const small = placePlanet(w, PLANET_PRESETS.smallRocky, 1.0002, 0);
    const moon = placeMoon(w, small, PLANET_PRESETS.moon, 1.0002, 0.002);
    mergeCollisions(w);
    expect(moon.parentId).toBe(earth.id);
  });

  it('color al azar válido', () => {
    for (let i = 0; i < 20; i++) {
      const c = randomPlanetColor();
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(0xffffff);
    }
  });
});

describe('lanzar proyectiles', () => {
  it('cada tipo tiene su tamaño; el tamaño se ajusta a sus límites', () => {
    const { w, earth } = system();
    const a = launchProjectile(w, earth, { type: 'asteroid', radiusEarth: 99, color: 0xff0000, travelYears: 0.01 });
    expect(a.radius / EARTH_RADIUS_AU).toBeCloseTo(PROJECTILE_SPECS.asteroid.max, 9);
    expect(a).toMatchObject({ kind: 'rocky', color: 0xff0000, name: 'Asteroide 1' });
    expect(a.mass).toBeCloseTo(rockyMass(PROJECTILE_SPECS.asteroid.max, 0.5), 15);
  });

  it('aunque vaya lento (20 o 25 días) sigue acertando, en cualquier dirección', () => {
    for (const travel of [20 / 365.25, 25 / 365.25]) {
      for (const angle of [0.1, 0.35, 0.6, 0.85]) {
        const { w, earth } = system();
        const rock = launchProjectile(w, earth, { type: 'asteroid', radiusEarth: 0.05, color: 0x888888, travelYears: travel }, () => angle);
        let steps = 0;
        while (w.get(rock.id) && steps < (travel / DT) * 2) {
          w.step(DT);
          mergeCollisions(w);
          steps++;
        }
        expect(w.get(rock.id), `viaje ${travel} ángulo ${angle}`).toBeUndefined();
      }
    }
  });

  it('va directo al objetivo y choca más o menos a tiempo', () => {
    const { w, earth } = system();
    const travel = 0.005;
    const rock = launchProjectile(w, earth, { type: 'medium', radiusEarth: 0.8, color: 0x888888, travelYears: travel }, () => 0.3);
    let steps = 0;
    while (w.get(rock.id) && steps < (travel / DT) * 2) {
      w.step(DT);
      mergeCollisions(w);
      steps++;
    }
    expect(w.get(rock.id)).toBeUndefined();
    expect(steps * DT).toBeLessThan(travel * 1.2);
  });
});
