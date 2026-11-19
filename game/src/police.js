// The long arm of Solvara. Crimes raise a heat level, cruisers arrive on the nearest
// avenue, and the only way down is distance: lose them for a few seconds and they give up.

import { LAW, PALETTE } from './config.js';

export function createPolice(world, fleet) {
  const cruisers = [];
  let stars = 0;
  let heat = 0;
  let calm = LAW.decaySeconds;
  let spawnTimer = 0;
  let away = 0;
  const events = [];

  function nearestLane(point) {
    let best = world.lanes[0];
    let bestDist = Infinity;
    for (const lane of world.lanes) {
      const mix = 0.5;
      const x = lane.a.x + (lane.b.x - lane.a.x) * mix;
      const z = lane.a.z + (lane.b.z - lane.a.z) * mix;
      const d = Math.hypot(x - point.x, z - point.z);
      if (d < bestDist) {
        bestDist = d;
        best = lane;
      }
    }
    return best;
  }

  function spawn(point) {
    // Pick the point on a lane that is roughly LAW.spawnDistance away from the player.
    const lane = nearestLane(point);
    const dx = lane.b.x - lane.a.x;
    const dz = lane.b.z - lane.a.z;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    const sign = (lane.a.x - point.x) * ux + (lane.a.z - point.z) * uz > 0 ? 1 : -1;
    const dist = Math.min(LAW.spawnDistance, len * 0.45);
    const x = point.x + ux * dist * sign;
    const z = point.z + uz * dist * sign;
    const car = fleet.spawn('sedan', x, z, Math.atan2(ux * sign, uz * sign), PALETTE.police, { police: true });
    car.driver = 'police';
    car.unit = { fire: 0, stuck: 0, siren: 0 };
    cruisers.push(car);
    events.push('siren');
    return car;
  }

  function report(amount = 1) {
    stars = Math.min(LAW.stars, Math.max(1, stars + amount));
    calm = LAW.decaySeconds;
    heat = 1;
  }

  // Screenshot poses set an exact wanted level: no heat build-up, no bleeding a star
  // while a frame sits still.
  function pin(amount) {
    stars = Math.max(0, Math.min(LAW.stars, amount));
    heat = stars > 0 ? 1 : 0;
    calm = LAW.decaySeconds;
  }

  function despawn(car) {
    car.driver = null;
    car.mesh.visible = false;
    car.dead = true;
  }

  return {
    cruisers,
    get stars() {
      return stars;
    },
    get heat() {
      return heat > 0;
    },
    report,
    pin,
    // Used by the screenshot poses: a cruiser where the picture needs it.
    spawnAt(x, z, yaw) {
      const car = fleet.spawn('sedan', x, z, yaw, PALETTE.police, { police: true });
      car.driver = 'police';
      car.unit = { fire: 99, stuck: 0, siren: 0 };
      cruisers.push(car);
      return car;
    },
    drain() {
      const out = events.slice();
      events.length = 0;
      return out;
    },
    clear() {
      stars = 0;
      heat = 0;
      for (const car of cruisers) despawn(car);
      cruisers.length = 0;
    },
    update(dt, player, onDamage) {
      const target = player.state.pos;
      const inCar = Boolean(player.inCar);
      if (stars > 0) {
        heat = Math.max(0, heat - dt * 0.2);
        spawnTimer -= dt;
        const want = Math.min(3, Math.ceil(stars / 2) + (stars > 3 ? 1 : 0));
        const active = cruisers.filter((c) => c.mesh.visible).length;
        if (active < want && spawnTimer <= 0) {
          spawn(target);
          spawnTimer = 2.4;
        }
      } else {
        heat = 0;
      }

      let seen = false;
      let nearest = Infinity;
      for (const car of cruisers) {
        if (!car.mesh.visible) continue;
        const dx = target.x - car.pos.x;
        const dz = target.z - car.pos.z;
        const dist = Math.hypot(dx, dz);
        nearest = Math.min(nearest, dist);
        if (dist < LAW.loseDistance) seen = true;

        const wantYaw = Math.atan2(dx, dz);
        let diff = wantYaw - car.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const tooClose = dist < 10;
        const throttle = tooClose ? 0.12 : Math.min(1, dist / 22);
        const steer = Math.max(-1, Math.min(1, diff * 1.9));
        car.driver = 'police';
        fleet.drive(car, dt, { throttle, steer, handbrake: false });

        // Flash the bar: red and blue chase each other twice a second.
        car.unit.siren += dt;
        if (car.lights) {
          const flip = Math.sin(car.unit.siren * 12) > 0;
          car.lights.red.emissiveIntensity = flip ? 1.6 : 0.15;
          car.lights.blue.emissiveIntensity = flip ? 0.15 : 1.6;
        }

        if (dist < 30) {
          car.unit.fire -= dt;
          if (car.unit.fire <= 0) {
            car.unit.fire = Math.max(0.55, 1.5 - stars * 0.16);
            if (onDamage) onDamage(inCar ? 3.5 : 5.5, car);
          }
        }
        if (dist > LAW.loseDistance * 1.9 || car.pos.z > 400) {
          car.unit.stuck += dt;
          if (car.unit.stuck > 18) {
            despawn(car);
            car.unit.stuck = 0;
          }
        } else {
          car.unit.stuck = 0;
        }
      }

      if (stars > 0 && !seen) {
        calm -= dt;
        if (calm <= -LAW.loseSeconds) {
          stars -= 1;
          calm = 0;
          events.push('cool');
          if (stars <= 0) {
            for (const car of cruisers) despawn(car);
          }
        }
      } else if (seen) {
        calm = LAW.decaySeconds;
      }

      // Clean getaway: nothing on the map within escape distance and one star falls per
      // held beat. Distance, not the clock, is what the player is buying.
      if (stars > 0 && nearest > LAW.escapeDistance) {
        away += dt;
        if (away >= LAW.escapeSeconds) {
          away = 0;
          stars -= 1;
          calm = LAW.decaySeconds;
          events.push('cool');
          if (stars <= 0) for (const car of cruisers) despawn(car);
        }
      } else {
        away = 0;
      }
    },
  };
}
