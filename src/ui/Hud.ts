import { SPEED_LEVELS } from '../game/clock';
import { PLANET_PRESETS, PLANET_TYPES, type PlanetType } from '../sim/planetTypes';
import { formatElapsed, formatSpeed } from './format';
import type { BodyInfo } from './bodyInfo';
import { Editor, type EditorHandlers, type EditorModel, type PreviewTone } from './Editor';

export interface HudHandlers {
  onSpeed(index: number): void;
  onAdd(type: PlanetType): void;
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
    top.append(this.systemName, this.elapsed, menuButton, frameButton);

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
    this.sheet.append(sheetHead, this.sheetStatus, this.sheetRows, sheetActions);

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
    for (const type of PLANET_TYPES) {
      const b = el('button', 'hud-btn hud-add-item', PLANET_PRESETS[type].label);
      b.onclick = () => {
        this.addMenu.classList.add('hidden');
        h.onAdd(type);
      };
      this.addMenu.append(b);
    }

    const bottom = el('div', 'hud-bottom');
    bottom.append(timeWrap, add);
    this.root.append(top, this.sheet, this.placement, this.addMenu, bottom, this.toasts);
    parent.append(this.root);
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
    this.elapsed.textContent = formatElapsed(years);
    this.realSpeed.textContent = (throttled ? '⚠ ' : '') + formatSpeed(yearsPerSecond);
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
  }

  openEditor(model: EditorModel, handlers: EditorHandlers): void {
    this.addMenu.classList.add('hidden');
    new Editor(this.parent, model, handlers);
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
