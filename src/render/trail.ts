export const TRAIL_LENGTH = 200;

/** Historial de posiciones (relativas al centro de la estela) muestreado por substep de simulación. */
export class TrailHistory {
  /** Años simulados entre muestras */
  interval = 0.02;
  /** Años simulados que abarca la estela visible */
  period = 0.02 * TRAIL_LENGTH;
  /** Tiempo de simulación a partir del cual toca la siguiente muestra */
  nextTime = -Infinity;
  private readonly times = new Float64Array(TRAIL_LENGTH);
  private readonly xs = new Float64Array(TRAIL_LENGTH);
  private readonly ys = new Float64Array(TRAIL_LENGTH);
  private readonly zs = new Float64Array(TRAIL_LENGTH);
  private count = 0;
  private head = 0;

  /** Indica si en `time` toca registrar una muestra. */
  shouldSample(time: number): boolean {
    return time >= this.nextTime;
  }

  record(t: number, rx: number, ry: number, rz: number): void {
    this.times[this.head] = t;
    this.xs[this.head] = rx;
    this.ys[this.head] = ry;
    this.zs[this.head] = rz;
    this.head = (this.head + 1) % TRAIL_LENGTH;
    this.count = Math.min(this.count + 1, TRAIL_LENGTH);
  }

  /** Registra si toca; devuelve si lo hizo. */
  maybeRecord(t: number, rx: number, ry: number, rz: number): boolean {
    if (!this.shouldSample(t)) return false;
    this.record(t, rx, ry, rz);
    // Se ancla a la rejilla de muestreo para que no se acumule deriva
    this.nextTime = t - this.nextTime < this.interval ? this.nextTime + this.interval : t + this.interval;
    return true;
  }

  reset(): void {
    this.count = 0;
    this.head = 0;
    this.nextTime = -Infinity;
  }

  /** Recorre de la muestra más antigua a la más reciente las que están en [minTime, maxTime]. */
  forEachVisible(minTime: number, maxTime: number, cb: (rx: number, ry: number, rz: number, t: number) => void): void {
    const start = (this.head - this.count + TRAIL_LENGTH) % TRAIL_LENGTH;
    for (let k = 0; k < this.count; k++) {
      const j = (start + k) % TRAIL_LENGTH;
      const t = this.times[j];
      if (t >= minTime && t <= maxTime) cb(this.xs[j], this.ys[j], this.zs[j], t);
    }
  }
}
