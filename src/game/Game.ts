import type { SceneView } from '../render/SceneView';
import type { Hud } from '../ui/Hud';
import type { InputHandlers, TouchInput } from '../input/TouchInput';
import type { EditorResult, PreviewTone } from '../ui/Editor';
import { World } from '../sim/world';
import { createStarSystem, STAR_CHOICES, type StarType } from '../sim/stars';
import { PLANET_PRESETS, type PlanetType } from '../sim/planetTypes';
import { centerOfMass } from '../sim/elements';
import { visualRadius } from '../sim/scale';
import { EARTH_MASS, EARTH_RADIUS_AU, MAX_BODIES } from '../sim/units';
import { climateOf, temperatureAt, type Habitability } from '../life/habitability';
import { describeBody, kindLabel } from '../ui/bodyInfo';
import { formatDistance, formatTemperature } from '../ui/format';
import { SimClock } from './clock';
import {
  checkMoonPlacement, checkPlanetPlacement, moonBand, moonBandFor, placeMoon, placePlanet, presetRadius,
  type PlacementCheck,
} from './placement';
import {
  applyBodyEdit, applyStarType, deleteBody, editRanges, editValues, isMoon, previewHabitability, previewZone,
  starTypeOf,
} from './editing';

type Mode =
  | { kind: 'idle' }
  | { kind: 'choosingMoonParent'; type: PlanetType }
  | { kind: 'placing'; type: PlanetType; parentId: number | null }
  | { kind: 'editing'; id: number };

const GHOST_TEMPERATE = 0x50e080;
const GHOST_COLD = 0x60a8ff;
const GHOST_HOT = 0xff7040;
const GHOST_WARNING = 0xffa040;
const GHOST_BLOCKED = 0xff3030;
const HINT_PLANET = 'Arrastra para elegir la órbita y suelta para colocar';
const HINT_CHOOSE_PARENT = 'Toca el planeta que tendrá la luna';
const HINT_MOON = 'Arrastra alrededor del planeta y suelta para colocar la luna';
const INFO_REFRESH_MS = 250;

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
    this.view.recordTrails(this.world);
  };

  attach(hud: Hud, input: TouchInput): void {
    this.hud = hud;
    this.input = input;
  }

  start(type: StarType): void {
    this.world = createStarSystem(type);
    this.started = true;
    this.view.frameSystem(this.world);
    this.hud.setSystemName(STAR_CHOICES.find((c) => c.type === type)!.label);
    this.hud.setSpeedIndex(this.clock.speedIndex);
  }

  frame(seconds: number): void {
    if (!this.started) {
      this.view.render();
      return;
    }
    this.clock.advance(seconds, this.stepAndRecord);
    this.view.sync(this.world, this.clock.alpha);
    this.view.render();
    const paused = this.mode.kind !== 'idle';
    const speed = paused ? 0 : this.clock.throttled ? this.clock.smoothedYearsPerSecond : this.clock.requestedYearsPerSecond;
    this.hud.setTime(this.world.time, speed, !paused && this.clock.throttled);
    if (this.selectedId !== null && !this.world.get(this.selectedId)) this.select(null);
    const now = performance.now();
    if (this.selectedId !== null && now - this.lastInfoUpdate > INFO_REFRESH_MS) this.refreshInfo();
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

  cancelPlacement(): void {
    this.exitMode();
  }

  // ── Ficha y editor ─────────────────────────────────────────

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
        canDelete: !star,
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
      if (body.kind === 'star') {
        if (r.starType) applyStarType(this.world, body, r.starType, r.name);
        else body.name = r.name.trim() || body.name;
        const choice = STAR_CHOICES.find((c) => c.type === r.starType);
        if (choice && this.world.stars().length === 1) this.hud.setSystemName(choice.label);
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
    if (this.mode.kind === 'placing') return;
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
