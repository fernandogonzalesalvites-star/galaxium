import { describe, it, expect } from 'vitest';
import { surfaceLuminance } from '../../src/render/surfaceMaps';
import { SURFACE_STYLES } from '../../src/sim/surfaces';

const W = 64, H = 32;

function stats(a: Uint8Array) {
  let min = 255, max = 0, sum = 0;
  for (const v of a) { min = Math.min(min, v); max = Math.max(max, v); sum += v; }
  return { min, max, mean: sum / a.length };
}

describe('texturas incluidas', () => {
  it('la lisa es blanca (el color se ve tal cual)', () => {
    expect(stats(surfaceLuminance('smooth', 1, W, H))).toMatchObject({ min: 255, max: 255 });
  });

  it('las demás tienen detalle y no quedan demasiado oscuras para teñir', () => {
    for (const style of SURFACE_STYLES.filter((s) => s !== 'smooth')) {
      const s = stats(surfaceLuminance(style, 7, W, H));
      expect(s.max - s.min, style).toBeGreaterThan(25);
      expect(s.mean, style).toBeGreaterThan(110);
    }
  });

  it('misma semilla, misma textura; otra semilla, otra textura', () => {
    const a = surfaceLuminance('rocky', 3, W, H);
    expect(surfaceLuminance('rocky', 3, W, H)).toEqual(a);
    expect(surfaceLuminance('rocky', 4, W, H)).not.toEqual(a);
  });

  it('no hay costura: los bordes izquierdo y derecho casi coinciden', () => {
    const a = surfaceLuminance('continents', 5, 256, 128);
    let diff = 0;
    for (let j = 0; j < 128; j++) diff += Math.abs(a[j * 256] - a[j * 256 + 255]);
    expect(diff / 128).toBeLessThan(12);
  });
});
