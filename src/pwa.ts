/** Evento que Chrome/Edge disparan cuando la app se puede instalar. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

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
    notify();
  });
}

/** Botón "Instalar app": solo se ve cuando el navegador ofrece instalarla. */
export function createInstallButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'install-button';
  button.textContent = 'Instalar app';
  const sync = () => {
    button.hidden = !deferred;
  };
  sync();
  listeners.add(sync);
  button.onclick = async () => {
    const prompt = deferred;
    if (!prompt) return;
    deferred = null;
    notify();
    await prompt.prompt();
    await prompt.userChoice;
  };
  return button;
}
