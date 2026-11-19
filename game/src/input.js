// Hands in, intent out. This module owns the keyboard, the mouse and pointer lock; it
// knows nothing about the hero or the camera, so it can be handed to any other module.

const SWALLOW = new Set([
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab',
]);

export function createInput(canvas) {
  const down = new Set();
  const fresh = new Set();
  const pilot = new Set();
  const mouse = { dx: 0, dy: 0, held: 0, wheel: 0 };
  let locked = false;
  let dragLook = false;

  function keyPressed(e) {
    if (SWALLOW.has(e.code)) e.preventDefault();
    if (pilot.size) pilot.clear(); // the first real key hands control back to the player
    if (!down.has(e.code)) fresh.add(e.code);
    down.add(e.code);
  }

  function keyReleased(e) {
    down.delete(e.code);
  }

  function dropAll() {
    down.clear();
    mouse.held = 0;
  }

  // Pointer lock gives raw movement for free. When a browser refuses the lock (headless,
  // an iframe, a user who dismissed the prompt) holding a mouse button does the same job,
  // so looking never depends on the lock succeeding.
  function moved(e) {
    if (locked || dragLook) {
      mouse.dx += e.movementX || 0;
      mouse.dy += e.movementY || 0;
    }
  }

  window.addEventListener('keydown', keyPressed);
  window.addEventListener('keyup', keyReleased);
  window.addEventListener('blur', dropAll);
  window.addEventListener('mousemove', moved);
  window.addEventListener('mousedown', (e) => {
    mouse.held |= 1 << e.button;
    if (!locked) dragLook = true;
  });
  window.addEventListener('mouseup', (e) => {
    mouse.held &= ~(1 << e.button);
    if (!locked) dragLook = false;
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('wheel', (e) => {
    mouse.wheel += Math.sign(e.deltaY);
    e.preventDefault();
  }, { passive: false });

  // Pointer lock is what turns mouse movement into looking rather than into a cursor.
  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (locked) dragLook = false;
  });

  return {
    // Movement wish on the ground plane: x is strafe, y is forward, already normalised.
    // A demo pilot can hold a key for us, which keeps the old demo opening inside the
    // same code path a real keyboard press takes.
    move(out) {
      let x = 0;
      let y = 0;
      if (down.has('KeyW') || pilot.has('KeyW') || down.has('ArrowUp')) y += 1;
      if (down.has('KeyS') || pilot.has('KeyS') || down.has('ArrowDown')) y -= 1;
      if (down.has('KeyA') || pilot.has('KeyA') || down.has('ArrowLeft')) x -= 1;
      if (down.has('KeyD') || pilot.has('KeyD') || down.has('ArrowRight')) x += 1;
      const len = Math.hypot(x, y) || 1;
      out.x = x / len;
      out.y = y / len;
      out.run = down.has('ShiftLeft') || down.has('ShiftRight') || pilot.has('ShiftLeft');
      return out;
    },
    held(code) {
      return down.has(code) || pilot.has(code);
    },
    // Virtual keys used by the ?demo openings; releasing returns control to the player.
    setPilot(code, on) {
      if (on) pilot.add(code);
      else pilot.delete(code);
    },
    clearPilot() {
      pilot.clear();
    },
    // True on exactly one frame per physical press.
    tapped(code) {
      if (!fresh.has(code)) return false;
      fresh.delete(code);
      return true;
    },
    // The same test for a few bindings that share one action (E and Enter, say).
    tappedAny(...codes) {
      let hit = false;
      for (const code of codes) {
        if (fresh.has(code)) {
          fresh.delete(code);
          hit = true;
        }
      }
      return hit;
    },
    // Consume the accumulated mouse movement.
    look() {
      const out = { dx: mouse.dx, dy: mouse.dy };
      mouse.dx = 0;
      mouse.dy = 0;
      return out;
    },
    firing() {
      return (mouse.held & 1) === 1;
    },
    // Right mouse: hold to aim, which squares the shoulders and tightens the camera.
    aiming() {
      return (mouse.held & 4) === 4;
    },
    wheel() {
      const n = mouse.wheel;
      mouse.wheel = 0;
      return n;
    },
    endFrame() {
      fresh.clear();
    },
    get locked() {
      return locked;
    },
  };
}
