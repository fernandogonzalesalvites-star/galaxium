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
