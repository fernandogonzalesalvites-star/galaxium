import { PROJECTILE_SPECS, PROJECTILE_TYPES, type ProjectileType } from '../sim/projectiles';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text) e.textContent = text;
  return e;
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const STEPS = 1000;

export interface LaunchOptions {
  type: ProjectileType;
  radiusEarth: number;
  color: number;
}

/**
 * Ventana «Lanzar»: qué lanzar (asteroide o rocoso pequeño, mediano o grande),
 * su tamaño y su color. Al lanzar sale desde lejos directo hacia el planeta.
 */
export function showLaunchDialog(
  parent: HTMLElement,
  opts: { name: string },
  h: { onLaunch(o: LaunchOptions): void; onCancel(): void },
): void {
  const backdrop = el('div', 'editor-backdrop');
  const panel = el('div', 'editor launch-dialog');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', `Lanzar contra ${opts.name}`);
  const title = el('div', 'editor-title');
  title.append(
    el('strong', '', `Lanzar contra ${opts.name}`),
    el('span', 'editor-kind', 'Al chocar se fusionan, cambia de color y queda un cráter que se va borrando.'),
  );

  let type: ProjectileType = 'asteroid';
  let radius = PROJECTILE_SPECS[type].radius;

  // Qué lanzar
  const typeField = el('div', 'editor-field');
  const chips = el('div', 'editor-surface-chips');
  const chipFor = new Map<ProjectileType, HTMLButtonElement>();
  for (const t of PROJECTILE_TYPES) {
    const b = el('button', 'editor-chip', PROJECTILE_SPECS[t].label);
    b.type = 'button';
    b.onclick = () => {
      type = t;
      radius = PROJECTILE_SPECS[t].radius;
      color.value = hex(PROJECTILE_SPECS[t].color);
      render();
    };
    chipFor.set(t, b);
    chips.append(b);
  }
  typeField.append(el('span', 'editor-field-head', 'Qué lanzar'), chips);

  // Tamaño (deslizador en escala logarítmica dentro del rango del tipo)
  const sizeField = el('label', 'editor-field');
  const sizeHead = el('span', 'editor-field-head');
  const sizeValue = el('span', 'editor-field-value');
  sizeHead.append(el('span', '', 'Tamaño (radio)'), sizeValue);
  const slider = el('input', 'editor-range');
  slider.type = 'range';
  slider.min = '0';
  slider.max = String(STEPS);
  sizeField.append(sizeHead, slider);
  const toPos = (r: number) => {
    const s = PROJECTILE_SPECS[type];
    return Math.round((STEPS * Math.log(r / s.min)) / Math.log(s.max / s.min));
  };
  slider.oninput = () => {
    const s = PROJECTILE_SPECS[type];
    radius = s.min * Math.pow(s.max / s.min, Number(slider.value) / STEPS);
    render();
  };

  // Color
  const colorField = el('label', 'editor-field editor-color-field');
  const color = el('input', 'editor-color');
  color.type = 'color';
  color.value = hex(PROJECTILE_SPECS[type].color);
  colorField.append(el('span', 'editor-field-head', 'Color'), color);

  const render = () => {
    for (const [t, b] of chipFor) b.classList.toggle('active', t === type);
    slider.value = String(toPos(radius));
    const km = Math.round((radius * 6371) / 10) * 10;
    sizeValue.textContent = `${radius.toLocaleString('es-ES', { maximumSignificantDigits: 2 })} R⊕ · ${km.toLocaleString('es-ES')} km`;
  };

  const close = () => backdrop.remove();
  const launch = el('button', 'hud-btn editor-apply', '☄️ Lanzar');
  launch.onclick = () => {
    close();
    h.onLaunch({ type, radiusEarth: radius, color: parseInt(color.value.slice(1), 16) });
  };
  const cancel = el('button', 'hud-btn', 'Cancelar');
  cancel.onclick = () => {
    close();
    h.onCancel();
  };
  const actions = el('div', 'editor-actions');
  actions.append(cancel, launch);
  backdrop.onclick = (e) => {
    if (e.target === backdrop) cancel.click();
  };

  panel.append(title, typeField, sizeField, colorField, actions);
  backdrop.append(panel);
  parent.append(backdrop);
  render();
}
