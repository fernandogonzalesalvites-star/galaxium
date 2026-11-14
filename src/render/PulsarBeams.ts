import * as THREE from 'three';

/** Vueltas por segundo (tiempo real, no simulado): el púlsar siempre gira rápido */
const SPIN_HZ = 0.8;
/** Inclinación de los haces respecto al eje de giro (radianes) */
const MAGNETIC_TILT = 0.55;
/** Largo de los haces respecto a la distancia de la cámara: siempre se ven del mismo tamaño */
const SCREEN_LENGTH = 0.18;
const BEAM_WIDTH = 0.09;

/** Degradado: brillante junto a la estrella y desvanecido en la punta. */
function fadeTexture(): THREE.DataTexture {
  const n = 64;
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    // Fila 0 = base del cono (punta del haz); fila n-1 = vértice (junto a la estrella)
    const t = i / (n - 1);
    const a = Math.round(255 * t * t);
    data.set([a, a, a, 255], i * 4);
  }
  const tex = new THREE.DataTexture(data, 1, n);
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Cono de largo 1 con el vértice en el origen, apuntando hacia -Y. */
function beamGeometry(): THREE.ConeGeometry {
  const g = new THREE.ConeGeometry(BEAM_WIDTH, 1, 24, 1, true);
  g.translate(0, -0.5, 0);
  return g;
}

/**
 * Los dos haces de radiación de un púlsar: salen por los polos magnéticos,
 * inclinados respecto al eje de giro, y barren el espacio como un faro.
 */
export class PulsarBeams {
  readonly group = new THREE.Group();
  private readonly tilted = new THREE.Group();
  private readonly material: THREE.MeshBasicMaterial;
  private readonly geometry = beamGeometry();

  constructor(color: THREE.Color) {
    this.material = new THREE.MeshBasicMaterial({
      color,
      alphaMap: fadeTexture(),
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const down = new THREE.Mesh(this.geometry, this.material);
    const up = new THREE.Mesh(this.geometry, this.material);
    up.rotation.x = Math.PI;
    this.tilted.rotation.z = MAGNETIC_TILT;
    this.tilted.add(down, up);
    this.group.add(this.tilted);
  }

  /** Gira los haces y ajusta su largo a la distancia de la cámara. */
  update(cameraDistance: number, nowMs: number): void {
    this.group.rotation.y = ((nowMs / 1000) * SPIN_HZ * Math.PI * 2) % (Math.PI * 2);
    this.group.scale.setScalar(cameraDistance * SCREEN_LENGTH);
  }

  setColor(color: THREE.Color): void {
    this.material.color.copy(color);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.alphaMap?.dispose();
    this.material.dispose();
  }
}
