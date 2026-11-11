import { describe, it, expect } from 'vitest';
import { formatElapsed, formatSpeed } from '../../src/ui/format';

describe('formatElapsed', () => {
  it('muestra días durante el primer año', () => {
    expect(formatElapsed(0)).toBe('Día 0');
    expect(formatElapsed(0.5)).toBe('Día 182');
  });
  it('muestra años con un decimal después', () => {
    expect(formatElapsed(12.34)).toBe('Año 12,3');
    expect(formatElapsed(3)).toBe('Año 3');
  });
});

describe('formatSpeed', () => {
  it('en pausa', () => {
    expect(formatSpeed(0)).toBe('En pausa');
  });
  it('en días por segundo por debajo de 1 año/s', () => {
    expect(formatSpeed(1 / 365.25)).toBe('1 día/s');
    expect(formatSpeed(10 / 365.25)).toBe('10 días/s');
  });
  it('en años por segundo a partir de 1 año/s', () => {
    expect(formatSpeed(1000 / 365.25)).toBe('2,7 años/s');
    expect(formatSpeed(1)).toBe('1 año/s');
    expect(formatSpeed(10)).toBe('10 años/s');
  });
});
