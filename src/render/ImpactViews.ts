import * as THREE from 'three';

/** El cráter se va borrando en un tiempo al azar entre estos segundos */
export const CRATER_LIFE_MIN = 245;
export const CRATER_LIFE_MAX = 390;
/** Segundos que el cráter brilla al rojo vivo mientras se enfría */
const CRATER_HEAT_SECONDS = 10;
/** Segundos que vuelan los fragmentos y que dura el destello */
const DEBRIS_SECONDS = 3.2;
const FLASH_SECONDS = 0.7;
/** Tamaño de cada fragmento en pantalla (píxeles) */
const DEBRIS_PX = 4;

function ramp(n: number, pixel: (r: number) => [number, number, number, number]): THREE.DataTexture {
  const data = new Uint8Array(n * 4);
  for (let j = 0; j < n; j++) {
    // Fila 0 = borde del cráter (r = 1); última fila = centro (r = 0)
    const r = 1 - (j + 0.5) / n;
    data.set(pixel(r).map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)), j * 4);
  }
  const tex = new THREE.DataTexture(data, 1, n);
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

let craterTex: { map: THREE.DataTexture; heat: THREE.DataTexture } | null = null;
/** Fondo oscuro, borde claro levantado y material expulsado alrededor que se difumina. */
function craterTextures() {
  craterTex ??= {
    map: ramp(64, (r) => {
      if (r < 0.62) return [0.16, 0.13, 0.11, 0.92];
      const rim = Math.exp(-(((r - 0.72) / 0.07) ** 2));
      const ejecta = Math.max(0, (1 - r) / 0.28);
      const shade = 0.2 + 0.65 * rim;
      return [shade, shade * 0.95, shade * 0.85, Math.max(0.92 * rim, 0.45 * ejecta)];
    }),
    // Calor: el centro arde y el borde apenas
    heat: ramp(64, (r) => {
      const h = Math.max(0, 1 - r / 0.7);
      return [h, h, h, 1];
    }),
  };
  return craterTex;
}

let dotTexture: THREE.DataTexture | null = null;
function dot(): THREE.DataTexture {
  if (dotTexture) return dotTexture;
  const n = 32;
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(i - n / 2 + 0.5, j - n / 2 + 0.5) / (n / 2);
      const a = Math.max(0, 1 - d) ** 1.5;
      data.set([255, 255, 255, Math.round(255 * a)], (j * n + i) * 4);
    }
  }
  dotTexture = new THREE.DataTexture(data, n, n);
  dotTexture.magFilter = THREE.LinearFilter;
  dotTexture.needsUpdate = true;
  return dotTexture;
}

/**
 * Cráter sobre la superficie (un casquete esférico pegado a ella). Va hijo de
 * la esfera del planeta, así gira y se achata con él. Primero arde al rojo
 * vivo, se enfría y se va borrando hasta desaparecer.
 */
export class CraterView {
  readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private age = 0;
  readonly life: number;

  /** `localNormal`: punto del choque en coordenadas de la esfera; `size`: tamaño relativo al radio (0..1) */
  constructor(localNormal: THREE.Vector3, size: number, random: () => number = Math.random) {
    // Ángulo del casquete: como mucho ~43° para que no cubra medio planeta
    const cap = Math.min(0.75, Math.max(0.06, Math.asin(Math.min(0.95, size))));
    const t = craterTextures();
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.004, 40, 12, 0, Math.PI * 2, 0, cap),
      new THREE.MeshStandardMaterial({
        map: t.map, emissiveMap: t.heat, emissive: new THREE.Color(0xff5a1a), emissiveIntensity: 2.2,
        transparent: true, depthWrite: false, roughness: 1, metalness: 0,
      }),
    );
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), localNormal.clone().normalize());
    this.life = CRATER_LIFE_MIN + random() * (CRATER_LIFE_MAX - CRATER_LIFE_MIN);
  }

  /** Avanza `dt` segundos; devuelve false cuando ya desapareció. */
  update(dt: number): boolean {
    this.age += dt;
    const m = this.mesh.material;
    m.emissiveIntensity = 2.2 * Math.max(0, 1 - this.age / CRATER_HEAT_SECONDS) ** 2;
    // Se va borrando poco a poco durante toda su vida
    m.opacity = Math.max(0, 1 - this.age / this.life);
    return this.age < this.life;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

/**
 * Fragmentos que salen despedidos del choque y un destello. Va en el grupo del
 * planeta (no gira con él). Las distancias se miden en radios del planeta.
 */
export class DebrisBurst {
  readonly group = new THREE.Group();
  private readonly points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly flash: THREE.Sprite;
  private readonly velocities: Float32Array;
  private readonly planetRadius: number;
  private age = 0;

  constructor(
    normal: THREE.Vector3, planetRadius: number, impactorRadius: number, colors: [number, number],
    random: () => number = Math.random,
  ) {
    const n = Math.round(Math.min(260, 50 + 600 * (impactorRadius / planetRadius)));
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    this.velocities = new Float32Array(n * 3);
    const origin = normal.clone().normalize().multiplyScalar(planetRadius);
    const palette = [new THREE.Color(colors[0]), new THREE.Color(colors[1]), new THREE.Color(0xffa040), new THREE.Color(0xfff0c0)];
    const dir = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      pos.set([origin.x, origin.y, origin.z], i * 3);
      // Hacia fuera del planeta, en un cono amplio alrededor del punto del choque
      dir.set(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize().multiplyScalar(0.85);
      dir.add(normal).normalize();
      const speed = planetRadius * (0.5 + random() * 1.8);
      this.velocities.set([dir.x * speed, dir.y * speed, dir.z * speed], i * 3);
      const c = palette[random() < 0.35 ? 2 + Math.floor(random() * 2) : Math.floor(random() * 2)];
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    // Tamaño fijo en pantalla (píxeles): se ven igual de cerca que de lejos
    this.points = new THREE.Points(g, new THREE.PointsMaterial({
      map: dot(), vertexColors: true, size: DEBRIS_PX, sizeAttenuation: false,
      transparent: true, depthWrite: false,
    }));
    this.points.frustumCulled = false;
    this.planetRadius = planetRadius;
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dot(), color: 0xffd9a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.flash.position.copy(origin);
    this.flash.scale.setScalar(planetRadius * 0.6);
    this.group.add(this.points, this.flash);
  }

  /** Avanza `dt` segundos; devuelve false cuando ya terminó. */
  update(dt: number): boolean {
    this.age += dt;
    const pos = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const v = this.velocities;
    const drag = Math.max(0, 1 - 0.9 * dt);
    for (let i = 0; i < v.length; i += 3) {
      pos.array[i] += v[i] * dt; pos.array[i + 1] += v[i + 1] * dt; pos.array[i + 2] += v[i + 2] * dt;
      v[i] *= drag; v[i + 1] *= drag; v[i + 2] *= drag;
    }
    pos.needsUpdate = true;
    this.points.material.opacity = Math.max(0, 1 - this.age / DEBRIS_SECONDS);
    // Destello: crece y se apaga enseguida
    const f = Math.min(1, this.age / FLASH_SECONDS);
    this.flash.material.opacity = 1 - f;
    this.flash.scale.setScalar(this.planetRadius * (0.5 + 1.3 * f));
    return this.age < DEBRIS_SECONDS;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.flash.material.dispose();
  }
}
