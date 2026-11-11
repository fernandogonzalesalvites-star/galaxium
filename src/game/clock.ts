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
