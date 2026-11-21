import type { SceneView } from '../render/SceneView';
import type { Hud } from '../ui/Hud';
import type { InputHandlers, TouchInput } from '../input/TouchInput';
import type { EditorResult, PreviewTone } from '../ui/Editor';
import { World } from '../sim/world';
import { createStarSystem, SINGLE_STARS, STAR_CHOICES, type StarType } from '../sim/stars';
import { PLANET_PRESETS, type PlanetType } from '../sim/planetTypes';
import { centerOfMass } from '../sim/elements';
import { visualRadius } from '../sim/scale';
import { EARTH_MASS, EARTH_RADIUS_AU, MAX_BODIES, SOLAR_RADIUS_AU } from '../sim/units';
import { climateOf, temperatureAt, type Habitability } from '../life/habitability';
import { describeBody, kindLabel } from '../ui/bodyInfo';
import { formatDistance, formatTemperature } from '../ui/format';
import { SimClock } from './clock';
import {
  checkMoonPlacement, checkPlanetPlacement, moonBand, moonBandFor, placeMoon, placePlanet, presetRadius,
  checkStarPlacement, placeStar, starVisualRadius, MAX_STARS, type PlacementCheck,
} from './placement';
import {
  applyBodyEdit, applyStarType, deleteBody, editRanges, editValues, isMoon, previewHabitability, previewZone,
  starTypeOf, canHaveRing, defaultRing, applyStarLook, starRadiusRange, type SingleStarType,
} from './editing';
import { restoreWorld, snapshot, type SaveData } from './save';
import { createDemoSystem } from './demo';
import { canGrowVegetation, growVegetation, removeVegetation } from './vegetation';
import { canRotate, formatDayHours } from '../sim/rotation';
import { mergeCollisions, type Impact } from '../sim/collisions';
import { LAUNCH_DISTANCE, launchProjectile } from '../sim/projectiles';
import type { Universe } from './save';
import {
  applyGalaxyType, checkGalaxyPlacement, createGalaxyUniverse, galaxies, GALAXY_SPECS, MAX_GALAXIES, mergeGalaxies,
  placeGalaxy, type GalaxyCheck, type GalaxyType,
} from '../sim/galaxies';
import { formatLightYears } from '../ui/format';

type Mode =
  | { kind: 'idle' }
  | { kind: 'choosingMoonParent'; type: PlanetType }
  | { kind: 'placing'; type: PlanetType; parentId: number | null }
  | { kind: 'placingStar'; type: SingleStarType }
  | { kind: 'placingGalaxy'; type: GalaxyType }
  | { kind: 'editing'; id: number };

const GHOST_TEMPERATE = 0x50e080;
const GHOST_COLD = 0x60a8ff;
const GHOST_HOT = 0xff7040;
const GHOST_WARNING = 0xffa040;
const GHOST_BLOCKED = 0xff3030;
const HINT_PLANET = 'Arrastra para elegir la órbita y suelta para colocar';
const HINT_CHOOSE_PARENT = 'Toca el planeta que tendrá la luna';
const HINT_GALAXY = 'Arrastra para elegir dónde irá la galaxia y suelta para colocarla';
const HINT_STAR ='Arrastra para elegir dónde orbitará la nueva estrella y suelta para colocarla';
const HINT_MOON ='Arrastra alrededor del planeta y suelta para colocar la luna';
const INFO_REFRESH_MS = 250;
/** Un proyectil va despacio: tarda unos 9 segundos reales en llegar (como mucho 18 días simulados) */
const LAUNCH_SECONDS = 9;
const MAX_TRAVEL_YEARS = 18 / 365.25;
/** Velocidad del fondo del menú (×10: las estrellas dan una vuelta cada ~3 s) */
const DEMO_SPEED_INDEX = 2;
/** Radio (UA) que se encuadra en el fondo del menú */
const DEMO_EXTENT = 0.4;

const CLIMATE_TEXT = {
  cold: 'Demasiado frío',
  temperate: 'Zona habitable',
  hot: 'Demasiado caliente',
} as const;

function habitabilityPreview(h: Habitability): { text: string; tone: PreviewTone } {
  const t = formatTemperature(h.temperature);
  if (h.habitable) return { text: `🌍 Sería habitable · ${t}`, tone: 'good' };
  return { text: `No sería habitable: ${h.reason!.toLowerCase()} · ${t}`, tone: 'bad' };
}

export class Game implements InputHandlers {
  world = new World();
  readonly clock = new SimClock();
  started = false;
  /** Nombre del sistema que se muestra arriba */
  systemName = '';
  /** Se está mostrando el fondo animado del menú */
  private demo = false;
  private mode: Mode = { kind: 'idle' };
  private selectedId: number | null = null;
  private speedBeforePause = 1;
  private hint = '';
  private lastInfoUpdate = -Infinity;
  private hud!: Hud;
  private input!: TouchInput;

  constructor(private readonly view: SceneView) {}

  private readonly stepAndRecord = (dt: number): void => {
    this.world.step(dt);
    if (this.universe === 'galaxies') {
      for (const m of mergeGalaxies(this.world)) this.pendingToasts.push(`¡${m.eaten} se fusionó con ${m.into}!`);
    } else if (this.started) {
      // Choques entre planetas, lunas y asteroides: se fusionan (se dibujan en el siguiente fotograma)
      this.pendingImpacts.push(...mergeCollisions(this.world));
    }
    this.view.recordTrails(this.world);
  };

  /** Modo de juego: sistema solar o galaxias */
  universe: Universe = 'stars';
  /** Avisos de fusiones ocurridas durante la simulación, para mostrar en el siguiente fotograma */
  private pendingToasts: string[] = [];
  /** Choques ocurridos durante la simulación, para dibujar en el siguiente fotograma */
  private pendingImpacts: Impact[] = [];

  attach(hud: Hud, input: TouchInput): void {
    this.hud = hud;
    this.input = input;
  }

  start(type: StarType): void {
    this.begin(createStarSystem(type), STAR_CHOICES.find((c) => c.type === type)!.label, 1);
  }

  /** Abre una partida guardada. */
  load(data: SaveData): void {
    this.begin(restoreWorld(data), data.systemName, data.speedIndex, data.universe ?? 'stars');
  }

  /** Empieza una partida en el modo galaxias. */
  startGalaxies(): void {
    // Rápido por defecto: a escala de galaxias ×1000 ya es lento
    this.begin(createGalaxyUniverse(), 'Galaxias', 5, 'galaxies');
  }

  /** Estado actual listo para guardar. */
  save(name: string): SaveData {
    const speedIndex = this.mode.kind === 'idle' ? this.clock.speedIndex : this.speedBeforePause;
    return snapshot(this.world, { name, systemName: this.systemName, speedIndex, universe: this.universe });
  }

  /** Cierra la partida (vuelta al inicio). */
  stop(): void {
    this.exitMode();
    this.started = false;
    this.select(null);
    this.view.clear();
    this.world = new World();
  }

  /**
   * Fondo animado del menú: un sistema doble con un gigante con anillos y un
   * planeta rocoso dando vueltas. No es una partida: no se guarda ni se puede tocar.
   */
  startDemo(): void {
    this.stop();
    const w = createDemoSystem();
    this.world = w;
    this.demo = true;
    this.clock.setSpeed(DEMO_SPEED_INDEX);
    this.view.showcase(w, DEMO_EXTENT);
  }

  private begin(world: World, systemName: string, speedIndex: number, universe: Universe = 'stars'): void {
    this.demo = false;
    this.universe = universe;
    this.pendingToasts = [];
    this.hud.setUniverse(universe);
    this.exitMode();
    this.view.clear();
    this.world = world;
    this.world.snapRenderState();
    this.started = true;
    this.select(null);
    this.clock.setSpeed(speedIndex);
    this.view.frameSystem(this.world);
    this.systemName = systemName;
    this.hud.setSystemName(systemName);
    this.hud.setSpeedIndex(this.clock.speedIndex);
  }

  frame(seconds: number): void {
    if (!this.started) {
      if (this.demo) {
        this.clock.advance(seconds, this.stepAndRecord);
        this.view.sync(this.world, this.clock.alpha, Math.min(seconds, 0.1));
      }
      this.view.render();
      return;
    }
    this.clock.advance(seconds, this.stepAndRecord);
    const paused = this.mode.kind !== 'idle';
    // Los planetas giran en tiempo real (1 hora de su día = 1 segundo), salvo en pausa
    const spin = paused || this.clock.speedIndex === 0 ? 0 : Math.min(seconds, 0.1);
    this.view.sync(this.world, this.clock.alpha, spin);
    this.view.render();
    const speed = paused ? 0 : this.clock.throttled ? this.clock.smoothedYearsPerSecond : this.clock.requestedYearsPerSecond;
    this.hud.setTime(this.world.time, speed, !paused && this.clock.throttled);
    if (this.selectedId !== null && !this.world.get(this.selectedId)) this.select(null);
    const now = performance.now();
    if (this.selectedId !== null && now - this.lastInfoUpdate > INFO_REFRESH_MS) this.refreshInfo();
    if (this.pendingToasts.length) {
      for (const t of this.pendingToasts) this.hud.toast(t);
      this.pendingToasts = [];
    }
    if (this.pendingImpacts.length) this.handleImpacts();
  }

  /** Dibuja los choques recientes: cráter y fragmentos; la cámara y la ficha pasan al que quedó. */
  private handleImpacts(): void {
    for (const impact of this.pendingImpacts) {
      if (!this.world.get(impact.survivorId)) continue;
      this.view.showImpact(impact);
      // Su órbita cambió: la estela empieza de nuevo
      this.view.resetTrails(this.world, impact.survivorId);
      if (this.view.followId === impact.eatenId) this.view.followId = impact.survivorId;
      if (this.selectedId === impact.eatenId || this.selectedId === impact.survivorId) this.select(impact.survivorId);
      this.hud.toast(`💥 ${impact.eatenName} chocó con ${impact.survivorName}`);
    }
    this.pendingImpacts = [];
  }

  /** Abre la ventana para lanzar un proyectil contra el planeta o luna elegido. */
  launchAtSelected(): void {
    if (this.selectedId === null || this.mode.kind !== 'idle') return;
    const target = this.world.get(this.selectedId);
    if (!target || !canRotate(target)) return;
    const id = target.id;
    this.pause();
    this.mode = { kind: 'editing', id };
    this.hud.openLaunch(
      { name: target.name },
      {
        onLaunch: (opts) => {
          this.exitMode();
          const t = this.world.get(id);
          if (!t) return;
          // Si estaba en pausa, se pone a ×1 para ver el choque
          if (this.clock.speedIndex === 0) this.setSpeed(1);
          // Va despacio: llega en unos 9 segundos a la velocidad actual (sin pasar de 18 días simulados)
          const travelYears = Math.min(LAUNCH_SECONDS * this.clock.requestedYearsPerSecond, MAX_TRAVEL_YEARS);
          const p = launchProjectile(this.world, t, { ...opts, travelYears });
          this.world.snapRenderState();
          this.view.follow(id, this.world, visualRadius(t) * LAUNCH_DISTANCE * 1.5);
          this.hud.toast(`☄️ ${p.name} va directo hacia ${t.name}`);
          this.select(id);
        },
        onCancel: () => this.exitMode(),
      },
    );
  }

  setSpeed(index: number): void {
    if (this.mode.kind !== 'idle') this.speedBeforePause = index;
    else this.clock.setSpeed(index);
    this.hud.setSpeedIndex(index);
  }

  frameSystem(): void {
    if (this.started) this.view.frameSystem(this.world);
  }

  requestAdd(type: PlanetType): void {
    if (!this.started || this.mode.kind === 'editing') return;
    if (this.world.bodies.length >= MAX_BODIES) {
      this.hud.toast(`Máximo de ${MAX_BODIES} cuerpos`);
      return;
    }
    const moon = PLANET_PRESETS[type].isMoon;
    if (moon && !this.world.bodies.some((b) => b.kind !== 'star' && b.parentId === null)) {
      this.hud.toast('Primero añade un planeta');
      return;
    }
    this.pause();
    this.select(null);
    this.view.ghost.hide();
    if (moon) {
      this.mode = { kind: 'choosingMoonParent', type };
      this.setPlacingInput(false);
      this.setHint(HINT_CHOOSE_PARENT);
    } else {
      this.mode = { kind: 'placing', type, parentId: null };
      this.setPlacingInput(true);
      this.setHint(HINT_PLANET);
    }
  }

  /** Empieza a colocar una estrella nueva, que orbitará alrededor de las que ya hay. */
  requestAddStar(type: SingleStarType): void {
    if (!this.started || this.mode.kind === 'editing') return;
    if (this.world.bodies.length >= MAX_BODIES) {
      this.hud.toast(`Máximo de ${MAX_BODIES} cuerpos`);
      return;
    }
    if (this.world.stars().length >= MAX_STARS) {
      this.hud.toast(`Máximo de ${MAX_STARS} estrellas`);
      return;
    }
    this.pause();
    this.select(null);
    this.view.ghost.hide();
    this.mode = { kind: 'placingStar', type };
    this.setPlacingInput(true);
    this.setHint(HINT_STAR);
  }

  /** Empieza a colocar una galaxia (solo en el modo galaxias). */
  requestAddGalaxy(type: GalaxyType): void {
    if (!this.started || this.mode.kind === 'editing' || this.universe !== 'galaxies') return;
    if (galaxies(this.world).length >= MAX_GALAXIES) {
      this.hud.toast(`Máximo de ${MAX_GALAXIES} galaxias`);
      return;
    }
    this.pause();
    this.select(null);
    this.view.ghost.hide();
    this.mode = { kind: 'placingGalaxy', type };
    this.setPlacingInput(true);
    this.setHint(HINT_GALAXY);
  }

  private moveGalaxyGhost(x: number, y: number): { check: GalaxyCheck; pos: { x: number; z: number } } | null {
    if (this.mode.kind !== 'placingGalaxy') return null;
    const spec = GALAXY_SPECS[this.mode.type];
    const gs = galaxies(this.world);
    const simY = gs.length ? centerOfMass(gs).y : 0;
    const pos = this.view.planePoint(x, y, simY);
    if (!pos) return null;
    const check = checkGalaxyPlacement(this.world, this.mode.type, pos.x, pos.z);
    this.view.ghost.show(
      {
        center: check.center, radius: check.radius,
        bodyPos: { x: pos.x, y: simY, z: pos.z }, bodyRadius: spec.radius,
        color: !check.ok ? GHOST_BLOCKED : check.warning ? GHOST_WARNING : spec.color,
        band: null,
      },
      this.view.focus,
    );
    this.hud.showPlacement(this.hint, check.warning, !check.ok, {
      text: `${spec.label} · a ${formatLightYears(check.radius)} del centro`,
      tone: 'neutral',
    });
    return { check, pos };
  }

  private releaseGalaxy(x: number, y: number): void {
    if (this.mode.kind !== 'placingGalaxy') return;
    const type = this.mode.type;
    const result = this.moveGalaxyGhost(x, y);
    if (!result) return;
    if (!result.check.ok) {
      this.hud.toast(result.check.warning ?? 'No se puede colocar aquí');
      return;
    }
    const g = placeGalaxy(this.world, type, result.pos.x, result.pos.z);
    this.world.removeNetMomentum();
    this.world.snapRenderState();
    for (const b of this.world.bodies) this.view.resetTrails(this.world, b.id);
    this.exitMode();
    this.hud.toast(`Se ha añadido ${g.name}`);
    this.select(g.id);
  }

  cancelPlacement(): void {
    this.exitMode();
  }

  private moveStarGhost(x: number, y: number): { check: PlacementCheck; pos: { x: number; z: number } } | null {
    if (this.mode.kind !== 'placingStar') return null;
    const spec = SINGLE_STARS[this.mode.type];
    const simY = centerOfMass(this.world.stars()).y;
    const pos = this.view.planePoint(x, y, simY);
    if (!pos) return null;
    const check = checkStarPlacement(this.world, spec, pos.x, pos.z);
    this.view.ghost.show(
      {
        center: check.center,
        radius: check.radius,
        bodyPos: { x: pos.x, y: simY, z: pos.z },
        bodyRadius: starVisualRadius(spec),
        color: !check.ok ? GHOST_BLOCKED : check.warning ? GHOST_WARNING : spec.color,
        band: null,
      },
      this.view.focus,
    );
    this.hud.showPlacement(this.hint, check.warning, !check.ok, {
      text: `${spec.name} · a ${formatDistance(check.radius, false)} del centro`,
      tone: 'neutral',
    });
    return { check, pos };
  }

  private releaseStar(x: number, y: number): void {
    if (this.mode.kind !== 'placingStar') return;
    const spec = SINGLE_STARS[this.mode.type];
    const result = this.moveStarGhost(x, y);
    if (!result) return;
    if (!result.check.ok) {
      this.hud.toast(result.check.warning ?? 'No se puede colocar aquí');
      return;
    }
    const star = placeStar(this.world, spec, result.pos.x, result.pos.z);
    this.world.removeNetMomentum();
    this.world.snapRenderState();
    // Las estelas de todos cambian de centro: se empiezan de nuevo
    for (const b of this.world.bodies) this.view.resetTrails(this.world, b.id);
    this.exitMode();
    this.hud.toast(`Se ha añadido ${star.name}`);
    this.select(star.id);
  }

  // ── Ficha y editor ─────────────────────────────────────────

  /** Hace crecer vegetación al azar en el planeta o luna elegido (solo rocosos). */
  vegetationSelected(): void {
    if (this.selectedId === null || this.mode.kind !== 'idle') return;
    const body = this.world.get(this.selectedId);
    if (!body) return;
    if (!canGrowVegetation(body)) {
      this.hud.toast('La vegetación solo crece en planetas rocosos');
      return;
    }
    const had = body.vegetation !== 0;
    growVegetation(body);
    this.hud.toast(had ? `🌿 Nueva vegetación en ${body.name}` : `🌿 Creció vegetación en ${body.name}`);
    this.refreshInfo();
  }

  /** Eventos (eclipses) activados. Se recuerda en el dispositivo entre partidas. */
  eventsOn = false;

  setEvents(on: boolean, announce = true): void {
    this.eventsOn = on;
    // Los eclipses se ven en pantalla, sin avisos aparte
    this.view.eclipsesEnabled = on;
    this.hud.setEventsOn(on);
    if (announce) {
      const hasMoons = this.world.bodies.some((b) => b.parentId !== null);
      this.hud.toast(on
        ? hasMoons ? 'Eventos activados: eclipses de sol y de luna' : 'Eventos activados. Añade una luna para ver eclipses'
        : 'Eventos desactivados');
    }
  }

  toggleEvents(): void {
    this.setEvents(!this.eventsOn);
  }

  /** Abre la edición de la rotación del planeta o luna elegido. El juego queda en pausa mientras. */
  editRotationSelected(): void {
    if (this.selectedId === null || this.mode.kind !== 'idle') return;
    const body = this.world.get(this.selectedId);
    if (!body || !canRotate(body)) return;
    const id = body.id;
    this.pause();
    this.mode = { kind: 'editing', id };
    this.hud.openRotation(
      { name: body.name, hours: body.dayHours },
      {
        onApply: (hours) => {
          const b = this.world.get(id);
          if (b) {
            b.dayHours = hours;
            this.hud.toast(`⟳ El día de ${b.name} ahora dura ${formatDayHours(hours)}`);
          }
          this.exitMode();
          this.select(id);
        },
        onCancel: () => this.exitMode(),
      },
    );
  }

  removeVegetationSelected(): void {
    if (this.selectedId === null || this.mode.kind !== 'idle') return;
    const body = this.world.get(this.selectedId);
    if (!body || !body.vegetation) return;
    removeVegetation(body);
    this.hud.toast(`Se quitó la vegetación de ${body.name}`);
    this.refreshInfo();
  }

  followSelected(): void {
    if (this.selectedId !== null && this.mode.kind === 'idle') this.view.follow(this.selectedId, this.world);
  }

  deselect(): void {
    if (this.mode.kind === 'idle') this.select(null);
  }

  /** Abre el editor del cuerpo elegido. La simulación queda en pausa hasta cerrarlo. */
  editSelected(): void {
    if (this.mode.kind !== 'idle' || this.selectedId === null) return;
    const body = this.world.get(this.selectedId);
    if (!body) return;
    this.pause();
    this.mode = { kind: 'editing', id: body.id };
    const id = body.id;
    if (body.kind === 'galaxy') {
      this.hud.openEditor(
        {
          kindLabel: kindLabel(body), name: body.name, isMoon: false, hasWater: false,
          canDelete: galaxies(this.world).length > 1,
          galaxyType: body.galaxyType ?? 'spiral', galaxyColor: body.color,
        },
        {
          onApply: (r) => this.applyEdit(id, r),
          onCancel: () => this.exitMode(),
          onDelete: () => this.deleteBody(id),
          preview: (r) => ({ text: r.galaxyType ? `${GALAXY_SPECS[r.galaxyType].label}` : '', tone: 'neutral' }),
          distanceRange: () => ({ min: 0, max: 0 }),
        },
      );
      return;
    }
    const star = body.kind === 'star';
    const values = star ? undefined : editValues(this.world, body);
    this.hud.openEditor(
      {
        kindLabel: kindLabel(body),
        name: body.name,
        starType: star ? starTypeOf(body) : undefined,
        values,
        ranges: star ? undefined : editRanges(this.world, body),
        isMoon: isMoon(body),
        hasWater: body.kind === 'rocky',
        // Una estrella se puede borrar si queda al menos otra
        canDelete: !star || this.world.stars().length > 1,
        canHaveRing: canHaveRing(body),
        defaultRing: defaultRing(body),
        seed: body.id,
        starRadius: star ? body.radius / SOLAR_RADIUS_AU : undefined,
        starRadiusRange: star ? starRadiusRange(this.world, body) : undefined,
        starColor: star ? body.color : undefined,
      },
      {
        onApply: (r) => this.applyEdit(id, r),
        onCancel: () => this.exitMode(),
        onDelete: () => this.deleteBody(id),
        preview: (r) => this.previewEdit(id, r),
        distanceRange: (massEarth, radiusEarth) => {
          const b = this.world.get(id)!;
          const parent = b.parentId !== null ? this.world.get(b.parentId) : undefined;
          if (!parent) return editRanges(this.world, b, massEarth, radiusEarth).distance;
          return moonBandFor(this.world, parent, { kind: b.kind, mass: massEarth * EARTH_MASS, radius: radiusEarth * EARTH_RADIUS_AU });
        },
      },
    );
  }

  private previewEdit(id: number, r: EditorResult): { text: string; tone: PreviewTone } {
    const body = this.world.get(id);
    if (!body) return { text: '', tone: 'neutral' };
    if (body.kind === 'star') {
      if (!r.starType) return { text: '', tone: 'neutral' };
      const z = previewZone(this.world, body, r.starType);
      return {
        text: `Zona habitable: de ${formatDistance(z.inner, false)} a ${formatDistance(z.outer, false)}`,
        tone: 'neutral',
      };
    }
    return habitabilityPreview(previewHabitability(this.world, body, r.values!));
  }

  private applyEdit(id: number, r: EditorResult): void {
    const body = this.world.get(id);
    if (body) {
      if (body.kind === 'galaxy') {
        body.name = r.name.trim() || body.name;
        if (r.galaxyType && r.galaxyType !== body.galaxyType) applyGalaxyType(this.world, body, r.galaxyType);
        if (r.galaxyColor !== undefined) body.color = r.galaxyColor;
      } else if (body.kind === 'star') {
        if (r.starType) applyStarType(this.world, body, r.starType, r.name);
        else body.name = r.name.trim() || body.name;
        if (r.starRadius !== undefined && r.starColor !== undefined) {
          const shrunk = applyStarLook(this.world, body, r.starRadius, r.starColor);
          if (shrunk) this.hud.toast('La estrella se achicó para no tapar a sus vecinos');
        }
        const choice = STAR_CHOICES.find((c) => c.type === r.starType);
        if (choice && this.world.stars().length === 1) {
          this.systemName = choice.label;
          this.hud.setSystemName(choice.label);
        }
      } else if (r.values) {
        const clamped = applyBodyEdit(this.world, body, r.values);
        if (clamped) this.hud.toast('La distancia se ajustó al máximo permitido');
      }
      this.world.removeNetMomentum();
      this.world.snapRenderState();
      this.view.resetTrails(this.world, id);
      this.hud.toast(`Cambios guardados en ${body.name}`);
    }
    this.exitMode();
    this.select(id);
  }

  private deleteBody(id: number): void {
    const body = this.world.get(id);
    if (body) {
      deleteBody(this.world, id);
      this.world.snapRenderState();
      this.hud.toast(`Se ha eliminado ${body.name}`);
    }
    this.exitMode();
    this.select(null);
  }

  // ── Gestos ─────────────────────────────────────────────────

  onTap(x: number, y: number): void {
    if (!this.started || this.mode.kind === 'editing') return;
    const id = this.view.pick(x, y);
    if (this.mode.kind === 'choosingMoonParent') {
      const planet = id !== null ? this.world.get(id) : undefined;
      if (!planet || planet.kind === 'star' || planet.parentId !== null) {
        this.hud.toast('Toca un planeta');
        return;
      }
      const preset = PLANET_PRESETS[this.mode.type];
      const band = moonBand(this.world, planet, preset);
      if (band.min >= band.max) {
        this.hud.toast('Este planeta no puede tener lunas de ese tamaño');
        return;
      }
      this.mode = { kind: 'placing', type: this.mode.type, parentId: planet.id };
      this.setPlacingInput(true);
      this.view.follow(planet.id, this.world, Number.isFinite(band.max) ? this.view.distanceToFit(band.max, 3) : undefined);
      this.setHint(HINT_MOON);
      return;
    }
    if (this.mode.kind === 'placing' || this.mode.kind === 'placingStar' || this.mode.kind === 'placingGalaxy') return;
    this.select(id);
  }

  onDoubleTap(x: number, y: number): void {
    if (!this.started || this.mode.kind !== 'idle') return;
    const id = this.view.pick(x, y);
    if (id === null) return;
    this.select(id);
    this.view.follow(id, this.world);
  }

  onPlacementMove(x: number, y: number): void {
    if (this.mode.kind === 'placingStar') {
      this.moveStarGhost(x, y);
      return;
    }
    if (this.mode.kind === 'placingGalaxy') {
      this.moveGalaxyGhost(x, y);
      return;
    }
    const result = this.evaluatePlacement(x, y);
    if (!result || this.mode.kind !== 'placing') return;
    const { check, pos, y: simY } = result;
    const preset = PLANET_PRESETS[this.mode.type];
    const parent = this.mode.parentId !== null ? this.world.get(this.mode.parentId) : undefined;
    const temperature = temperatureAt(this.world.stars(), { x: pos.x, y: simY, z: pos.z }, preset.atmosphere);
    const climate = climateOf(temperature);
    const climateColor = climate === 'temperate' ? GHOST_TEMPERATE : climate === 'cold' ? GHOST_COLD : GHOST_HOT;
    this.view.ghost.show(
      {
        center: check.center,
        radius: check.radius,
        bodyPos: { x: pos.x, y: simY, z: pos.z },
        bodyRadius: visualRadius({ kind: preset.kind, radius: presetRadius(preset) }),
        color: !check.ok ? GHOST_BLOCKED : check.warning ? GHOST_WARNING : climateColor,
        band: parent ? moonBand(this.world, parent, preset) : null,
      },
      this.view.focus,
    );
    this.hud.showPlacement(this.hint, check.warning, !check.ok, {
      text: `${CLIMATE_TEXT[climate]} · ${formatTemperature(temperature)}`,
      tone: climate === 'temperate' ? 'good' : 'bad',
    });
  }

  onPlacementRelease(x: number, y: number): void {
    if (this.mode.kind === 'placingStar') {
      this.releaseStar(x, y);
      return;
    }
    if (this.mode.kind === 'placingGalaxy') {
      this.releaseGalaxy(x, y);
      return;
    }
    const result = this.evaluatePlacement(x, y);
    if (!result || this.mode.kind !== 'placing') return;
    const { check, pos } = result;
    if (!check.ok) {
      this.hud.toast(check.warning ?? 'No se puede colocar aquí');
      return;
    }
    const preset = PLANET_PRESETS[this.mode.type];
    const parent = this.mode.parentId !== null ? this.world.get(this.mode.parentId) : undefined;
    const body = parent
      ? placeMoon(this.world, parent, preset, pos.x, pos.z)
      : placePlanet(this.world, preset, pos.x, pos.z);
    this.world.removeNetMomentum();
    this.world.snapRenderState();
    this.exitMode();
    this.hud.toast(`Se ha añadido ${body.name}`);
    this.select(body.id);
  }

  private evaluatePlacement(x: number, y: number): { check: PlacementCheck; pos: { x: number; z: number }; y: number } | null {
    if (this.mode.kind !== 'placing') return null;
    if (this.mode.parentId === null) {
      const simY = centerOfMass(this.world.stars()).y;
      const pos = this.view.planePoint(x, y, simY);
      if (!pos) return null;
      return { check: checkPlanetPlacement(this.world, pos.x, pos.z), pos, y: simY };
    }
    const planet = this.world.get(this.mode.parentId);
    if (!planet) {
      this.exitMode();
      return null;
    }
    const pos = this.view.planePoint(x, y, planet.y);
    if (!pos) return null;
    return {
      check: checkMoonPlacement(this.world, planet, PLANET_PRESETS[this.mode.type], pos.x, pos.z),
      pos,
      y: planet.y,
    };
  }

  /** Pausa la simulación al colocar o editar y recuerda la velocidad anterior. */
  private pause(): void {
    if (this.mode.kind !== 'idle') return;
    this.speedBeforePause = this.clock.speedIndex;
    this.clock.setSpeed(0);
    this.world.snapRenderState();
  }

  private exitMode(): void {
    if (this.mode.kind === 'idle') return;
    this.mode = { kind: 'idle' };
    this.setPlacingInput(false);
    this.view.ghost.hide();
    this.hud.hidePlacement();
    this.clock.setSpeed(this.speedBeforePause);
    this.hud.setSpeedIndex(this.speedBeforePause);
  }

  private setPlacingInput(placing: boolean): void {
    this.input.placing = placing;
    this.view.controls.enableRotate = !placing;
  }

  private setHint(hint: string): void {
    this.hint = hint;
    this.hud.showPlacement(hint, null, false);
  }

  private select(id: number | null): void {
    this.selectedId = id;
    this.refreshInfo();
  }

  private refreshInfo(): void {
    this.lastInfoUpdate = performance.now();
    const body = this.selectedId !== null ? this.world.get(this.selectedId) : undefined;
    this.hud.setSelected(body ? describeBody(this.world, body) : null);
  }
}
