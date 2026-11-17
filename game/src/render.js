// Crown Bay — the thin helpers between the game and the picture:
// settle the world forward a fixed number of steps, draw one frame,
// and hand the harness a readable canvas. The game owns the scene
// and the camera; this file only owns the moment a frame is taken.
//
// These exist as their own module so the boot code (main.js) never
// has to think about stepping or rendering directly — and so the
// screenshot path and the live loop share exactly one way of drawing.

export function renderOnce(game) {
  game.render();
  return true;
}

// Advance the world `steps` times at the fixed step, catching a
// stumble instead of letting it kill the shot: a scene that throws
// on step 40 should still produce the frame it managed, and the
// error is recorded on window.__errors by the boot code's handler.
export function settle(game, steps, dt) {
  let done = 0;
  for (let i = 0; i < steps; i += 1) {
    try {
      game.step(dt);
      done += 1;
    } catch (err) {
      if (typeof window !== 'undefined' && Array.isArray(window.__errors)) {
        window.__errors.push(`settle step ${i}: ${String(err && err.message ? err.message : err)}`);
      }
      break;
    }
  }
  return done;
}

// A cheap, reusable way to say "how far through": used by the HUD
// and the effects when they need a 0..1 value that eases in and out.
export function clamp01(value) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Shortest signed angle from `from` to `to`, in (-PI, PI]: the turn
// a camera or a car should take, without spinning the long way round.
export function angleDelta(from, to) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

// Ease a value toward a target without overshooting: the same shape
// the chase camera uses when it swings back behind a car.
export function easeToward(value, target, rate, dt) {
  const step = Math.min(1, rate * dt);
  return value + (target - value) * step;
}
