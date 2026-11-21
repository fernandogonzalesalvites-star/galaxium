import { DAY_EXAMPLES, DAY_HOURS_MAX, DAY_HOURS_MIN, formatDayHours, parseDayHours } from '../sim/rotation';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text) e.textContent = text;
  return e;
}

/**
 * Edición de la rotación de un planeta: solo la duración del día.
 * 1 hora del planeta = 1 segundo en el juego (24 h → una vuelta cada 24 s).
 */
export function showRotationDialog(
  parent: HTMLElement,
  opts: { name: string; hours: number },
  h: { onApply(hours: number): void; onCancel(): void },
): void {
  const backdrop = el('div', 'editor-backdrop');
  const panel = el('div', 'editor rotation-dialog');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', `Rotación de ${opts.name}`);
  const title = el('div', 'editor-title');
  title.append(el('strong', '', `Rotación de ${opts.name}`), el('span', 'editor-kind', `Ahora: ${formatDayHours(opts.hours)}`));

  const field = el('label', 'editor-field');
  field.append(el('span', 'editor-field-head', 'Duración del día (horas)'));
  const input = el('input', 'editor-text');
  input.type = 'text';
  input.inputMode = 'decimal';
  input.value = String(opts.hours).replace('.', ',');
  const help = el('span', 'editor-note');
  const error = el('span', 'rotation-error hidden');
  error.setAttribute('role', 'alert');
  field.append(input, help, error);

  const renderHelp = () => {
    const r = parseDayHours(input.value);
    help.textContent = 'hours' in r
      ? `1 hora = 1 segundo en el juego: dará una vuelta cada ${formatSeconds(r.hours)}.`
      : `1 hora = 1 segundo en el juego. Entre ${DAY_HOURS_MIN} y ${DAY_HOURS_MAX} horas.`;
  };

  const examples = el('div', 'editor-surface-chips');
  for (const ex of DAY_EXAMPLES) {
    const b = el('button', 'editor-chip', `${ex.label} ${formatDayHours(ex.hours).replace(/ \(.*\)/, '')}`);
    b.type = 'button';
    b.onclick = () => {
      input.value = String(ex.hours).replace('.', ',');
      error.classList.add('hidden');
      input.removeAttribute('aria-invalid');
      renderHelp();
    };
    examples.append(b);
  }
  const exField = el('div', 'editor-field');
  exField.append(el('span', 'editor-field-head', 'Ejemplos'), examples);

  const close = () => backdrop.remove();
  const apply = el('button', 'hud-btn editor-apply', 'Aplicar');
  apply.onclick = () => {
    const r = parseDayHours(input.value);
    if ('error' in r) {
      // Dice cómo arreglarlo y no borra lo escrito
      error.textContent = r.error;
      error.classList.remove('hidden');
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    close();
    h.onApply(r.hours);
  };
  const cancel = el('button', 'hud-btn', 'Cancelar');
  cancel.onclick = () => {
    close();
    h.onCancel();
  };
  const actions = el('div', 'editor-actions');
  actions.append(cancel, apply);

  input.oninput = () => {
    error.classList.add('hidden');
    input.removeAttribute('aria-invalid');
    renderHelp();
  };
  input.onkeydown = (e) => {
    if (e.key === 'Enter') apply.click();
    if (e.key === 'Escape') cancel.click();
  };
  backdrop.onclick = (e) => {
    if (e.target === backdrop) cancel.click();
  };

  panel.append(title, field, exField, actions);
  backdrop.append(panel);
  parent.append(backdrop);
  renderHelp();
  input.select();
}

/** «24 segundos», «1 minuto y 5 segundos». */
function formatSeconds(s: number): string {
  const total = Math.round(s * 10) / 10;
  if (total < 60) return `${total.toLocaleString('es-ES')} ${total === 1 ? 'segundo' : 'segundos'}`;
  const m = Math.floor(total / 60), rest = Math.round(total - m * 60);
  const mins = `${m} ${m === 1 ? 'minuto' : 'minutos'}`;
  return rest ? `${mins} y ${rest} ${rest === 1 ? 'segundo' : 'segundos'}` : mins;
}
