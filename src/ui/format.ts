import { DAYS_PER_YEAR } from '../sim/units';

const LOCALE = 'es-ES';

export function num(value: number, maxDecimals: number): string {
  return value.toLocaleString(LOCALE, { maximumFractionDigits: maxDecimals });
}

/** Número con 3 cifras significativas: «0,0123», «1», «318». */
export function sig(value: number): string {
  if (value >= 1000) return num(value, 0);
  return value.toLocaleString(LOCALE, { maximumSignificantDigits: 3 });
}

const KM_PER_AU = 149_597_871;

/** Distancia: en km para las lunas, en UA para el resto. */
export function formatDistance(au: number, inKm: boolean): string {
  if (inKm) return `${num(Math.round(au * KM_PER_AU / 100) * 100, 0)} km`;
  return `${au < 0.1 ? num(au, 4) : au < 10 ? num(au, 2) : num(au, 1)} UA`;
}

/** Periodo orbital: «27,3 días» o «1,88 años». */
export function formatPeriod(years: number): string {
  if (!Number.isFinite(years)) return 'Sin órbita';
  if (years < 1) return `${num(years * DAYS_PER_YEAR, 1)} días`;
  return `${num(years, 2)} años`;
}

/** Temperatura en °C con los kelvin entre paréntesis. */
export function formatTemperature(kelvin: number): string {
  if (!Number.isFinite(kelvin)) return '—';
  return `${num(Math.round(kelvin - 273.15), 0)} °C (${num(Math.round(kelvin), 0)} K)`;
}

export function formatPercent(fraction: number): string {
  return `${num(Math.round(fraction * 100), 0)} %`;
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
