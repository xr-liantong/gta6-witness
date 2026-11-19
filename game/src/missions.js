// "The Emerald Coupé": three beats, one car, one fixer. The mission is a small state
// machine that only reads what the rest of the game already knows — where you are and
// what you are driving.

export const CHAPTER = 'Chapter one · The Emerald Coupé';

export function createMissions(world) {
  const events = [];
  const queue = [];
  const state = { step: 0, done: false, timer: 0 };
  let line = null;
  const beats = [
    {
      objective: 'Meet Reina Sosa at the marina',
      marker: world.markers.fixer,
      lines: [
        ['Reina', 'Dani Cruz. You look like a man who needs a favour.'],
        ['Dani', 'I need a car that is not mine.'],
        ['Reina', 'The emerald coupé. Hotel Miramar forecourt. Pier Nine by six, and we are even.'],
      ],
    },
    {
      objective: 'Steal the emerald coupé from the hotel forecourt',
      marker: world.markers.car,
      lines: [
        ['Reina', 'That is the one. The owner counts the doors. Do not add any.'],
      ],
    },
    {
      objective: 'Drive it to Pier Nine at the docks',
      marker: world.markers.drop,
      lines: [
        ['Reina', 'Pier Nine. Bring it round the back and keep the engine warm.'],
      ],
    },
  ];

  function say(who, text) {
    queue.push({ who, text, life: 5.5 });
    events.push({ type: 'line', who, text });
  }

  function enterStep(step) {
    state.step = step;
    state.timer = 0;
    const beat = beats[Math.min(step, beats.length - 1)];
    events.push({ type: 'objective', text: beat.objective });
    if (step < beats.length) {
      for (const [who, text] of beat.lines) say(who, text);
    }
  }

  return {
    get step() {
      return state.step;
    },
    get done() {
      return state.done;
    },
    get objective() {
      if (state.done) return 'Free roam: the city is yours';
      return beats[state.step].objective;
    },
    get subtitle() {
      return line;
    },
    get marker() {
      return state.done ? null : beats[state.step].marker;
    },
    begin() {
      if (state.step === 0 && state.timer === 0) enterStep(0);
    },
    drain() {
      const out = events.slice();
      events.length = 0;
      return out;
    },
    update(dt, player) {
      state.timer += dt;
      if (line) {
        line.life -= dt;
        if (line.life <= 0) line = null;
      } else if (queue.length) {
        line = queue.shift();
      }
      if (state.done) return;
      if (state.step === 0) {
        if (Math.hypot(player.state.pos.x - world.marina.x, player.state.pos.z - world.marina.z) < 6) {
          enterStep(1);
        }
        return;
      }
      if (state.step === 1) {
        if (player.inCar && player.inCar.isJobCar) enterStep(2);
        return;
      }
      if (state.step === 2 && player.inCar && player.inCar.isJobCar) {
        if (Math.hypot(player.state.pos.x - world.docks.x, player.state.pos.z - world.docks.z) < 18) {
          state.done = true;
          player.state.money += 250;
          say('Reina', 'Beautiful. Two hundred and fifty, and the coupé was never here.');
          events.push({ type: 'reward', amount: 250 });
          events.push({ type: 'objective', text: 'Free roam: the city is yours' });
          events.push({ type: 'complete' });
        }
      }
    },
    serialize() {
      return { step: state.step, done: state.done };
    },
    load(data) {
      if (!data) return;
      state.step = Math.max(0, Math.min(2, data.step | 0));
      state.done = Boolean(data.done);
      if (state.step > 0 && !state.done) {
        events.push({ type: 'objective', text: beats[state.step].objective });
      }
    },
  };
}
