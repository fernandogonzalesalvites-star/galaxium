import { describe, it, expect } from 'vitest';
import { G, DT } from '../../src/sim/units';

describe('unidades', () => {
  it('una órbita circular a 1 UA del Sol va a 2π UA/año', () => {
    expect(Math.sqrt(G * 1 / 1)).toBeCloseTo(2 * Math.PI, 10);
  });

  it('el subpaso dura unas 4,4 horas', () => {
    expect(DT * 365.25 * 24).toBeCloseTo(4.38, 2);
  });
});
