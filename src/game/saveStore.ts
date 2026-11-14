import { isValidSave, type SaveData } from './save';

/** Partida guardada en el dispositivo. */
export interface SaveRecord extends SaveData {
  id: string;
  /** Solo en el autoguardado: partida con nombre a la que pertenece (para seguir guardando en ella) */
  slotId?: string | null;
}

/** Id del autoguardado («Continuar»). */
export const AUTOSAVE_ID = 'auto';

const DB_NAME = 'galaxium';
const STORE = 'saves';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Todas las partidas válidas, de la más reciente a la más antigua. */
export async function listSaves(): Promise<SaveRecord[]> {
  const all = (await run('readonly', (s) => s.getAll())) as SaveRecord[];
  return all.filter(isValidSave).sort((a, b) => b.savedAt - a.savedAt);
}

export async function putSave(record: SaveRecord): Promise<void> {
  await run('readwrite', (s) => s.put(record));
}

export async function deleteSave(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id));
}

/** Id nuevo para una partida con nombre. */
export function newSaveId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Pide al navegador que no borre las partidas si falta espacio (no siempre lo concede). */
export function requestPersistence(): void {
  navigator.storage?.persist?.().catch(() => {});
}
