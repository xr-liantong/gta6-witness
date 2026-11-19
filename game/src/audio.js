// Sound, synthesised on the spot: no audio files, no network. An engine drone, a siren,
// gunshots from a noise burst, and the small clicks that make the interface feel solid.

export function createAudio() {
  let ctx = null;
  let engine = null;
  let siren = null;
  let noise = null;
  let master = null;

  function noiseBuffer() {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    return buffer;
  }

  function start() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    noise = noiseBuffer();

    // Engine: a saw through a lowpass; pitch and gain follow the car.
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start();
    engine = { osc, filter, gain };

    // Siren: a square wave wobbling between two tones.
    const sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'square';
    sirenOsc.frequency.value = 640;
    const sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    siren = { osc: sirenOsc, gain: sirenGain, on: false, phase: 0 };
  }

  function blip(freq, dur, type = 'sine', level = 0.25) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(level, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  return {
    start,
    get ready() {
      return Boolean(ctx);
    },
    engine(speed, throttle) {
      if (!engine) return;
      const t = ctx.currentTime;
      const hz = 46 + Math.min(1, Math.abs(speed) / 31) * 120 + Math.abs(throttle) * 16;
      engine.osc.frequency.setTargetAtTime(hz, t, 0.08);
      engine.filter.frequency.setTargetAtTime(320 + Math.abs(speed) * 22, t, 0.1);
      engine.gain.gain.setTargetAtTime(0.05 + Math.min(0.16, Math.abs(speed) * 0.006), t, 0.1);
    },
    idleEngine() {
      if (engine) engine.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    },
    siren(on) {
      if (!siren) return;
      siren.on = on;
      siren.gain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.1);
    },
    tick(dt) {
      if (!siren || !siren.on) return;
      siren.phase += dt;
      siren.osc.frequency.setTargetAtTime(
        Math.sin(siren.phase * 5) > 0 ? 730 : 560,
        ctx.currentTime,
        0.02,
      );
    },
    gun() {
      if (!ctx) return;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.9, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      src.connect(gain);
      gain.connect(master);
      src.start();
      blip(90, 0.1, 'square', 0.18);
    },
    horn() {
      blip(392, 0.28, 'square', 0.14);
      blip(523, 0.28, 'square', 0.1);
    },
    step() {
      blip(120 + Math.random() * 40, 0.05, 'triangle', 0.05);
    },
    cash() {
      blip(880, 0.1, 'sine', 0.12);
      setTimeout(() => blip(1180, 0.12, 'sine', 0.1), 70);
    },
    ui() {
      blip(660, 0.06, 'sine', 0.08);
    },
    crash() {
      if (!ctx) return;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      src.connect(gain);
      gain.connect(master);
      src.start();
    },
  };
}
