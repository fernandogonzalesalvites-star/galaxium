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
