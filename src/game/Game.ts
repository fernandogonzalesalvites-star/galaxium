import type { SceneView } from '../render/SceneView';
import type { Hud } from '../ui/Hud';
import type { InputHandlers, TouchInput } from '../input/TouchInput';
import { World } from '../sim/world';
import { createStarSystem, STAR_CHOICES, type StarType } from '../sim/stars';
import { PLANET_PRESETS, type PlanetType } from '../sim/planetTypes';
import { centerOfMass } from '../sim/elements';
import { visualRadius } from '../sim/scale';
import { MAX_BODIES } from '../sim/units';
import { SimClock } from './clock';
import {
  checkMoonPlacement, checkPlanetPlacement, moonBand, placeMoon, placePlanet, presetRadius,
  type PlacementCheck,
} from './placement';

type Mode =
  | { kind: 'idle' }
  | { kind: 'choosingMoonParent'; type: PlanetType }
  | { kind: 'placing'; type: PlanetType; parentId: number | null };

const GHOST_OK = 0xffffff;
const GHOST_WARNING = 0xffa040;
const GHOST_BLOCKED = 0xff5050;
const HINT_PLANET = 'Arrastra para elegir la órbita y suelta para colocar';
const HINT_CHOOSE_PARENT = 'Toca el planeta que tendrá la luna';
const HINT_MOON = 'Arrastra alrededor del planeta y suelta para colocar la luna';

export class Game implements InputHandlers {
  world = new World();
  readonly clock = new SimClock();
  started = false;
  private mode: Mode = { kind: 'idle' };
  private selectedId: number | null = null;
  private speedBeforePlacement = 1;
  private hint = '';
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
  }

  setSpeed(index: number): void {
    if (this.mode.kind !== 'idle') this.speedBeforePlacement = index;
    else this.clock.setSpeed(index);
    this.hud.setSpeedIndex(index);
  }

  frameSystem(): void {
    if (this.started) this.view.frameSystem(this.world);
  }

  requestAdd(type: PlanetType): void {
    if (!this.started) return;
    if (this.world.bodies.length >= MAX_BODIES) {
      this.hud.toast(`Máximo de ${MAX_BODIES} cuerpos`);
      return;
    }
    const isMoon = PLANET_PRESETS[type].isMoon;
    if (isMoon && !this.world.bodies.some((b) => b.kind !== 'star' && b.parentId === null)) {
      this.hud.toast('Primero añade un planeta');
      return;
    }
    this.pauseForPlacement();
    this.select(null);
    this.view.ghost.hide();
    if (isMoon) {
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
    this.exitPlacement();
  }

  onTap(x: number, y: number): void {
    if (!this.started) return;
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
    this.view.ghost.show(
      {
        center: check.center,
        radius: check.radius,
        bodyPos: { x: pos.x, y: simY, z: pos.z },
        bodyRadius: visualRadius({ kind: preset.kind, radius: presetRadius(preset) }),
        color: !check.ok ? GHOST_BLOCKED : check.warning ? GHOST_WARNING : GHOST_OK,
        band: parent ? moonBand(this.world, parent, preset) : null,
      },
      this.view.focus,
    );
    this.hud.showPlacement(this.hint, check.warning, !check.ok);
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
    this.exitPlacement();
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
      this.exitPlacement();
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

  /** Pausa la simulación al entrar en colocación y recuerda la velocidad anterior. */
  private pauseForPlacement(): void {
    if (this.mode.kind !== 'idle') return;
    this.speedBeforePlacement = this.clock.speedIndex;
    this.clock.setSpeed(0);
    this.world.snapRenderState();
  }

  private exitPlacement(): void {
    if (this.mode.kind === 'idle') return;
    this.mode = { kind: 'idle' };
    this.setPlacingInput(false);
    this.view.ghost.hide();
    this.hud.hidePlacement();
    this.clock.setSpeed(this.speedBeforePlacement);
    this.hud.setSpeedIndex(this.speedBeforePlacement);
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
    const body = id !== null ? this.world.get(id) : undefined;
    this.hud.setSelected(body ? body.name : null);
  }
}
