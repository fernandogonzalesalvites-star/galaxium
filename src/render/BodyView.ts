import * as THREE from 'three';
import type { Body } from '../sim/body';
import type { Vec3 } from '../sim/vec';
import { visualRadius } from '../sim/scale';
import { DT } from '../sim/units';
import { TRAIL_LENGTH, TrailHistory } from './trail';
import { markerTexture } from './markerTexture';
import { RingView } from './RingView';
import { PulsarBeams } from './PulsarBeams';
import { BlackHoleView } from './BlackHoleView';
import { GalaxyView } from './GalaxyView';
import type { GalaxyType } from '../sim/galaxies';

/** Intensidad de la luz de una estrella y del brillo del disco de un agujero negro */
const STAR_LIGHT = 3;
const BLACK_HOLE_LIGHT = 0.4;
import { surfaceTexture, vegetationTexture } from './surfaceTextures';
import { flattening } from '../sim/rotation';
import { EclipseShell, type EclipseShadow } from './EclipseShell';

/** La capa de vegetación va un 0,4 % por encima de la superficie */
const VEGETATION_LIFT = 1.004;
/**
 * Orden de dibujo de las capas transparentes de un planeta. Las dos tienen su
 * centro en el del planeta, así que three.js no sabe cuál va delante: primero
 * la vegetación (pegada a la superficie) y luego los anillos.
 */
const VEGETATION_ORDER = 1;
const SHADOW_ORDER = 2;
const RING_ORDER = 3;
/** La capa de los eclipses va un 0,6 % por encima de la superficie (sobre la vegetación) */
const ECLIPSE_LIFT = 1.006;

const textureLoader = new THREE.TextureLoader();

export { TRAIL_LENGTH };
/** Tamaño en pantalla del punto marcador (sprite sin atenuación) */
const MARKER_SCALE = 0.012;
/** Por debajo de este radio aparente (px) se muestra el marcador */
const MARKER_HIDE_PX = 4;

export function interpolated(b: Body, alpha: number): Vec3 {
  return {
    x: b.px + (b.x - b.px) * alpha,
    y: b.py + (b.y - b.py) * alpha,
    z: b.pz + (b.z - b.pz) * alpha,
  };
}

export class BodyView {
  readonly group = new THREE.Group();
  readonly trail: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  /** Radio aparente en píxeles, actualizado en cada update */
  screenRadiusPx = 0;
  /** Historial de la estela, rellenado por substep desde SceneView.recordTrails */
  readonly history = new TrailHistory();
  private readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial | THREE.MeshStandardMaterial>;
  private readonly marker: THREE.Sprite;
  private readonly color: THREE.Color;
  private colorHex: number;
  private readonly light: THREE.PointLight | null = null;
  private lastTrailTime = -Infinity;
  private ring: RingView | null = null;
  private beams: PulsarBeams | null = null;
  private blackHole: BlackHoleView | null = null;
  private galaxy: GalaxyView | null = null;
  private vegetation: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial> | null = null;
  private vegetationSeed = 0;
  /** Capa donde se dibuja la sombra de un eclipse (se crea la primera vez que hace falta) */
  private eclipse: EclipseShell | null = null;
  private galaxyType: GalaxyType | null = null;
  private ringKey = '';
  /** Data URL de la textura que se está mostrando (null = color liso) */
  private textureUrl: string | null = null;
  /** Superficie que se está mostrando ('' = color liso) */
  private surfaceKey = '';
  /** La textura actual es solo de este cuerpo (imagen propia) y hay que liberarla */
  private ownsMap = false;

  constructor(body: Body) {
    this.color = new THREE.Color(body.color);
    this.colorHex = body.color;
    const material =
      body.kind === 'star'
        ? new THREE.MeshBasicMaterial({ color: this.color })
        : new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.9, metalness: 0 });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), material);
    this.marker = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: markerTexture(), color: this.color, sizeAttenuation: false, transparent: true, depthWrite: false }),
    );
    this.marker.scale.setScalar(MARKER_SCALE);
    this.group.add(this.mesh, this.marker);
    if (body.kind === 'star') {
      this.light = new THREE.PointLight(this.color, STAR_LIGHT, 0, 0);
      this.group.add(this.light);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((TRAIL_LENGTH + 1) * 3), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array((TRAIL_LENGTH + 1) * 3), 3));
    geometry.setDrawRange(0, 0);
    this.trail = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.trail.frustumCulled = false;
  }

  update(
    b: Body, alpha: number, focus: Vec3, center: Vec3 | null, time: number,
    camera: THREE.PerspectiveCamera, viewportHeightPx: number, spinSeconds = 0,
  ): void {
    if (b.color !== this.colorHex) this.setColor(b.color);
    this.syncSurface(b);
    this.syncRing(b);
    const p = interpolated(b, alpha);
    this.group.position.set(p.x - focus.x, p.y - focus.y, p.z - focus.z);
    const r = visualRadius(b);
    // Si gira muy rápido (día de 5 h o menos) se achata: más ancho en el ecuador, aplastado en los polos
    const f = b.kind === 'star' || b.kind === 'galaxy' ? 0 : flattening(b.dayHours);
    this.mesh.scale.set(r * (1 + f / 2), r * (1 - f), r * (1 + f / 2));
    // Rotación: una vuelta cada `dayHours` segundos reales (1 hora del planeta = 1 segundo).
    // Gira la esfera con su textura y su vegetación; los anillos van aparte y no se tambalean
    if (b.dayHours > 0 && spinSeconds > 0) {
      this.mesh.rotation.y = (this.mesh.rotation.y + (spinSeconds / b.dayHours) * Math.PI * 2) % (Math.PI * 2);
    }
    this.ring?.mesh.scale.setScalar(r);
    const dist = Math.max(camera.position.distanceTo(this.group.position), 1e-12);
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    this.screenRadiusPx = (r / (dist * Math.tan(halfFov))) * (viewportHeightPx / 2);
    this.syncBeams(b, dist);
    this.syncBlackHole(b, dist);
    this.syncGalaxy(b, time);
    this.syncVegetation(b);
    // La capa del eclipse sigue la forma de la esfera (también si está achatada), sin girar con ella
    if (this.eclipse) this.eclipse.mesh.scale.copy(this.mesh.scale).multiplyScalar(ECLIPSE_LIFT);
    // El agujero negro siempre se ve por su disco: el punto marcador lo taparía
    this.marker.visible = !this.blackHole && this.screenRadiusPx < MARKER_HIDE_PX;
    this.updateTrail(p, alpha, focus, center, time);
  }

  private updateTrail(p: Vec3, alpha: number, focus: Vec3, center: Vec3 | null, time: number): void {
    const geometry = this.trail.geometry;
    if (!center) {
      geometry.setDrawRange(0, 0);
      return;
    }
    if (time < this.lastTrailTime) this.history.reset();
    this.lastTrailTime = time;
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = geometry.getAttribute('color') as THREE.BufferAttribute;
    const cx = center.x - focus.x, cy = center.y - focus.y, cz = center.z - focus.z;
    const renderTime = time - (1 - alpha) * DT;
    const minTime = time - this.history.period;
    // Primera pasada: cuántos puntos hay, para repartir el degradado
    let n = 0;
    this.history.forEachVisible(minTime, renderTime, () => { n++; });
    let k = 0;
    this.history.forEachVisible(minTime, renderTime, (rx, ry, rz) => {
      pos.setXYZ(k, rx + cx, ry + cy, rz + cz);
      const fade = ((k + 1) / (n + 1)) * 0.8;
      col.setXYZ(k, this.color.r * fade, this.color.g * fade, this.color.b * fade);
      k++;
    });
    // El último vértice es la posición actual, para que la estela llegue hasta el cuerpo
    pos.setXYZ(n, p.x - focus.x, p.y - focus.y, p.z - focus.z);
    col.setXYZ(n, this.color.r * 0.8, this.color.g * 0.8, this.color.b * 0.8);
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geometry.setDrawRange(0, n + 1);
  }

  /** Cambia el color tras editar el cuerpo. */
  private setColor(color: number): void {
    this.colorHex = color;
    this.color.set(color);
    // Con imagen propia la esfera la muestra tal cual; las texturas incluidas se tiñen
    if (!this.textureUrl) this.mesh.material.color.copy(this.color);
    this.marker.material.color.copy(this.color);
    this.light?.color.copy(this.color);
    this.beams?.setColor(this.color);
    this.blackHole?.setColor(this.color);
    this.galaxy?.setColor(this.color);
  }

  /** Pone o quita la imagen de la superficie. */
  /**
   * Pone la superficie: la imagen propia (sin teñir) o la textura incluida
   * (teñida con el color). Las estrellas no llevan textura.
   */
  private syncSurface(b: Body): void {
    const key = b.texture ? `img:${b.texture}` : b.kind === 'star' || b.surface === 'smooth' ? '' : `inc:${b.surface}:${b.id}`;
    if (key === this.surfaceKey) return;
    this.surfaceKey = key;
    this.textureUrl = b.texture;
    const material = this.mesh.material;
    // Las imágenes propias son solo de este cuerpo; las incluidas se comparten (caché)
    if (this.ownsMap) material.map?.dispose();
    material.map = null;
    this.ownsMap = false;
    material.color.copy(this.color);
    material.needsUpdate = true;
    if (!key) return;
    const apply = (tex: THREE.Texture, own: boolean, tint: boolean) => {
      // Si mientras se preparaba se cambió la superficie, se descarta
      if (this.surfaceKey !== key) {
        if (own) tex.dispose();
        return;
      }
      material.map = tex;
      this.ownsMap = own;
      if (tint) material.color.copy(this.color);
      else material.color.set(0xffffff);
      material.needsUpdate = true;
    };
    if (b.texture) {
      textureLoader.load(b.texture, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        apply(tex, true, false);
      });
    } else {
      void surfaceTexture(b.surface, b.id).then((tex) => apply(tex, false, true));
    }
  }

  /**
   * Vegetación: una capa verde y transparente apenas por encima de la superficie,
   * para que se vea sobre cualquier textura o color. Se quita al poner 0.
   */
  private syncVegetation(b: Body): void {
    const seed = b.kind === 'rocky' ? b.vegetation : 0;
    if (seed === this.vegetationSeed) return;
    this.vegetationSeed = seed;
    if (!seed) {
      if (this.vegetation) {
        this.mesh.remove(this.vegetation);
        this.vegetation.geometry.dispose();
        this.vegetation.material.dispose();
        this.vegetation = null;
      }
      return;
    }
    if (!this.vegetation) {
      this.vegetation = new THREE.Mesh(
        new THREE.SphereGeometry(VEGETATION_LIFT, 48, 32),
        new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 1, metalness: 0, opacity: 0 }),
      );
      // Se dibuja antes que los anillos: si no, se vería a través de ellos
      this.vegetation.renderOrder = VEGETATION_ORDER;
      // Hija de la esfera: hereda su tamaño
      this.mesh.add(this.vegetation);
    }
    const material = this.vegetation.material;
    void vegetationTexture(seed).then((tex) => {
      // Si mientras se generaba se pidió otra vegetación (o se quitó), se ignora
      if (this.vegetationSeed !== seed || !this.vegetation) return;
      material.map = tex;
      material.opacity = 1;
      material.needsUpdate = true;
    });
  }

  /**
   * Eclipse sobre este cuerpo: la sombra de una luna (eclipse de sol) o la del
   * planeta sobre una luna (eclipse de luna). null = sin eclipse.
   */
  setEclipse(shadow: EclipseShadow | null): void {
    if (!shadow && !this.eclipse) return;
    if (!this.eclipse) {
      this.eclipse = new EclipseShell();
      this.eclipse.mesh.renderOrder = SHADOW_ORDER;
      // Fuera de la esfera para no girar con ella (la sombra depende de la luz, no del giro)
      this.group.add(this.eclipse.mesh);
    }
    this.eclipse.set(shadow);
  }

  /** Galaxia: nube de puntos en lugar de esfera (se rehace si cambia de forma). */
  private syncGalaxy(b: Body, time: number): void {
    const type = b.kind === 'galaxy' ? b.galaxyType ?? 'spiral' : null;
    if (type !== this.galaxyType) {
      if (this.galaxy) {
        this.group.remove(this.galaxy.group);
        this.galaxy.dispose();
        this.galaxy = null;
      }
      this.galaxyType = type;
      if (type) {
        this.galaxy = new GalaxyView(type, b.id, this.color);
        this.group.add(this.galaxy.group);
      }
      this.mesh.visible = !type && !this.blackHole;
    }
    this.galaxy?.update(b.radius, time);
  }

  /** Pone o quita el dibujo de agujero negro (horizonte, disco y anillo de luz). */
  private syncBlackHole(b: Body, cameraDistance: number): void {
    if (b.blackHole && !this.blackHole) {
      this.blackHole = new BlackHoleView(this.color);
      this.group.add(this.blackHole.group);
      this.mesh.visible = false;
      // No da luz propia: solo el brillo tenue de su disco
      if (this.light) this.light.intensity = BLACK_HOLE_LIGHT;
    } else if (!b.blackHole && this.blackHole) {
      this.group.remove(this.blackHole.group);
      this.blackHole.dispose();
      this.blackHole = null;
      this.mesh.visible = true;
      if (this.light) this.light.intensity = STAR_LIGHT;
    }
    this.blackHole?.update(cameraDistance, performance.now());
  }

  /** Pone, gira o quita los haces si el cuerpo es (o deja de ser) un púlsar. */
  private syncBeams(b: Body, cameraDistance: number): void {
    if (b.pulsar && !this.beams) {
      this.beams = new PulsarBeams(this.color);
      this.group.add(this.beams.group);
    } else if (!b.pulsar && this.beams) {
      this.group.remove(this.beams.group);
      this.beams.dispose();
      this.beams = null;
    }
    this.beams?.update(cameraDistance, performance.now());
  }

  /** Crea, actualiza o quita los anillos según el cuerpo. */
  private syncRing(b: Body): void {
    const key = b.ring ? `${b.ring.color}|${b.ring.outer}|${b.ring.tilt}` : '';
    if (key === this.ringKey) return;
    this.ringKey = key;
    if (!b.ring) {
      if (this.ring) {
        this.group.remove(this.ring.mesh);
        this.ring.dispose();
        this.ring = null;
      }
      return;
    }
    if (this.ring) this.ring.set(b.ring);
    else {
      this.ring = new RingView(b.ring, b.id);
      // Después de la vegetación, para taparla donde el anillo pasa por delante
      this.ring.mesh.renderOrder = RING_ORDER;
      // Fuera de la esfera para que no gire con ella; su escala se copia en cada update
      this.group.add(this.ring.mesh);
    }
  }

  dispose(): void {
    this.ring?.dispose();
    this.beams?.dispose();
    this.blackHole?.dispose();
    this.galaxy?.dispose();
    this.eclipse?.dispose();
    // La textura de vegetación es compartida (caché): solo se libera la esfera
    this.vegetation?.geometry.dispose();
    this.vegetation?.material.dispose();
    // Las texturas incluidas son compartidas: solo se libera una imagen propia
    if (this.ownsMap) this.mesh.material.map?.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.marker.material.dispose();
    this.trail.geometry.dispose();
    this.trail.material.dispose();
  }
}
