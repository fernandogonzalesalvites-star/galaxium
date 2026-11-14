import { DAYS_PER_YEAR } from '../sim/units';
import { LY_PER_UNIT, MYR_PER_UNIT, SOLAR_MASSES_PER_UNIT } from '../sim/galaxies';

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

// ── Modo galaxias (ver sim/galaxies.ts para las unidades) ──

/** Cantidad grande en palabras: «1,5 mil millones», «2 billones». */
function bigNumber(n: number): string {
  if (n >= 1e12) return `${sig(n / 1e12)} ${n / 1e12 < 2 ? 'billón' : 'billones'}`;
  if (n >= 1e9) return `${sig(n / 1e9)} mil millones`;
  if (n >= 1e6) return `${sig(n / 1e6)} ${n / 1e6 < 2 ? 'millón' : 'millones'}`;
  if (n >= 1e3) return `${sig(n / 1e3)} mil`;
  return sig(n);
}

/** Distancia galáctica (kpc) en años luz. */
export function formatLightYears(kpc: number): string {
  return `${bigNumber(kpc * LY_PER_UNIT)} años luz`;
}

/** Masa de galaxia (unidades de 10 000 millones de soles). */
export function formatGalaxyMass(units: number): string {
  return `${bigNumber(units * SOLAR_MASSES_PER_UNIT)} de soles`;
}

/** Tiempo galáctico transcurrido: «Hace 0 años», «120 millones de años». */
export function formatGalacticElapsed(units: number): string {
  const myr = units * MYR_PER_UNIT;
  if (myr < 1) return `${num(Math.floor(myr * 1000), 0)} mil años`;
  return `${bigNumber(myr * 1e6)} de años`;
}

/** Velocidad del modo galaxias: «2,4 millones de años/s». */
export function formatGalacticSpeed(unitsPerSecond: number): string {
  if (unitsPerSecond <= 0) return 'En pausa';
  return `${bigNumber(unitsPerSecond * MYR_PER_UNIT * 1e6)} de años/s`;
}
