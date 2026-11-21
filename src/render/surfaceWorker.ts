import { surfaceLuminance, vegetationMap } from './surfaceMaps';
import type { SurfaceStyle } from '../sim/surfaces';

type Request =
  | { key: string; kind: 'surface'; style: SurfaceStyle; seed: number; width: number; height: number }
  | { key: string; kind: 'vegetation'; seed: number; width: number; height: number };

/** Lo mínimo del ámbito de un worker que se usa aquí (el proyecto compila con los tipos del navegador). */
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<Request>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
};

/** Genera texturas en segundo plano para no congelar el juego. */
scope.onmessage = (e) => {
  const req = e.data;
  const data = req.kind === 'vegetation'
    ? vegetationMap(req.seed, req.width, req.height)
    : surfaceLuminance(req.style, req.seed, req.width, req.height);
  scope.postMessage({ key: req.key, data }, [data.buffer]);
};
