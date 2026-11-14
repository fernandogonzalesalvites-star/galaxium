import { surfaceLuminance } from './surfaceMaps';
import type { SurfaceStyle } from '../sim/surfaces';

interface Request { key: string; style: SurfaceStyle; seed: number; width: number; height: number }

/** Lo mínimo del ámbito de un worker que se usa aquí (el proyecto compila con los tipos del navegador). */
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<Request>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
};

/** Genera texturas en segundo plano para no congelar el juego. */
scope.onmessage = (e) => {
  const { key, style, seed, width, height } = e.data;
  const data = surfaceLuminance(style, seed, width, height);
  scope.postMessage({ key, data }, [data.buffer]);
};
