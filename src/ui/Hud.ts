import { SPEED_LEVELS } from '../game/clock';
import { SINGLE_STAR_TYPES, type SingleStarType } from '../game/editing';
import { SINGLE_STARS } from '../sim/stars';
import { PLANET_PRESETS, PLANET_TYPES, type PlanetType } from '../sim/planetTypes';
import { formatElapsed, formatGalacticElapsed, formatGalacticSpeed, formatSpeed } from './format';
import { GALAXY_SPECS, GALAXY_TYPES, type GalaxyType } from '../sim/galaxies';
import type { Universe } from '../game/save';
import { showRotationDialog } from './rotationDialog';
import { showLaunchDialog, type LaunchOptions } from './launchDialog';
import type { BodyInfo } from './bodyInfo';
import { Editor, type EditorHandlers, type EditorModel, type PreviewTone } from './Editor';

export interface HudHandlers {
  onSpeed(index: number): void;
  onAdd(type: PlanetType): void;
  /** Añadir una estrella más al sistema */
  onAddStar(type: SingleStarType): void;
  /** Añadir una galaxia (modo galaxias) */
  onAddGalaxy(type: GalaxyType): void;
  /** Hacer crecer vegetación al azar en el planeta elegido (otra distinta si ya tenía) */
  onVegetation(): void;
  onRemoveVegetation(): void;
  /** Abrir la edición de la rotación (duración del día) del planeta elegido */
  onRotation(): void;
  /** Activar o apagar los eventos (eclipses) */
  onToggleEvents(): void;
  /** Abrir la ventana para lanzar un proyectil contra el planeta elegido */
  onLaunch(): void;
  /** Añadir nubes al azar al planeta elegido (otras distintas si ya tenía) */
  onClouds(): void;
  onRemoveClouds(): void;
  onCancelPlacement(): void;
  onFrameSystem(): void;
  onEdit(): void;
  onFollow(): void;
  onDeselect(): void;
  /** Botón de partida: guardar o salir al inicio */
  onGameMenu(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text) e.textContent = text;
  return e;
}

const TEXT_REFRESH_MS = 250;
const TOAST_MS = 3000;

export class Hud {
  private readonly root = el('div', 'hud');
  private readonly systemName = el('span', 'hud-system');
  private readonly elapsed = el('span', 'hud-elapsed');
  private readonly realSpeed = el('span', 'hud-real-speed');
  private readonly sheet = el('div', 'hud-sheet hidden');
  private readonly sheetName = el('strong', 'hud-sheet-name');
  private readonly sheetKind = el('span', 'hud-sheet-kind');
  private readonly sheetStatus = el('div', 'hud-sheet-status');
  private readonly sheetRows = el('dl', 'hud-sheet-rows');
  private readonly vegBox = el('div', 'hud-sheet-veg hidden');
  private readonly vegButton = el('button', 'hud-btn hud-veg');
  private readonly vegRemove = el('button', 'hud-btn hud-veg-remove hidden', 'Quitar');
  private readonly vegNote = el('span', 'hud-veg-note hidden', 'Solo crece en planetas rocosos');
  private readonly rotButton = el('button', 'hud-btn hud-rot hidden');
  private readonly eventsButton = el('button', 'hud-btn hud-events');
  private readonly launchButton = el('button', 'hud-btn hud-launch');
  private readonly cloudButton = el('button', 'hud-btn hud-clouds');
  private readonly cloudRemove = el('button', 'hud-btn hud-veg-remove hidden', 'Quitar');
  private readonly cloudNote = el('span', 'hud-veg-note hidden', 'Necesita atmósfera para tener nubes');
  private readonly placementClimate = el('div', 'hud-placement-climate');
  private readonly placement = el('div', 'hud-placement hidden');
  private readonly placementHint = el('div', 'hud-placement-hint');
  private readonly placementWarning = el('div', 'hud-placement-warning');
  private readonly addMenu = el('div', 'hud-add-menu hidden');
  private readonly toasts = el('div', 'hud-toasts');
  private readonly speedButtons: HTMLButtonElement[] = [];
  private lastTextUpdate = -Infinity;

  constructor(private readonly parent: HTMLElement, h: HudHandlers) {
    const top = el('div', 'hud-top');
    const frameButton = el('button', 'hud-btn hud-frame', '⌖');
    frameButton.title = 'Ver todo el sistema';
    frameButton.onclick = () => h.onFrameSystem();
    const menuButton = el('button', 'hud-btn hud-menu', '💾');
    menuButton.title = 'Guardar partida';
    menuButton.setAttribute('aria-label', 'Guardar partida');
    menuButton.onclick = () => h.onGameMenu();
    // Eventos: activa o apaga los eclipses (el botón se ilumina cuando están activos)
    this.eventsButton.innerHTML = '<span aria-hidden="true">🌗</span> Eventos';
    this.eventsButton.title = 'Eventos: eclipses de sol y de luna';
    this.eventsButton.setAttribute('aria-pressed', 'false');
    this.eventsButton.onclick = () => h.onToggleEvents();
    top.append(this.systemName, this.elapsed, this.eventsButton, menuButton, frameButton);

    const cancel = el('button', 'hud-btn', 'Cancelar');
    cancel.onclick = () => h.onCancelPlacement();
    this.placement.append(this.placementHint, this.placementClimate, this.placementWarning, cancel);

    const sheetHead = el('div', 'hud-sheet-head');
    const titles = el('div', 'hud-sheet-titles');
    titles.append(this.sheetName, this.sheetKind);
    const close = el('button', 'hud-btn hud-sheet-close', '✕');
    close.title = 'Cerrar';
    close.onclick = () => h.onDeselect();
    sheetHead.append(titles, close);
    const sheetActions = el('div', 'hud-sheet-actions');
    const edit = el('button', 'hud-btn hud-sheet-edit', 'Editar');
    edit.onclick = () => h.onEdit();
    const follow = el('button', 'hud-btn', 'Seguir');
    follow.onclick = () => h.onFollow();
    sheetActions.append(edit, follow);

    // Vegetación: solo en planetas y lunas rocosos
    this.vegButton.innerHTML = '<span aria-hidden="true">🌿</span> Vegetación';
    this.vegButton.onclick = () => h.onVegetation();
    this.vegRemove.onclick = () => h.onRemoveVegetation();
    // Vegetación y rotación en la misma fila para que la ficha no tape tanto en el celular
    const vegRow = el('div', 'hud-sheet-actions');
    vegRow.append(this.vegButton, this.vegRemove, this.rotButton);
    // Lanzar: botón mediano debajo, para tirarle un asteroide o un planeta rocoso
    this.launchButton.innerHTML = '<span aria-hidden="true">☄️</span> Lanzar';
    this.launchButton.onclick = () => h.onLaunch();
    // Nubes: se añaden al azar; «Quitar» al lado; apagado si no hay atmósfera
    this.cloudButton.innerHTML = '<span aria-hidden="true">☁️</span> Añadir nubes';
    this.cloudButton.onclick = () => h.onClouds();
    this.cloudRemove.onclick = () => h.onRemoveClouds();
    this.cloudRemove.setAttribute('aria-label', 'Quitar nubes');
    this.vegRemove.setAttribute('aria-label', 'Quitar vegetación');
    const cloudRow = el('div', 'hud-sheet-actions');
    cloudRow.append(this.cloudButton, this.cloudRemove);
    this.vegBox.append(vegRow, this.vegNote, cloudRow, this.cloudNote, this.launchButton);
    // Rotación: abre una edición solo para la duración del día
    this.rotButton.innerHTML = '<span aria-hidden="true">⟳</span> Rotación';
    this.rotButton.onclick = () => h.onRotation();
    this.sheet.append(sheetHead, this.sheetStatus, this.sheetRows, sheetActions, this.vegBox);

    const time = el('div', 'hud-time');
    SPEED_LEVELS.forEach((level, i) => {
      const b = el('button', 'hud-btn hud-speed', level.label);
      b.onclick = () => h.onSpeed(i);
      this.speedButtons.push(b);
      time.append(b);
    });
    const timeWrap = el('div', 'hud-time-wrap');
    timeWrap.append(time, this.realSpeed);

    const add = el('button', 'hud-btn hud-add', '＋');
    add.title = 'Añadir cuerpo';
    add.onclick = () => this.addMenu.classList.toggle('hidden');
    // Dos columnas: planetas y lunas a un lado, estrellas al otro
    const planets = el('div', 'hud-add-column');
    planets.append(el('span', 'hud-add-title', 'Planetas'));
    for (const type of PLANET_TYPES) {
      const b = el('button', 'hud-btn hud-add-item', PLANET_PRESETS[type].label);
      b.onclick = () => {
        this.addMenu.classList.add('hidden');
        h.onAdd(type);
      };
      planets.append(b);
    }
    const stars = el('div', 'hud-add-column');
    stars.append(el('span', 'hud-add-title', 'Estrellas'));
    for (const type of SINGLE_STAR_TYPES) {
      const spec = SINGLE_STARS[type];
      const b = el('button', 'hud-btn hud-add-item hud-add-star');
      const dot = el('span', 'hud-add-dot');
      const c = `#${spec.color.toString(16).padStart(6, '0')}`;
      // El agujero negro: punto negro con un aro del color de su disco
      dot.style.background = spec.blackHole ? '#000' : c;
      if (spec.blackHole) dot.style.boxShadow = `0 0 0 2px ${c}, 0 0 8px ${c}`;
      b.append(dot, document.createTextNode(spec.name === 'Sol' ? 'Tipo Sol' : spec.name));
      b.onclick = () => {
        this.addMenu.classList.add('hidden');
        h.onAddStar(type);
      };
      stars.append(b);
    }
    // Modo galaxias: en el menú solo hay galaxias
    const galaxyColumn = el('div', 'hud-add-column hidden');
    galaxyColumn.append(el('span', 'hud-add-title', 'Galaxias'));
    for (const type of GALAXY_TYPES) {
      const b = el('button', 'hud-btn hud-add-item', GALAXY_SPECS[type].label);
      b.onclick = () => {
        this.addMenu.classList.add('hidden');
        h.onAddGalaxy(type);
      };
      galaxyColumn.append(b);
    }
    this.addMenu.append(planets, stars, galaxyColumn);
    this.solarColumns = [planets, stars];
    this.galaxyColumn = galaxyColumn;

    const bottom = el('div', 'hud-bottom');
    bottom.append(timeWrap, add);
    this.root.append(top, this.sheet, this.placement, this.addMenu, bottom, this.toasts);
    parent.append(this.root);
  }

  private solarColumns: HTMLElement[] = [];
  private galaxyColumn: HTMLElement | null = null;
  private universe: Universe = 'stars';

  /** Muestra si los eventos (eclipses) están activados. */
  setEventsOn(on: boolean): void {
    this.eventsButton.classList.toggle('active', on);
    this.eventsButton.setAttribute('aria-pressed', String(on));
  }

  /** Cambia el menú «＋» y las unidades de tiempo según el modo de juego. */
  setUniverse(universe: Universe): void {
    this.universe = universe;
    // En el modo galaxias no hay lunas: no hay eclipses
    this.eventsButton.classList.toggle('hidden', universe === 'galaxies');
    for (const c of this.solarColumns) c.classList.toggle('hidden', universe === 'galaxies');
    this.galaxyColumn?.classList.toggle('hidden', universe !== 'galaxies');
    this.lastTextUpdate = -Infinity;
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  setSystemName(name: string): void {
    this.systemName.textContent = name;
  }

  setSpeedIndex(index: number): void {
    this.speedButtons.forEach((b, i) => b.classList.toggle('active', i === index));
  }

  setTime(years: number, yearsPerSecond: number, throttled: boolean): void {
    const now = performance.now();
    if (now - this.lastTextUpdate < TEXT_REFRESH_MS) return;
    this.lastTextUpdate = now;
    const galactic = this.universe === 'galaxies';
    this.elapsed.textContent = galactic ? formatGalacticElapsed(years) : formatElapsed(years);
    this.realSpeed.textContent = (throttled ? '⚠ ' : '') + (galactic ? formatGalacticSpeed(yearsPerSecond) : formatSpeed(yearsPerSecond));
    this.realSpeed.classList.toggle('throttled', throttled);
  }

  /** Muestra la ficha del cuerpo elegido, o la oculta con null. */
  setSelected(info: BodyInfo | null): void {
    this.sheet.classList.toggle('hidden', info === null);
    if (!info) return;
    this.addMenu.classList.add('hidden');
    this.sheetName.textContent = info.name;
    this.sheetKind.textContent = info.kindLabel;
    this.sheetStatus.classList.toggle('hidden', info.status === null);
    if (info.status) {
      this.sheetStatus.textContent = (info.status.habitable ? '🌍 ' : '') + info.status.text;
      this.sheetStatus.dataset.tone = info.status.habitable ? 'good' : 'bad';
    }
    const rows = info.rows.map(([label, value]) => {
      const row = el('div', 'hud-sheet-row');
      row.append(el('dt', '', label), el('dd', '', value));
      return row;
    });
    this.sheetRows.replaceChildren(...rows);

    const veg = info.vegetation ?? null;
    this.vegBox.classList.toggle('hidden', veg === null);
    // En gigantes de gas o hielo el botón se ve apagado y el texto dice por qué
    this.vegButton.disabled = veg === 'unavailable';
    this.vegRemove.classList.toggle('hidden', veg !== 'grown');
    this.vegNote.classList.toggle('hidden', veg !== 'unavailable');
    this.rotButton.classList.toggle('hidden', !info.canRotate);
    const clouds = info.clouds ?? null;
    this.cloudButton.disabled = clouds === 'unavailable';
    this.cloudRemove.classList.toggle('hidden', clouds !== 'added');
    this.cloudNote.classList.toggle('hidden', clouds !== 'unavailable');
  }

  openEditor(model: EditorModel, handlers: EditorHandlers): void {
    this.addMenu.classList.add('hidden');
    new Editor(this.parent, model, handlers);
  }

  openRotation(opts: { name: string; hours: number }, handlers: { onApply(hours: number): void; onCancel(): void }): void {
    this.addMenu.classList.add('hidden');
    showRotationDialog(this.parent, opts, handlers);
  }

  openLaunch(opts: { name: string }, handlers: { onLaunch(o: LaunchOptions): void; onCancel(): void }): void {
    this.addMenu.classList.add('hidden');
    showLaunchDialog(this.parent, opts, handlers);
  }

  showPlacement(
    hint: string, warning: string | null, blocked: boolean,
    climate: { text: string; tone: PreviewTone } | null = null,
  ): void {
    this.placement.classList.remove('hidden');
    this.addMenu.classList.add('hidden');
    this.placementHint.textContent = hint;
    this.placementClimate.textContent = climate?.text ?? '';
    this.placementClimate.dataset.tone = climate?.tone ?? 'neutral';
    this.placementWarning.textContent = warning ?? '';
    this.placementWarning.classList.toggle('blocked', blocked);
  }

  hidePlacement(): void {
    this.placement.classList.add('hidden');
  }

  toast(message: string): void {
    const t = el('div', 'hud-toast', message);
    this.toasts.append(t);
    setTimeout(() => t.classList.add('fade'), TOAST_MS - 500);
    setTimeout(() => t.remove(), TOAST_MS);
  }
}
