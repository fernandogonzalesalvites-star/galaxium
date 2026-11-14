import * as THREE from 'three';
import type { Vec3 } from '../sim/vec';

const SEGMENTS = 160;
const FILL_COLOR = 0x3ddc84;
const FILL_OPACITY = 0.1;
const EDGE_OPACITY = 0.45;

function edge(): THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  const points = new Float32Array(SEGMENTS * 3);
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    points[i * 3] = Math.cos(a);
    points[i * 3 + 2] = Math.sin(a);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
  const line = new THREE.LineLoop(
    geometry,
    new THREE.LineBasicMaterial({ color: FILL_COLOR, transparent: true, opacity: EDGE_OPACITY, depthWrite: false }),
  );
  line.frustumCulled = false;
  return line;
}

/** Anillo verde translúcido donde el agua sería líquida (zona habitable), en el plano de las órbitas. */
export class HabitableZoneView {
  readonly group = new THREE.Group();
  private readonly fill: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly inner = edge();
  private readonly outer = edge();
  private lastInner = NaN;
  private lastOuter = NaN;

  constructor() {
    this.fill = new THREE.Mesh(
      new THREE.RingGeometry(1, 2, SEGMENTS, 1),
      new THREE.MeshBasicMaterial({
        color: FILL_COLOR, transparent: true, opacity: FILL_OPACITY, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    this.fill.rotation.x = -Math.PI / 2;
    this.fill.frustumCulled = false;
    this.fill.renderOrder = -1;
    this.group.add(this.fill, this.inner, this.outer);
    this.group.visible = false;
  }

  /** `center` ya está restado del foco de la cámara. */
  update(inner: number, outer: number, center: Vec3): void {
    const valid = Number.isFinite(inner) && Number.isFinite(outer) && outer > inner && inner > 0;
    this.group.visible = valid;
    if (!valid) return;
    this.group.position.set(center.x, center.y, center.z);
    if (inner !== this.lastInner || outer !== this.lastOuter) {
      this.fill.geometry.dispose();
      this.fill.geometry = new THREE.RingGeometry(inner, outer, SEGMENTS, 1);
      this.inner.scale.set(inner, 1, inner);
      this.outer.scale.set(outer, 1, outer);
      this.lastInner = inner;
      this.lastOuter = outer;
    }
  }
}
