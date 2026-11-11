import { describe, it, expect } from 'vitest';
import { SimClock, SPEED_LEVELS } from '../../src/game/clock';
import { DT } from '../../src/sim/units';

const MAX = SPEED_LEVELS.length - 1;

describe('SimClock', () => {
  it('hay 6 velocidades: pausa, ×1, ×10, ×100, ×1000 y Máx', () => {
    expect(SPEED_LEVELS.map((s) => s.label)).toEqual(['⏸', '×1', '×10', '×100', '×1000', 'Máx']);
    expect(SPEED_LEVELS[MAX].yearsPerSecond).toBe(10);
  });

  it('a velocidad máxima hace ≈333 subpasos en un fotograma de 1/60 s', () => {
    const clock = new SimClock(6, () => 0);
    clock.setSpeed(MAX);
    const steps = clock.advance(1 / 60, () => {});
    expect(steps).toBeGreaterThanOrEqual(332);
    expect(steps).toBeLessThanOrEqual(333);
    expect(clock.throttled).toBe(false);
  });

  it('a ×1 avanza 1 día por segundo (5 subpasos en 60 fotogramas)', () => {
    const clock = new SimClock(6, () => 0);
    clock.setSpeed(1);
    let steps = 0;
    for (let i = 0; i < 60; i++) steps += clock.advance(1 / 60, () => {});
    expect(steps).toBe(5);
    expect(clock.alpha).toBeGreaterThanOrEqual(0);
    expect(clock.alpha).toBeLessThan(1);
  });

  it('en pausa no avanza', () => {
    const clock = new SimClock(6, () => 0);
    clock.setSpeed(0);
    expect(clock.advance(1 / 60, () => {})).toBe(0);
  });

  it('respeta el presupuesto de tiempo y marca la simulación como limitada', () => {
    let t = 0;
    const clock = new SimClock(6, () => t++);
    clock.setSpeed(MAX);
    const steps = clock.advance(1 / 60, () => {});
    expect(steps).toBe(7);
    expect(clock.throttled).toBe(true);
    expect(clock.lastYearsPerSecond).toBeCloseTo(7 * DT * 60, 10);
  });

  it('limita un fotograma largo a 0,1 s', () => {
    const clock = new SimClock(6, () => 0);
    clock.setSpeed(MAX);
    const steps = clock.advance(5, () => {});
    expect(steps).toBeGreaterThanOrEqual(1999);
    expect(steps).toBeLessThanOrEqual(2000);
  });

  it('setSpeed recorta índices fuera de rango', () => {
    const clock = new SimClock();
    clock.setSpeed(99);
    expect(clock.speedIndex).toBe(MAX);
    clock.setSpeed(-3);
    expect(clock.speedIndex).toBe(0);
  });
});
