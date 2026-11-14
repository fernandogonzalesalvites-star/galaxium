import * as THREE from 'three';

/** Tamaño en pantalla, como fracción de la distancia a la cámara (se ve igual a cualquier zoom) */
const SCREEN_SIZE = 0.03;
/** Radios del disco de acreción, en radios del horizonte */
const DISK_INNER = 1.5;
const DISK_OUTER = 4.2;
/** Inclinación del disco (radianes) */
const DISK_TILT = 0.35;
/** Vueltas por segundo del disco (tiempo real) */
const DISK_SPIN_HZ = 0.12;
const TEXELS = 256;

/** Disco de acreción: caliente (blanco-amarillo) por dentro, rojizo y tenue por fuera, con grumos. */
function diskTexture(): THREE.DataTexture {
  const data = new Uint8Array(TEXELS * TEXELS * 4);
  for (let j = 0; j < TEXELS; j++) {
    for (let i = 0; i < TEXELS; i++) {
      // u: radio (0 dentro → 1 fuera); v: ángulo
      const u = i / (TEXELS - 1), v = j / TEXELS;
      const heat = Math.pow(1 - u, 1.6);
      const streak = 0.75 + 0.25 * Math.sin(v * Math.PI * 2 * 7 + u * 18) * Math.sin(v * Math.PI * 2 * 3 - u * 9);
      const edge = Math.min(1, u / 0.05) * Math.pow(1 - u, 0.7);
      const a = Math.min(1, edge * streak * (0.35 + 0.9 * heat));
      const o = (j * TEXELS + i) * 4;
      data[o] = 255;
      data[o + 1] = Math.round(120 + 135 * heat);
      data[o + 2] = Math.round(40 + 200 * heat * heat);
      data[o + 3] = Math.round(255 * a);
    }
  }
  const tex = new THREE.DataTexture(data, TEXELS, TEXELS);
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Anillo de luz desviada alrededor del horizonte (siempre mirando a la cámara). */
function photonRingTexture(): THREE.DataTexture {
  const n = 128;
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const r = Math.hypot(i - n / 2 + 0.5, j - n / 2 + 0.5) / (n / 2);
      // Fino y brillante en r≈0,5 (justo fuera del horizonte), con un halo suave
      const ring = Math.exp(-(((r - 0.5) / 0.035) ** 2)) + 0.25 * Math.exp(-(((r - 0.55) / 0.15) ** 2));
      const o = (j * n + i) * 4;
      data[o] = 255; data[o + 1] = 210; data[o + 2] = 150;
      data[o + 3] = Math.round(255 * Math.min(1, ring) * (r < 1 ? 1 : 0));
    }
  }
  const tex = new THREE.DataTexture(data, n, n);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Disco de radio 1 en el plano XZ con UV (u = radio, v = ángulo) para el disco de acreción. */
function diskGeometry(): THREE.RingGeometry {
  const g = new THREE.RingGeometry(DISK_INNER, DISK_OUTER, 128, 4);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    uv.setXY(i, (Math.hypot(x, y) - DISK_INNER) / (DISK_OUTER - DISK_INNER), (Math.atan2(y, x) / (Math.PI * 2) + 1) % 1);
  }
  g.rotateX(-Math.PI / 2);
  return g;
}

/**
 * Cómo se ve un agujero negro: una esfera negra (el horizonte) que tapa lo que
 * hay detrás, un disco de acreción brillante que gira y un anillo de luz.
 * Se escala con la distancia de la cámara para verse siempre.
 */
export class BlackHoleView {
  readonly group = new THREE.Group();
  private readonly disk: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly horizon: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private readonly ring: THREE.Sprite;

  constructor(color: THREE.Color) {
    this.horizon = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    this.disk = new THREE.Mesh(
      diskGeometry(),
      new THREE.MeshBasicMaterial({
        map: diskTexture(), color, transparent: true, depthWrite: false,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      }),
    );
    // El disco gira sobre su propio eje dentro de un grupo inclinado (si no, bambolea)
    const tilted = new THREE.Group();
    tilted.rotation.z = DISK_TILT;
    tilted.add(this.disk);
    this.ring = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: photonRingTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.ring.scale.setScalar(4);
    // El horizonte se dibuja antes que el disco para tapar su mitad trasera
    this.horizon.renderOrder = 1;
    this.disk.renderOrder = 2;
    this.ring.renderOrder = 3;
    this.group.add(this.horizon, tilted, this.ring);
  }

  update(cameraDistance: number, nowMs: number): void {
    this.group.scale.setScalar(cameraDistance * SCREEN_SIZE);
    this.disk.rotation.y = ((nowMs / 1000) * DISK_SPIN_HZ * Math.PI * 2) % (Math.PI * 2);
  }

  setColor(color: THREE.Color): void {
    this.disk.material.color.copy(color);
    this.ring.material.color.copy(color);
  }

  dispose(): void {
    this.horizon.geometry.dispose();
    this.horizon.material.dispose();
    this.disk.geometry.dispose();
    this.disk.material.map?.dispose();
    this.disk.material.dispose();
    this.ring.material.map?.dispose();
    this.ring.material.dispose();
  }
}
