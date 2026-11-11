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
