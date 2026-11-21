import type { Body, BodyKind } from './body';

/** Días posibles: de 1 hora a 2000 horas (unos 83 días terrestres) */
export const DAY_HOURS_MIN = 1;
export const DAY_HOURS_MAX = 2000;

/** Ejemplos reales para elegir rápido en el editor de rotación. */
export const DAY_EXAMPLES: readonly { label: string; hours: number }[] = [
  { label: 'Júpiter', hours: 10 },
  { label: 'Tierra', hours: 24 },
  { label: 'Marte', hours: 24.6 },
  { label: 'Luna', hours: 655 },
];

/** Día con el que nace un cuerpo según su tipo (también para partidas viejas). */
export function defaultDayHours(kind: BodyKind, isMoon: boolean): number {
  if (kind === 'star' || kind === 'galaxy') return 0;
  if (isMoon) return 655;
  if (kind === 'gas') return 10;
  if (kind === 'ice') return 16;
  return 24;
}

export function canRotate(body: Pick<Body, 'kind'>): boolean {
  return body.kind !== 'star' && body.kind !== 'galaxy';
}

/** Valida lo escrito por la persona: devuelve las horas o un mensaje que dice cómo arreglarlo. */
export function parseDayHours(text: string): { hours: number } | { error: string } {
  const n = Number(text.trim().replace(',', '.'));
  if (text.trim() === '' || !Number.isFinite(n)) return { error: 'Escribe un número de horas, por ejemplo 24' };
  if (n < DAY_HOURS_MIN || n > DAY_HOURS_MAX) {
    return { error: `Escribe un número entre ${DAY_HOURS_MIN} y ${DAY_HOURS_MAX} horas` };
  }
  return { hours: Math.round(n * 10) / 10 };
}

/** A partir de este día (o más corto) el planeta gira tan rápido que se achata */
export const FLATTEN_FROM_HOURS = 5;
/** Achatamiento con un día de 5 h y con el más corto posible (1 h) */
const FLATTEN_AT_START = 0.08;
const FLATTEN_MAX = 0.35;

/**
 * Cuánto se achata un planeta por girar rápido (0 = esfera; 0,35 = polos un 35 %
 * más cerca del centro). Con días de más de 5 h no se achata.
 */
export function flattening(dayHours: number): number {
  if (!(dayHours > 0) || dayHours > FLATTEN_FROM_HOURS) return 0;
  const t = (FLATTEN_FROM_HOURS - Math.max(dayHours, DAY_HOURS_MIN)) / (FLATTEN_FROM_HOURS - DAY_HOURS_MIN);
  return FLATTEN_AT_START + (FLATTEN_MAX - FLATTEN_AT_START) * t;
}

/** «24 h», «24,6 h» o «655 h (27,3 días)». */
export function formatDayHours(hours: number): string {
  if (hours <= 0) return 'No gira';
  const h = hours.toLocaleString('es-ES', { maximumFractionDigits: 1 });
  if (hours < 48) return `${h} h`;
  const d = (hours / 24).toLocaleString('es-ES', { maximumFractionDigits: 1 });
  return `${h} h (${d} días)`;
}
