/** Cada cuánto se revisa si hay una versión nueva publicada (ms) */
const CHECK_EVERY_MS = 5 * 60_000;
/** Primera revisión, poco después de abrir */
const FIRST_CHECK_MS = 4_000;

/** Nombre del archivo principal del juego en una página (cambia con cada versión). */
export function mainScriptOf(html: string): string | null {
  return html.match(/assets\/index-[\w-]+\.js/)?.[0] ?? null;
}

export interface UpdateHandlers {
  /** true si se puede recargar ya sin molestar (por ejemplo, en el menú) */
  canReloadNow(): boolean;
  /** Hay versión nueva pero se está jugando: avisar para que el jugador decida */
  onUpdateAvailable(): void;
}

/**
 * Revisa de vez en cuando (y al volver a la app) si se publicó una versión
 * nueva. En el menú recarga sola; durante una partida avisa.
 * Solo funciona en la versión compilada.
 */
export function watchForUpdates(h: UpdateHandlers): void {
  if (!import.meta.env.PROD) return;
  const current = mainScriptOf(document.documentElement.innerHTML);
  if (!current) return;
  let notified = false;
  let checking = false;

  const check = async () => {
    if (checking || notified || !navigator.onLine) return;
    checking = true;
    try {
      // Dirección única para saltarse cualquier caché (también la del modo sin conexión)
      const res = await fetch(`./?version=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const latest = mainScriptOf(await res.text());
      if (!latest || latest === current) return;
      if (h.canReloadNow()) location.reload();
      else {
        notified = true;
        h.onUpdateAvailable();
      }
    } catch {
      // Sin conexión: se intenta más tarde
    } finally {
      checking = false;
    }
  };

  setTimeout(check, FIRST_CHECK_MS);
  setInterval(check, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
}
