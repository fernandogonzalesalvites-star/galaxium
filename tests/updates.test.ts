import { describe, it, expect } from 'vitest';
import { mainScriptOf } from '../src/updates';

describe('detectar versión nueva', () => {
  it('encuentra el archivo principal del juego en la página publicada', () => {
    const html = '<link rel="stylesheet" href="./assets/index-BGCOIo_r.css"><script type="module" crossorigin src="./assets/index-Cxzlxj_h.js"></script>';
    expect(mainScriptOf(html)).toBe('assets/index-Cxzlxj_h.js');
  });

  it('en modo desarrollo no hay archivo principal compilado', () => {
    expect(mainScriptOf('<script type="module" src="/src/main.ts"></script>')).toBeNull();
  });
});
