# Forja Estelar — Fases 1 y 2: núcleo de simulación y escena 3D — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un juego web jugable en el móvil donde se elige una estrella, se colocan planetas y lunas en órbita circular automática, y todos se mueven con gravedad N cuerpos en 3D, con controles de tiempo y gestos táctiles.

**Architecture:** Física y lógica en TypeScript puro (`src/sim`, `src/game/clock.ts`, `src/game/placement.ts`, `src/input`), cubiertas por tests de Vitest. Three.js solo en `src/render`, que dibuja el estado de la simulación. La interfaz es DOM simple en `src/ui`. `src/game/Game.ts` coordina todo y `src/main.ts` arranca el bucle.

**Tech Stack:** TypeScript (modo estricto), Three.js con OrbitControls, Vite y Vitest. Node 24 ya está instalado.

**Spec:** `docs/superpowers/specs/2026-11-11-forja-estelar-design.md`

## Global Constraints

- Unidades de la simulación: UA, masas solares y años. `G = 4π²`.
- Integrador leapfrog kick-drift-kick con paso fijo `DT = 1/2000` año. Más velocidad significa más subpasos, nunca pasos más grandes.
- Máximo de **40** cuerpos simulados.
- Radio visual = radio real × **10** (planetas y lunas) o × **5** (estrellas). El radio de choque es el visual.
- Velocidades de tiempo: pausa, ×1 (1 día/s), ×10, ×100, ×1000 (≈2,7 años/s) y Máx (10 años/s). Presupuesto de física: **6 ms por fotograma**.
- Órbita automática antihoraria vista desde +y: para un desplazamiento (dx, dz) respecto al centro, la velocidad tangente es `(v·dz/r, −v·dx/r)`.
- Lunas solo entre `1,2 × límite de Roche` y `0,5 × radio de Hill`. Aviso en sistema doble si `r < 3 × separación`.
- Sin imágenes ni recursos descargados: todo se genera por código.
- Todo el texto visible en **español**. Botones de al menos **48 px**.
- `src/sim` no importa nunca `three` ni el DOM.
- Mensajes de commit terminados en la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore` | Proyecto base |
| `src/sim/units.ts` | Constantes físicas y de juego |
| `src/sim/vec.ts` | Tipo `Vec3` |
| `src/sim/body.ts` | Tipos `Body`, `BodyInit` y `BodyKind` |
| `src/sim/world.ts` | Clase `World`: cuerpos, gravedad, integrador, energía y momento |
| `src/sim/scale.ts` | Radio visual o de choque |
| `src/sim/elements.ts` | Centro de masas, órbita relativa, velocidad circular, Hill y Roche |
| `src/sim/stars.ts` | Tipos de estrella y `createStarSystem` |
| `src/sim/planetTypes.ts` | Plantillas de planetas y lunas |
| `src/game/placement.ts` | Comprobar y colocar planetas y lunas en órbita automática |
| `src/game/clock.ts` | Velocidad del tiempo, subpasos, presupuesto e interpolación |
| `src/game/Game.ts` | Coordinador: modos, selección, colocación y fotograma |
| `src/input/TouchInput.ts` | Toque, doble toque, multitáctil y arrastre de colocación |
| `src/render/markerTexture.ts` | Textura del punto marcador |
| `src/render/starfield.ts` | Fondo de estrellas |
| `src/render/BodyView.ts` | Malla, marcador, luz y estela de un cuerpo |
| `src/render/GhostView.ts` | Planeta fantasma y círculos de órbita y franja |
| `src/render/SceneView.ts` | Escena, cámara, controles, sincronización, selección y plano |
| `src/ui/format.ts` | Textos de tiempo y velocidad |
| `src/ui/Hud.ts` | Barra superior, tiempo, botón ＋, banner de colocación y avisos |
| `src/ui/startScreen.ts` | Pantalla de elección de estrella |
| `src/ui/style.css` | Estilos |
| `src/main.ts` | Arranque y bucle |
| `tests/**` | Tests de Vitest |

---

### Task 1: Proyecto base y unidades

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.ts`, `src/ui/style.css`, `src/sim/units.ts`
- Test: `tests/sim/units.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `src/sim/units.ts` exporta `G`, `EARTH_MASS`, `EARTH_RADIUS_AU`, `SOLAR_RADIUS_AU`, `DAYS_PER_YEAR`, `DT`, `SOFTENING2` y `MAX_BODIES`, todos de tipo `number`.

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "forja-estelar",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --host",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Instalar dependencias**

Run: `npm install three` y después `npm install -D typescript vite vitest @types/three`
Expected: se crean `node_modules/` y `package-lock.json` sin errores.

- [ ] **Step 3: Crear `tsconfig.json`, `vite.config.ts`, `.gitignore`**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitOverride": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { host: true, port: 5173 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
```

`.gitignore`:
```
node_modules/
dist/
```

- [ ] **Step 4: Crear `index.html`, `src/ui/style.css`, `src/main.ts`**

`index.html`:
```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#000000" />
    <title>Forja Estelar</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/ui/style.css`:
```css
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 100%; height: 100%; overflow: hidden; background: #000; color: #e8ecf4;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  -webkit-tap-highlight-color: transparent; user-select: none; touch-action: none;
}
#app { position: fixed; inset: 0; }
#app canvas { display: block; width: 100%; height: 100%; }
```

`src/main.ts` (provisional, se sustituye en la Task 10):
```ts
import './ui/style.css';

const app = document.getElementById('app')!;
app.textContent = 'Forja Estelar';
```

- [ ] **Step 5: Escribir el test que falla**

`tests/sim/units.test.ts`:
```ts
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
```

- [ ] **Step 6: Ejecutar el test y comprobar que falla**

Run: `npm test`
Expected: FAIL, no se puede resolver `../../src/sim/units`.

- [ ] **Step 7: Implementar `src/sim/units.ts`**

```ts
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
```

- [ ] **Step 8: Ejecutar los tests y la comprobación de tipos**

Run: `npm test` y después `npm run typecheck`
Expected: 2 tests en verde y ningún error de tipos.

- [ ] **Step 9: Comprobar el servidor de desarrollo**

Run: `npm run dev` en segundo plano y abrir `http://localhost:5173`.
Expected: la página muestra «Forja Estelar». Después, parar el servidor.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Proyecto base con Vite, TypeScript, Three.js y unidades físicas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Mundo e integrador de N cuerpos

**Files:**
- Create: `src/sim/vec.ts`, `src/sim/body.ts`, `src/sim/world.ts`
- Test: `tests/sim/world.test.ts`

**Interfaces:**
- Consumes: `G`, `SOFTENING2`, `DT` y `EARTH_MASS` de `src/sim/units.ts`
- Produces:
  - `interface Vec3 { x: number; y: number; z: number }`
  - `type BodyKind = 'star' | 'rocky' | 'gas' | 'ice'`
  - `interface Body`, con los campos `id, name, kind, mass, radius, x, y, z, vx, vy, vz, ax, ay, az, px, py, pz, parentId: number | null, luminosity, color, atmosphere, water`
  - `interface BodyInit`, con `name`, `kind`, `mass` y `radius` obligatorios y el resto opcionales
  - `class World` con:
    - Propiedades: `bodies: Body[]`, `time: number`.
    - Gestión de cuerpos: `add(init: BodyInit): Body`, `remove(id: number): void`, `get(id: number): Body | undefined`, `stars(): Body[]`.
    - Integración: `invalidate(): void`, `computeAccelerations(): void`, `step(dt: number): void`.
    - Utilidades: `totalEnergy(): number`, `totalMomentum(): Vec3`, `removeNetMomentum(): void`, `snapRenderState(): void`.

- [ ] **Step 1: Escribir los tests que fallan**

`tests/sim/world.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { World } from '../../src/sim/world';
import { G, EARTH_MASS, DT } from '../../src/sim/units';

function sunEarth(): World {
  const w = new World();
  w.add({ name: 'Sol', kind: 'star', mass: 1, radius: 0.00465 });
  const v = Math.sqrt((G * (1 + EARTH_MASS)) / 1);
  w.add({ name: 'Tierra', kind: 'rocky', mass: EARTH_MASS, radius: 4.26e-5, x: 1, vz: -v });
  return w;
}

describe('World', () => {
  it('asigna ids únicos y crecientes', () => {
    const w = sunEarth();
    expect(w.bodies.map((b) => b.id)).toEqual([1, 2]);
  });

  it('la Tierra tarda 1 año en dar la vuelta', () => {
    const w = sunEarth();
    const [sun, earth] = w.bodies;
    let prevZ = earth.z - sun.z;
    let period = 0;
    for (let i = 0; i < 4000 && period === 0; i++) {
      w.step(DT);
      const z = earth.z - sun.z;
      if (prevZ > 0 && z <= 0) period = w.time - DT * (z / (z - prevZ));
      prevZ = z;
    }
    expect(period).toBeGreaterThan(0.995);
    expect(period).toBeLessThan(1.005);
  });

  it('la energía cambia menos de un 0,1 % tras 1000 órbitas', () => {
    const w = sunEarth();
    const e0 = w.totalEnergy();
    for (let i = 0; i < 2_000_000; i++) w.step(DT);
    expect(Math.abs((w.totalEnergy() - e0) / e0)).toBeLessThan(1e-3);
  });

  it('conserva el momento total', () => {
    const w = new World();
    w.add({ name: 'A', kind: 'star', mass: 1, radius: 0.004, vx: 0.1 });
    w.add({ name: 'B', kind: 'rocky', mass: 0.001, radius: 1e-4, x: 1, vz: -6 });
    w.add({ name: 'C', kind: 'gas', mass: 0.0005, radius: 1e-4, x: -2, z: 0.5, vz: 4 });
    const p0 = w.totalMomentum();
    for (let i = 0; i < 5000; i++) w.step(DT);
    const p1 = w.totalMomentum();
    expect(p1.x).toBeCloseTo(p0.x, 10);
    expect(p1.y).toBeCloseTo(p0.y, 10);
    expect(p1.z).toBeCloseTo(p0.z, 10);
  });

  it('removeNetMomentum deja el momento total en cero', () => {
    const w = sunEarth();
    w.removeNetMomentum();
    const p = w.totalMomentum();
    expect(Math.hypot(p.x, p.y, p.z)).toBeLessThan(1e-15);
  });

  it('al eliminar un planeta sus lunas pasan a no tener padre', () => {
    const w = sunEarth();
    const moon = w.add({ name: 'Luna', kind: 'rocky', mass: 3.7e-8, radius: 1.16e-5, x: 1.003, parentId: 2 });
    w.remove(2);
    expect(w.get(2)).toBeUndefined();
    expect(moon.parentId).toBeNull();
  });

  it('step guarda la posición anterior y snapRenderState la iguala a la actual', () => {
    const w = sunEarth();
    const earth = w.bodies[1];
    w.step(DT);
    expect(earth.px).toBe(1);
    expect(earth.x).not.toBe(1);
    w.snapRenderState();
    expect(earth.px).toBe(earth.x);
  });
});
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

Run: `npx vitest run tests/sim/world.test.ts`
Expected: FAIL, no se puede resolver `../../src/sim/world`.

- [ ] **Step 3: Implementar `src/sim/vec.ts` y `src/sim/body.ts`**

`src/sim/vec.ts`:
```ts
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
```

`src/sim/body.ts`:
```ts
export type BodyKind = 'star' | 'rocky' | 'gas' | 'ice';

export interface Body {
  id: number;
  name: string;
  kind: BodyKind;
  /** Masa en masas solares */
  mass: number;
  /** Radio real en UA */
  radius: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  ax: number; ay: number; az: number;
  /** Posición al empezar el último subpaso (para interpolar el dibujo) */
  px: number; py: number; pz: number;
  /** Planeta alrededor del que orbita (lunas); null para estrellas y planetas */
  parentId: number | null;
  /** Luminosidad en L☉ (solo estrellas; 0 en el resto) */
  luminosity: number;
  /** Color base 0xRRGGBB */
  color: number;
  /** Grosor de atmósfera 0..1 */
  atmosphere: number;
  /** Proporción de agua 0..1 */
  water: number;
}

export interface BodyInit {
  name: string;
  kind: BodyKind;
  mass: number;
  radius: number;
  x?: number; y?: number; z?: number;
  vx?: number; vy?: number; vz?: number;
  parentId?: number | null;
  luminosity?: number;
  color?: number;
  atmosphere?: number;
  water?: number;
}
```

- [ ] **Step 4: Implementar `src/sim/world.ts`**

```ts
import type { Body, BodyInit } from './body';
import type { Vec3 } from './vec';
import { G, SOFTENING2 } from './units';

export class World {
  bodies: Body[] = [];
  /** Tiempo simulado en años */
  time = 0;
  private nextId = 1;
  private accelValid = false;

  add(init: BodyInit): Body {
    const x = init.x ?? 0;
    const y = init.y ?? 0;
    const z = init.z ?? 0;
    const body: Body = {
      id: this.nextId++,
      name: init.name,
      kind: init.kind,
      mass: init.mass,
      radius: init.radius,
      x, y, z,
      vx: init.vx ?? 0, vy: init.vy ?? 0, vz: init.vz ?? 0,
      ax: 0, ay: 0, az: 0,
      px: x, py: y, pz: z,
      parentId: init.parentId ?? null,
      luminosity: init.luminosity ?? 0,
      color: init.color ?? 0xffffff,
      atmosphere: init.atmosphere ?? 0,
      water: init.water ?? 0,
    };
    this.bodies.push(body);
    this.accelValid = false;
    return body;
  }

  remove(id: number): void {
    this.bodies = this.bodies.filter((b) => b.id !== id);
    for (const b of this.bodies) if (b.parentId === id) b.parentId = null;
    this.accelValid = false;
  }

  get(id: number): Body | undefined {
    return this.bodies.find((b) => b.id === id);
  }

  stars(): Body[] {
    return this.bodies.filter((b) => b.kind === 'star');
  }

  /** Marca las aceleraciones como obsoletas (tras editar masas o posiciones). */
  invalidate(): void {
    this.accelValid = false;
  }

  computeAccelerations(): void {
    const bs = this.bodies;
    const n = bs.length;
    for (let i = 0; i < n; i++) {
      const b = bs[i];
      b.ax = 0; b.ay = 0; b.az = 0;
    }
    for (let i = 0; i < n; i++) {
      const a = bs[i];
      for (let j = i + 1; j < n; j++) {
        const b = bs[j];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const r2 = dx * dx + dy * dy + dz * dz + SOFTENING2;
        const inv = 1 / (r2 * Math.sqrt(r2));
        const fa = G * b.mass * inv;
        const fb = G * a.mass * inv;
        a.ax += dx * fa; a.ay += dy * fa; a.az += dz * fa;
        b.ax -= dx * fb; b.ay -= dy * fb; b.az -= dz * fb;
      }
    }
    this.accelValid = true;
  }

  /** Un subpaso leapfrog kick-drift-kick. */
  step(dt: number): void {
    if (!this.accelValid) this.computeAccelerations();
    const h = dt / 2;
    for (const b of this.bodies) {
      b.vx += b.ax * h; b.vy += b.ay * h; b.vz += b.az * h;
      b.px = b.x; b.py = b.y; b.pz = b.z;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    }
    this.computeAccelerations();
    for (const b of this.bodies) {
      b.vx += b.ax * h; b.vy += b.ay * h; b.vz += b.az * h;
    }
    this.time += dt;
  }

  totalEnergy(): number {
    const bs = this.bodies;
    let e = 0;
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i];
      e += 0.5 * a.mass * (a.vx * a.vx + a.vy * a.vy + a.vz * a.vz);
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        e -= (G * a.mass * b.mass) / Math.sqrt(dx * dx + dy * dy + dz * dz + SOFTENING2);
      }
    }
    return e;
  }

  totalMomentum(): Vec3 {
    let x = 0, y = 0, z = 0;
    for (const b of this.bodies) {
      x += b.mass * b.vx; y += b.mass * b.vy; z += b.mass * b.vz;
    }
    return { x, y, z };
  }

  /** Quita la velocidad del centro de masas para que el sistema no se desplace. */
  removeNetMomentum(): void {
    const p = this.totalMomentum();
    let m = 0;
    for (const b of this.bodies) m += b.mass;
    if (m === 0) return;
    for (const b of this.bodies) {
      b.vx -= p.x / m; b.vy -= p.y / m; b.vz -= p.z / m;
    }
  }

  /** Hace que el dibujo muestre el estado exacto actual (sin interpolación). */
  snapRenderState(): void {
    for (const b of this.bodies) {
      b.px = b.x; b.py = b.y; b.pz = b.z;
    }
  }
}
```

- [ ] **Step 5: Ejecutar los tests y comprobar que pasan**

Run: `npx vitest run tests/sim/world.test.ts`
Expected: 7 tests en verde. El de las 1000 órbitas puede tardar unos segundos.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Mundo de N cuerpos con integrador leapfrog" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Utilidades orbitales y escala visible

**Files:**
- Create: `src/sim/scale.ts`, `src/sim/elements.ts`
- Test: `tests/sim/elements.test.ts`

**Interfaces:**
- Consumes: `Body` y `World` (Task 2), `G` (Task 1)
- Produces:
  - `scale.ts`: `PLANET_VISUAL_SCALE = 10`, `STAR_VISUAL_SCALE = 5` y `visualRadius(b: Pick<Body,'kind'|'radius'>): number`.
  - `elements.ts`, tipos:
    - `interface MassPoint extends Vec3 { mass; vx; vy; vz }`
    - `interface OrbitInfo { distance; speed; semiMajorAxis; eccentricity; period; bound: boolean }`
  - `elements.ts`, funciones:
    - `centerOfMass(points: readonly MassPoint[]): MassPoint`
    - `centralMassFor(world: World, body: Body): MassPoint | null`
    - `relativeOrbit(body: MassPoint, central: MassPoint): OrbitInfo`
    - `circularSpeed(centralMass: number, bodyMass: number, r: number): number`
    - `hillRadius(a: number, m: number, M: number): number`
    - `rocheLimit(planet: Pick<Body,'kind'|'mass'|'radius'>, moon: Pick<Body,'kind'|'mass'|'radius'>): number`

- [ ] **Step 1: Escribir los tests que fallan**

`tests/sim/elements.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  centerOfMass, centralMassFor, relativeOrbit, circularSpeed, hillRadius, rocheLimit,
} from '../../src/sim/elements';
import { visualRadius } from '../../src/sim/scale';
import { World } from '../../src/sim/world';
import { G, EARTH_MASS, EARTH_RADIUS_AU } from '../../src/sim/units';

const sun = { mass: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };

describe('relativeOrbit', () => {
  it('reconoce una órbita circular a 1 UA', () => {
    const v = circularSpeed(1, 0, 1);
    const o = relativeOrbit({ mass: 0, x: 1, y: 0, z: 0, vx: 0, vy: 0, vz: -v }, sun);
    expect(o.bound).toBe(true);
    expect(o.eccentricity).toBeLessThan(1e-12);
    expect(o.semiMajorAxis).toBeCloseTo(1, 10);
    expect(o.period).toBeCloseTo(1, 10);
    expect(o.distance).toBeCloseTo(1, 12);
  });

  it('calcula una órbita excéntrica e = 0,5', () => {
    const v = Math.sqrt(G * 1.5);
    const o = relativeOrbit({ mass: 0, x: 1, y: 0, z: 0, vx: 0, vy: 0, vz: -v }, sun);
    expect(o.eccentricity).toBeCloseTo(0.5, 10);
    expect(o.semiMajorAxis).toBeCloseTo(2, 10);
  });

  it('detecta una trayectoria de escape', () => {
    const v = Math.sqrt(2 * G) * 1.01;
    const o = relativeOrbit({ mass: 0, x: 1, y: 0, z: 0, vx: 0, vy: 0, vz: -v }, sun);
    expect(o.bound).toBe(false);
    expect(o.period).toBe(Infinity);
  });
});

describe('escala, Hill y Roche', () => {
  it('el radio visual es ×10 para planetas y ×5 para estrellas', () => {
    expect(visualRadius({ kind: 'rocky', radius: 1 })).toBe(10);
    expect(visualRadius({ kind: 'star', radius: 1 })).toBe(5);
  });

  it('el radio de Hill de la Tierra es ≈0,01 UA', () => {
    expect(hillRadius(1, EARTH_MASS, 1)).toBeCloseTo(0.01, 4);
  });

  it('con densidades iguales el límite de Roche es 2,44 radios visuales', () => {
    const planet = { kind: 'rocky' as const, mass: EARTH_MASS, radius: EARTH_RADIUS_AU };
    const moon = { kind: 'rocky' as const, mass: EARTH_MASS / 8, radius: EARTH_RADIUS_AU / 2 };
    expect(rocheLimit(planet, moon)).toBeCloseTo(2.44 * visualRadius(planet), 12);
  });
});

describe('centros', () => {
  it('centerOfMass pondera por masa', () => {
    const c = centerOfMass([
      { mass: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
      { mass: 3, x: 4, y: 0, z: 0, vx: 0, vy: 0, vz: 2 },
    ]);
    expect(c.mass).toBe(4);
    expect(c.x).toBe(3);
    expect(c.vz).toBe(1.5);
  });

  it('el centro de una luna es su planeta y el de un planeta son las estrellas', () => {
    const w = new World();
    w.add({ name: 'A', kind: 'star', mass: 0.8, radius: 0.004, x: 0.1 });
    w.add({ name: 'B', kind: 'star', mass: 0.8, radius: 0.004, x: -0.1 });
    const p = w.add({ name: 'P', kind: 'rocky', mass: EARTH_MASS, radius: EARTH_RADIUS_AU, x: 1 });
    const m = w.add({ name: 'L', kind: 'rocky', mass: 1e-8, radius: 1e-5, x: 1.003, parentId: p.id });
    const cp = centralMassFor(w, p)!;
    expect(cp.mass).toBeCloseTo(1.6, 12);
    expect(cp.x).toBeCloseTo(0, 12);
    expect(centralMassFor(w, m)).toBe(p);
  });

  it('una estrella sola no tiene centro', () => {
    const w = new World();
    const s = w.add({ name: 'S', kind: 'star', mass: 1, radius: 0.004 });
    expect(centralMassFor(w, s)).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

Run: `npx vitest run tests/sim/elements.test.ts`
Expected: FAIL, no se puede resolver `../../src/sim/elements`.

- [ ] **Step 3: Implementar `src/sim/scale.ts`**

```ts
import type { Body } from './body';

/** Los planetas y lunas se dibujan 10 veces más grandes de lo real */
export const PLANET_VISUAL_SCALE = 10;
/** Las estrellas se dibujan 5 veces más grandes de lo real */
export const STAR_VISUAL_SCALE = 5;

/** Radio dibujado en UA. También es el radio de choque. */
export function visualRadius(b: Pick<Body, 'kind' | 'radius'>): number {
  return b.radius * (b.kind === 'star' ? STAR_VISUAL_SCALE : PLANET_VISUAL_SCALE);
}
```

- [ ] **Step 4: Implementar `src/sim/elements.ts`**

```ts
import type { Body } from './body';
import type { Vec3 } from './vec';
import type { World } from './world';
import { G } from './units';
import { visualRadius } from './scale';

export interface MassPoint extends Vec3 {
  mass: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface OrbitInfo {
  /** Distancia actual al centro (UA) */
  distance: number;
  /** Velocidad relativa (UA/año) */
  speed: number;
  /** Semieje mayor (UA); Infinity si no está ligada */
  semiMajorAxis: number;
  eccentricity: number;
  /** Periodo (años); Infinity si no está ligada */
  period: number;
  bound: boolean;
}

export function centerOfMass(points: readonly MassPoint[]): MassPoint {
  let m = 0, x = 0, y = 0, z = 0, vx = 0, vy = 0, vz = 0;
  for (const p of points) {
    m += p.mass;
    x += p.mass * p.x; y += p.mass * p.y; z += p.mass * p.z;
    vx += p.mass * p.vx; vy += p.mass * p.vy; vz += p.mass * p.vz;
  }
  if (m === 0) return { mass: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
  return { mass: m, x: x / m, y: y / m, z: z / m, vx: vx / m, vy: vy / m, vz: vz / m };
}

/** Cuerpo o centro de masas alrededor del que orbita `body`. */
export function centralMassFor(world: World, body: Body): MassPoint | null {
  if (body.parentId !== null) {
    const parent = world.get(body.parentId);
    if (parent) return parent;
  }
  const stars = world.stars().filter((s) => s.id !== body.id);
  if (stars.length === 0) return null;
  return centerOfMass(stars);
}

export function relativeOrbit(body: MassPoint, central: MassPoint): OrbitInfo {
  const rx = body.x - central.x, ry = body.y - central.y, rz = body.z - central.z;
  const vx = body.vx - central.vx, vy = body.vy - central.vy, vz = body.vz - central.vz;
  const r = Math.hypot(rx, ry, rz);
  const v2 = vx * vx + vy * vy + vz * vz;
  const mu = G * (central.mass + body.mass);
  const energy = v2 / 2 - mu / r;
  const rv = rx * vx + ry * vy + rz * vz;
  const k = v2 - mu / r;
  const ex = (k * rx - rv * vx) / mu;
  const ey = (k * ry - rv * vy) / mu;
  const ez = (k * rz - rv * vz) / mu;
  const bound = energy < 0;
  const a = bound ? -mu / (2 * energy) : Infinity;
  return {
    distance: r,
    speed: Math.sqrt(v2),
    semiMajorAxis: a,
    eccentricity: Math.hypot(ex, ey, ez),
    period: bound ? 2 * Math.PI * Math.sqrt((a * a * a) / mu) : Infinity,
    bound,
  };
}

export function circularSpeed(centralMass: number, bodyMass: number, r: number): number {
  return Math.sqrt((G * (centralMass + bodyMass)) / r);
}

/** Radio de Hill: zona donde domina la gravedad de un cuerpo de masa m que orbita a M a distancia a. */
export function hillRadius(a: number, m: number, M: number): number {
  return a * Math.cbrt(m / (3 * M));
}

/** Límite de Roche (UA) usando radios visuales. */
export function rocheLimit(
  planet: Pick<Body, 'kind' | 'mass' | 'radius'>,
  moon: Pick<Body, 'kind' | 'mass' | 'radius'>,
): number {
  const rp = visualRadius(planet);
  const rm = visualRadius(moon);
  const densityRatio = (planet.mass / (rp * rp * rp)) / (moon.mass / (rm * rm * rm));
  return 2.44 * rp * Math.cbrt(densityRatio);
}
```

- [ ] **Step 5: Ejecutar los tests y comprobar que pasan**

Run: `npx vitest run tests/sim/elements.test.ts`
Expected: todos en verde.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Utilidades orbitales: centro de masas, elementos, Hill, Roche y escala visible" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Estrellas y plantillas de planetas

**Files:**
- Create: `src/sim/stars.ts`, `src/sim/planetTypes.ts`
- Test: `tests/sim/stars.test.ts`

**Interfaces:**
- Consumes: `World` (Task 2), `G` y `SOLAR_RADIUS_AU` (Task 1), `centerOfMass` (Task 3), `BodyKind` (Task 2)
- Produces:
  - `stars.ts`: `type StarType = 'redDwarf' | 'sunLike' | 'blueGiant' | 'binary'`, `interface StarSpec { name; mass; luminosity; radiusSolar; color }`, `SINGLE_STARS`, `BINARY_STAR` (incluye `separation`), `STAR_CHOICES: { type; label; description; color }[]` y `createStarSystem(type: StarType): World`.
  - `planetTypes.ts`: `type PlanetType = 'smallRocky' | 'earthLike' | 'superEarth' | 'gasGiant' | 'iceGiant' | 'moon'`, `interface PlanetPreset { label; kind; massEarth; radiusEarth; color; atmosphere; water; isMoon }`, `PLANET_PRESETS: Record<PlanetType, PlanetPreset>` y `PLANET_TYPES: PlanetType[]`.

- [ ] **Step 1: Escribir los tests que fallan**

`tests/sim/stars.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createStarSystem, BINARY_STAR, STAR_CHOICES } from '../../src/sim/stars';
import { PLANET_PRESETS, PLANET_TYPES } from '../../src/sim/planetTypes';
import { centerOfMass } from '../../src/sim/elements';
import { DT } from '../../src/sim/units';

describe('createStarSystem', () => {
  it('crea una estrella tipo Sol con 1 M☉ y 1 L☉', () => {
    const w = createStarSystem('sunLike');
    expect(w.bodies).toHaveLength(1);
    expect(w.bodies[0]).toMatchObject({ kind: 'star', mass: 1, luminosity: 1, name: 'Sol' });
  });

  it('la gigante azul tiene 10 M☉ y 5000 L☉', () => {
    const s = createStarSystem('blueGiant').bodies[0];
    expect(s.mass).toBe(10);
    expect(s.luminosity).toBe(5000);
  });

  it('el sistema doble está centrado, sin momento y mantiene su separación', () => {
    const w = createStarSystem('binary');
    expect(w.bodies).toHaveLength(2);
    const c = centerOfMass(w.bodies);
    expect(Math.hypot(c.x, c.y, c.z)).toBeLessThan(1e-12);
    expect(Math.hypot(c.vx, c.vy, c.vz)).toBeLessThan(1e-12);
    for (let i = 0; i < 300; i++) w.step(DT);
    const [a, b] = w.bodies;
    const sep = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    expect(Math.abs(sep - BINARY_STAR.separation) / BINARY_STAR.separation).toBeLessThan(0.01);
  });

  it('hay cuatro opciones de estrella', () => {
    expect(STAR_CHOICES.map((c) => c.type)).toEqual(['redDwarf', 'sunLike', 'blueGiant', 'binary']);
  });
});

describe('plantillas de planetas', () => {
  it('hay una plantilla por tipo y solo la luna es luna', () => {
    expect(PLANET_TYPES).toHaveLength(6);
    expect(PLANET_TYPES.filter((t) => PLANET_PRESETS[t].isMoon)).toEqual(['moon']);
    expect(PLANET_PRESETS.earthLike.massEarth).toBe(1);
  });
});
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

Run: `npx vitest run tests/sim/stars.test.ts`
Expected: FAIL, no se puede resolver `../../src/sim/stars`.

- [ ] **Step 3: Implementar `src/sim/stars.ts`**

```ts
import { World } from './world';
import { G, SOLAR_RADIUS_AU } from './units';

export type StarType = 'redDwarf' | 'sunLike' | 'blueGiant' | 'binary';

export interface StarSpec {
  name: string;
  /** M☉ */
  mass: number;
  /** L☉ */
  luminosity: number;
  /** Radio en radios solares */
  radiusSolar: number;
  color: number;
}

export const SINGLE_STARS: Record<Exclude<StarType, 'binary'>, StarSpec> = {
  redDwarf: { name: 'Enana roja', mass: 0.3, luminosity: 0.012, radiusSolar: 0.3, color: 0xff7a45 },
  sunLike: { name: 'Sol', mass: 1, luminosity: 1, radiusSolar: 1, color: 0xfff1c4 },
  blueGiant: { name: 'Gigante azul', mass: 10, luminosity: 5000, radiusSolar: 6, color: 0xa9c8ff },
};

export const BINARY_STAR: StarSpec & { separation: number } = {
  name: 'Estrella',
  mass: 0.8,
  luminosity: 0.45,
  radiusSolar: 0.8,
  color: 0xffe2a0,
  separation: 0.2,
};

export const STAR_CHOICES: { type: StarType; label: string; description: string; color: number }[] = [
  { type: 'redDwarf', label: 'Enana roja', description: 'Pequeña y fría. Zona habitable muy cerca (~0,1 UA).', color: SINGLE_STARS.redDwarf.color },
  { type: 'sunLike', label: 'Tipo Sol', description: 'Como nuestro Sol. Zona habitable a ~1 UA.', color: SINGLE_STARS.sunLike.color },
  { type: 'blueGiant', label: 'Gigante azul', description: 'Enorme y muy brillante. Zona habitable lejana (~40–80 UA).', color: SINGLE_STARS.blueGiant.color },
  { type: 'binary', label: 'Sistema doble', description: 'Dos estrellas que giran juntas. Zona habitable a ~1 UA.', color: BINARY_STAR.color },
];

export function createStarSystem(type: StarType): World {
  const world = new World();
  if (type === 'binary') {
    const s = BINARY_STAR;
    const half = s.separation / 2;
    // Cada estrella va a la mitad de la velocidad relativa de una órbita circular
    const v = Math.sqrt((G * 2 * s.mass) / s.separation) / 2;
    const common = { kind: 'star' as const, mass: s.mass, radius: s.radiusSolar * SOLAR_RADIUS_AU, luminosity: s.luminosity, color: s.color };
    world.add({ ...common, name: `${s.name} A`, x: half, vz: -v });
    world.add({ ...common, name: `${s.name} B`, x: -half, vz: v });
  } else {
    const s = SINGLE_STARS[type];
    world.add({ name: s.name, kind: 'star', mass: s.mass, radius: s.radiusSolar * SOLAR_RADIUS_AU, luminosity: s.luminosity, color: s.color });
  }
  return world;
}
```

- [ ] **Step 4: Implementar `src/sim/planetTypes.ts`**

```ts
import type { BodyKind } from './body';

export type PlanetType = 'smallRocky' | 'earthLike' | 'superEarth' | 'gasGiant' | 'iceGiant' | 'moon';

export interface PlanetPreset {
  label: string;
  kind: BodyKind;
  /** Masa en masas terrestres */
  massEarth: number;
  /** Radio en radios terrestres */
  radiusEarth: number;
  color: number;
  atmosphere: number;
  water: number;
  isMoon: boolean;
}

export const PLANET_PRESETS: Record<PlanetType, PlanetPreset> = {
  smallRocky: { label: 'Rocoso pequeño', kind: 'rocky', massEarth: 0.1, radiusEarth: 0.53, color: 0xb5651d, atmosphere: 0.05, water: 0, isMoon: false },
  earthLike: { label: 'Tipo Tierra', kind: 'rocky', massEarth: 1, radiusEarth: 1, color: 0x2e6fd8, atmosphere: 0.3, water: 0.7, isMoon: false },
  superEarth: { label: 'Supertierra', kind: 'rocky', massEarth: 5, radiusEarth: 1.6, color: 0x7f9a65, atmosphere: 0.5, water: 0.4, isMoon: false },
  gasGiant: { label: 'Gigante gaseoso', kind: 'gas', massEarth: 318, radiusEarth: 11.2, color: 0xd8b384, atmosphere: 1, water: 0, isMoon: false },
  iceGiant: { label: 'Gigante helado', kind: 'ice', massEarth: 17, radiusEarth: 3.9, color: 0x7fd3e6, atmosphere: 1, water: 0, isMoon: false },
  moon: { label: 'Luna', kind: 'rocky', massEarth: 0.0123, radiusEarth: 0.273, color: 0xbfbfbf, atmosphere: 0, water: 0, isMoon: true },
};

export const PLANET_TYPES: PlanetType[] = ['smallRocky', 'earthLike', 'superEarth', 'gasGiant', 'iceGiant', 'moon'];
```

- [ ] **Step 5: Ejecutar los tests y comprobar que pasan**

Run: `npx vitest run tests/sim/stars.test.ts`
Expected: todos en verde.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Tipos de estrella, sistema doble y plantillas de planetas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Colocación en órbita automática

**Files:**
- Create: `src/game/placement.ts`
- Test: `tests/game/placement.test.ts`

**Interfaces:**
- Consumes: `World` y `Body` (Task 2); `centerOfMass`, `centralMassFor`, `relativeOrbit`, `circularSpeed`, `hillRadius`, `rocheLimit` y `visualRadius` (Task 3); `PlanetPreset` (Task 4); `EARTH_MASS` y `EARTH_RADIUS_AU` (Task 1)
- Produces:
  - `interface PlacementCheck { ok: boolean; warning: string | null; radius: number; center: Vec3 }`
  - Comprobaciones:
    - `checkPlanetPlacement(world: World, x: number, z: number): PlacementCheck`
    - `checkMoonPlacement(world: World, planet: Body, preset: PlanetPreset, x: number, z: number): PlacementCheck`
    - `moonBand(world: World, planet: Body, preset: PlanetPreset): { min: number; max: number }`
  - Colocación:
    - `placePlanet(world: World, preset: PlanetPreset, x: number, z: number): Body`
    - `placeMoon(world: World, planet: Body, preset: PlanetPreset, x: number, z: number): Body`
  - Utilidades:
    - `nextName(world: World, prefix: string): string`
    - `presetRadius(preset: PlanetPreset): number`, que devuelve el radio real en UA

- [ ] **Step 1: Escribir los tests que fallan**

`tests/game/placement.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  checkPlanetPlacement, checkMoonPlacement, moonBand, placePlanet, placeMoon, nextName,
} from '../../src/game/placement';
import { createStarSystem } from '../../src/sim/stars';
import { PLANET_PRESETS } from '../../src/sim/planetTypes';
import { centralMassFor, relativeOrbit } from '../../src/sim/elements';
import { DT } from '../../src/sim/units';

describe('planetas', () => {
  it('un planeta colocado a 1 UA sigue en órbita circular tras 1 año', () => {
    const w = createStarSystem('sunLike');
    const p = placePlanet(w, PLANET_PRESETS.earthLike, 1, 0);
    w.removeNetMomentum();
    for (let i = 0; i < 2000; i++) w.step(DT);
    const o = relativeOrbit(p, centralMassFor(w, p)!);
    expect(o.eccentricity).toBeLessThan(0.01);
    expect(o.semiMajorAxis).toBeCloseTo(1, 2);
  });

  it('pone nombres consecutivos', () => {
    const w = createStarSystem('sunLike');
    expect(placePlanet(w, PLANET_PRESETS.earthLike, 1, 0).name).toBe('Planeta 1');
    expect(placePlanet(w, PLANET_PRESETS.gasGiant, 0, 5).name).toBe('Planeta 2');
    expect(nextName(w, 'Luna')).toBe('Luna 1');
  });

  it('copia masa, radio y aspecto de la plantilla', () => {
    const w = createStarSystem('sunLike');
    const p = placePlanet(w, PLANET_PRESETS.earthLike, 1, 0);
    expect(p.mass).toBeCloseTo(3.003e-6, 12);
    expect(p).toMatchObject({ kind: 'rocky', atmosphere: 0.3, water: 0.7, parentId: null });
  });

  it('bloquea colocar pegado a la estrella', () => {
    const w = createStarSystem('sunLike');
    const c = checkPlanetPlacement(w, 0.01, 0);
    expect(c.ok).toBe(false);
    expect(c.warning).toBe('Demasiado cerca de la estrella');
  });

  it('avisa (sin bloquear) cerca de las dos estrellas de un sistema doble', () => {
    const w = createStarSystem('binary');
    const near = checkPlanetPlacement(w, 0.4, 0);
    expect(near.ok).toBe(true);
    expect(near.warning).toContain('inestable');
    const far = checkPlanetPlacement(w, 1, 0);
    expect(far).toMatchObject({ ok: true, warning: null });
    expect(far.radius).toBeCloseTo(1, 12);
  });
});

describe('lunas', () => {
  function sunEarth() {
    const w = createStarSystem('sunLike');
    const earth = placePlanet(w, PLANET_PRESETS.earthLike, 1, 0);
    return { w, earth };
  }

  it('la franja permitida va de 1,2×Roche a 0,5×Hill', () => {
    const { w, earth } = sunEarth();
    const band = moonBand(w, earth, PLANET_PRESETS.moon);
    expect(band.min).toBeGreaterThan(0.0013);
    expect(band.min).toBeLessThan(0.0016);
    expect(band.max).toBeCloseTo(0.005, 4);
  });

  it('acepta dentro de la franja y rechaza fuera', () => {
    const { w, earth } = sunEarth();
    expect(checkMoonPlacement(w, earth, PLANET_PRESETS.moon, 1.003, 0)).toMatchObject({ ok: true, warning: null });
    const tooClose = checkMoonPlacement(w, earth, PLANET_PRESETS.moon, 1.0005, 0);
    expect(tooClose.ok).toBe(false);
    expect(tooClose.warning).toContain('cerca');
    const tooFar = checkMoonPlacement(w, earth, PLANET_PRESETS.moon, 1.02, 0);
    expect(tooFar.ok).toBe(false);
    expect(tooFar.warning).toContain('lejos');
  });

  it('una luna colocada sigue ligada a su planeta tras 1 año', () => {
    const { w, earth } = sunEarth();
    const moon = placeMoon(w, earth, PLANET_PRESETS.moon, 1.003, 0);
    expect(moon.parentId).toBe(earth.id);
    expect(moon.name).toBe('Luna 1');
    w.removeNetMomentum();
    for (let i = 0; i < 2000; i++) w.step(DT);
    const o = relativeOrbit(moon, earth);
    expect(o.bound).toBe(true);
    expect(o.eccentricity).toBeLessThan(0.1);
    expect(o.distance).toBeGreaterThan(0.0015);
    expect(o.distance).toBeLessThan(0.0045);
  });
});
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

Run: `npx vitest run tests/game/placement.test.ts`
Expected: FAIL, no se puede resolver `../../src/game/placement`.

- [ ] **Step 3: Implementar `src/game/placement.ts`**

```ts
import type { Body } from '../sim/body';
import type { Vec3 } from '../sim/vec';
import type { World } from '../sim/world';
import type { PlanetPreset } from '../sim/planetTypes';
import {
  centerOfMass, centralMassFor, relativeOrbit, circularSpeed, hillRadius, rocheLimit,
} from '../sim/elements';
import { visualRadius } from '../sim/scale';
import { EARTH_MASS, EARTH_RADIUS_AU } from '../sim/units';

export interface PlacementCheck {
  ok: boolean;
  warning: string | null;
  /** Radio de la órbita resultante (UA) */
  radius: number;
  /** Centro de la órbita (coordenadas de simulación) */
  center: Vec3;
}

/** No se puede colocar a menos de 3 radios visuales de una estrella */
const MIN_STAR_CLEARANCE = 3;

export function presetRadius(preset: PlanetPreset): number {
  return preset.radiusEarth * EARTH_RADIUS_AU;
}

function presetMass(preset: PlanetPreset): number {
  return preset.massEarth * EARTH_MASS;
}

export function nextName(world: World, prefix: string): string {
  const names = new Set(world.bodies.map((b) => b.name));
  let n = 1;
  while (names.has(`${prefix} ${n}`)) n++;
  return `${prefix} ${n}`;
}

export function checkPlanetPlacement(world: World, x: number, z: number): PlacementCheck {
  const stars = world.stars();
  if (stars.length === 0) {
    return { ok: false, warning: 'No hay ninguna estrella', radius: 0, center: { x: 0, y: 0, z: 0 } };
  }
  const c = centerOfMass(stars);
  const center = { x: c.x, y: c.y, z: c.z };
  const radius = Math.hypot(x - c.x, z - c.z);
  const maxStarRadius = Math.max(...stars.map((s) => visualRadius(s)));
  if (radius < maxStarRadius * MIN_STAR_CLEARANCE) {
    return { ok: false, warning: 'Demasiado cerca de la estrella', radius, center };
  }
  if (stars.length >= 2) {
    const [a, b] = stars;
    const separation = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    if (radius < 3 * separation) {
      return { ok: true, warning: 'Zona inestable: demasiado cerca de las dos estrellas', radius, center };
    }
  }
  return { ok: true, warning: null, radius, center };
}

export function placePlanet(world: World, preset: PlanetPreset, x: number, z: number): Body {
  const c = centerOfMass(world.stars());
  const dx = x - c.x, dz = z - c.z;
  const r = Math.hypot(dx, dz);
  const mass = presetMass(preset);
  const v = circularSpeed(c.mass, mass, r);
  return world.add({
    name: nextName(world, 'Planeta'),
    kind: preset.kind,
    mass,
    radius: presetRadius(preset),
    x, y: c.y, z,
    vx: c.vx + (v * dz) / r,
    vy: c.vy,
    vz: c.vz - (v * dx) / r,
    color: preset.color,
    atmosphere: preset.atmosphere,
    water: preset.water,
  });
}

/** Distancias mínima y máxima (UA) a las que puede orbitar una luna de ese tipo. */
export function moonBand(world: World, planet: Body, preset: PlanetPreset): { min: number; max: number } {
  const moon = { kind: preset.kind, mass: presetMass(preset), radius: presetRadius(preset) };
  const min = 1.2 * rocheLimit(planet, moon);
  const central = centralMassFor(world, planet);
  if (!central) return { min, max: Infinity };
  const a = relativeOrbit(planet, central).distance;
  return { min, max: 0.5 * hillRadius(a, planet.mass, central.mass) };
}

export function checkMoonPlacement(
  world: World, planet: Body, preset: PlanetPreset, x: number, z: number,
): PlacementCheck {
  const center = { x: planet.x, y: planet.y, z: planet.z };
  const radius = Math.hypot(x - planet.x, z - planet.z);
  const { min, max } = moonBand(world, planet, preset);
  if (min >= max) return { ok: false, warning: 'Este planeta no puede tener lunas de ese tamaño', radius, center };
  if (radius < min) return { ok: false, warning: 'Demasiado cerca: la luna se rompería', radius, center };
  if (radius > max) return { ok: false, warning: 'Demasiado lejos: la luna se escaparía', radius, center };
  return { ok: true, warning: null, radius, center };
}

export function placeMoon(world: World, planet: Body, preset: PlanetPreset, x: number, z: number): Body {
  const dx = x - planet.x, dz = z - planet.z;
  const r = Math.hypot(dx, dz);
  const mass = presetMass(preset);
  const v = circularSpeed(planet.mass, mass, r);
  return world.add({
    name: nextName(world, 'Luna'),
    kind: preset.kind,
    mass,
    radius: presetRadius(preset),
    x, y: planet.y, z,
    vx: planet.vx + (v * dz) / r,
    vy: planet.vy,
    vz: planet.vz - (v * dx) / r,
    parentId: planet.id,
    color: preset.color,
    atmosphere: preset.atmosphere,
    water: preset.water,
  });
}
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

Run: `npx vitest run tests/game/placement.test.ts`
Expected: todos en verde.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Colocación de planetas y lunas en órbita circular automática" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Reloj de simulación

**Files:**
- Create: `src/game/clock.ts`
- Test: `tests/game/clock.test.ts`

**Interfaces:**
- Consumes: `DT` (Task 1)
- Produces:
  - `SPEED_LEVELS: readonly { label: string; yearsPerSecond: number }[]` (6 niveles)
  - `class SimClock`:
    - Constructor: `constructor(budgetMs = 6, now = () => performance.now())`.
    - Propiedades: `speedIndex: number`, `alpha: number`, `lastYearsPerSecond: number`, `smoothedYearsPerSecond: number`, `throttled: boolean`.
    - Métodos: `get requestedYearsPerSecond(): number`, `setSpeed(index: number): void`, `advance(frameSeconds: number, step: (dt: number) => void): number`.

- [ ] **Step 1: Escribir los tests que fallan**

`tests/game/clock.test.ts`:
```ts
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
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

Run: `npx vitest run tests/game/clock.test.ts`
Expected: FAIL, no se puede resolver `../../src/game/clock`.

- [ ] **Step 3: Implementar `src/game/clock.ts`**

```ts
import { DT } from '../sim/units';

export const SPEED_LEVELS: readonly { label: string; yearsPerSecond: number }[] = [
  { label: '⏸', yearsPerSecond: 0 },
  { label: '×1', yearsPerSecond: 1 / 365.25 },
  { label: '×10', yearsPerSecond: 10 / 365.25 },
  { label: '×100', yearsPerSecond: 100 / 365.25 },
  { label: '×1000', yearsPerSecond: 1000 / 365.25 },
  { label: 'Máx', yearsPerSecond: 10 },
];

/** Un fotograma nunca cuenta como más de 0,1 s (evita saltos al volver a la app) */
const MAX_FRAME_SECONDS = 0.1;

export class SimClock {
  speedIndex = 1;
  /** Fracción del siguiente subpaso ya transcurrida (0..1), para interpolar el dibujo */
  alpha = 0;
  /** Años simulados por segundo real en el último fotograma */
  lastYearsPerSecond = 0;
  /** Media suavizada de lastYearsPerSecond */
  smoothedYearsPerSecond = 0;
  /** true si el último fotograma no llegó a la velocidad pedida por falta de tiempo */
  throttled = false;
  private debt = 0;

  constructor(
    private readonly budgetMs = 6,
    private readonly now: () => number = () => performance.now(),
  ) {}

  get requestedYearsPerSecond(): number {
    return SPEED_LEVELS[this.speedIndex].yearsPerSecond;
  }

  setSpeed(index: number): void {
    this.speedIndex = Math.max(0, Math.min(SPEED_LEVELS.length - 1, Math.round(index)));
  }

  /** Avanza la simulación por `frameSeconds` reales llamando a `step(DT)` las veces necesarias. */
  advance(frameSeconds: number, step: (dt: number) => void): number {
    const real = Math.min(Math.max(frameSeconds, 0), MAX_FRAME_SECONDS);
    this.debt += this.requestedYearsPerSecond * real;
    const start = this.now();
    let steps = 0;
    this.throttled = false;
    while (this.debt >= DT) {
      step(DT);
      this.debt -= DT;
      steps++;
      if (this.now() - start > this.budgetMs) {
        this.throttled = this.debt >= DT;
        this.debt = Math.min(this.debt, DT * 0.999);
        break;
      }
    }
    this.alpha = this.debt / DT;
    this.lastYearsPerSecond = real > 0 ? (steps * DT) / real : 0;
    this.smoothedYearsPerSecond += (this.lastYearsPerSecond - this.smoothedYearsPerSecond) * 0.1;
    return steps;
  }
}
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

Run: `npx vitest run tests/game/clock.test.ts`
Expected: todos en verde.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Reloj de simulación con velocidades, presupuesto e interpolación" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Entrada táctil

**Files:**
- Create: `src/input/TouchInput.ts`
- Test: `tests/input/touchInput.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `interface PointerLike { pointerId: number; clientX: number; clientY: number; pointerType: string }`
  - `interface InputHandlers { onTap(x, y): void; onDoubleTap(x, y): void; onPlacementMove(x, y): void; onPlacementRelease(x, y): void }`
  - `class TouchInput`:
    - Constructor: `constructor(handlers: InputHandlers, now = () => performance.now())`.
    - Propiedad: `placing: boolean`.
    - Métodos: `attach(el: HTMLElement): void`, `down(e: PointerLike)`, `move(e)`, `up(e)`, `cancel(e)`.

- [ ] **Step 1: Escribir los tests que fallan**

`tests/input/touchInput.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { TouchInput } from '../../src/input/TouchInput';

const P = (id: number, x: number, y: number, pointerType = 'touch') => ({ pointerId: id, clientX: x, clientY: y, pointerType });

function setup() {
  let t = 0;
  const h = { onTap: vi.fn(), onDoubleTap: vi.fn(), onPlacementMove: vi.fn(), onPlacementRelease: vi.fn() };
  const input = new TouchInput(h, () => t);
  return { h, input, wait: (ms: number) => { t += ms; } };
}

describe('TouchInput', () => {
  it('un toque corto es un tap', () => {
    const { h, input, wait } = setup();
    input.down(P(1, 100, 100));
    wait(100);
    input.up(P(1, 102, 101));
    expect(h.onTap).toHaveBeenCalledWith(102, 101);
  });

  it('arrastrar no es un tap', () => {
    const { h, input } = setup();
    input.down(P(1, 100, 100));
    input.move(P(1, 140, 100));
    input.up(P(1, 150, 100));
    expect(h.onTap).not.toHaveBeenCalled();
  });

  it('una pulsación larga no es un tap', () => {
    const { h, input, wait } = setup();
    input.down(P(1, 100, 100));
    wait(500);
    input.up(P(1, 100, 100));
    expect(h.onTap).not.toHaveBeenCalled();
  });

  it('dos toques seguidos son un doble toque', () => {
    const { h, input, wait } = setup();
    input.down(P(1, 100, 100)); wait(80); input.up(P(1, 100, 100));
    wait(120);
    input.down(P(2, 104, 102)); wait(80); input.up(P(2, 104, 102));
    expect(h.onTap).toHaveBeenCalledTimes(1);
    expect(h.onDoubleTap).toHaveBeenCalledWith(104, 102);
  });

  it('dos toques separados en el tiempo son dos taps', () => {
    const { h, input, wait } = setup();
    input.down(P(1, 100, 100)); wait(80); input.up(P(1, 100, 100));
    wait(600);
    input.down(P(2, 100, 100)); wait(80); input.up(P(2, 100, 100));
    expect(h.onTap).toHaveBeenCalledTimes(2);
    expect(h.onDoubleTap).not.toHaveBeenCalled();
  });

  it('un gesto con dos dedos no genera tap', () => {
    const { h, input, wait } = setup();
    input.down(P(1, 100, 100));
    input.down(P(2, 200, 200));
    wait(80);
    input.up(P(2, 200, 200));
    input.up(P(1, 100, 100));
    expect(h.onTap).not.toHaveBeenCalled();
  });

  it('en modo colocación, arrastrar mueve el fantasma y soltar coloca', () => {
    const { h, input } = setup();
    input.placing = true;
    input.down(P(1, 50, 50));
    input.move(P(1, 60, 60));
    input.up(P(1, 60, 60));
    expect(h.onPlacementMove).toHaveBeenCalledWith(50, 50);
    expect(h.onPlacementMove).toHaveBeenCalledWith(60, 60);
    expect(h.onPlacementRelease).toHaveBeenCalledWith(60, 60);
    expect(h.onTap).not.toHaveBeenCalled();
  });

  it('en modo colocación el ratón sin pulsar también mueve el fantasma', () => {
    const { h, input } = setup();
    input.placing = true;
    input.move(P(1, 10, 10, 'mouse'));
    expect(h.onPlacementMove).toHaveBeenCalledWith(10, 10);
  });

  it('pellizcar en modo colocación no coloca', () => {
    const { h, input } = setup();
    input.placing = true;
    input.down(P(1, 50, 50));
    input.down(P(2, 90, 90));
    input.up(P(1, 50, 50));
    input.up(P(2, 90, 90));
    expect(h.onPlacementRelease).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

Run: `npx vitest run tests/input/touchInput.test.ts`
Expected: FAIL, no se puede resolver `../../src/input/TouchInput`.

- [ ] **Step 3: Implementar `src/input/TouchInput.ts`**

```ts
export interface PointerLike {
  pointerId: number;
  clientX: number;
  clientY: number;
  pointerType: string;
}

export interface InputHandlers {
  onTap(x: number, y: number): void;
  onDoubleTap(x: number, y: number): void;
  onPlacementMove(x: number, y: number): void;
  onPlacementRelease(x: number, y: number): void;
}

export const TAP_MOVE_PX = 10;
export const TAP_MAX_MS = 350;
export const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_PX = 30;

/**
 * Distingue toques, dobles toques y el arrastre de colocación.
 * Girar, hacer zoom y mover la vista los gestiona OrbitControls sobre el mismo elemento.
 */
export class TouchInput {
  placing = false;
  private readonly pointers = new Map<number, { x0: number; y0: number; t0: number }>();
  private multiTouch = false;
  private lastTap = { t: -Infinity, x: 0, y: 0 };

  constructor(
    private readonly handlers: InputHandlers,
    private readonly now: () => number = () => performance.now(),
  ) {}

  attach(el: HTMLElement): void {
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.cancel(e));
  }

  down(e: PointerLike): void {
    this.pointers.set(e.pointerId, { x0: e.clientX, y0: e.clientY, t0: this.now() });
    if (this.pointers.size > 1) this.multiTouch = true;
    if (this.placing && !this.multiTouch) this.handlers.onPlacementMove(e.clientX, e.clientY);
  }

  move(e: PointerLike): void {
    if (!this.placing || this.multiTouch) return;
    if (e.pointerType === 'mouse' || this.pointers.has(e.pointerId)) {
      this.handlers.onPlacementMove(e.clientX, e.clientY);
    }
  }

  up(e: PointerLike): void {
    const start = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!start) return;
    const wasMulti = this.multiTouch;
    if (this.pointers.size === 0) this.multiTouch = false;
    if (wasMulti) return;

    if (this.placing) {
      this.handlers.onPlacementRelease(e.clientX, e.clientY);
      return;
    }

    const now = this.now();
    const moved = Math.hypot(e.clientX - start.x0, e.clientY - start.y0);
    if (moved > TAP_MOVE_PX || now - start.t0 > TAP_MAX_MS) return;

    const isDouble =
      now - this.lastTap.t < DOUBLE_TAP_MS &&
      Math.hypot(e.clientX - this.lastTap.x, e.clientY - this.lastTap.y) < DOUBLE_TAP_PX;
    if (isDouble) {
      this.lastTap = { t: -Infinity, x: 0, y: 0 };
      this.handlers.onDoubleTap(e.clientX, e.clientY);
    } else {
      this.lastTap = { t: now, x: e.clientX, y: e.clientY };
      this.handlers.onTap(e.clientX, e.clientY);
    }
  }

  cancel(e: PointerLike): void {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) this.multiTouch = false;
  }
}
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

Run: `npx vitest run tests/input/touchInput.test.ts`
Expected: todos en verde.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Entrada táctil: toque, doble toque y arrastre de colocación" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Escena 3D

**Files:**
- Create: `src/render/markerTexture.ts`, `src/render/starfield.ts`, `src/render/BodyView.ts`, `src/render/GhostView.ts`, `src/render/SceneView.ts`

**Interfaces:**
- Consumes: `World`, `Body`, `Vec3`, `centerOfMass`, `centralMassFor`, `relativeOrbit`, `MassPoint` y `visualRadius` (Tasks 2–3)
- Produces:
  - `BodyView.ts`: `TRAIL_LENGTH = 200`, `interpolated(b: Body, alpha: number): Vec3` y `class BodyView`:
    - Propiedades: `group`, `trail`, `screenRadiusPx`, `trailInterval`.
    - Métodos: `update(b, alpha, focus, center, time, camera, viewportHeightPx)`, `dispose()`.
  - `GhostView.ts`: `interface GhostParams { center: Vec3; radius: number; bodyPos: Vec3; bodyRadius: number; color: number; band: { min: number; max: number } | null }` y `class GhostView { group; show(p: GhostParams, focus: Vec3); hide() }`.
  - `SceneView.ts`, `class SceneView`:
    - Propiedades: `renderer`, `scene`, `camera`, `controls: OrbitControls`, `ghost: GhostView`, `focus: Vec3`, `followId: number | null`.
    - Dibujo: `resize()`, `sync(world: World, alpha: number)`, `render()`.
    - Interacción: `pick(clientX, clientY): number | null`, `planePoint(clientX, clientY, simY): { x: number; z: number } | null`.
    - Cámara: `follow(id: number, world: World, distance?: number)`, `frameSystem(world: World)`.

Esta tarea usa WebGL, que no se puede probar con Vitest en Node. Se verifica con la comprobación de tipos aquí y visualmente en la Task 10.

- [ ] **Step 1: Implementar `src/render/markerTexture.ts`**

```ts
import * as THREE from 'three';

let texture: THREE.Texture | null = null;

/** Punto circular con borde suave, generado una sola vez. */
export function markerTexture(): THREE.Texture {
  if (texture) return texture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
```

- [ ] **Step 2: Implementar `src/render/starfield.ts`**

```ts
import * as THREE from 'three';

/** Campo de estrellas de fondo. Se coloca siempre centrado en la cámara. */
export function createStarfield(count = 4000, radius = 5000): THREE.Points {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const brightness = 0.35 + 0.65 * Math.random() ** 3;
    const tint = Math.random();
    colors[i * 3] = brightness * (tint < 0.15 ? 0.8 : 1);
    colors[i * 3 + 1] = brightness * 0.95;
    colors[i * 3 + 2] = brightness * (tint > 0.85 ? 0.8 : 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false }),
  );
  points.frustumCulled = false;
  points.renderOrder = -1;
  return points;
}
```

- [ ] **Step 3: Implementar `src/render/BodyView.ts`**

```ts
import * as THREE from 'three';
import type { Body } from '../sim/body';
import type { Vec3 } from '../sim/vec';
import { visualRadius } from '../sim/scale';
import { markerTexture } from './markerTexture';

export const TRAIL_LENGTH = 200;
/** Tamaño en pantalla del punto marcador (sprite sin atenuación) */
const MARKER_SCALE = 0.012;
/** Por debajo de este radio aparente (px) se muestra el marcador */
const MARKER_HIDE_PX = 4;

export function interpolated(b: Body, alpha: number): Vec3 {
  return {
    x: b.px + (b.x - b.px) * alpha,
    y: b.py + (b.y - b.py) * alpha,
    z: b.pz + (b.z - b.pz) * alpha,
  };
}

export class BodyView {
  readonly group = new THREE.Group();
  readonly trail: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  /** Radio aparente en píxeles, actualizado en cada update */
  screenRadiusPx = 0;
  /** Años simulados entre puntos de la estela */
  trailInterval = 0.02;
  private readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial | THREE.MeshStandardMaterial>;
  private readonly marker: THREE.Sprite;
  private readonly color: THREE.Color;
  /** Puntos de la estela relativos a su centro (UA), en búfer circular */
  private readonly trailPoints = new Float64Array(TRAIL_LENGTH * 3);
  private trailCount = 0;
  private trailHead = 0;
  private lastTrailTime = -Infinity;

  constructor(body: Body) {
    this.color = new THREE.Color(body.color);
    const material =
      body.kind === 'star'
        ? new THREE.MeshBasicMaterial({ color: this.color })
        : new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.9, metalness: 0 });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), material);
    this.marker = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: markerTexture(), color: this.color, sizeAttenuation: false, transparent: true, depthWrite: false }),
    );
    this.marker.scale.setScalar(MARKER_SCALE);
    this.group.add(this.mesh, this.marker);
    if (body.kind === 'star') this.group.add(new THREE.PointLight(this.color, 3, 0, 0));

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((TRAIL_LENGTH + 1) * 3), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array((TRAIL_LENGTH + 1) * 3), 3));
    geometry.setDrawRange(0, 0);
    this.trail = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.trail.frustumCulled = false;
  }

  update(
    b: Body, alpha: number, focus: Vec3, center: Vec3 | null, time: number,
    camera: THREE.PerspectiveCamera, viewportHeightPx: number,
  ): void {
    const p = interpolated(b, alpha);
    this.group.position.set(p.x - focus.x, p.y - focus.y, p.z - focus.z);
    const r = visualRadius(b);
    this.mesh.scale.setScalar(r);
    const dist = Math.max(camera.position.distanceTo(this.group.position), 1e-12);
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    this.screenRadiusPx = (r / (dist * Math.tan(halfFov))) * (viewportHeightPx / 2);
    this.marker.visible = this.screenRadiusPx < MARKER_HIDE_PX;
    this.updateTrail(p, focus, center, time);
  }

  private updateTrail(p: Vec3, focus: Vec3, center: Vec3 | null, time: number): void {
    const geometry = this.trail.geometry;
    if (!center) {
      geometry.setDrawRange(0, 0);
      return;
    }
    if (time < this.lastTrailTime) {
      this.trailCount = 0;
      this.lastTrailTime = -Infinity;
    }
    if (time - this.lastTrailTime >= this.trailInterval) {
      const i = this.trailHead * 3;
      this.trailPoints[i] = p.x - center.x;
      this.trailPoints[i + 1] = p.y - center.y;
      this.trailPoints[i + 2] = p.z - center.z;
      this.trailHead = (this.trailHead + 1) % TRAIL_LENGTH;
      this.trailCount = Math.min(this.trailCount + 1, TRAIL_LENGTH);
      this.lastTrailTime = time;
    }
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = geometry.getAttribute('color') as THREE.BufferAttribute;
    const n = this.trailCount;
    const start = (this.trailHead - n + TRAIL_LENGTH) % TRAIL_LENGTH;
    const cx = center.x - focus.x, cy = center.y - focus.y, cz = center.z - focus.z;
    for (let k = 0; k < n; k++) {
      const j = ((start + k) % TRAIL_LENGTH) * 3;
      pos.setXYZ(k, this.trailPoints[j] + cx, this.trailPoints[j + 1] + cy, this.trailPoints[j + 2] + cz);
      const fade = ((k + 1) / (n + 1)) * 0.8;
      col.setXYZ(k, this.color.r * fade, this.color.g * fade, this.color.b * fade);
    }
    // El último vértice es la posición actual, para que la estela llegue hasta el cuerpo
    pos.setXYZ(n, p.x - focus.x, p.y - focus.y, p.z - focus.z);
    col.setXYZ(n, this.color.r * 0.8, this.color.g * 0.8, this.color.b * 0.8);
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geometry.setDrawRange(0, n + 1);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.marker.material.dispose();
    this.trail.geometry.dispose();
    this.trail.material.dispose();
  }
}
```

- [ ] **Step 4: Implementar `src/render/GhostView.ts`**

```ts
import * as THREE from 'three';
import type { Vec3 } from '../sim/vec';
import { markerTexture } from './markerTexture';

const CIRCLE_SEGMENTS = 128;

function unitCircle(color: number): THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  const points = new Float32Array(CIRCLE_SEGMENTS * 3);
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    points[i * 3] = Math.cos(a);
    points[i * 3 + 2] = Math.sin(a);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
  const line = new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
  line.frustumCulled = false;
  return line;
}

export interface GhostParams {
  /** Centro de la órbita (simulación) */
  center: Vec3;
  /** Radio de la órbita (UA) */
  radius: number;
  /** Posición del cuerpo fantasma (simulación) */
  bodyPos: Vec3;
  /** Radio visual del cuerpo (UA) */
  bodyRadius: number;
  color: number;
  /** Franja permitida para lunas, o null */
  band: { min: number; max: number } | null;
}

/** Planeta fantasma y círculos de vista previa durante la colocación. */
export class GhostView {
  readonly group = new THREE.Group();
  private readonly sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  private readonly marker = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: markerTexture(), sizeAttenuation: false, transparent: true, depthWrite: false }),
  );
  private readonly orbit = unitCircle(0xffffff);
  private readonly bandMin = unitCircle(0x66ccff);
  private readonly bandMax = unitCircle(0x66ccff);

  constructor() {
    this.marker.scale.setScalar(0.014);
    this.group.add(this.sphere, this.marker, this.orbit, this.bandMin, this.bandMax);
    this.group.visible = false;
  }

  show(p: GhostParams, focus: Vec3): void {
    this.group.visible = true;
    const color = new THREE.Color(p.color);
    this.sphere.position.set(p.bodyPos.x - focus.x, p.bodyPos.y - focus.y, p.bodyPos.z - focus.z);
    this.sphere.scale.setScalar(p.bodyRadius);
    this.sphere.material.color.copy(color);
    this.marker.position.copy(this.sphere.position);
    this.marker.material.color.copy(color);
    const cx = p.center.x - focus.x, cy = p.center.y - focus.y, cz = p.center.z - focus.z;
    this.orbit.position.set(cx, cy, cz);
    this.orbit.scale.set(p.radius, 1, p.radius);
    this.orbit.material.color.copy(color);
    const showBand = p.band !== null;
    this.bandMin.visible = showBand;
    this.bandMax.visible = showBand;
    if (p.band) {
      this.bandMin.position.set(cx, cy, cz);
      this.bandMin.scale.set(p.band.min, 1, p.band.min);
      this.bandMax.position.set(cx, cy, cz);
      this.bandMax.scale.set(p.band.max, 1, p.band.max);
    }
  }

  hide(): void {
    this.group.visible = false;
  }
}
```

- [ ] **Step 5: Implementar `src/render/SceneView.ts`**

```ts
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Body } from '../sim/body';
import type { Vec3 } from '../sim/vec';
import type { World } from '../sim/world';
import { centerOfMass, centralMassFor, relativeOrbit, type MassPoint } from '../sim/elements';
import { visualRadius } from '../sim/scale';
import { BodyView, TRAIL_LENGTH, interpolated } from './BodyView';
import { GhostView } from './GhostView';
import { createStarfield } from './starfield';

/** Radio mínimo (px) alrededor de un cuerpo que cuenta como tocarlo */
const PICK_RADIUS_PX = 28;
const TRAIL_REFRESH_FRAMES = 60;
const DEFAULT_TRAIL_INTERVAL = 0.02;

export class SceneView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly ghost = new GhostView();
  /** Punto de la simulación que se dibuja en el origen de la escena (evita temblores lejos del centro) */
  readonly focus: Vec3 = { x: 0, y: 0, z: 0 };
  followId: number | null = null;
  private readonly views = new Map<number, BodyView>();
  private readonly starfield = createStarfield();
  private readonly raycaster = new THREE.Raycaster();
  private frameCount = 0;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(50, 1, 1e-6, 1e5);
    this.camera.position.set(0, 1.2, 1.6);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1e-5;
    this.controls.maxDistance = 3000;
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.06), this.starfield, this.ghost.group);
    this.resize();
  }

  resize(): void {
    const w = this.container.clientWidth;
    const h = Math.max(this.container.clientHeight, 1);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  sync(world: World, alpha: number): void {
    this.syncViews(world);
    if (this.followId !== null) {
      const followed = world.get(this.followId);
      if (followed) Object.assign(this.focus, interpolated(followed, alpha));
      else this.followId = null;
    }
    const stars = world.stars();
    const starCenter = stars.length > 0 ? centerOfMass(stars) : null;
    const refresh = this.frameCount++ % TRAIL_REFRESH_FRAMES === 0;
    const height = this.renderer.domElement.clientHeight;
    for (const b of world.bodies) {
      const view = this.views.get(b.id)!;
      if (refresh) view.trailInterval = this.trailIntervalFor(world, b);
      const center = this.trailCenter(world, b, stars.length, starCenter, alpha);
      view.update(b, alpha, this.focus, center, world.time, this.camera, height);
    }
    this.starfield.position.copy(this.camera.position);
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /** Id del cuerpo bajo el punto de pantalla, o null. */
  pick(clientX: number, clientY: number): number | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector3();
    let best: number | null = null;
    let bestDistance = Infinity;
    for (const [id, view] of this.views) {
      v.copy(view.group.position).project(this.camera);
      if (v.z > 1) continue;
      const sx = rect.left + ((v.x + 1) / 2) * rect.width;
      const sy = rect.top + ((1 - v.y) / 2) * rect.height;
      const d = Math.hypot(sx - clientX, sy - clientY);
      if (d <= Math.max(PICK_RADIUS_PX, view.screenRadiusPx) && d < bestDistance) {
        bestDistance = d;
        best = id;
      }
    }
    return best;
  }

  /** Punto (coordenadas de simulación) donde el rayo de pantalla corta el plano horizontal y = simY. */
  planePoint(clientX: number, clientY: number, simY: number): { x: number; z: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(simY - this.focus.y));
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x + this.focus.x, z: hit.z + this.focus.z };
  }

  /** La cámara sigue al cuerpo, a `distance` UA (por defecto 12 radios visuales). */
  follow(id: number, world: World, distance?: number): void {
    const b = world.get(id);
    if (!b) return;
    this.followId = id;
    Object.assign(this.focus, { x: b.x, y: b.y, z: b.z });
    this.placeCamera(distance ?? visualRadius(b) * 12);
  }

  /** Encuadra todo el sistema, centrado en las estrellas. */
  frameSystem(world: World): void {
    this.followId = null;
    const stars = world.stars();
    const c = stars.length > 0 ? centerOfMass(stars) : { x: 0, y: 0, z: 0 };
    let luminosity = 0;
    for (const s of stars) luminosity += s.luminosity;
    // Como mínimo se ve hasta más allá de la zona habitable
    let extent = Math.max(0.05, 1.5 * Math.sqrt(luminosity));
    for (const b of world.bodies) {
      extent = Math.max(extent, Math.hypot(b.x - c.x, b.y - c.y, b.z - c.z) + visualRadius(b) * 4);
    }
    Object.assign(this.focus, { x: c.x, y: c.y, z: c.z });
    this.placeCamera(extent * 2.5);
  }

  private placeCamera(distance: number): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    if (offset.lengthSq() === 0) offset.set(0, 0.6, 0.8);
    offset.setLength(distance);
    this.controls.target.set(0, 0, 0);
    this.camera.position.copy(offset);
  }

  private syncViews(world: World): void {
    const alive = new Set<number>();
    for (const b of world.bodies) {
      alive.add(b.id);
      if (!this.views.has(b.id)) {
        const view = new BodyView(b);
        view.trailInterval = this.trailIntervalFor(world, b);
        this.views.set(b.id, view);
        this.scene.add(view.group, view.trail);
      }
    }
    for (const [id, view] of this.views) {
      if (!alive.has(id)) {
        this.scene.remove(view.group, view.trail);
        view.dispose();
        this.views.delete(id);
      }
    }
  }

  private trailIntervalFor(world: World, b: Body): number {
    const central = centralMassFor(world, b);
    if (!central) return DEFAULT_TRAIL_INTERVAL;
    const orbit = relativeOrbit(b, central);
    return orbit.bound ? orbit.period / TRAIL_LENGTH : DEFAULT_TRAIL_INTERVAL;
  }

  /** Centro respecto al que se dibuja la estela: planeta padre o estrellas. */
  private trailCenter(world: World, b: Body, starCount: number, starCenter: MassPoint | null, alpha: number): Vec3 | null {
    if (b.parentId !== null) {
      const parent = world.get(b.parentId);
      return parent ? interpolated(parent, alpha) : null;
    }
    if (b.kind === 'star') return starCount > 1 ? starCenter : null;
    return starCenter;
  }
}
```

- [ ] **Step 6: Comprobar tipos y tests**

Run: `npm run typecheck` y después `npm test`
Expected: sin errores de tipos y todos los tests anteriores en verde.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Escena 3D: cuerpos, marcadores, estelas, fantasma de colocación y cámara" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Interfaz (HUD y pantalla de inicio)

**Files:**
- Create: `src/ui/format.ts`, `src/ui/Hud.ts`, `src/ui/startScreen.ts`
- Modify: `src/ui/style.css` (añadir estilos al final)
- Test: `tests/ui/format.test.ts`

**Interfaces:**
- Consumes: `SPEED_LEVELS` (Task 6), `PLANET_PRESETS`, `PLANET_TYPES`, `PlanetType`, `STAR_CHOICES` y `StarType` (Task 4), `DAYS_PER_YEAR` (Task 1)
- Produces:
  - `format.ts`: `formatElapsed(years: number): string` y `formatSpeed(yearsPerSecond: number): string`.
  - `Hud.ts`: `interface HudHandlers { onSpeed(index: number): void; onAdd(type: PlanetType): void; onCancelPlacement(): void; onFrameSystem(): void }` y `class Hud`:
    - Constructor: `constructor(parent: HTMLElement, h: HudHandlers)`.
    - Estado: `setVisible(v: boolean)`, `setSystemName(name: string)`, `setSpeedIndex(i: number)`, `setTime(years: number, yearsPerSecond: number, throttled: boolean)`, `setSelected(name: string | null)`.
    - Colocación y avisos: `showPlacement(hint: string, warning: string | null, blocked: boolean)`, `hidePlacement()`, `toast(message: string)`.
  - `startScreen.ts`: `showStartScreen(parent: HTMLElement, onChoose: (type: StarType) => void): void`.

- [ ] **Step 1: Escribir los tests que fallan**

`tests/ui/format.test.ts`:
```ts
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
```

- [ ] **Step 2: Ejecutar los tests y comprobar que fallan**

Run: `npx vitest run tests/ui/format.test.ts`
Expected: FAIL, no se puede resolver `../../src/ui/format`.

- [ ] **Step 3: Implementar `src/ui/format.ts`**

```ts
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
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

Run: `npx vitest run tests/ui/format.test.ts`
Expected: todos en verde.

- [ ] **Step 5: Implementar `src/ui/Hud.ts`**

```ts
import { SPEED_LEVELS } from '../game/clock';
import { PLANET_PRESETS, PLANET_TYPES, type PlanetType } from '../sim/planetTypes';
import { formatElapsed, formatSpeed } from './format';

export interface HudHandlers {
  onSpeed(index: number): void;
  onAdd(type: PlanetType): void;
  onCancelPlacement(): void;
  onFrameSystem(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text) e.textContent = text;
  return e;
}

const TEXT_REFRESH_MS = 250;
const TOAST_MS = 3000;

export class Hud {
  private readonly root = el('div', 'hud');
  private readonly systemName = el('span', 'hud-system');
  private readonly elapsed = el('span', 'hud-elapsed');
  private readonly realSpeed = el('span', 'hud-real-speed');
  private readonly selected = el('div', 'hud-selected hidden');
  private readonly placement = el('div', 'hud-placement hidden');
  private readonly placementHint = el('div', 'hud-placement-hint');
  private readonly placementWarning = el('div', 'hud-placement-warning');
  private readonly addMenu = el('div', 'hud-add-menu hidden');
  private readonly toasts = el('div', 'hud-toasts');
  private readonly speedButtons: HTMLButtonElement[] = [];
  private lastTextUpdate = -Infinity;

  constructor(parent: HTMLElement, h: HudHandlers) {
    const top = el('div', 'hud-top');
    const frameButton = el('button', 'hud-btn hud-frame', '⌖');
    frameButton.title = 'Ver todo el sistema';
    frameButton.onclick = () => h.onFrameSystem();
    top.append(this.systemName, this.elapsed, frameButton);

    const cancel = el('button', 'hud-btn', 'Cancelar');
    cancel.onclick = () => h.onCancelPlacement();
    this.placement.append(this.placementHint, this.placementWarning, cancel);

    const time = el('div', 'hud-time');
    SPEED_LEVELS.forEach((level, i) => {
      const b = el('button', 'hud-btn hud-speed', level.label);
      b.onclick = () => h.onSpeed(i);
      this.speedButtons.push(b);
      time.append(b);
    });
    const timeWrap = el('div', 'hud-time-wrap');
    timeWrap.append(time, this.realSpeed);

    const add = el('button', 'hud-btn hud-add', '＋');
    add.title = 'Añadir cuerpo';
    add.onclick = () => this.addMenu.classList.toggle('hidden');
    for (const type of PLANET_TYPES) {
      const b = el('button', 'hud-btn hud-add-item', PLANET_PRESETS[type].label);
      b.onclick = () => {
        this.addMenu.classList.add('hidden');
        h.onAdd(type);
      };
      this.addMenu.append(b);
    }

    const bottom = el('div', 'hud-bottom');
    bottom.append(timeWrap, add);
    this.root.append(top, this.selected, this.placement, this.addMenu, bottom, this.toasts);
    parent.append(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  setSystemName(name: string): void {
    this.systemName.textContent = name;
  }

  setSpeedIndex(index: number): void {
    this.speedButtons.forEach((b, i) => b.classList.toggle('active', i === index));
  }

  setTime(years: number, yearsPerSecond: number, throttled: boolean): void {
    const now = performance.now();
    if (now - this.lastTextUpdate < TEXT_REFRESH_MS) return;
    this.lastTextUpdate = now;
    this.elapsed.textContent = formatElapsed(years);
    this.realSpeed.textContent = (throttled ? '⚠ ' : '') + formatSpeed(yearsPerSecond);
    this.realSpeed.classList.toggle('throttled', throttled);
  }

  setSelected(name: string | null): void {
    this.selected.textContent = name ?? '';
    this.selected.classList.toggle('hidden', name === null);
  }

  showPlacement(hint: string, warning: string | null, blocked: boolean): void {
    this.placement.classList.remove('hidden');
    this.addMenu.classList.add('hidden');
    this.placementHint.textContent = hint;
    this.placementWarning.textContent = warning ?? '';
    this.placementWarning.classList.toggle('blocked', blocked);
  }

  hidePlacement(): void {
    this.placement.classList.add('hidden');
  }

  toast(message: string): void {
    const t = el('div', 'hud-toast', message);
    this.toasts.append(t);
    setTimeout(() => t.classList.add('fade'), TOAST_MS - 500);
    setTimeout(() => t.remove(), TOAST_MS);
  }
}
```

- [ ] **Step 6: Implementar `src/ui/startScreen.ts`**

```ts
import { STAR_CHOICES, type StarType } from '../sim/stars';

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Pantalla inicial para elegir la estrella. Se elimina al elegir. */
export function showStartScreen(parent: HTMLElement, onChoose: (type: StarType) => void): void {
  const screen = document.createElement('div');
  screen.className = 'start-screen';
  const title = document.createElement('h1');
  title.textContent = 'Forja Estelar';
  const subtitle = document.createElement('p');
  subtitle.className = 'start-subtitle';
  subtitle.textContent = 'Elige la estrella de tu sistema';
  const grid = document.createElement('div');
  grid.className = 'start-grid';
  for (const choice of STAR_CHOICES) {
    const card = document.createElement('button');
    card.className = 'start-card';
    const dot = document.createElement('span');
    dot.className = 'start-dot';
    dot.style.background = hex(choice.color);
    dot.style.boxShadow = `0 0 24px ${hex(choice.color)}`;
    const name = document.createElement('strong');
    name.textContent = choice.label;
    const description = document.createElement('span');
    description.className = 'start-desc';
    description.textContent = choice.description;
    card.append(dot, name, description);
    card.onclick = () => {
      screen.remove();
      onChoose(choice.type);
    };
    grid.append(card);
  }
  screen.append(title, subtitle, grid);
  parent.append(screen);
}
```

- [ ] **Step 7: Añadir estilos al final de `src/ui/style.css`**

```css
.hidden { display: none !important; }
button { font: inherit; color: inherit; }

.hud {
  position: absolute; inset: 0; pointer-events: none;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}
.hud button, .hud-add-menu, .hud-placement { pointer-events: auto; }
.hud-btn {
  min-width: 48px; min-height: 48px; padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px;
  background: rgba(12, 16, 28, 0.72); backdrop-filter: blur(8px);
  font-size: 15px; cursor: pointer;
}
.hud-btn:active { transform: scale(0.96); }
.hud-top { position: absolute; top: 12px; left: 12px; right: 12px; display: flex; align-items: center; gap: 12px; }
.hud-system { font-weight: 700; font-size: 17px; }
.hud-elapsed { flex: 1; opacity: 0.75; font-variant-numeric: tabular-nums; }
.hud-frame { font-size: 22px; }
.hud-selected {
  position: absolute; top: 72px; left: 50%; transform: translateX(-50%);
  padding: 8px 16px; border-radius: 999px; background: rgba(12, 16, 28, 0.72); font-weight: 600;
}
.hud-placement {
  position: absolute; top: 72px; left: 12px; right: 12px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 12px; border-radius: 14px; background: rgba(12, 16, 28, 0.8); text-align: center;
}
.hud-placement-warning { color: #ffb050; min-height: 1.2em; }
.hud-placement-warning.blocked { color: #ff6060; }
.hud-bottom {
  position: absolute; left: 12px; right: 12px; bottom: 12px;
  display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;
}
.hud-time-wrap { display: flex; flex-direction: column; gap: 6px; }
.hud-time { display: flex; flex-wrap: wrap; gap: 6px; }
.hud-speed { padding: 0 10px; font-variant-numeric: tabular-nums; }
.hud-speed.active { background: rgba(80, 140, 255, 0.55); border-color: rgba(140, 180, 255, 0.8); }
.hud-real-speed { font-size: 13px; opacity: 0.75; }
.hud-real-speed.throttled { color: #ffb050; opacity: 1; }
.hud-add { width: 64px; height: 64px; border-radius: 50%; font-size: 30px; background: rgba(60, 120, 255, 0.8); flex-shrink: 0; }
.hud-add-menu { position: absolute; right: 12px; bottom: 88px; display: flex; flex-direction: column; gap: 6px; }
.hud-toasts {
  position: absolute; left: 50%; bottom: 150px; transform: translateX(-50%);
  display: flex; flex-direction: column; gap: 6px; align-items: center;
}
.hud-toast { padding: 10px 16px; border-radius: 12px; background: rgba(12, 16, 28, 0.88); transition: opacity 0.5s; white-space: nowrap; }
.hud-toast.fade { opacity: 0; }

.start-screen {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 16px; padding: 24px; overflow-y: auto;
  background: radial-gradient(ellipse at center, rgba(20, 30, 60, 0.6), rgba(0, 0, 0, 0.9));
}
.start-screen h1 { font-size: 36px; letter-spacing: 0.04em; }
.start-subtitle { opacity: 0.75; }
.start-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; width: 100%; max-width: 640px; }
.start-card {
  display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 18px 12px;
  border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 16px; background: rgba(12, 16, 28, 0.75);
  cursor: pointer; text-align: center;
}
.start-dot { width: 36px; height: 36px; border-radius: 50%; }
.start-desc { font-size: 13px; opacity: 0.75; }
```

- [ ] **Step 8: Comprobar tipos y tests**

Run: `npm run typecheck` y después `npm test`
Expected: sin errores y todo en verde.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Interfaz: barra de tiempo, menú de añadir, avisos y pantalla de inicio" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Coordinador del juego, arranque y verificación

**Files:**
- Create: `src/game/Game.ts`, `.claude/launch.json`
- Modify: `src/main.ts` (sustituir entero)

**Interfaces:**
- Consumes:
  - Física y colocación: `World` (Task 2), `centerOfMass` (Task 3), `createStarSystem`, `STAR_CHOICES`, `StarType`, `PLANET_PRESETS` y `PlanetType` (Task 4), `checkPlanetPlacement`, `checkMoonPlacement`, `moonBand`, `placePlanet`, `placeMoon`, `presetRadius` y `PlacementCheck` (Task 5).
  - Tiempo y entrada: `SimClock` (Task 6), `TouchInput` e `InputHandlers` (Task 7).
  - Dibujo e interfaz: `SceneView` (Task 8), `Hud` y `showStartScreen` (Task 9), `MAX_BODIES` (Task 1), `visualRadius` (Task 3).
- Produces: `class Game implements InputHandlers`:
  - Construcción: `constructor(view: SceneView)`, `attach(hud: Hud, input: TouchInput)`.
  - Partida: `start(type: StarType)`, `frame(seconds: number)`, `setSpeed(i: number)`.
  - Acciones del jugador: `requestAdd(type: PlanetType)`, `cancelPlacement()`, `frameSystem()`.
  - Gestos: `onTap`, `onDoubleTap`, `onPlacementMove`, `onPlacementRelease`.

- [ ] **Step 1: Implementar `src/game/Game.ts`**

```ts
import type { SceneView } from '../render/SceneView';
import type { Hud } from '../ui/Hud';
import type { InputHandlers, TouchInput } from '../input/TouchInput';
import { World } from '../sim/world';
import { createStarSystem, STAR_CHOICES, type StarType } from '../sim/stars';
import { PLANET_PRESETS, type PlanetType } from '../sim/planetTypes';
import { centerOfMass } from '../sim/elements';
import { visualRadius } from '../sim/scale';
import { MAX_BODIES } from '../sim/units';
import { SimClock } from './clock';
import {
  checkMoonPlacement, checkPlanetPlacement, moonBand, placeMoon, placePlanet, presetRadius,
  type PlacementCheck,
} from './placement';

type Mode =
  | { kind: 'idle' }
  | { kind: 'choosingMoonParent'; type: PlanetType }
  | { kind: 'placing'; type: PlanetType; parentId: number | null };

const GHOST_OK = 0xffffff;
const GHOST_WARNING = 0xffa040;
const GHOST_BLOCKED = 0xff5050;
const HINT_PLANET = 'Arrastra para elegir la órbita y suelta para colocar';
const HINT_CHOOSE_PARENT = 'Toca el planeta que tendrá la luna';
const HINT_MOON = 'Arrastra alrededor del planeta y suelta para colocar la luna';

export class Game implements InputHandlers {
  world = new World();
  readonly clock = new SimClock();
  started = false;
  private mode: Mode = { kind: 'idle' };
  private selectedId: number | null = null;
  private speedBeforePlacement = 1;
  private hint = '';
  private hud!: Hud;
  private input!: TouchInput;

  constructor(private readonly view: SceneView) {}

  attach(hud: Hud, input: TouchInput): void {
    this.hud = hud;
    this.input = input;
  }

  start(type: StarType): void {
    this.world = createStarSystem(type);
    this.started = true;
    this.view.frameSystem(this.world);
    this.hud.setSystemName(STAR_CHOICES.find((c) => c.type === type)!.label);
    this.hud.setSpeedIndex(this.clock.speedIndex);
  }

  frame(seconds: number): void {
    if (!this.started) {
      this.view.render();
      return;
    }
    this.clock.advance(seconds, (dt) => this.world.step(dt));
    this.view.sync(this.world, this.clock.alpha);
    this.view.render();
    const paused = this.mode.kind !== 'idle';
    const speed = paused ? 0 : this.clock.throttled ? this.clock.smoothedYearsPerSecond : this.clock.requestedYearsPerSecond;
    this.hud.setTime(this.world.time, speed, !paused && this.clock.throttled);
    if (this.selectedId !== null && !this.world.get(this.selectedId)) this.select(null);
  }

  setSpeed(index: number): void {
    if (this.mode.kind !== 'idle') this.speedBeforePlacement = index;
    else this.clock.setSpeed(index);
    this.hud.setSpeedIndex(index);
  }

  frameSystem(): void {
    if (this.started) this.view.frameSystem(this.world);
  }

  requestAdd(type: PlanetType): void {
    if (!this.started) return;
    if (this.world.bodies.length >= MAX_BODIES) {
      this.hud.toast(`Máximo de ${MAX_BODIES} cuerpos`);
      return;
    }
    this.pauseForPlacement();
    this.select(null);
    this.view.ghost.hide();
    if (PLANET_PRESETS[type].isMoon) {
      this.mode = { kind: 'choosingMoonParent', type };
      this.setPlacingInput(false);
      this.setHint(HINT_CHOOSE_PARENT);
    } else {
      this.mode = { kind: 'placing', type, parentId: null };
      this.setPlacingInput(true);
      this.setHint(HINT_PLANET);
    }
  }

  cancelPlacement(): void {
    this.exitPlacement();
  }

  onTap(x: number, y: number): void {
    if (!this.started) return;
    const id = this.view.pick(x, y);
    if (this.mode.kind === 'choosingMoonParent') {
      const planet = id !== null ? this.world.get(id) : undefined;
      if (!planet || planet.kind === 'star' || planet.parentId !== null) {
        this.hud.toast('Toca un planeta');
        return;
      }
      const preset = PLANET_PRESETS[this.mode.type];
      const band = moonBand(this.world, planet, preset);
      this.mode = { kind: 'placing', type: this.mode.type, parentId: planet.id };
      this.setPlacingInput(true);
      this.view.follow(planet.id, this.world, Number.isFinite(band.max) ? band.max * 3 : undefined);
      this.setHint(HINT_MOON);
      return;
    }
    if (this.mode.kind === 'placing') return;
    this.select(id);
  }

  onDoubleTap(x: number, y: number): void {
    if (!this.started || this.mode.kind !== 'idle') return;
    const id = this.view.pick(x, y);
    if (id === null) return;
    this.select(id);
    this.view.follow(id, this.world);
  }

  onPlacementMove(x: number, y: number): void {
    const result = this.evaluatePlacement(x, y);
    if (!result || this.mode.kind !== 'placing') return;
    const { check, pos, y: simY } = result;
    const preset = PLANET_PRESETS[this.mode.type];
    const parent = this.mode.parentId !== null ? this.world.get(this.mode.parentId) : undefined;
    this.view.ghost.show(
      {
        center: check.center,
        radius: check.radius,
        bodyPos: { x: pos.x, y: simY, z: pos.z },
        bodyRadius: visualRadius({ kind: preset.kind, radius: presetRadius(preset) }),
        color: !check.ok ? GHOST_BLOCKED : check.warning ? GHOST_WARNING : GHOST_OK,
        band: parent ? moonBand(this.world, parent, preset) : null,
      },
      this.view.focus,
    );
    this.hud.showPlacement(this.hint, check.warning, !check.ok);
  }

  onPlacementRelease(x: number, y: number): void {
    const result = this.evaluatePlacement(x, y);
    if (!result || this.mode.kind !== 'placing') return;
    const { check, pos } = result;
    if (!check.ok) {
      this.hud.toast(check.warning ?? 'No se puede colocar aquí');
      return;
    }
    const preset = PLANET_PRESETS[this.mode.type];
    const parent = this.mode.parentId !== null ? this.world.get(this.mode.parentId) : undefined;
    const body = parent
      ? placeMoon(this.world, parent, preset, pos.x, pos.z)
      : placePlanet(this.world, preset, pos.x, pos.z);
    this.world.removeNetMomentum();
    this.world.snapRenderState();
    this.exitPlacement();
    this.hud.toast(`Se ha añadido ${body.name}`);
    this.select(body.id);
  }

  private evaluatePlacement(x: number, y: number): { check: PlacementCheck; pos: { x: number; z: number }; y: number } | null {
    if (this.mode.kind !== 'placing') return null;
    if (this.mode.parentId === null) {
      const simY = centerOfMass(this.world.stars()).y;
      const pos = this.view.planePoint(x, y, simY);
      if (!pos) return null;
      return { check: checkPlanetPlacement(this.world, pos.x, pos.z), pos, y: simY };
    }
    const planet = this.world.get(this.mode.parentId);
    if (!planet) {
      this.exitPlacement();
      return null;
    }
    const pos = this.view.planePoint(x, y, planet.y);
    if (!pos) return null;
    return {
      check: checkMoonPlacement(this.world, planet, PLANET_PRESETS[this.mode.type], pos.x, pos.z),
      pos,
      y: planet.y,
    };
  }

  /** Pausa la simulación al entrar en colocación y recuerda la velocidad anterior. */
  private pauseForPlacement(): void {
    if (this.mode.kind !== 'idle') return;
    this.speedBeforePlacement = this.clock.speedIndex;
    this.clock.setSpeed(0);
    this.world.snapRenderState();
  }

  private exitPlacement(): void {
    if (this.mode.kind === 'idle') return;
    this.mode = { kind: 'idle' };
    this.setPlacingInput(false);
    this.view.ghost.hide();
    this.hud.hidePlacement();
    this.clock.setSpeed(this.speedBeforePlacement);
    this.hud.setSpeedIndex(this.speedBeforePlacement);
  }

  private setPlacingInput(placing: boolean): void {
    this.input.placing = placing;
    this.view.controls.enableRotate = !placing;
  }

  private setHint(hint: string): void {
    this.hint = hint;
    this.hud.showPlacement(hint, null, false);
  }

  private select(id: number | null): void {
    this.selectedId = id;
    const body = id !== null ? this.world.get(id) : undefined;
    this.hud.setSelected(body ? body.name : null);
  }
}
```

- [ ] **Step 2: Sustituir `src/main.ts`**

```ts
import './ui/style.css';
import { SceneView } from './render/SceneView';
import { Hud } from './ui/Hud';
import { showStartScreen } from './ui/startScreen';
import { TouchInput } from './input/TouchInput';
import { Game } from './game/Game';

const app = document.getElementById('app')!;
const view = new SceneView(app);
const game = new Game(view);
const hud = new Hud(app, {
  onSpeed: (i) => game.setSpeed(i),
  onAdd: (type) => game.requestAdd(type),
  onCancelPlacement: () => game.cancelPlacement(),
  onFrameSystem: () => game.frameSystem(),
});
const input = new TouchInput(game);
input.attach(view.renderer.domElement);
game.attach(hud, input);

hud.setVisible(false);
showStartScreen(app, (type) => {
  hud.setVisible(true);
  game.start(type);
});

let last = performance.now();
function loop(now: number): void {
  const seconds = (now - last) / 1000;
  last = now;
  game.frame(seconds);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.addEventListener('resize', () => view.resize());
// Al volver a la app no se cuenta el tiempo que estuvo en segundo plano
document.addEventListener('visibilitychange', () => {
  last = performance.now();
});
```

- [ ] **Step 3: Crear `.claude/launch.json` para la vista previa**

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "forja-estelar", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 5173 }
  ]
}
```

- [ ] **Step 4: Comprobar tipos, tests y build**

Run: `npm run typecheck`, `npm test` y `npm run build`
Expected: sin errores, todos los tests en verde y la carpeta `dist/` generada.

- [ ] **Step 5: Verificación visual en el navegador (vista móvil 375×812)**

Arrancar la vista previa `forja-estelar`, poner el tamaño de móvil y comprobar:
1. La pantalla de inicio muestra «Forja Estelar» y 4 tarjetas de estrella.
2. Al elegir «Tipo Sol» se ve el Sol amarillo en el centro, el fondo de estrellas y la barra de tiempo con ×1 activo.
3. ＋ → «Tipo Tierra»: aparece el banner «Arrastra para elegir la órbita…» y la velocidad muestra «En pausa». Al mover el puntero hay un fantasma con su círculo de órbita. Junto al Sol el círculo se pone rojo con «Demasiado cerca de la estrella». Al soltar a ~1 UA aparece el aviso «Se ha añadido Planeta 1».
4. Con ×1000 el planeta gira y deja una estela que se desvanece. La velocidad muestra «2,7 años/s».
5. ＋ → «Luna» → tocar el planeta: la cámara se acerca y aparecen dos círculos azules (franja permitida). Al soltar dentro de la franja se añade «Luna 1», que gira alrededor del planeta con su estela.
6. Tocar un cuerpo muestra su nombre arriba. Un doble toque lo sigue con la cámara y ⌖ vuelve a encuadrar el sistema.
7. Con «Sistema doble»: las dos estrellas giran entre sí y colocar un planeta a ~0,4 UA muestra el aviso naranja de zona inestable.
8. La consola del navegador no tiene errores.

Si algo falla, usar superpowers:systematic-debugging antes de cambiar código.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Coordinador del juego y arranque: fases 1 y 2 jugables" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Prueba en el Android del usuario**

1. Ejecutar `ipconfig` y anotar la IPv4 de la WiFi del PC.
2. Ejecutar `npm run dev`. Si Windows pregunta por el firewall, permitir el acceso en redes privadas.
3. El usuario abre `http://<IPv4>:5173` en Chrome del Android, en la misma WiFi, y repite los puntos 1 a 6 del Step 5 con los dedos: girar con 1 dedo, pellizcar para hacer zoom y mover la vista con 2 dedos.
4. Anotar lo que diga el usuario sobre fluidez y controles para el plan de la fase 3.
