import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Body } from '../sim/body';
import type { Vec3 } from '../sim/vec';
import type { World } from '../sim/world';
import { centerOfMass, centralMassFor, relativeOrbit, type MassPoint } from '../sim/elements';
import { visualRadius } from '../sim/scale';
import { BodyView, interpolated } from './BodyView';
import { fitDistance } from './cameraFit';
import { TRAIL_LENGTH } from './trail';
import { GhostView } from './GhostView';
import { createStarfield } from './starfield';
import { HabitableZoneView } from './HabitableZoneView';
import { habitableZone } from '../life/habitability';
import { computeEclipses, type Eclipses } from '../sim/eclipses';

/** No se repite el aviso del mismo eclipse antes de este tiempo (ms) */
const ECLIPSE_NOTICE_GAP_MS = 8000;

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
  readonly habitableZone = new HabitableZoneView();
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
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.06), this.starfield, this.habitableZone.group, this.ghost.group);
    this.resize();
    // Además de los cambios de ventana, cualquier cambio de tamaño del contenedor
    new ResizeObserver(() => this.resize()).observe(container);
  }

  resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    // Sin tamaño todavía (página cargando u oculta): una relación de aspecto 0
    // dejaría la cámara a distancia infinita. Se espera al siguiente cambio.
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** `spinSeconds`: segundos reales que han pasado para la rotación de los planetas (0 en pausa). */
  sync(world: World, alpha: number, spinSeconds = 0): void {
    this.syncViews(world);
    if (this.followId !== null) {
      const followed = world.get(this.followId);
      if (followed) Object.assign(this.focus, interpolated(followed, alpha));
      else this.followId = null;
    }
    const stars = world.stars();
    // Centro de las estelas: las estrellas, o en el modo galaxias, las galaxias
    const anchors = stars.length > 0 ? stars : world.bodies.filter((b) => b.kind === 'galaxy');
    const starCenter = anchors.length > 0 ? centerOfMass(anchors) : null;
    // La zona habitable se centra en las estrellas que dan luz (pesando por su
    // brillo), no en el centro de masas: un agujero negro pesa mucho pero no alumbra
    const lit = stars.filter((s) => s.luminosity > 0);
    if (lit.length > 0) {
      let luminosity = 0;
      const center = { x: 0, y: 0, z: 0 };
      for (const s of lit) {
        // Posición interpolada para que el anillo no tiemble respecto a la estrella
        const p = interpolated(s, alpha);
        luminosity += s.luminosity;
        center.x += p.x * s.luminosity; center.y += p.y * s.luminosity; center.z += p.z * s.luminosity;
      }
      center.x /= luminosity; center.y /= luminosity; center.z /= luminosity;
      const zone = habitableZone(luminosity);
      this.habitableZone.update(zone.inner, zone.outer, {
        x: center.x - this.focus.x, y: center.y - this.focus.y, z: center.z - this.focus.z,
      });
    } else {
      this.habitableZone.update(NaN, NaN, this.focus);
    }
    const refresh = this.frameCount++ % TRAIL_REFRESH_FRAMES === 0;
    const height = this.renderer.domElement.clientHeight;
    const eclipses = this.eclipsesEnabled ? computeEclipses(world.bodies) : null;
    if (eclipses) this.reportEclipseStarts(world, eclipses);
    for (const b of world.bodies) {
      const view = this.views.get(b.id)!;
      // Eventos: luna roja dentro de la sombra del planeta, y sombra de la luna sobre el planeta
      view.eclipseRed = eclipses?.lunar.get(b.id) ?? 0;
      const shadow = eclipses?.solar.find((s) => s.planetId === b.id);
      view.setShadow(shadow ? shadow.normal : null, shadow?.radius);
      if (refresh) this.applyTrailTiming(view, world, b);
      const center = this.trailCenter(world, b, anchors.length, starCenter, alpha);
      view.update(b, alpha, this.focus, center, world.time, this.camera, height, spinSeconds);
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
    // Una galaxia ya es grande: basta con alejarse unas pocas veces su radio
    this.placeCamera(distance ?? visualRadius(b) * (b.kind === 'galaxy' ? 3 : 12));
  }

  /**
   * Vista de presentación del menú: centrada en las estrellas, con la cámara
   * algo inclinada y girando despacio alrededor.
   */
  showcase(world: World, extent: number): void {
    this.followId = null;
    const c = centerOfMass(world.stars());
    Object.assign(this.focus, { x: c.x, y: c.y, z: c.z });
    const d = this.distanceToFit(extent, 2.5);
    // Las estrellas en el centro de la pantalla (el título y «Jugar» van arriba a la izquierda)
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(0, 0.42, 1).setLength(d);
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.5;
    this.habitableZone.enabled = false;
  }

  /** Encuadra todo el sistema, centrado en las estrellas. */
  frameSystem(world: World): void {
    this.followId = null;
    const stars = world.stars();
    const gs = world.bodies.filter((b) => b.kind === 'galaxy');
    const c = stars.length > 0 ? centerOfMass(stars) : gs.length > 0 ? centerOfMass(gs) : { x: 0, y: 0, z: 0 };
    let luminosity = 0;
    for (const s of stars) luminosity += s.luminosity;
    // Como mínimo se ve hasta más allá de la zona habitable
    let extent = Math.max(0.05, 1.5 * Math.sqrt(luminosity));
    for (const b of world.bodies) {
      extent = Math.max(extent, Math.hypot(b.x - c.x, b.y - c.y, b.z - c.z) + visualRadius(b) * (b.kind === 'galaxy' ? 1.2 : 4));
    }
    Object.assign(this.focus, { x: c.x, y: c.y, z: c.z });
    this.placeCamera(this.distanceToFit(extent, 2.5));
  }

  private placeCamera(distance: number): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    if (offset.lengthSq() === 0) offset.set(0, 0.6, 0.8);
    offset.setLength(distance);
    this.controls.target.set(0, 0, 0);
    this.camera.position.copy(offset);
  }

  /** Eventos activados: se dibujan los eclipses */
  eclipsesEnabled = false;
  /** Avisa cuando empieza un eclipse (para mostrar un mensaje) */
  onEclipseStart: ((kind: 'solar' | 'lunar', moon: string, planet: string) => void) | null = null;
  private activeEclipses = new Set<string>();
  private lastEclipseNotice = new Map<string, number>();

  /** Detecta los eclipses que acaban de empezar (con un margen para no repetir avisos). */
  private reportEclipseStarts(world: World, e: Eclipses): void {
    const now = new Set<string>();
    const nowMs = performance.now();
    const fire = (key: string, kind: 'solar' | 'lunar', moonId: number, planetId: number) => {
      now.add(key);
      if (this.activeEclipses.has(key)) return;
      if (nowMs - (this.lastEclipseNotice.get(key) ?? -Infinity) < ECLIPSE_NOTICE_GAP_MS) return;
      this.lastEclipseNotice.set(key, nowMs);
      const moon = world.get(moonId), planet = world.get(planetId);
      if (moon && planet) this.onEclipseStart?.(kind, moon.name, planet.name);
    };
    for (const s of e.solar) fire(`s${s.moonId}`, 'solar', s.moonId, s.planetId);
    for (const [moonId, amount] of e.lunar) {
      const moon = world.get(moonId);
      // La luna roja se avisa cuando entra del todo en la sombra
      if (moon && moon.parentId !== null && amount >= 0.99) fire(`l${moonId}`, 'lunar', moonId, moon.parentId);
      else if (this.activeEclipses.has(`l${moonId}`)) now.add(`l${moonId}`);
    }
    this.activeEclipses = now;
  }

  /** Quita todos los cuerpos dibujados (al salir de una partida o cargar otra). */
  clear(): void {
    for (const view of this.views.values()) {
      this.scene.remove(view.group, view.trail);
      view.dispose();
    }
    this.views.clear();
    this.followId = null;
    this.controls.autoRotate = false;
    this.habitableZone.enabled = true;
    this.ghost.hide();
    this.habitableZone.update(NaN, NaN, this.focus);
  }

  private syncViews(world: World): void {
    const alive = new Set<number>();
    for (const b of world.bodies) {
      alive.add(b.id);
      if (!this.views.has(b.id)) {
        const view = new BodyView(b);
        this.applyTrailTiming(view, world, b);
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

  private applyTrailTiming(view: BodyView, world: World, b: Body): void {
    const { interval, period } = this.trailIntervalFor(world, b);
    view.history.interval = interval;
    view.history.period = period;
  }

  private trailIntervalFor(world: World, b: Body): { interval: number; period: number } {
    const central = centralMassFor(world, b);
    if (central) {
      const orbit = relativeOrbit(b, central);
      if (orbit.bound) return { interval: orbit.period / TRAIL_LENGTH, period: orbit.period };
    }
    return { interval: DEFAULT_TRAIL_INTERVAL, period: DEFAULT_TRAIL_INTERVAL * TRAIL_LENGTH };
  }

  /** Borra la estela de un cuerpo y de sus lunas (tras moverlo en el editor). */
  resetTrails(world: World, id: number): void {
    for (const b of world.bodies) {
      if (b.id !== id && b.parentId !== id) continue;
      const view = this.views.get(b.id);
      if (!view) continue;
      view.history.reset();
      this.applyTrailTiming(view, world, b);
    }
  }

  /** Distancia de cámara para que `radius * factor` quepa según la relación de aspecto actual. */
  distanceToFit(radius: number, factor: number): number {
    return fitDistance(radius, factor, this.camera.aspect);
  }

  /** Llamado tras cada substep: anota en el historial las posiciones que tocan. */
  recordTrails(world: World): void {
    let starCount = 0;
    let cx = 0, cy = 0, cz = 0;
    let haveCenter = false;
    for (const b of world.bodies) {
      const view = this.views.get(b.id);
      if (!view || world.time < view.history.nextTime) continue;
      let ox: number, oy: number, oz: number;
      if (b.parentId !== null) {
        const parent = world.get(b.parentId);
        if (!parent) continue;
        ox = parent.x; oy = parent.y; oz = parent.z;
      } else {
        if (!haveCenter) {
          let m = 0;
          for (const s of world.bodies) {
            // Una partida tiene estrellas o galaxias, nunca las dos
            if (s.kind !== 'star' && s.kind !== 'galaxy') continue;
            starCount++;
            m += s.mass;
            cx += s.x * s.mass; cy += s.y * s.mass; cz += s.z * s.mass;
          }
          if (m > 0) { cx /= m; cy /= m; cz /= m; } else starCount = 0;
          haveCenter = true;
        }
        if (starCount === 0 || ((b.kind === 'star' || b.kind === 'galaxy') && starCount < 2)) continue;
        ox = cx; oy = cy; oz = cz;
      }
      view.history.maybeRecord(world.time, b.x - ox, b.y - oy, b.z - oz);
    }
  }

  /** Centro respecto al que se dibuja la estela: planeta padre o estrellas. */
  private trailCenter(world: World, b: Body, starCount: number, starCenter: MassPoint | null, alpha: number): Vec3 | null {
    if (b.parentId !== null) {
      const parent = world.get(b.parentId);
      return parent ? interpolated(parent, alpha) : null;
    }
    if (b.kind === 'star' || b.kind === 'galaxy') return starCount > 1 ? starCenter : null;
    return starCenter;
  }
}
