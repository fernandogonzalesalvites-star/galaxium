import * as THREE from 'three';
import type { GalaxyType } from '../sim/galaxies';

/** Una vuelta de la galaxia sobre sí misma, en unidades de tiempo de simulación (~240 millones de años) */
const SPIN_PERIOD = 8;

const COUNTS: Record<GalaxyType, number> = { spiral: 7000, barred: 7000, elliptical: 6000, irregular: 2500, dwarf: 1200 };

function rng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Número con distribución normal (Box-Muller). */
function gauss(r: () => number): number {
  return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
}

let dotTexture: THREE.DataTexture | null = null;
/** Punto redondo y difuso para cada estrella de la nube. */
function dot(): THREE.DataTexture {
  if (dotTexture) return dotTexture;
  const n = 32;
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(i - n / 2 + 0.5, j - n / 2 + 0.5) / (n / 2);
      const a = Math.max(0, 1 - d) ** 2;
      data.set([255, 255, 255, Math.round(255 * a)], (j * n + i) * 4);
    }
  }
  dotTexture = new THREE.DataTexture(data, n, n);
  dotTexture.magFilter = THREE.LinearFilter;
  dotTexture.needsUpdate = true;
  return dotTexture;
}

/**
 * Posiciones (dentro de un disco de radio 1) y colores de las estrellas de una
 * galaxia, según su forma. Núcleo amarillento, brazos azulados con alguna
 * región rosada de estrellas naciendo.
 */
function cloud(type: GalaxyType, seed: number): { pos: Float32Array; col: Float32Array } {
  const r = rng(seed);
  const n = COUNTS[type];
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const core = [1, 0.85, 0.6], arm = [0.65, 0.78, 1], pink = [1, 0.55, 0.75];
  const arms = type === 'barred' ? 2 : 2 + Math.floor(r() * 2);
  const twist = 2.2 + r() * 1.2;
  for (let k = 0; k < n; k++) {
    let x = 0, y = 0, z = 0, c = core;
    const t = r();
    if (type === 'elliptical') {
      // Elipsoide sin brazos: más denso en el centro
      const rad = Math.pow(r(), 1.8);
      const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
      x = rad * Math.sin(ph) * Math.cos(th);
      z = rad * Math.sin(ph) * Math.sin(th) * 0.75;
      y = rad * Math.cos(ph) * 0.55;
      c = rad < 0.4 ? core : [1, 0.78, 0.55];
    } else if (type === 'irregular' || type === 'dwarf') {
      // Grumos sueltos
      const clumps = type === 'dwarf' ? 2 : 5;
      const ci = Math.floor(r() * clumps);
      const cr = rng(seed * 31 + ci);
      const cx = (cr() - 0.5) * 1.1, cz = (cr() - 0.5) * 1.1;
      x = cx + gauss(r) * 0.22; z = cz + gauss(r) * 0.22; y = gauss(r) * 0.08;
      c = r() < 0.12 ? pink : type === 'dwarf' ? [0.9, 0.9, 1] : arm;
    } else if (t < 0.22) {
      // Bulbo central
      x = gauss(r) * 0.12; z = gauss(r) * 0.12; y = gauss(r) * 0.08;
      c = core;
    } else if (type === 'barred' && t < 0.34) {
      // Barra
      x = (r() * 2 - 1) * 0.42; z = gauss(r) * 0.05; y = gauss(r) * 0.03;
      c = core;
    } else {
      // Brazos en espiral
      const a = Math.floor(r() * arms);
      const rad = type === 'barred' ? 0.4 + Math.pow(r(), 0.8) * 0.6 : 0.08 + Math.pow(r(), 0.7) * 0.92;
      const base = (a / arms) * Math.PI * 2 + (type === 'barred' ? 0 : 0);
      // Brazos finos y bien marcados: poca dispersión alrededor de la espiral
      const ang = base + Math.log(rad + 0.05) * twist + gauss(r) * 0.16 * (1.1 - rad);
      x = Math.cos(ang) * rad + gauss(r) * 0.02;
      z = Math.sin(ang) * rad + gauss(r) * 0.02;
      y = gauss(r) * 0.025;
      c = r() < 0.06 ? pink : rad < 0.3 ? core : arm;
    }
    pos.set([x, y, z], k * 3);
    const b = 0.55 + r() * 0.45;
    col.set([c[0] * b, c[1] * b, c[2] * b], k * 3);
  }
  return { pos, col };
}

/** Nube de puntos de una galaxia. El grupo se escala con el radio de la galaxia. */
export class GalaxyView {
  readonly group = new THREE.Group();
  private readonly spin = new THREE.Group();
  private readonly points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;

  constructor(type: GalaxyType, seed: number, color: THREE.Color) {
    const { pos, col } = cloud(type, seed);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({
      map: dot(), vertexColors: true, color, size: 1, sizeAttenuation: true,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
    // Cada galaxia con su propia inclinación
    const r = rng(seed + 99);
    this.group.rotation.set((r() - 0.5) * 1.2, r() * Math.PI * 2, (r() - 0.5) * 1.2);
    this.spin.add(this.points);
    this.group.add(this.spin);
  }

  /** Tamaño (kpc) y giro según el tiempo simulado. */
  update(radius: number, simTime: number): void {
    this.group.scale.setScalar(radius);
    // El tamaño de punto no se escala con el grupo: se ajusta al radio
    this.points.material.size = radius * 0.035;
    this.spin.rotation.y = -((simTime / SPIN_PERIOD) * Math.PI * 2) % (Math.PI * 2);
  }

  setColor(color: THREE.Color): void {
    this.points.material.color.copy(color);
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
