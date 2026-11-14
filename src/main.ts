import './ui/style.css';
import { SceneView } from './render/SceneView';
import { Hud } from './ui/Hud';
import { showStartScreen } from './ui/startScreen';
import { showSaveDialog } from './ui/saveDialog';
import { TouchInput } from './input/TouchInput';
import { Game } from './game/Game';
import { AUTOSAVE_ID, deleteSave, listSaves, newSaveId, putSave, requestPersistence, type SaveRecord } from './game/saveStore';
import { setupPwa } from './pwa';
import { watchForUpdates } from './updates';

setupPwa();

/** Cada cuánto se guarda sola la partida (ms) */
const AUTOSAVE_MS = 20_000;

const app = document.getElementById('app')!;
const view = new SceneView(app);
const game = new Game(view);
const hud = new Hud(app, {
  onSpeed: (i) => game.setSpeed(i),
  onAdd: (type) => game.requestAdd(type),
  onAddStar: (type) => game.requestAddStar(type),
  onCancelPlacement: () => game.cancelPlacement(),
  onFrameSystem: () => game.frameSystem(),
  onEdit: () => game.editSelected(),
  onFollow: () => game.followSelected(),
  onDeselect: () => game.deselect(),
  onGameMenu: () => openGameMenu(),
});
const input = new TouchInput(game);
input.attach(view.renderer.domElement);
game.attach(hud, input);

// ── Partidas ─────────────────────────────────────────────────
/** Partida con nombre en la que se está jugando (null = aún sin guardar) */
let slotId: string | null = null;
let slotName = '';

/** Guarda en «Continuar». No avisa: es automático. */
function autosave(): Promise<void> {
  if (!game.started) return Promise.resolve();
  const record: SaveRecord = { ...game.save(slotName || game.systemName), id: AUTOSAVE_ID, slotId };
  return putSave(record).catch(() => {});
}

async function saveNamed(name: string, asNew: boolean): Promise<void> {
  const id = asNew || !slotId ? newSaveId() : slotId;
  try {
    await putSave({ ...game.save(name), id });
    slotId = id;
    slotName = name;
    requestPersistence();
    await autosave();
    hud.toast(`Partida «${name}» guardada`);
  } catch {
    hud.toast('No se pudo guardar la partida');
  }
}

function openGameMenu(): void {
  if (!game.started) return;
  showSaveDialog(app, { name: slotName || game.systemName, hasSlot: slotId !== null }, {
    onSave: (name) => void saveNamed(name, false),
    onSaveCopy: (name) => void saveNamed(name, true),
    onExit: async () => {
      await autosave();
      void openStart();
    },
  });
}

async function openStart(): Promise<void> {
  hud.setVisible(false);
  game.startDemo();
  const saves = await listSaves().catch(() => [] as SaveRecord[]);
  showStartScreen(app, saves, {
    onNew: (type) => {
      slotId = null;
      slotName = '';
      hud.setVisible(true);
      game.start(type);
    },
    onLoad: (save) => {
      try {
        game.load(save);
      } catch {
        hud.toast('Esa partida está dañada y no se puede abrir');
        void openStart();
        return;
      }
      // «Continuar» sigue guardando en la partida con nombre de la que venía
      slotId = save.id === AUTOSAVE_ID ? (save.slotId ?? null) : save.id;
      slotName = slotId ? save.name : '';
      hud.setVisible(true);
    },
    onDelete: (id) => void deleteSave(id).catch(() => {}),
  });
}

void openStart();
setInterval(() => void autosave(), AUTOSAVE_MS);

// ── Actualizaciones ──────────────────────────────────────────
watchForUpdates({
  // En el menú se recarga sola; durante una partida se avisa
  canReloadNow: () => !game.started && !document.querySelector('.editor-backdrop'),
  onUpdateAvailable: () => {
    const banner = document.createElement('button');
    banner.className = 'update-banner';
    banner.textContent = '✨ Hay una versión nueva · Toca para actualizar';
    banner.onclick = async () => {
      banner.disabled = true;
      banner.textContent = 'Guardando y actualizando…';
      // Se guarda antes: al volver, «Continuar» sigue donde estabas
      await autosave();
      location.reload();
    };
    app.append(banner);
  },
});

let last = performance.now();
function loop(now: number): void {
  const seconds = (now - last) / 1000;
  last = now;
  game.frame(seconds);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.addEventListener('resize', () => view.resize());
document.addEventListener('visibilitychange', () => {
  // Al volver a la app no se cuenta el tiempo que estuvo en segundo plano
  last = performance.now();
  // Al salir de la app (cambiar de app, cerrar la pestaña) se guarda
  if (document.visibilityState === 'hidden') void autosave();
});
window.addEventListener('pagehide', () => void autosave());
