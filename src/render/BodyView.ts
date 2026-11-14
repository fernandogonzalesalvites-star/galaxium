import * as THREE from 'three';
import type { Body } from '../sim/body';
import type { Vec3 } from '../sim/vec';
import { visualRadius } from '../sim/scale';
import { DT } from '../sim/units';
import { TRAIL_LENGTH, TrailHistory } from './trail';
import { markerTexture } from './markerTexture';
import { RingView } from './RingView';

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
  private ringKey = '';
  /** Data URL de la textura que se está mostrando (null = color liso) */
  private textureUrl: string | null = null;

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
      this.light = new THREE.PointLight(this.color, 3, 0, 0);
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
    camera: THREE.PerspectiveCamera, viewportHeightPx: number,
  ): void {
    if (b.color !== this.colorHex) this.setColor(b.color);
    if (b.texture !== this.textureUrl) this.setTexture(b.texture);
    this.syncRing(b);
    const p = interpolated(b, alpha);
    this.group.position.set(p.x - focus.x, p.y - focus.y, p.z - focus.z);
    const r = visualRadius(b);
    this.mesh.scale.setScalar(r);
    const dist = Math.max(camera.position.distanceTo(this.group.position), 1e-12);
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    this.screenRadiusPx = (r / (dist * Math.tan(halfFov))) * (viewportHeightPx / 2);
    this.marker.visible = this.screenRadiusPx < MARKER_HIDE_PX;
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
    // Con textura, la esfera muestra la imagen tal cual (sin teñirla)
    if (!this.textureUrl) this.mesh.material.color.copy(this.color);
    this.marker.material.color.copy(this.color);
    this.light?.color.copy(this.color);
  }

  /** Pone o quita la imagen de la superficie. */
  private setTexture(url: string | null): void {
    this.textureUrl = url;
    const material = this.mesh.material;
    material.map?.dispose();
    material.map = null;
    material.color.copy(this.color);
    material.needsUpdate = true;
    if (!url) return;
    textureLoader.load(url, (tex) => {
      // Si mientras cargaba se cambió o quitó la imagen, se descarta
      if (this.textureUrl !== url) {
        tex.dispose();
        return;
      }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      material.map = tex;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    });
  }

  /** Crea, actualiza o quita los anillos según el cuerpo. */
  private syncRing(b: Body): void {
    const key = b.ring ? `${b.ring.color}|${b.ring.outer}|${b.ring.tilt}` : '';
    if (key === this.ringKey) return;
    this.ringKey = key;
    if (!b.ring) {
      if (this.ring) {
        this.mesh.remove(this.ring.mesh);
        this.ring.dispose();
        this.ring = null;
      }
      return;
    }
    if (this.ring) this.ring.set(b.ring);
    else {
      this.ring = new RingView(b.ring, b.id);
      // Hijo de la esfera: hereda su escala (radio visual)
      this.mesh.add(this.ring.mesh);
    }
  }

  dispose(): void {
    this.ring?.dispose();
    this.mesh.material.map?.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.marker.material.dispose();
    this.trail.geometry.dispose();
    this.trail.material.dispose();
  }
}
