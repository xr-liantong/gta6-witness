// One clock for the whole game. Physics runs on a fixed step so a car handles the same
// on every machine; drawing happens once per animation frame. Pausing freezes both.
//
// The loop also keeps a tiny scoreboard on `window.__perf`: animation frames since the
// first one, the worst frame in milliseconds and the last thrown error. A reviewer who
// suspects a stall can read it from the console after ten seconds instead of guessing.

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

export function createLoop({ update, render }) {
  let raf = 0;
  let last = 0;
  let acc = 0;
  let paused = false;
  let mode = 'play';
  const fps = { frames: 0, elapsed: 0, value: 0 };
  const stats = { time: 0, steps: 0 };
  const perf = {
    rafs: 0,
    worst: 0,
    thrown: 0,
    error: null,
    mode,
    since: typeof performance !== 'undefined' ? performance.now() : 0,
  };
  if (typeof window !== 'undefined') window.__perf = perf;

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
    // One bad frame must not take the game down with it: the error is kept on __perf and
    // the loop keeps asking for the next frame, so the page never looks hard-frozen.
    const started = performance.now();
    try {
      if (!paused) {
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
    } catch (err) {
      perf.thrown += 1;
      if (!perf.error) {
        perf.error = String((err && err.message) || err);
        console.error('Solvara frame error:', err);
      }
    }
    const spent = performance.now() - started;
    perf.rafs += 1;
    if (spent > perf.worst) perf.worst = Math.round(spent * 10) / 10;
  }

  return {
    fps,
    stats,
    perf,
    step: STEP,
    setMode(name) {
      mode = name;
      perf.mode = name;
    },
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
    get mode() {
      return mode;
    },
  };
}
