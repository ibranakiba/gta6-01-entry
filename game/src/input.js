// Crown Bay — input.js rewritten in recorded session fix8, 18 Nov 2026.
// Crown Bay — keyboard + mouse, in one place. Discrete presses (enter a
// car, shoot, reload, pause, open the map, confirm the title screen) are
// edge-triggered bits that takeActions() hands out once and clears, so a
// held key never double-fires. Movement and sprint are level state that
// move() and run() read every frame. The mouse steers the camera through
// pointer lock; a click on the canvas also fires the pistol, and any
// pointer press anywhere on the page counts as a confirm — that is what
// makes the title screen work when the overlay covers the canvas, and
// what the gold START button drives.
export const ACTION_CONFIRM = 1;
export const ACTION_ENTER = 2;
export const ACTION_HORN = 4;
export const ACTION_JUMP = 8;
export const ACTION_MAP = 16;
export const ACTION_PAUSE = 32;
export const ACTION_RELOAD = 64;
export const ACTION_SHOOT = 128;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM | ACTION_JUMP,
  KeyE: ACTION_ENTER,
  KeyH: ACTION_HORN,
  KeyM: ACTION_MAP,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  KeyR: ACTION_RELOAD,
  KeyF: ACTION_SHOOT,
};

export function createInput(canvas) {
  const held = new Set();
  let queued = 0;
  let lookX = 0;
  let lookY = 0;
  let locked = false;

  function queue(bits) { queued |= bits; }

  function onKeyDown(e) {
    // Ignore repeats: a held key must not re-queue its edge action, and
    // typing into a form field (there is none in-game, but be safe) is
    // never game input.
    if (e.repeat) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    held.add(e.code);
    const bits = KEY_ACTIONS[e.code];
    if (bits) {
      queue(bits);
      e.preventDefault();
    }
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    held.delete(e.code);
  }

  function onBlur() {
    held.clear();
  }

  function onPointerDown(e) {
    // Every press anywhere confirms (title / pause / game-over screens
    // listen for ACTION_CONFIRM). A press on the canvas itself is also a
    // shot, and it grabs pointer lock so the mouse can steer the camera.
    // Prevent the browser's default press behaviour on the canvas so a
    // click never starts a text selection or a drag while aiming.
    if (e.target === canvas) e.preventDefault();
    queue(ACTION_CONFIRM);
    if (e.target === canvas) {
      queue(ACTION_SHOOT);
      if (!locked && canvas.requestPointerLock) {
        try {
          const p = canvas.requestPointerLock();
          if (p && p.catch) p.catch(() => {});
        } catch { /* pointer lock is a nicety, not a requirement */ }
      }
    }
  }

  function onPointerMove(e) {
    if (!locked) return;
    lookX += e.movementX || 0;
    lookY += e.movementY || 0;
  }

  function onLockChange() {
    locked = document.pointerLockElement === canvas;
  }

  function onContextMenu(e) {
    if (e.target === canvas) e.preventDefault();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerlockchange', onLockChange);
  canvas.addEventListener('contextmenu', onContextMenu);

  return {
    // Edge actions pressed since the last call; the bits clear as read.
    takeActions() {
      const bits = queued;
      queued = 0;
      return bits;
    },

    // Mouse look since the last call, in pixels; clears as read.
    takeLook() {
      const look = { x: lookX, y: lookY };
      lookX = 0;
      lookY = 0;
      return look;
    },

    // {x: strafe right +, y: forward +} from held keys, -1..1 each way.
    move() {
      const left = held.has('KeyA') || held.has('ArrowLeft');
      const right = held.has('KeyD') || held.has('ArrowRight');
      const fwd = held.has('KeyW') || held.has('ArrowUp');
      const back = held.has('KeyS') || held.has('ArrowDown');
      return {
        x: (right ? 1 : 0) - (left ? 1 : 0),
        y: (fwd ? 1 : 0) - (back ? 1 : 0),
      };
    },

    // Sprint on foot, boost in a vehicle, climb in a helicopter.
    run() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },

    // Confirm from code (the title screen's START button calls this
    // through window.__game.input) — same as pressing Enter or clicking.
    confirm() {
      queue(ACTION_CONFIRM);
    },

    get pointerLocked() { return locked; },
  };
}
