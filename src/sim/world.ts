import type { Body, BodyInit } from './body';
import type { Vec3 } from './vec';
import { G, SOFTENING2 } from './units';
import { defaultSurface } from './surfaces';

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
      ring: init.ring ?? null,
      texture: init.texture ?? null,
      surface: init.surface ?? defaultSurface(init.kind, (init.parentId ?? null) !== null),
      pulsar: init.pulsar ?? false,
    };
    this.bodies.push(body);
    this.accelValid = false;
    return body;
  }

  /** Reemplaza todo el contenido (al cargar una partida). Los ids se conservan. */
  load(bodies: Body[], time: number): void {
    this.bodies = bodies;
    this.time = time;
    this.nextId = bodies.reduce((m, b) => Math.max(m, b.id), 0) + 1;
    this.accelValid = false;
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
