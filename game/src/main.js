// Crown Bay — main.js rewritten in recorded session fix7, 18 Nov 2026.
// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between four screens: title,
// play, paused and game over. Errors are collected on window.__errors so a
// headless test can read them back.
//
// ?seed=N fixes the city, traffic and pedestrians. ?shot=start|play|chase|
// club|end (with &seed=N) stages that scene instead of running the loop,
// paints it twice and sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createGame, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './world.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

window.__errors = [];
window.addEventListener('error', (e) => {
  window.__errors.push(String(e.message || e.error || 'error'));
});
window.addEventListener('unhandledrejection', (e) => {
  window.__errors.push(`unhandled: ${String(e.reason && e.reason.message ? e.reason.message : e.reason)}`);
});

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const game = createGame(canvas, seed);
window.__game = game; // debug handle for headless tests

function runShot(name) {
  stageShot(name, game);
  // The staged scene never runs step(), so paint the minimap once here —
  // otherwise the submitted screenshots show an empty minimap circle.
  game.hud.drawMinimap({
    playerX: game.player.x, playerZ: game.player.z,
    playerHeading: game.player.inVehicle ? game.player.inVehicle.heading : game.player.heading,
    police: [...game.police.cars, ...game.police.officers],
    marker: game.missions.marker,
    inClub: game.state.inClub,
  });
  let painted = 0;
  function paint() {
    game.render();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  game.setBestText();
  game.hud.showScreen('title');

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (accumulator >= STEP) {
      game.step(STEP);
      accumulator -= STEP;
    }
    game.render();
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
