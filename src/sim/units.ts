/** Constante gravitatoria en UA³ / (M☉ · año²) */
export const G = 4 * Math.PI * Math.PI;
/** Masa de la Tierra en masas solares */
export const EARTH_MASS = 3.003e-6;
/** Radio de la Tierra en UA */
export const EARTH_RADIUS_AU = 4.2635e-5;
/** Radio del Sol en UA */
export const SOLAR_RADIUS_AU = 0.00465047;
export const DAYS_PER_YEAR = 365.25;
/** Subpaso fijo del integrador, en años (≈4,4 h) */
export const DT = 1 / 2000;
/** Suavizado gravitatorio (UA²) para evitar divisiones por cero */
export const SOFTENING2 = 1e-14;
/** Máximo de cuerpos simulados */
export const MAX_BODIES = 40;
