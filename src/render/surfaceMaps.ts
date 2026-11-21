import type { SurfaceStyle } from '../sim/surfaces';

/**
 * Texturas incluidas, generadas al vuelo. Devuelven un mapa de brillo (0..255)
 * en proyección equirectangular (2:1), que luego se tiñe con el color del
 * planeta. El ruido se toma en 3D sobre la esfera, así no hay costura ni
 * deformación en los polos. Mismo estilo y semilla = misma textura.
 */

function hash(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Ruido de valor 3D, 0..1. */
function noise(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = fade(x - xi), fy = fade(y - yi), fz = fade(z - zi);
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz, seed);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), fx), lerp(c(0, 1, 0), c(1, 1, 0), fx), fy),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), fx), lerp(c(0, 1, 1), c(1, 1, 1), fx), fy),
    fz,
  );
}

/** Suma de octavas de ruido, 0..1. */
function fbm(x: number, y: number, z: number, seed: number, octaves: number): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq, z * freq, seed + i * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

function rng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

interface Crater { x: number; y: number; z: number; cos: number; r: number }

function makeCraters(seed: number, count: number): Crater[] {
  const r = rng(seed + 7);
  return Array.from({ length: count }, () => {
    const u = r() * 2 - 1, phi = r() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const radius = 0.03 + Math.pow(r(), 3) * 0.22;
    return { x: s * Math.cos(phi), y: u, z: s * Math.sin(phi), r: radius, cos: Math.cos(radius * 1.3) };
  });
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Brillo de la textura (fila 0 = polo sur, como espera la esfera de three.js).
 * Valores entre ~0,35 y 1 para que el color siga reconociéndose al teñir.
 */
export function surfaceLuminance(style: SurfaceStyle, seed: number, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height);
  if (style === 'smooth') return out.fill(255);
  const craters = style === 'craters' ? makeCraters(seed, 60) : [];
  const r = rng(seed + 3);
  const bandFreq = 7 + r() * 6;
  const bandPhase = r() * 10;
  const stormLon = r() * Math.PI * 2;
  const stormLat = -0.25 - r() * 0.2;
  const landLevel = 0.5 + (r() - 0.5) * 0.06;

  for (let j = 0; j < height; j++) {
    const lat = ((j + 0.5) / height - 0.5) * Math.PI;
    const cl = Math.cos(lat), y = Math.sin(lat);
    for (let i = 0; i < width; i++) {
      const lon = ((i + 0.5) / width) * Math.PI * 2;
      const x = cl * Math.cos(lon), z = cl * Math.sin(lon);
      let v: number;
      switch (style) {
        case 'rocky': {
          const n = fbm(x * 2.2, y * 2.2, z * 2.2, seed, 6);
          const ridges = 1 - Math.abs(fbm(x * 4, y * 4, z * 4, seed + 50, 4) * 2 - 1);
          v = 0.38 + 0.5 * n + 0.18 * ridges * ridges;
          break;
        }
        case 'craters': {
          v = 0.6 + 0.3 * fbm(x * 3, y * 3, z * 3, seed, 5);
          for (const c of craters) {
            const d = x * c.x + y * c.y + z * c.z;
            if (d < c.cos) continue;
            // Distancia angular al centro, relativa al radio del cráter
            const t = Math.acos(Math.min(1, d)) / c.r;
            if (t < 1) v *= 0.72 + 0.2 * t * t;
            else if (t < 1.3) v *= 1 + 0.25 * (1 - Math.abs(t - 1.12) / 0.18);
          }
          break;
        }
        case 'continents': {
          const n = fbm(x * 1.7, y * 1.7, z * 1.7, seed, 6);
          const coast = clamp01((n - landLevel) / 0.03);
          const land = 0.78 + 0.22 * fbm(x * 6, y * 6, z * 6, seed + 9, 4);
          const sea = 0.42 + 0.08 * n;
          v = sea + (land - sea) * coast;
          // Casquetes polares
          v = Math.max(v, clamp01((Math.abs(y) - 0.88) / 0.05));
          break;
        }
        case 'bands':
        case 'storm': {
          const warp = fbm(x * 3, y * 3, z * 3, seed, 4) * 2.2;
          const b = Math.sin(y * bandFreq + bandPhase + warp);
          const fine = fbm(x * 10, y * 30, z * 10, seed + 20, 3);
          v = 0.62 + 0.25 * b + 0.12 * (fine - 0.5);
          if (style === 'storm') {
            let dl = lon - stormLon;
            dl = Math.atan2(Math.sin(dl), Math.cos(dl));
            const e = Math.hypot(dl / 0.32, (lat - stormLat) / 0.13);
            if (e < 1.25) {
              const swirl = Math.sin(e * 9 + Math.atan2(lat - stormLat, dl) * 2);
              const k = clamp01((1.25 - e) / 0.3);
              v = v * (1 - k) + (0.5 + 0.12 * swirl + 0.25 * (1 - e)) * k;
            }
          }
          break;
        }
        case 'ice':
        default: {
          const warp = fbm(x * 2, y * 2, z * 2, seed, 3);
          v = 0.82 + 0.1 * Math.sin(y * bandFreq * 0.6 + warp * 3) + 0.08 * (fbm(x * 8, y * 8, z * 8, seed + 30, 3) - 0.5);
          break;
        }
      }
      out[j * width + i] = Math.round(clamp01(v) * 255);
    }
  }
  return out;
}

/**
 * Manchas de vegetación (RGBA, fila 0 = polo sur) para poner encima del planeta:
 * bosques oscuros, praderas más claras y zonas sin plantas (transparentes).
 * Cuánto cubre cambia con la semilla: del 25 % al 60 % del planeta, menos en los polos.
 */
export function vegetationMap(seed: number, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  const r = rng(seed);
  const coverage = 0.25 + r() * 0.35;
  // Umbral aproximado para cubrir esa fracción (el ruido se concentra alrededor de 0,5)
  const level = 0.6 - coverage * 0.28;
  const scale = 1.6 + r() * 1.6;
  for (let j = 0; j < height; j++) {
    const lat = ((j + 0.5) / height - 0.5) * Math.PI;
    const cl = Math.cos(lat), y = Math.sin(lat);
    // Hacia los polos hace frío: menos plantas
    const cold = clamp01((Math.abs(y) - 0.7) / 0.2);
    for (let i = 0; i < width; i++) {
      const lon = ((i + 0.5) / width) * Math.PI * 2;
      const x = cl * Math.cos(lon), z = cl * Math.sin(lon);
      const n = fbm(x * scale, y * scale, z * scale, seed, 6);
      const a = clamp01((n - level) / 0.035) * (1 - cold);
      const shade = fbm(x * 7, y * 7, z * 7, seed + 11, 4);
      const dry = fbm(x * 2.5, y * 2.5, z * 2.5, seed + 23, 3);
      // Bosque (verde oscuro) ↔ pradera (verde claro) ↔ sabana (verde amarillento)
      const g = 0.32 + 0.38 * shade;
      const o = (j * width + i) * 4;
      out[o] = Math.round(255 * clamp01(0.08 + 0.35 * dry * shade));
      out[o + 1] = Math.round(255 * clamp01(g));
      out[o + 2] = Math.round(255 * clamp01(0.06 + 0.1 * shade));
      out[o + 3] = Math.round(255 * a * 0.92);
    }
  }
  return out;
}
