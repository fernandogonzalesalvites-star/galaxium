import * as THREE from 'three';
import type { Body } from '../sim/body';
import type { Vec3 } from '../sim/vec';
import { visualRadius } from '../sim/scale';
import { markerTexture } from './markerTexture';

export const TRAIL_LENGTH = 200;
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
  /** Años simulados entre puntos de la estela */
  trailInterval = 0.02;
  private readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial | THREE.MeshStandardMaterial>;
  private readonly marker: THREE.Sprite;
  private readonly color: THREE.Color;
  /** Puntos de la estela relativos a su centro (UA), en búfer circular */
  private readonly trailPoints = new Float64Array(TRAIL_LENGTH * 3);
  private trailCount = 0;
  private trailHead = 0;
  private lastTrailTime = -Infinity;

  constructor(body: Body) {
    this.color = new THREE.Color(body.color);
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
    if (body.kind === 'star') this.group.add(new THREE.PointLight(this.color, 3, 0, 0));

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
    const p = interpolated(b, alpha);
    this.group.position.set(p.x - focus.x, p.y - focus.y, p.z - focus.z);
    const r = visualRadius(b);
    this.mesh.scale.setScalar(r);
    const dist = Math.max(camera.position.distanceTo(this.group.position), 1e-12);
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    this.screenRadiusPx = (r / (dist * Math.tan(halfFov))) * (viewportHeightPx / 2);
    this.marker.visible = this.screenRadiusPx < MARKER_HIDE_PX;
    this.updateTrail(p, focus, center, time);
  }

  private updateTrail(p: Vec3, focus: Vec3, center: Vec3 | null, time: number): void {
    const geometry = this.trail.geometry;
    if (!center) {
      geometry.setDrawRange(0, 0);
      return;
    }
    if (time < this.lastTrailTime) {
      this.trailCount = 0;
      this.lastTrailTime = -Infinity;
    }
    if (time - this.lastTrailTime >= this.trailInterval) {
      const i = this.trailHead * 3;
      this.trailPoints[i] = p.x - center.x;
      this.trailPoints[i + 1] = p.y - center.y;
      this.trailPoints[i + 2] = p.z - center.z;
      this.trailHead = (this.trailHead + 1) % TRAIL_LENGTH;
      this.trailCount = Math.min(this.trailCount + 1, TRAIL_LENGTH);
      this.lastTrailTime = time;
    }
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = geometry.getAttribute('color') as THREE.BufferAttribute;
    const n = this.trailCount;
    const start = (this.trailHead - n + TRAIL_LENGTH) % TRAIL_LENGTH;
    const cx = center.x - focus.x, cy = center.y - focus.y, cz = center.z - focus.z;
    for (let k = 0; k < n; k++) {
      const j = ((start + k) % TRAIL_LENGTH) * 3;
      pos.setXYZ(k, this.trailPoints[j] + cx, this.trailPoints[j + 1] + cy, this.trailPoints[j + 2] + cz);
      const fade = ((k + 1) / (n + 1)) * 0.8;
      col.setXYZ(k, this.color.r * fade, this.color.g * fade, this.color.b * fade);
    }
    // El último vértice es la posición actual, para que la estela llegue hasta el cuerpo
    pos.setXYZ(n, p.x - focus.x, p.y - focus.y, p.z - focus.z);
    col.setXYZ(n, this.color.r * 0.8, this.color.g * 0.8, this.color.b * 0.8);
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geometry.setDrawRange(0, n + 1);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.marker.material.dispose();
    this.trail.geometry.dispose();
    this.trail.material.dispose();
  }
}
