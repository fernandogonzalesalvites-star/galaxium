import { DAYS_PER_YEAR } from '../sim/units';

const LOCALE = 'es-ES';

function num(value: number, maxDecimals: number): string {
  return value.toLocaleString(LOCALE, { maximumFractionDigits: maxDecimals });
}

/** Tiempo simulado transcurrido: «Día 182» o «Año 12,3». */
export function formatElapsed(years: number): string {
  if (years < 1) return `Día ${Math.floor(years * DAYS_PER_YEAR)}`;
  return `Año ${num(years, 1)}`;
}

/** Velocidad de la simulación: «1 día/s», «2,7 años/s» o «En pausa». */
export function formatSpeed(yearsPerSecond: number): string {
  if (yearsPerSecond <= 0) return 'En pausa';
  if (yearsPerSecond < 1) {
    const d = num(yearsPerSecond * DAYS_PER_YEAR, 1);
    return `${d} ${d === '1' ? 'día' : 'días'}/s`;
  }
  const y = num(yearsPerSecond, 1);
  return `${y} ${y === '1' ? 'año' : 'años'}/s`;
}
