import { describe, expect, test } from 'vitest';
import { fitDistance } from '../../src/render/cameraFit';

describe('fitDistance', () => {
  const tan = Math.tan((25 * Math.PI) / 180);
  test('retrato: el radio cabe a lo ancho', () => {
    const a = 375 / 812;
    for (const r of [0.01, 1, 40]) {
      expect(fitDistance(r, 2.5, a) * tan * a).toBeGreaterThanOrEqual(1.16 * r);
      expect(fitDistance(r, 3, a) * tan * a).toBeGreaterThanOrEqual(1.39 * r);
    }
  });
  test('sin tamaño de pantalla: distancia finita', () => {
    expect(fitDistance(2, 2.5, 0)).toBe(5);
    expect(fitDistance(2, 2.5, NaN)).toBe(5);
  });
  test('horizontal: sin cambios', () => {
    expect(fitDistance(2, 2.5, 1.78)).toBe(5);
    expect(fitDistance(2, 3, 1.78)).toBe(6);
  });
});
