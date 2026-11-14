/** Evento que Chrome/Edge disparan cuando la app se puede instalar. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Dirección pública (https) desde donde se puede instalar la app. */
export const PUBLIC_URL = 'https://fernandogonzalesalvites-star.github.io/galaxium/';

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

/** true si el juego ya se está usando como app instalada. */
function runningInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Registra el service worker (solo en la versión compilada, para no guardar en
 * caché archivos del modo desarrollo) y escucha cuándo se puede instalar.
 */
export function setupPwa(): void {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    notify();
  });
}

/** Ventana con los pasos para instalar cuando el navegador no ofrece hacerlo directo. */
function showInstallHelp(): void {
  const overlay = document.createElement('div');
  overlay.className = 'install-help';
  const box = document.createElement('div');
  box.className = 'install-help-box';
  const title = document.createElement('h2');
  title.textContent = 'Instalar Galaxium';
  const body = document.createElement('div');
  body.className = 'install-help-body';

  const p = (text: string) => {
    const el = document.createElement('p');
    el.textContent = text;
    return el;
  };
  const steps = (items: string[]) => {
    const ol = document.createElement('ol');
    for (const item of items) {
      const li = document.createElement('li');
      li.textContent = item;
      ol.append(li);
    }
    return ol;
  };

  if (!window.isSecureContext) {
    const link = document.createElement('a');
    link.href = PUBLIC_URL;
    link.textContent = 'Abrir la versión instalable';
    link.className = 'install-help-link';
    body.append(
      p('Desde esta dirección el navegador no permite instalar el juego. Ábrelo desde la versión publicada y ahí toca «Instalar juego».'),
      link,
    );
  } else if (isIos()) {
    body.append(
      steps([
        'Abre el juego en Safari.',
        'Toca el botón Compartir (el cuadrado con una flecha hacia arriba).',
        'Elige «Agregar a pantalla de inicio» y luego «Agregar».',
      ]),
    );
  } else {
    body.append(
      steps([
        'Abre el menú del navegador (⋮ arriba a la derecha).',
        'Elige «Instalar aplicación» o «Agregar a pantalla de inicio».',
        'Confirma con «Instalar».',
      ]),
      p('Si no aparece la opción, espera unos segundos con el juego abierto y vuelve a intentarlo.'),
    );
  }

  const close = document.createElement('button');
  close.className = 'install-help-close';
  close.textContent = 'Entendido';
  const dismiss = () => overlay.remove();
  close.onclick = dismiss;
  overlay.onclick = (e) => {
    if (e.target === overlay) dismiss();
  };
  box.append(title, body, close);
  overlay.append(box);
  document.body.append(overlay);
}

/**
 * Botón «Instalar juego» de la pantalla de inicio. Si el navegador permite
 * instalar directo, abre su ventana; si no, explica los pasos. Se oculta
 * cuando el juego ya está abierto como app instalada.
 */
export function createInstallButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'install-button';
  button.textContent = 'Instalar juego';
  const sync = () => {
    button.hidden = installed || runningInstalled();
  };
  sync();
  listeners.add(sync);
  button.onclick = async () => {
    const prompt = deferred;
    if (!prompt) {
      showInstallHelp();
      return;
    }
    deferred = null;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') installed = true;
    notify();
  };
  return button;
}
