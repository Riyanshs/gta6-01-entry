// Keyboard + mouse input. WASD moves, mouse steers the camera (pointer lock when
// the player clicks the canvas; the game still plays fine without it), E interacts,
// 1/2/3 switch weapons, R reloads, P pauses, M cycles the radio, Space is the handbrake.

export const ACTION_INTERACT = 1;
export const ACTION_SHOOT = 2;
export const ACTION_PAUSE = 4;
export const ACTION_RELOAD = 8;

export function createInput(canvas) {
  const keys = new Set();
  const actions = { bits: 0 };
  let mouseDX = 0;
  let mouseDY = 0;
  let shooting = false;

  function codeOf(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(codeOf(event));
    if (codeOf(event) === 'KeyE') actions.bits |= ACTION_INTERACT;
    if (codeOf(event) === 'KeyP' || codeOf(event) === 'Escape') actions.bits |= ACTION_PAUSE;
    if (codeOf(event) === 'KeyR') actions.bits |= ACTION_RELOAD;
    if (codeOf(event) === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(codeOf(event)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      shooting = true;
      actions.bits |= ACTION_SHOOT;
    }
    if (document.pointerLockElement !== canvas) {
      try {
        canvas.requestPointerLock();
      } catch {
        // Pointer lock is a nicety, not a requirement.
      }
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) shooting = false;
  });
  window.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === canvas) {
      mouseDX += event.movementX || 0;
      mouseDY += event.movementY || 0;
    }
  });

  return {
    keys,
    takeActions() {
      const bits = actions.bits;
      actions.bits = 0;
      return bits;
    },
    takeMouse() {
      const dx = mouseDX;
      const dy = mouseDY;
      mouseDX = 0;
      mouseDY = 0;
      return { dx, dy };
    },
    get shooting() {
      return shooting;
    },
    /** Forward/back/strafe as -1..1, from WASD or arrows. */
    move() {
      let f = 0;
      let s = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
      return { forward: f, strafe: s };
    },
    get running() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    get handbrake() {
      return keys.has('Space');
    },
    weaponSlot() {
      if (keys.has('Digit1')) return 0;
      if (keys.has('Digit2')) return 1;
      if (keys.has('Digit3')) return 2;
      return -1;
    },
    radioNext() {
      return keys.has('KeyM');
    },
  };
}
