// Crown Bay — input.js rewritten in recorded session fix7, 18 Nov 2026.
// Keyboard + mouse input. WASD/arrows move, mouse drag orbits the camera
// (pointer lock on click for a proper third-person feel), keys fire one-shot
// actions that the game consumes each frame. Touch: left half is a virtual
// joystick, right half drags the camera.
//
// Title-screen start is deliberately redundant so it cannot silently break:
// Enter/Space (keydown on window) and ANY primary pointer press anywhere on
// the page (pointerdown on window) both raise ACTION_CONFIRM, and the
// confirm() method below lets the title screen's START button trigger the
// same action directly. A click is harmless during play: the play branch
// never reads ACTION_CONFIRM, so a click there only shoots (canvas
// mousedown) as before. On pause / game-over screens a click resumes or
// retries, which is the expected behaviour.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_SHOOT = 8;
export const ACTION_RELOAD = 16;
export const ACTION_HORN = 32;
export const ACTION_JUMP = 64;
export const ACTION_MAP = 128;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  KeyE: ACTION_ENTER,
  KeyF: ACTION_SHOOT,
  KeyR: ACTION_RELOAD,
  KeyH: ACTION_HORN,
  KeyM: ACTION_MAP,
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let lookDX = 0;
  let lookDY = 0;
  let locked = false;
  let dragging = false;
  let joy = { x: 0, y: 0, active: false };
  let touchShoot = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    const a = KEY_ACTIONS[e.code];
    if (a) {
      actions |= a;
      if (e.code === 'Space') e.preventDefault();
    }
    if (e.code === 'Space') actions |= ACTION_JUMP;
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onMouseMove(e) {
    if (locked || dragging) { lookDX += e.movementX; lookDY += e.movementY; }
  }
  function onMouseDown(e) {
    if (e.button === 0) {
      actions |= ACTION_SHOOT;
      dragging = true;
      if (canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch { /* pointer lock is a nicety */ } }
    }
  }
  function onMouseUp(e) { if (e.button === 0) dragging = false; }
  function onLockChange() { locked = document.pointerLockElement === canvas; }
  function onBlur() { keys.clear(); dragging = false; }
  // Any primary pointer press anywhere on the page counts as "confirm".
  // This is what makes a click on the title screen work even though the
  // full-screen title overlay sits above the canvas: the old code only
  // listened for mousedown on the canvas itself, so clicks on the overlay
  // never produced an action at all.
  function onPointerDown(e) {
    if (e.button !== 0) return;
    actions |= ACTION_CONFIRM;
  }

  // --- touch controls ---
  const touches = new Map();
  function onTouchStart(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.clientX < window.innerWidth / 2 && !joy.active) {
        joy = { x: 0, y: 0, active: true, id: t.identifier, ox: t.clientX, oy: t.clientY };
        touches.set(t.identifier, 'joy');
      } else {
        touches.set(t.identifier, 'look');
        joy.lx = t.clientX; joy.ly = t.clientY;
      }
    }
  }
  function onTouchMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (touches.get(t.identifier) === 'joy' && joy.active) {
        joy.x = Math.max(-1, Math.min(1, (t.clientX - joy.ox) / 60));
        joy.y = Math.max(-1, Math.min(1, (t.clientY - joy.oy) / 60));
      } else if (touches.get(t.identifier) === 'look') {
        lookDX += (t.clientX - (joy.lx ?? t.clientX)) * 2;
        lookDY += (t.clientY - (joy.ly ?? t.clientY)) * 2;
        joy.lx = t.clientX; joy.ly = t.clientY;
      }
    }
  }
  function onTouchEnd(e) {
    for (const t of e.changedTouches) {
      if (touches.get(t.identifier) === 'joy') { joy = { x: 0, y: 0, active: false }; }
      touches.delete(t.identifier);
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointerlockchange', onLockChange);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);
  canvas.addEventListener('touchcancel', onTouchEnd);

  return {
    // -1..1 strafe (x) and forward (y); touch joystick feeds the same axes.
    move() {
      let x = 0, y = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (joy.active) { x += joy.x; y -= joy.y; }
      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      return { x, y };
    },
    run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    brake() { return keys.has('Space'); },
    takeLook() { const d = { x: lookDX, y: lookDY }; lookDX = 0; lookDY = 0; return d; },
    takeActions() { const a = actions; actions = 0; if (touchShoot) { touchShoot = false; return a | ACTION_SHOOT; } return a; },
    tapShoot() { touchShoot = true; },
    isLocked() { return locked; },
    // Direct confirm for the title screen's START button (and any other
    // DOM control): same bit the Enter key and a pointer press set.
    confirm() { actions |= ACTION_CONFIRM; },
  };
}
