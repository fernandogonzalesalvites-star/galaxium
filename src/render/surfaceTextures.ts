import * as THREE from 'three';
import type { SurfaceStyle } from '../sim/surfaces';
import { surfaceLuminance } from './surfaceMaps';

const WIDTH = 512;
const HEIGHT = 256;

const cache = new Map<string, Promise<THREE.DataTexture>>();
const pending = new Map<string, (data: Uint8Array) => void>();
let worker: Worker | null | undefined;

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./surfaceWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ key: string; data: Uint8Array }>) => {
      pending.get(e.data.key)?.(e.data.data);
      pending.delete(e.data.key);
    };
  } catch {
    worker = null;
  }
  return worker;
}

function generate(key: string, style: SurfaceStyle, seed: number): Promise<Uint8Array> {
  const w = getWorker();
  if (!w) return Promise.resolve(surfaceLuminance(style, seed, WIDTH, HEIGHT));
  return new Promise((resolve) => {
    pending.set(key, resolve);
    w.postMessage({ key, style, seed, width: WIDTH, height: HEIGHT });
  });
}

/**
 * Textura incluida (en escala de grises) para teñir con el color del planeta.
 * Se genera en segundo plano y se reutiliza: mismo estilo y semilla, misma textura.
 * No liberar: la caché es compartida.
 */
export function surfaceTexture(style: SurfaceStyle, seed: number): Promise<THREE.DataTexture> {
  const key = `${style}:${seed}`;
  let p = cache.get(key);
  if (!p) {
    p = generate(key, style, seed).then((lum) => {
      const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
      for (let i = 0; i < lum.length; i++) {
        rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = lum[i];
        rgba[i * 4 + 3] = 255;
      }
      const tex = new THREE.DataTexture(rgba, WIDTH, HEIGHT);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = 4;
      tex.needsUpdate = true;
      return tex;
    });
    cache.set(key, p);
  }
  return p;
}

/** Vista previa pequeña (data URL en grises) para el editor. */
export function surfacePreview(style: SurfaceStyle, seed: number): string {
  const w = 96, h = 48;
  const lum = surfaceLuminance(style, seed, w, h);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      // La textura tiene el polo sur en la fila 0; en pantalla el norte va arriba
      const v = lum[(h - 1 - j) * w + i];
      const o = (j * w + i) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}
