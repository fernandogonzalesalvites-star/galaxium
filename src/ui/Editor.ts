import type { BodyEdit, EditRanges, Range, SingleStarType } from '../game/editing';
import { RING_OUTER, RING_TILT, SINGLE_STAR_TYPES } from '../game/editing';
import type { Ring } from '../sim/body';
import { imageToSurface } from './imageTexture';
import { SINGLE_STARS } from '../sim/stars';
import { formatDistance, formatPercent, sig } from './format';

export interface EditorModel {
  /** «Planeta rocoso», «Luna», «Estrella»… */
  kindLabel: string;
  name: string;
  /** Solo estrellas: tipo actual (null si no coincide con ninguno) */
  starType?: SingleStarType | null;
  /** Solo planetas y lunas */
  values?: BodyEdit;
  ranges?: EditRanges;
  isMoon: boolean;
  hasWater: boolean;
  canDelete: boolean;
  /** Solo planetas: se le pueden poner anillos */
  canHaveRing?: boolean;
  /** Anillos que se proponen al activarlos */
  defaultRing?: Ring;
}

export interface EditorResult {
  name: string;
  starType?: SingleStarType;
  values?: BodyEdit;
}

export type PreviewTone = 'good' | 'bad' | 'neutral';

export interface EditorHandlers {
  onApply(result: EditorResult): void;
  onCancel(): void;
  onDelete(): void;
  /** Texto que resume cómo quedaría el cuerpo con estos valores */
  preview(result: EditorResult): { text: string; tone: PreviewTone };
  /** Distancias permitidas para esa masa y ese radio (UA) */
  distanceRange(massEarth: number, radiusEarth: number): Range;
}

const SLIDER_STEPS = 1000;
const DELETE_CONFIRM_MS = 3000;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text) e.textContent = text;
  return e;
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

interface Field {
  root: HTMLElement;
  value(): number;
}

/** Deslizador con escala logarítmica entre range.min y range.max. */
function logSlider(label: string, initial: number, range: Range, format: (v: number) => string, onInput: () => void) {
  const root = el('label', 'editor-field');
  const head = el('span', 'editor-field-head');
  const name = el('span', '', label);
  const shown = el('span', 'editor-field-value');
  head.append(name, shown);
  const input = el('input', 'editor-range');
  input.type = 'range';
  input.min = '0';
  input.max = String(SLIDER_STEPS);
  input.step = '1';
  root.append(head, input);
  let r = range;
  let current = initial;
  const toPos = (v: number) =>
    r.max > r.min ? (SLIDER_STEPS * Math.log(v / r.min)) / Math.log(r.max / r.min) : 0;
  const fromPos = (p: number) => r.min * Math.pow(r.max / r.min, p / SLIDER_STEPS);
  const render = () => {
    input.value = String(Math.round(toPos(current)));
    shown.textContent = format(current);
  };
  input.disabled = r.max <= r.min;
  input.oninput = () => {
    current = fromPos(Number(input.value));
    shown.textContent = format(current);
    onInput();
  };
  render();
  return {
    root,
    value: () => current,
    setRange(next: Range) {
      r = next;
      current = Math.min(r.max, Math.max(r.min, current));
      input.disabled = r.max <= r.min;
      render();
    },
  };
}

/** Deslizador lineal de 0 a 1, en porcentaje. */
function fractionSlider(label: string, initial: number, onInput: () => void): Field {
  const root = el('label', 'editor-field');
  const head = el('span', 'editor-field-head');
  const shown = el('span', 'editor-field-value', formatPercent(initial));
  head.append(el('span', '', label), shown);
  const input = el('input', 'editor-range');
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  input.step = '1';
  input.value = String(Math.round(initial * 100));
  let current = initial;
  input.oninput = () => {
    current = Number(input.value) / 100;
    shown.textContent = formatPercent(current);
    onInput();
  };
  root.append(head, input);
  return { root, value: () => current };
}

/** Deslizador lineal entre range.min y range.max. */
function linearSlider(label: string, initial: number, range: Range, step: number, format: (v: number) => string, onInput: () => void): Field {
  const root = el('label', 'editor-field');
  const head = el('span', 'editor-field-head');
  const shown = el('span', 'editor-field-value', format(initial));
  head.append(el('span', '', label), shown);
  const input = el('input', 'editor-range');
  input.type = 'range';
  input.min = String(range.min);
  input.max = String(range.max);
  input.step = String(step);
  input.value = String(initial);
  let current = initial;
  input.oninput = () => {
    current = Number(input.value);
    shown.textContent = format(current);
    onInput();
  };
  root.append(head, input);
  return { root, value: () => current };
}

/** Interruptor con texto, para activar o desactivar una sección. */
function toggle(label: string, initial: boolean, onChange: (on: boolean) => void) {
  const root = el('label', 'editor-field editor-toggle');
  const input = el('input', 'editor-switch');
  input.type = 'checkbox';
  input.checked = initial;
  input.onchange = () => onChange(input.checked);
  root.append(el('span', 'editor-field-head', label), input);
  return { root, value: () => input.checked };
}

/** Ventana del editor de planetas, lunas y estrellas. Mientras está abierta, el juego está en pausa. */
export class Editor {
  private readonly backdrop = el('div', 'editor-backdrop');

  constructor(parent: HTMLElement, model: EditorModel, private readonly h: EditorHandlers) {
    const panel = el('div', 'editor');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', `Editar ${model.name}`);
    const title = el('div', 'editor-title');
    title.append(el('strong', '', `Editar ${model.name}`), el('span', 'editor-kind', model.kindLabel));

    const nameField = el('label', 'editor-field');
    nameField.append(el('span', 'editor-field-head', 'Nombre'));
    const nameInput = el('input', 'editor-text');
    nameInput.type = 'text';
    nameInput.maxLength = 24;
    nameInput.value = model.name;
    nameField.append(nameInput);

    const preview = el('div', 'editor-preview');
    const body = el('div', 'editor-body');
    body.append(nameField);

    let collect: () => EditorResult;
    const refresh = () => {
      const p = this.h.preview(collect());
      preview.textContent = p.text;
      preview.dataset.tone = p.tone;
    };

    if (model.starType !== undefined) {
      let chosen = model.starType;
      const group = el('div', 'editor-star-types');
      const buttons: HTMLButtonElement[] = [];
      for (const type of SINGLE_STAR_TYPES) {
        const spec = SINGLE_STARS[type];
        const b = el('button', 'editor-star-type');
        b.type = 'button';
        const dot = el('span', 'editor-dot');
        dot.style.background = hex(spec.color);
        b.append(dot, el('span', '', spec.name));
        b.onclick = () => {
          chosen = type;
          buttons.forEach((x) => x.classList.toggle('active', x === b));
          refresh();
        };
        b.classList.toggle('active', type === chosen);
        buttons.push(b);
        group.append(b);
      }
      const field = el('div', 'editor-field');
      field.append(el('span', 'editor-field-head', 'Tipo de estrella'), group);
      body.append(field);
      collect = () => ({ name: nameInput.value, starType: chosen ?? undefined });
    } else {
      const v = model.values!;
      const ranges = model.ranges!;
      let distance: ReturnType<typeof logSlider>;
      const onSize = () => {
        if (model.isMoon) distance.setRange(this.h.distanceRange(mass.value(), radius.value()));
        refresh();
      };
      const mass = logSlider('Masa', v.massEarth, ranges.mass, (x) => `${sig(x)} M⊕`, onSize);
      const radius = logSlider('Tamaño (radio)', v.radiusEarth, ranges.radius, (x) => `${sig(x)} R⊕`, onSize);
      distance = logSlider(
        model.isMoon ? 'Distancia al planeta' : 'Distancia a la estrella',
        v.distance, ranges.distance, (x) => formatDistance(x, model.isMoon), refresh,
      );
      const atmosphere = fractionSlider('Atmósfera', v.atmosphere, refresh);
      const water = fractionSlider('Agua', v.water, refresh);
      const colorField = el('label', 'editor-field editor-color-field');
      const colorInput = el('input', 'editor-color');
      colorInput.type = 'color';
      colorInput.value = hex(v.color);
      colorField.append(el('span', 'editor-field-head', 'Color'), colorInput);
      body.append(mass.root, radius.root, distance.root, atmosphere.root);
      if (model.hasWater) body.append(water.root);
      body.append(colorField);

      // Superficie: imagen propia envuelta alrededor del planeta
      let texture = v.texture;
      const surface = el('div', 'editor-field');
      const surfaceRow = el('div', 'editor-surface');
      const thumb = el('span', 'editor-thumb');
      const pick = el('button', 'hud-btn editor-small-btn', 'Elegir imagen');
      pick.type = 'button';
      const clear = el('button', 'hud-btn editor-small-btn', 'Quitar');
      clear.type = 'button';
      const fileInput = el('input', 'hidden');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      const surfaceNote = el('span', 'editor-note');
      const renderSurface = () => {
        thumb.style.backgroundImage = texture ? `url(${texture})` : '';
        thumb.style.backgroundColor = texture ? '' : colorInput.value;
        clear.hidden = !texture;
        pick.textContent = texture ? 'Cambiar' : 'Elegir imagen';
        surfaceNote.textContent = texture
          ? 'La imagen cubre todo el planeta. Los mapas 2:1 encajan perfecto.'
          : 'Usa una foto o un dibujo como superficie.';
      };
      pick.onclick = () => fileInput.click();
      clear.onclick = () => {
        texture = null;
        renderSurface();
      };
      fileInput.onchange = async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;
        pick.disabled = true;
        pick.textContent = 'Cargando…';
        try {
          const s = await imageToSurface(file);
          texture = s.dataUrl;
          // El punto y la estela toman el color medio de la imagen
          colorInput.value = hex(s.average);
        } catch {
          surfaceNote.textContent = 'No se pudo usar esa imagen. Prueba con otra.';
          pick.disabled = false;
          return;
        }
        pick.disabled = false;
        renderSurface();
      };
      colorInput.addEventListener('input', renderSurface);
      surfaceRow.append(thumb, pick, clear);
      surface.append(el('span', 'editor-field-head', 'Superficie'), surfaceRow, surfaceNote, fileInput);
      body.append(surface);
      renderSurface();

      // Anillos (solo planetas)
      let ringOn = false;
      let ringColor: HTMLInputElement | null = null;
      let ringSize: Field | null = null;
      let ringTilt: Field | null = null;
      if (model.canHaveRing) {
        const r0 = v.ring ?? model.defaultRing!;
        ringOn = v.ring !== null;
        const ringBox = el('div', 'editor-ring');
        const ringSwitch = toggle('Anillos', ringOn, (on) => {
          ringOn = on;
          ringBox.hidden = !on;
        });
        const ringColorField = el('label', 'editor-field editor-color-field');
        ringColor = el('input', 'editor-color');
        ringColor.type = 'color';
        ringColor.value = hex(r0.color);
        ringColorField.append(el('span', 'editor-field-head', 'Color de los anillos'), ringColor);
        ringSize = linearSlider('Tamaño de los anillos', r0.outer, RING_OUTER, 0.05, (x) => `${x.toFixed(1)}× el radio`, () => {});
        ringTilt = linearSlider('Inclinación', r0.tilt, RING_TILT, 1, (x) => `${Math.round(x)}°`, () => {});
        ringBox.append(ringColorField, ringSize.root, ringTilt.root);
        ringBox.hidden = !ringOn;
        body.append(ringSwitch.root, ringBox);
      }

      collect = () => ({
        name: nameInput.value,
        values: {
          name: nameInput.value,
          massEarth: mass.value(),
          radiusEarth: radius.value(),
          distance: distance.value(),
          atmosphere: atmosphere.value(),
          water: model.hasWater ? water.value() : 0,
          color: parseInt(colorInput.value.slice(1), 16),
          texture,
          ring: ringOn && ringColor && ringSize && ringTilt
            ? { color: parseInt(ringColor.value.slice(1), 16), outer: ringSize.value(), tilt: ringTilt.value() }
            : null,
        },
      });
    }

    const actions = el('div', 'editor-actions');
    const cancel = el('button', 'hud-btn', 'Cancelar');
    cancel.onclick = () => this.close(() => this.h.onCancel());
    const apply = el('button', 'hud-btn editor-apply', 'Aplicar');
    apply.onclick = () => this.close(() => this.h.onApply(collect()));
    actions.append(cancel, apply);

    panel.append(title, preview, body, actions);
    if (model.canDelete) {
      const del = el('button', 'hud-btn editor-delete', 'Eliminar');
      let armed = false;
      let timer = 0;
      del.onclick = () => {
        if (armed) {
          clearTimeout(timer);
          this.close(() => this.h.onDelete());
          return;
        }
        armed = true;
        del.textContent = 'Toca otra vez para eliminar';
        del.classList.add('armed');
        timer = window.setTimeout(() => {
          armed = false;
          del.textContent = 'Eliminar';
          del.classList.remove('armed');
        }, DELETE_CONFIRM_MS);
      };
      panel.append(del);
    }

    this.backdrop.append(panel);
    this.backdrop.onclick = (e) => {
      if (e.target === this.backdrop) this.close(() => this.h.onCancel());
    };
    parent.append(this.backdrop);
    refresh();
  }

  private close(then: () => void): void {
    this.backdrop.remove();
    then();
  }
}
