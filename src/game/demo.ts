import type { World } from '../sim/world';
import { createStarSystem } from '../sim/stars';
import { PLANET_PRESETS } from '../sim/planetTypes';
import { placePlanet } from './placement';

/**
 * Sistema del fondo del menú: dos estrellas, un gigante con anillos y un
 * planeta tipo Tierra. Las distancias están por fuera de la zona inestable
 * del par de estrellas, así que puede girar indefinidamente.
 */
export function createDemoSystem(): World {
  const w = createStarSystem('binary');
  const giant = placePlanet(w, PLANET_PRESETS.gasGiant, 0.8, 0);
  giant.ring = { color: 0xe3cfa4, outer: 2.6, tilt: 24 };
  placePlanet(w, PLANET_PRESETS.earthLike, -0.55, 0.1);
  w.removeNetMomentum();
  w.snapRenderState();
  return w;
}
