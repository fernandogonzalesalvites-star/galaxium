import * as THREE from 'three';
import type { Vec3 } from '../sim/vec';
import { markerTexture } from './markerTexture';

const CIRCLE_SEGMENTS = 128;

function unitCircle(color: number): THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  const points = new Float32Array(CIRCLE_SEGMENTS * 3);
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    points[i * 3] = Math.cos(a);
    points[i * 3 + 2] = Math.sin(a);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
  const line = new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
  line.frustumCulled = false;
  return line;
}

export interface GhostParams {
  /** Centro de la órbita (simulación) */
  center: Vec3;
  /** Radio de la órbita (UA) */
  radius: number;
  /** Posición del cuerpo fantasma (simulación) */
  bodyPos: Vec3;
  /** Radio visual del cuerpo (UA) */
  bodyRadius: number;
  color: number;
  /** Franja permitida para lunas, o null */
  band: { min: number; max: number } | null;
}

/** Planeta fantasma y círculos de vista previa durante la colocación. */
export class GhostView {
  readonly group = new THREE.Group();
  private readonly sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  private readonly marker = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: markerTexture(), sizeAttenuation: false, transparent: true, depthWrite: false }),
  );
  private readonly orbit = unitCircle(0xffffff);
  private readonly bandMin = unitCircle(0x66ccff);
  private readonly bandMax = unitCircle(0x66ccff);

  constructor() {
    this.marker.scale.setScalar(0.014);
    this.group.add(this.sphere, this.marker, this.orbit, this.bandMin, this.bandMax);
    this.group.visible = false;
  }

  show(p: GhostParams, focus: Vec3): void {
    this.group.visible = true;
    const color = new THREE.Color(p.color);
    this.sphere.position.set(p.bodyPos.x - focus.x, p.bodyPos.y - focus.y, p.bodyPos.z - focus.z);
    this.sphere.scale.setScalar(p.bodyRadius);
    this.sphere.material.color.copy(color);
    this.marker.position.copy(this.sphere.position);
    this.marker.material.color.copy(color);
    const cx = p.center.x - focus.x, cy = p.center.y - focus.y, cz = p.center.z - focus.z;
    this.orbit.position.set(cx, cy, cz);
    this.orbit.scale.set(p.radius, 1, p.radius);
    this.orbit.material.color.copy(color);
    const showBand = p.band !== null;
    this.bandMin.visible = showBand;
    this.bandMax.visible = showBand;
    if (p.band) {
      this.bandMin.position.set(cx, cy, cz);
      this.bandMin.scale.set(p.band.min, 1, p.band.min);
      this.bandMax.position.set(cx, cy, cz);
      this.bandMax.scale.set(p.band.max, 1, p.band.max);
    }
  }

  hide(): void {
    this.group.visible = false;
  }
}
