import { STAR_CHOICES, type StarType } from '../sim/stars';
import { createInstallButton } from '../pwa';
import { AUTOSAVE_ID, type SaveRecord } from '../game/saveStore';
import { formatElapsed } from './format';

const DELETE_CONFIRM_MS = 3000;

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text) e.textContent = text;
  return e;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** «Tipo Sol · 3 planetas · día 120 · 14 nov, 15:30» */
function describeSave(s: SaveRecord): string {
  let planets = 0, moons = 0;
  for (const b of s.bodies) {
    if (b.kind === 'star') continue;
    if (b.parentId === null) planets++;
    else moons++;
  }
  const parts = [s.systemName, plural(planets, 'planeta', 'planetas')];
  if (moons > 0) parts.push(plural(moons, 'luna', 'lunas'));
  parts.push(formatElapsed(s.time));
  parts.push(new Date(s.savedAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
  return parts.join(' · ');
}

export interface StartScreenHandlers {
  onNew(type: StarType): void;
  onLoad(save: SaveRecord): void;
  onDelete(id: string): void;
}

/** Pantalla inicial: continuar, abrir una partida guardada o empezar una nueva. Se elimina al elegir. */
export function showStartScreen(parent: HTMLElement, saves: SaveRecord[], h: StartScreenHandlers): void {
  const screen = el('div', 'start-screen');
  const close = () => screen.remove();
  screen.append(el('h1', '', 'Galaxium'));

  const auto = saves.find((s) => s.id === AUTOSAVE_ID);
  const named = saves.filter((s) => s.id !== AUTOSAVE_ID);

  if (auto) {
    const cont = el('button', 'start-continue');
    cont.append(el('strong', '', 'Continuar'), el('span', 'start-desc', `${auto.name} · ${describeSave(auto)}`));
    cont.onclick = () => {
      close();
      h.onLoad(auto);
    };
    screen.append(cont);
  }

  if (named.length > 0) {
    const section = el('div', 'start-section');
    section.append(el('p', 'start-subtitle', 'Partidas guardadas'));
    const list = el('div', 'start-saves');
    for (const s of named) {
      const row = el('div', 'start-save');
      const open = el('button', 'start-save-open');
      open.append(el('strong', '', s.name), el('span', 'start-desc', describeSave(s)));
      open.onclick = () => {
        close();
        h.onLoad(s);
      };
      const del = el('button', 'start-save-delete', '🗑');
      del.title = 'Borrar partida';
      del.setAttribute('aria-label', `Borrar ${s.name}`);
      let armed = false;
      let timer = 0;
      del.onclick = () => {
        if (armed) {
          clearTimeout(timer);
          row.remove();
          if (!list.children.length) section.remove();
          h.onDelete(s.id);
          return;
        }
        armed = true;
        del.textContent = '¿Borrar?';
        del.classList.add('armed');
        timer = window.setTimeout(() => {
          armed = false;
          del.textContent = '🗑';
          del.classList.remove('armed');
        }, DELETE_CONFIRM_MS);
      };
      row.append(open, del);
      list.append(row);
    }
    section.append(list);
    screen.append(section);
  }

  screen.append(el('p', 'start-subtitle', saves.length > 0 ? 'Nueva partida: elige la estrella' : 'Elige la estrella de tu sistema'));
  const grid = el('div', 'start-grid');
  for (const choice of STAR_CHOICES) {
    const card = el('button', 'start-card');
    const dot = el('span', 'start-dot');
    dot.style.background = hex(choice.color);
    dot.style.boxShadow = `0 0 24px ${hex(choice.color)}`;
    card.append(dot, el('strong', '', choice.label), el('span', 'start-desc', choice.description));
    card.onclick = () => {
      close();
      h.onNew(choice.type);
    };
    grid.append(card);
  }
  screen.append(grid, createInstallButton());
  parent.append(screen);
}
