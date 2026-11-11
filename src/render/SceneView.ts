import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Body } from '../sim/body';
import type { Vec3 } from '../sim/vec';
import type { World } from '../sim/world';
import { centerOfMass, centralMassFor, relativeOrbit, type MassPoint } from '../sim/elements';
import { visualRadius } from '../sim/scale';
import { BodyView, TRAIL_LENGTH, interpolated } from './BodyView';
import { GhostView } from './GhostView';
import { createStarfield } from './starfield';

/** Radio mínimo (px) alrededor de un cuerpo que cuenta como tocarlo */
const PICK_RADIUS_PX = 28;
const TRAIL_REFRESH_FRAMES = 60;
const DEFAULT_TRAIL_INTERVAL = 0.02;

export class SceneView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly ghost = new GhostView();
  /** Punto de la simulación que se dibuja en el origen de la escena (evita temblores lejos del centro) */
  readonly focus: Vec3 = { x: 0, y: 0, z: 0 };
  followId: number | null = null;
  private readonly views = new Map<number, BodyView>();
  private readonly starfield = createStarfield();
  private readonly raycaster = new THREE.Raycaster();
  private frameCount = 0;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(50, 1, 1e-6, 1e5);
    this.camera.position.set(0, 1.2, 1.6);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1e-5;
    this.controls.maxDistance = 3000;
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.06), this.starfield, this.ghost.group);
    this.resize();
  }

  resize(): void {
    const w = this.container.clientWidth;
    const h = Math.max(this.container.clientHeight, 1);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  sync(world: World, alpha: number): void {
    this.syncViews(world);
    if (this.followId !== null) {
      const followed = world.get(this.followId);
      if (followed) Object.assign(this.focus, interpolated(followed, alpha));
      else this.followId = null;
    }
    const stars = world.stars();
    const starCenter = stars.length > 0 ? centerOfMass(stars) : null;
    const refresh = this.frameCount++ % TRAIL_REFRESH_FRAMES === 0;
    const height = this.renderer.domElement.clientHeight;
    for (const b of world.bodies) {
      const view = this.views.get(b.id)!;
      if (refresh) view.trailInterval = this.trailIntervalFor(world, b);
      const center = this.trailCenter(world, b, stars.length, starCenter, alpha);
      view.update(b, alpha, this.focus, center, world.time, this.camera, height);
    }
    this.starfield.position.copy(this.camera.position);
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /** Id del cuerpo bajo el punto de pantalla, o null. */
  pick(clientX: number, clientY: number): number | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector3();
    let best: number | null = null;
    let bestDistance = Infinity;
    for (const [id, view] of this.views) {
      v.copy(view.group.position).project(this.camera);
      if (v.z > 1) continue;
      const sx = rect.left + ((v.x + 1) / 2) * rect.width;
      const sy = rect.top + ((1 - v.y) / 2) * rect.height;
      const d = Math.hypot(sx - clientX, sy - clientY);
      if (d <= Math.max(PICK_RADIUS_PX, view.screenRadiusPx) && d < bestDistance) {
        bestDistance = d;
        best = id;
      }
    }
    return best;
  }

  /** Punto (coordenadas de simulación) donde el rayo de pantalla corta el plano horizontal y = simY. */
  planePoint(clientX: number, clientY: number, simY: number): { x: number; z: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(simY - this.focus.y));
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x + this.focus.x, z: hit.z + this.focus.z };
  }

  /** La cámara sigue al cuerpo, a `distance` UA (por defecto 12 radios visuales). */
  follow(id: number, world: World, distance?: number): void {
    const b = world.get(id);
    if (!b) return;
    this.followId = id;
    Object.assign(this.focus, { x: b.x, y: b.y, z: b.z });
    this.placeCamera(distance ?? visualRadius(b) * 12);
  }

  /** Encuadra todo el sistema, centrado en las estrellas. */
  frameSystem(world: World): void {
    this.followId = null;
    const stars = world.stars();
    const c = stars.length > 0 ? centerOfMass(stars) : { x: 0, y: 0, z: 0 };
    let luminosity = 0;
    for (const s of stars) luminosity += s.luminosity;
    // Como mínimo se ve hasta más allá de la zona habitable
    let extent = Math.max(0.05, 1.5 * Math.sqrt(luminosity));
    for (const b of world.bodies) {
      extent = Math.max(extent, Math.hypot(b.x - c.x, b.y - c.y, b.z - c.z) + visualRadius(b) * 4);
    }
    Object.assign(this.focus, { x: c.x, y: c.y, z: c.z });
    this.placeCamera(extent * 2.5);
  }

  private placeCamera(distance: number): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    if (offset.lengthSq() === 0) offset.set(0, 0.6, 0.8);
    offset.setLength(distance);
    this.controls.target.set(0, 0, 0);
    this.camera.position.copy(offset);
  }

  private syncViews(world: World): void {
    const alive = new Set<number>();
    for (const b of world.bodies) {
      alive.add(b.id);
      if (!this.views.has(b.id)) {
        const view = new BodyView(b);
        view.trailInterval = this.trailIntervalFor(world, b);
        this.views.set(b.id, view);
        this.scene.add(view.group, view.trail);
      }
    }
    for (const [id, view] of this.views) {
      if (!alive.has(id)) {
        this.scene.remove(view.group, view.trail);
        view.dispose();
        this.views.delete(id);
      }
    }
  }

  private trailIntervalFor(world: World, b: Body): number {
    const central = centralMassFor(world, b);
    if (!central) return DEFAULT_TRAIL_INTERVAL;
    const orbit = relativeOrbit(b, central);
    return orbit.bound ? orbit.period / TRAIL_LENGTH : DEFAULT_TRAIL_INTERVAL;
  }

  /** Centro respecto al que se dibuja la estela: planeta padre o estrellas. */
  private trailCenter(world: World, b: Body, starCount: number, starCenter: MassPoint | null, alpha: number): Vec3 | null {
    if (b.parentId !== null) {
      const parent = world.get(b.parentId);
      return parent ? interpolated(parent, alpha) : null;
    }
    if (b.kind === 'star') return starCount > 1 ? starCenter : null;
    return starCenter;
  }
}
