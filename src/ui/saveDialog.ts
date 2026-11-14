export interface SaveDialogHandlers {
  /** Guarda en la partida actual (o crea una si aún no tiene) */
  onSave(name: string): void;
  /** Guarda una copia con otro nombre */
  onSaveCopy(name: string): void;
  onExit(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text) e.textContent = text;
  return e;
}

/** Ventana «Partida»: nombre, guardar, guardar copia y salir al inicio. */
export function showSaveDialog(parent: HTMLElement, opts: { name: string; hasSlot: boolean }, h: SaveDialogHandlers): void {
  const backdrop = el('div', 'editor-backdrop');
  const panel = el('div', 'editor save-dialog');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Partida');
  const title = el('div', 'editor-title');
  title.append(
    el('strong', '', 'Partida'),
    el('span', 'editor-kind', 'Se guarda en este dispositivo. También se guarda sola mientras juegas.'),
  );

  const field = el('label', 'editor-field');
  field.append(el('span', 'editor-field-head', 'Nombre de la partida'));
  const input = el('input', 'editor-text');
  input.type = 'text';
  input.maxLength = 32;
  input.value = opts.name;
  field.append(input);

  const close = () => backdrop.remove();
  const name = () => input.value.trim() || opts.name;

  const save = el('button', 'hud-btn editor-apply', 'Guardar');
  save.onclick = () => {
    close();
    h.onSave(name());
  };
  const actions = el('div', 'editor-actions');
  const cancel = el('button', 'hud-btn', 'Cerrar');
  cancel.onclick = close;
  actions.append(cancel, save);

  panel.append(title, field, actions);
  if (opts.hasSlot) {
    const copy = el('button', 'hud-btn', 'Guardar como partida nueva');
    copy.onclick = () => {
      close();
      h.onSaveCopy(name());
    };
    panel.append(copy);
  }
  const exit = el('button', 'hud-btn save-exit', 'Salir al inicio');
  exit.onclick = () => {
    close();
    h.onExit();
  };
  panel.append(exit);

  backdrop.append(panel);
  backdrop.onclick = (e) => {
    if (e.target === backdrop) close();
  };
  input.onkeydown = (e) => {
    if (e.key === 'Enter') save.click();
  };
  parent.append(backdrop);
}
