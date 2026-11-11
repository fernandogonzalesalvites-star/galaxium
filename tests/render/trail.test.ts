import { describe, expect, test } from 'vitest';
import { TrailHistory, TRAIL_LENGTH } from '../../src/render/trail';
import { DT } from '../../src/sim/units';

function run(period: number, orbits: number) {
  const h = new TrailHistory();
  h.period = period;
  h.interval = period / TRAIL_LENGTH;
  const total = Math.round((orbits * period) / DT);
  let t = 0;
  for (let done = 0; done < total; ) {
    const chunk = Math.min(333, total - done);
    for (let i = 0; i < chunk; i++) {
      t += DT;
      const a = (2 * Math.PI * t) / period;
      h.maybeRecord(t, Math.cos(a), 0, Math.sin(a));
    }
    done += chunk;
  }
  const times: number[] = [];
  h.forEachVisible(t - period, t, (_x, _y, _z, ts) => times.push(ts));
  return { h, t, times };
}

describe('TrailHistory', () => {
  test('planeta de 1 año: ~200 puntos visibles espaciados por el intervalo', () => {
    const { h, times } = run(1, 5);
    expect(Math.abs(times.length - 200)).toBeLessThanOrEqual(2);
    for (let i = 1; i < times.length; i++) {
      expect(Math.abs(times[i] - times[i - 1] - h.interval)).toBeLessThanOrEqual(DT + 1e-12);
    }
  });

  test('luna de 0.0748 años: un punto por substep dentro del periodo', () => {
    const P = 0.0748;
    const { t, times } = run(P, 20);
    expect(Math.abs(times.length - P / DT)).toBeLessThanOrEqual(2);
    expect(times.length).toBeLessThanOrEqual(TRAIL_LENGTH);
    for (const ts of times) expect(ts).toBeGreaterThanOrEqual(t - P);
  });

  test('reset vacía el historial', () => {
    const { h, t } = run(1, 1);
    h.reset();
    const seen: number[] = [];
    h.forEachVisible(-Infinity, Infinity, (_x, _y, _z, ts) => seen.push(ts));
    expect(seen.length).toBe(0);
    expect(h.nextTime).toBe(-Infinity);
    expect(t).toBeGreaterThan(0);
  });
});
