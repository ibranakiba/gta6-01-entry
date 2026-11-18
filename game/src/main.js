// fix9
// Crown Bay — the front door. The page loads this module, it builds
// the game on the page's canvas, and then it either runs the normal
// play loop or stages one of the screenshot scenes (?shot=start,
// play, chase, end, club) for the entry's pictures.
//
// The game itself lives in world.js; this file is only the wiring:
// find the canvas, read the URL, hand the game its first frame, and
// keep the loop ticking at the fixed step the tuning table defines.
import { createGame, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './world.js';
import { SHOT_NAMES, stageShot } from './shots.js';
import { settle, renderOnce } from './render.js';
import { MAX_DT, STEP } from './config.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number(params.get('seed'));
const seed = Number.isFinite(seedParam) && seedParam !== 0 ? seedParam : 1;

// Every error the page throws is collected here, so the screenshot
// harness and the player can see that the game booted cleanly —
// window.__errors stays empty on a good run.
window.__errors = [];
window.addEventListener('error', (event) => {
  window.__errors.push(String(event.message || event.error || 'unknown error'));
});
window.addEventListener('unhandledrejection', (event) => {
  window.__errors.push(`unhandled: ${String(event.reason || 'unknown')}`);
});

// The canvas comes from the page; if the page ever forgets it, make
// one rather than failing to boot at all.
let canvas = document.querySelector('canvas');
if (!canvas) {
  canvas = document.createElement('canvas');
  canvas.id = 'game-canvas';
  document.body.appendChild(canvas);
}

const game = createGame(canvas, seed);
window.__game = game;
window.__shotReady = false;
// The title screen's START button (and anything else on the page) can
// start the game through the input's confirm, the same bit the Enter
// key and a pointer press set.
window.__confirmStart = () => game.input.confirm();
game.setBestText();

function runShot(name) {
  if (!SHOT_NAMES.includes(name)) {
    window.__errors.push(`unknown shot: ${name}`);
    window.__shotReady = true;
    return;
  }
  stageShot(game, name);
  // Let the world settle: the camera swings behind the car, the rain
  // starts falling, the police close in — a frame taken too early
  // would catch the scene mid-teleport. The chase needs a little more
  // time than the rest, so it gets extra steps to close the distance.
  settle(game, name === 'chase' ? 240 : 150, STEP);
  renderOnce(game);
  window.__shotReady = true;
}

if (shotName) {
  // Staged scenes never run the live loop: one deterministic setup,
  // one settled frame, then the harness takes its picture.
  runShot(shotName);
} else {
  // The live loop: fixed steps, clamped so a slow frame can never
  // jump the world forward by half a second.
  let last = performance.now();
  let carry = 0;
  function loop(now) {
    const frameDt = Math.min(MAX_DT, (now - last) / 1000);
    last = now;
    carry += frameDt;
    let guard = 0;
    while (carry >= STEP && guard < 8) {
      game.step(STEP);
      carry -= STEP;
      guard += 1;
    }
    if (guard >= 8) carry = 0;
    game.render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// Keep the screen names reachable for the page's own wiring.
export { SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE };
