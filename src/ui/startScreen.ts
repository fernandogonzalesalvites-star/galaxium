import { STAR_CHOICES, type StarType } from '../sim/stars';
import { createInstallButton } from '../pwa';
import { AUTOSAVE_ID, type SaveRecord } from '../game/saveStore';
import { formatElapsed, formatGalacticElapsed } from './format';

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
  const date = new Date(s.savedAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  if (s.universe === 'galaxies') {
    const n = s.bodies.filter((b) => b.kind === 'galaxy').length;
    return [s.systemName, plural(n, 'galaxia', 'galaxias'), formatGalacticElapsed(s.time), date].join(' · ');
  }
  let planets = 0, moons = 0;
  for (const b of s.bodies) {
    if (b.kind === 'star') continue;
    if (b.parentId === null) planets++;
    else moons++;
  }
  const parts = [s.systemName, plural(planets, 'planeta', 'planetas')];
  if (moons > 0) parts.push(plural(moons, 'luna', 'lunas'));
  parts.push(formatElapsed(s.time));
  parts.push(date);
  return parts.join(' · ');
}

export interface StartScreenHandlers {
  onNew(type: StarType): void;
  /** Empezar en el modo galaxias */
  onGalaxies(): void;
  onLoad(save: SaveRecord): void;
  onDelete(id: string): void;
}

/**
 * Pantalla inicial, estilo «Cine»: título grande y fino arriba a la izquierda,
 * «Jugar →» debajo (lleva a continuar, abrir una partida o elegir la estrella de
 * una nueva), un atajo «Continuar» y el horizonte de un planeta abajo.
 * Se elimina al elegir.
 */
export function showStartScreen(parent: HTMLElement, saves: SaveRecord[], h: StartScreenHandlers): void {
  const screen = el('div', 'start-screen');
  const close = () => screen.remove();

  const header = el('header', 'start-header');
  const title = el('h1', 'start-title');
  title.append(el('span', 'start-title-main', 'Galaxium'), el('span', 'start-title-sub', 'Simulator'));
  header.append(title);

  const auto = saves.find((s) => s.id === AUTOSAVE_ID);
  const named = saves.filter((s) => s.id !== AUTOSAVE_ID);

  // ── Menú principal (estilo «Cine») ──
  const menu = el('div', 'start-menu');
  // Horizonte curvo de un planeta iluminado, abajo, detrás de todo
  screen.append(el('div', 'start-horizon'));
  const play = el('button', 'start-play-btn');
  play.innerHTML = 'Jugar <span class="start-play-arrow" aria-hidden="true">→</span>';
  const menuFooter = el('div', 'start-footer');
  const where = location.hostname.endsWith('github.io') ? '' : ` · ${location.host}`;
  // Se muestra en la hora local de quien juega
  const built = new Date(__BUILD_DATE__).toLocaleString('es', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  menuFooter.append(createInstallButton(), el('p', 'start-version', `Versión del ${built}${where}`));
  const menuCenter = el('div', 'start-menu-center');
  menuCenter.append(play);
  // Atajo: seguir la última partida sin pasar por la pantalla de estrellas
  if (auto) {
    const cont = el('button', 'start-continue-link');
    cont.append(
      el('span', 'start-continue-label', 'Continuar'),
      el('span', 'start-continue-detail', ` · ${auto.name} · ${describeSave(auto).split(' · ').slice(-2, -1)[0] ?? ''}`),
    );
    cont.onclick = () => {
      close();
      h.onLoad(auto);
    };
    menuCenter.append(cont);
  }
  menu.append(menuCenter, menuFooter);

  // ── Elegir partida o estrella ──
  const choose = el('div', 'start-choose');
  choose.hidden = true;
  const back = el('button', 'start-back', '← Volver');
  back.onclick = () => {
    choose.hidden = true;
    menu.hidden = false;
    screen.classList.remove('choosing');
  };
  play.onclick = () => {
    menu.hidden = true;
    choose.hidden = false;
    screen.classList.add('choosing');
    screen.scrollTop = 0;
  };
  choose.append(back);

  if (auto) {
    const cont = el('button', 'start-continue');
    cont.append(el('strong', '', 'Continuar'), el('span', 'start-desc', `${auto.name} · ${describeSave(auto)}`));
    cont.onclick = () => {
      close();
      h.onLoad(auto);
    };
    choose.append(cont);
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
    choose.append(section);
  }

  choose.append(el('p', 'start-subtitle', saves.length > 0 ? 'Nueva partida: elige la estrella' : 'Elige la estrella de tu sistema'));
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
  // Debajo de las estrellas: el modo galaxias, donde solo se añaden galaxias
  const galaxyCard = el('button', 'start-galaxies');
  galaxyCard.append(
    el('span', 'start-galaxy-icon'),
    el('strong', '', 'Galaxias'),
    el('span', 'start-desc', 'Otra escala: aquí solo se añaden galaxias. Se atraen, giran unas alrededor de otras y, si chocan, se fusionan.'),
  );
  galaxyCard.onclick = () => {
    close();
    h.onGalaxies();
  };
  choose.append(grid, galaxyCard);
  screen.append(header, menu, choose);
  parent.append(screen);
}
