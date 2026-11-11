import { STAR_CHOICES, type StarType } from '../sim/stars';

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Pantalla inicial para elegir la estrella. Se elimina al elegir. */
export function showStartScreen(parent: HTMLElement, onChoose: (type: StarType) => void): void {
  const screen = document.createElement('div');
  screen.className = 'start-screen';
  const title = document.createElement('h1');
  title.textContent = 'Forja Estelar';
  const subtitle = document.createElement('p');
  subtitle.className = 'start-subtitle';
  subtitle.textContent = 'Elige la estrella de tu sistema';
  const grid = document.createElement('div');
  grid.className = 'start-grid';
  for (const choice of STAR_CHOICES) {
    const card = document.createElement('button');
    card.className = 'start-card';
    const dot = document.createElement('span');
    dot.className = 'start-dot';
    dot.style.background = hex(choice.color);
    dot.style.boxShadow = `0 0 24px ${hex(choice.color)}`;
    const name = document.createElement('strong');
    name.textContent = choice.label;
    const description = document.createElement('span');
    description.className = 'start-desc';
    description.textContent = choice.description;
    card.append(dot, name, description);
    card.onclick = () => {
      screen.remove();
      onChoose(choice.type);
    };
    grid.append(card);
  }
  screen.append(title, subtitle, grid);
  parent.append(screen);
}
