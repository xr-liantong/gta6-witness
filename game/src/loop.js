// One clock for the whole game. Physics runs on a fixed step so a car handles the same
// on every machine; drawing happens once per animation frame. Pausing freezes both.

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

export function createLoop({ update, render }) {
  let raf = 0;
  let last = 0;
  let acc = 0;
  let paused = false;
  const fps = { frames: 0, elapsed: 0, value: 0 };
  const stats = { time: 0, steps: 0 };

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    fps.frames += 1;
    fps.elapsed += dt;
    if (fps.elapsed >= 0.5) {
      fps.value = fps.frames / fps.elapsed;
      fps.frames = 0;
      fps.elapsed = 0;
    }
    if (paused) return;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 8) {
      update(STEP);
      acc -= STEP;
      steps += 1;
      stats.time += STEP;
      stats.steps += 1;
    }
    render(dt);
    fps.sim = steps;
  }

  return {
    fps,
    stats,
    step: STEP,
    start() {
      if (!raf) raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    },
    pause(value = true) {
      paused = value;
      acc = 0;
      last = 0;
    },
    get paused() {
      return paused;
    },
  };
}
