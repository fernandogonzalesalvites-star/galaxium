import * as THREE from 'three';

/** El cráter se va borrando en un tiempo al azar entre estos segundos */
export const CRATER_LIFE_MIN = 245;
export const CRATER_LIFE_MAX = 390;
/** Segundos que el cráter brilla al rojo vivo mientras se enfría */
const CRATER_HEAT_SECONDS = 10;
/** Segundos que vuelan los fragmentos y que dura el destello */
const DEBRIS_SECONDS = 4.5;
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

/** Una roca irregular (icosaedro deformado), compartida por todos los fragmentos. */
let rockGeometry: THREE.BufferGeometry | null = null;
function rock(): THREE.BufferGeometry {
  if (rockGeometry) return rockGeometry;
  // Sin vértices compartidos entre caras: se deforma por posición para que no se abra
  const g = new THREE.IcosahedronGeometry(1, 1);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // Mismo punto → misma deformación (depende solo de la posición)
    const h = Math.abs((Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453) % 1);
    const k = 0.7 + 0.45 * h;
    pos.setXYZ(i, x * k, y * k * 0.85, z * k);
  }
  g.computeVertexNormals();
  rockGeometry = g;
  return g;
}

interface Chunk {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  axis: THREE.Vector3;
  spin: number;
  angle: number;
  size: number;
}

/**
 * Fragmentos que salen despedidos del choque: trozos de roca en 3D, grandes
 * (algunos de hasta un cuarto del planeta, lo tapan un poco al pasar), que
 * giran mientras vuelan y reciben la luz de la estrella; más chispas
 * incandescentes y un destello. Va en el grupo del planeta (no gira con él).
 */
export class DebrisBurst {
  readonly group = new THREE.Group();
  private readonly rocks: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private readonly chunks: Chunk[] = [];
  private readonly sparks: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly sparkVel: Float32Array;
  private readonly flash: THREE.Sprite;
  private readonly planetRadius: number;
  private readonly dummy = new THREE.Object3D();
  private readonly q = new THREE.Quaternion();
  private age = 0;

  constructor(
    normal: THREE.Vector3, planetRadius: number, impactorRadius: number, colors: [number, number],
    random: () => number = Math.random,
  ) {
    this.planetRadius = planetRadius;
    const n = normal.clone().normalize();
    const origin = n.clone().multiplyScalar(planetRadius);
    const ratio = Math.min(1, impactorRadius / planetRadius);
    // Hacia fuera, en un cono amplio alrededor del punto del choque
    const outward = () =>
      new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize().multiplyScalar(0.9).add(n).normalize();

    // Rocas: más y más grandes cuanto mayor es lo que chocó
    const count = Math.round(18 + 70 * ratio);
    this.rocks = new THREE.InstancedMesh(
      rock(),
      new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, flatShading: true, transparent: true }),
      count,
    );
    this.rocks.frustumCulled = false;
    const palette = [new THREE.Color(colors[0]), new THREE.Color(colors[1]), new THREE.Color(0x6b5a4c), new THREE.Color(0x8a7a6a)];
    for (let i = 0; i < count; i++) {
      // Muchos medianos y unos pocos enormes (hasta ~25 % del radio del planeta)
      const size = planetRadius * (0.04 + 0.21 * Math.pow(random(), 2.2)) * (0.6 + 0.8 * ratio);
      this.chunks.push({
        pos: origin.clone(),
        vel: outward().multiplyScalar(planetRadius * (0.35 + random() * 1.3)),
        axis: new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize(),
        spin: (random() * 2 - 1) * 6,
        angle: random() * Math.PI * 2,
        size,
      });
      this.rocks.setColorAt(i, palette[Math.floor(random() * palette.length)].clone().multiplyScalar(0.7 + random() * 0.4));
    }

    // Chispas incandescentes (pequeñas y brillantes)
    const sparkCount = Math.round(40 + 120 * ratio);
    const sp = new Float32Array(sparkCount * 3);
    const sc = new Float32Array(sparkCount * 3);
    this.sparkVel = new Float32Array(sparkCount * 3);
    const hot = [new THREE.Color(0xffa040), new THREE.Color(0xfff0c0), new THREE.Color(0xff6020)];
    for (let i = 0; i < sparkCount; i++) {
      sp.set([origin.x, origin.y, origin.z], i * 3);
      const v = outward().multiplyScalar(planetRadius * (0.6 + random() * 2.2));
      this.sparkVel.set([v.x, v.y, v.z], i * 3);
      const c = hot[Math.floor(random() * hot.length)];
      sc.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    g.setAttribute('color', new THREE.BufferAttribute(sc, 3));
    this.sparks = new THREE.Points(g, new THREE.PointsMaterial({
      map: dot(), vertexColors: true, size: DEBRIS_PX, sizeAttenuation: false,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.sparks.frustumCulled = false;

    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dot(), color: 0xffd9a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.flash.position.copy(origin);
    this.flash.scale.setScalar(planetRadius * 0.6);
    this.group.add(this.rocks, this.sparks, this.flash);
    this.placeRocks();
  }

  private placeRocks(): void {
    this.chunks.forEach((c, i) => {
      this.dummy.position.copy(c.pos);
      this.dummy.quaternion.copy(this.q.setFromAxisAngle(c.axis, c.angle));
      this.dummy.scale.setScalar(c.size);
      this.dummy.updateMatrix();
      this.rocks.setMatrixAt(i, this.dummy.matrix);
    });
    this.rocks.instanceMatrix.needsUpdate = true;
  }

  /** Avanza `dt` segundos; devuelve false cuando ya terminó. */
  update(dt: number): boolean {
    this.age += dt;
    const drag = Math.max(0, 1 - 0.7 * dt);
    for (const c of this.chunks) {
      c.pos.addScaledVector(c.vel, dt);
      c.vel.multiplyScalar(drag);
      c.angle += c.spin * dt;
    }
    this.placeRocks();
    // Las rocas se ven enteras casi todo el tiempo y se desvanecen al final
    const t = this.age / DEBRIS_SECONDS;
    this.rocks.material.opacity = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.4);
    const pos = this.sparks.geometry.getAttribute('position') as THREE.BufferAttribute;
    const v = this.sparkVel;
    for (let i = 0; i < v.length; i += 3) {
      pos.array[i] += v[i] * dt; pos.array[i + 1] += v[i + 1] * dt; pos.array[i + 2] += v[i + 2] * dt;
      v[i] *= drag; v[i + 1] *= drag; v[i + 2] *= drag;
    }
    pos.needsUpdate = true;
    this.sparks.material.opacity = Math.max(0, 1 - this.age / (DEBRIS_SECONDS * 0.6));
    // Destello: crece y se apaga enseguida
    const f = Math.min(1, this.age / FLASH_SECONDS);
    this.flash.material.opacity = 1 - f;
    this.flash.scale.setScalar(this.planetRadius * (0.5 + 1.3 * f));
    return this.age < DEBRIS_SECONDS;
  }

  dispose(): void {
    // La geometría de roca es compartida: no se libera
    this.rocks.material.dispose();
    this.rocks.dispose();
    this.sparks.geometry.dispose();
    this.sparks.material.dispose();
    this.flash.material.dispose();
  }
}

