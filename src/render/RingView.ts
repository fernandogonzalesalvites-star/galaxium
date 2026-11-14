import * as THREE from 'three';
import type { Ring } from '../sim/body';
import { RING_INNER } from '../game/editing';

const BAND_TEXELS = 256;

/** Generador pseudoaleatorio con semilla, para que cada planeta tenga sus propias bandas. */
function seeded(seed: number): () => number {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/**
 * Textura de 1 píxel de alto con las bandas del anillo (de dentro hacia fuera):
 * brillo y transparencia variables, con huecos como la división de Cassini.
 */
function bandTexture(seed: number): THREE.DataTexture {
  const rnd = seeded(seed);
  const data = new Uint8Array(BAND_TEXELS * 4);
  // Unas pocas bandas anchas más ruido fino
  const waves = Array.from({ length: 5 }, () => ({ f: 2 + rnd() * 14, p: rnd() * Math.PI * 2, a: 0.1 + rnd() * 0.2 }));
  const gap = 0.45 + rnd() * 0.3;
  for (let i = 0; i < BAND_TEXELS; i++) {
    const t = i / (BAND_TEXELS - 1);
    let density = 0.65;
    for (const w of waves) density += w.a * Math.sin(t * w.f * Math.PI * 2 + w.p);
    // Hueco marcado
    density *= 1 - 0.85 * Math.exp(-(((t - gap) / 0.025) ** 2));
    // Bordes suaves
    density *= Math.min(1, t / 0.06) * Math.min(1, (1 - t) / 0.08);
    const d = Math.min(1, Math.max(0, density));
    const shade = 180 + Math.round(75 * d);
    data[i * 4] = shade;
    data[i * 4 + 1] = shade;
    data[i * 4 + 2] = shade;
    data[i * 4 + 3] = Math.round(235 * d);
  }
  const tex = new THREE.DataTexture(data, BAND_TEXELS, 1);
  tex.magFilter = THREE.LinearFilter;
  // Mipmaps: sin ellos las bandas parpadean y forman rayitas al verse de lejos
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** Disco plano entre RING_INNER y outer (en radios del planeta), con UV radial. */
function ringGeometry(outer: number): THREE.RingGeometry {
  const g = new THREE.RingGeometry(RING_INNER, outer, 160, 1);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (r - RING_INNER) / (outer - RING_INNER), 0.5);
  }
  uv.needsUpdate = true;
  return g;
}

/** Anillos de un planeta. Se añade al grupo del cuerpo y se escala con su radio. */
export class RingView {
  readonly mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private outer: number;

  constructor(ring: Ring, seed: number) {
    this.outer = ring.outer;
    // Sin iluminación: la luz de la estrella llega casi rasante al plano de los
    // anillos y con un material iluminado se verían casi negros
    const material = new THREE.MeshBasicMaterial({
      map: bandTexture(seed),
      color: new THREE.Color(ring.color),
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(ringGeometry(ring.outer), material);
    this.set(ring);
  }

  /** Aplica color, tamaño e inclinación. */
  set(ring: Ring): void {
    if (ring.outer !== this.outer) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = ringGeometry(ring.outer);
      this.outer = ring.outer;
    }
    this.mesh.material.color.set(ring.color);
    // RingGeometry está en el plano XY: se tumba al plano de la órbita (XZ) y se inclina
    this.mesh.rotation.set(-Math.PI / 2 + THREE.MathUtils.degToRad(ring.tilt), 0, 0);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.map?.dispose();
    this.mesh.material.dispose();
  }
}
