import { SPEED_LEVELS } from '../game/clock';
import { PLANET_PRESETS, PLANET_TYPES, type PlanetType } from '../sim/planetTypes';
import { formatElapsed, formatSpeed } from './format';

export interface HudHandlers {
  onSpeed(index: number): void;
  onAdd(type: PlanetType): void;
  onCancelPlacement(): void;
  onFrameSystem(): void;
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
  private readonly selected = el('div', 'hud-selected hidden');
  private readonly placement = el('div', 'hud-placement hidden');
  private readonly placementHint = el('div', 'hud-placement-hint');
  private readonly placementWarning = el('div', 'hud-placement-warning');
  private readonly addMenu = el('div', 'hud-add-menu hidden');
  private readonly toasts = el('div', 'hud-toasts');
  private readonly speedButtons: HTMLButtonElement[] = [];
  private lastTextUpdate = -Infinity;

  constructor(parent: HTMLElement, h: HudHandlers) {
    const top = el('div', 'hud-top');
    const frameButton = el('button', 'hud-btn hud-frame', '⌖');
    frameButton.title = 'Ver todo el sistema';
    frameButton.onclick = () => h.onFrameSystem();
    top.append(this.systemName, this.elapsed, frameButton);

    const cancel = el('button', 'hud-btn', 'Cancelar');
    cancel.onclick = () => h.onCancelPlacement();
    this.placement.append(this.placementHint, this.placementWarning, cancel);

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
    this.root.append(top, this.selected, this.placement, this.addMenu, bottom, this.toasts);
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

  setSelected(name: string | null): void {
    this.selected.textContent = name ?? '';
    this.selected.classList.toggle('hidden', name === null);
  }

  showPlacement(hint: string, warning: string | null, blocked: boolean): void {
    this.placement.classList.remove('hidden');
    this.addMenu.classList.add('hidden');
    this.placementHint.textContent = hint;
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
