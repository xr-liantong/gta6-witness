// Cars: arcade physics with a long/lateral split, so the tail steps out when you lift
// off the throttle; plus the fleet of parked cars you can steal and the shared bodywork
// the police and traffic borrow.

import * as THREE from 'three';
import { BODIES, makeVehicleMesh } from './vehicle-mesh.js';
import { WORLD } from './config.js';

const DRIVE = {
  accel: 14.5,
  brake: 22,
  reverse: 7,
  maxSpeed: 31,
  maxReverse: 9,
  drag: 0.55,
  turnRate: 1.9,
  grip: 0.84,
  driftGrip: 0.965,
};

const PAINTS = [0x2f8f8a, 0xd4623c, 0xe8e4da, 0x37506b, 0xe0b33c, 0x8c93a1, 0xb8455b, 0x7fa86b];

function makeCar(kind, paint, options = {}) {
  const def = BODIES[kind] || BODIES.sedan;
  const built = makeVehicleMesh(def, paint, options);
  return {
    kind,
    def,
    paint,
    mesh: built.group,
    wheels: built.wheels,
    front: built.front,
    lights: built.lights,
    pos: new THREE.Vector3(0, 0, 0),
    yaw: 0,
    vel: new THREE.Vector3(),
    speed: 0,
    steer: 0,
    driver: null,
    police: Boolean(options.police),
    radius: def.length * 0.46,
    spin: 0,
    bump: 0,
  };
}

export function createFleet(world, scene) {
  const cars = [];
  let paintIndex = 0;

  function add(kind, x, z, yaw, paint, options) {
    const car = makeCar(kind, paint ?? PAINTS[paintIndex % PAINTS.length], options);
    paintIndex += 1;
    car.pos.set(x, world.groundAt(x, z), z);
    car.yaw = yaw;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = yaw;
    scene.add(car.mesh);
    cars.push(car);
    return car;
  }

  for (const bay of world.parked) {
    add(bay.kind, bay.x, bay.z, bay.yaw);
  }
  // The job car: unmistakable green, parked across the hotel forecourt.
  const job = add('coupe', world.jobCar.x, world.jobCar.z, world.jobCar.yaw, 0x1f7f5f);
  job.isJobCar = true;

  const boxes = world.buildings.map((b) => ({
    minX: b.x - b.w / 2,
    maxX: b.x + b.w / 2,
    minZ: b.z - b.d / 2,
    maxZ: b.z + b.d / 2,
  }));

  const limitX = (world.bounds.max - world.bounds.min) / 2 + 120;
  const limitZ = WORLD.sea - 10;

  // Four corners of the hull tested against the towers' footprints.
  function hitBuildings(car) {
    const half = car.def.length / 2;
    const side = car.def.width / 2;
    const sin = Math.sin(car.yaw);
    const cos = Math.cos(car.yaw);
    let hit = false;
    for (const sz of [-1, 1]) {
      for (const sx of [-1, 1]) {
        const px = car.pos.x + sin * half * sz + cos * side * sx;
        const pz = car.pos.z + cos * half * sz - sin * side * sx;
        for (let i = 0; i < boxes.length; i += 1) {
          const b = boxes[i];
          if (px < b.minX || px > b.maxX || pz < b.minZ || pz > b.maxZ) continue;
          hit = true;
          const left = px - b.minX;
          const right = b.maxX - px;
          const back = pz - b.minZ;
          const front = b.maxZ - pz;
          const m = Math.min(left, right, back, front);
          if (m === left) car.pos.x -= m + 0.02;
          else if (m === right) car.pos.x += m + 0.02;
          else if (m === back) car.pos.z -= m + 0.02;
          else car.pos.z += m + 0.02;
        }
      }
    }
    return hit;
  }

  function hitCars(car) {
    let hit = null;
    for (const other of cars) {
      if (other === car || other.driver === 'traffic') continue;
      const dx = car.pos.x - other.pos.x;
      const dz = car.pos.z - other.pos.z;
      const min = car.radius + other.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 > min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      car.pos.x += (dx / d) * (min - d);
      car.pos.z += (dz / d) * (min - d);
      car.vel.multiplyScalar(-0.22);
      car.speed *= -0.22;
      hit = other;
      break;
    }
    return hit;
  }

  function drive(car, dt, controls) {
    const sin = Math.sin(car.yaw);
    const cos = Math.cos(car.yaw);
    let vLong = car.vel.x * sin + car.vel.z * cos;
    let vLat = car.vel.x * cos - car.vel.z * sin;

    const throttle = controls.throttle || 0;
    if (throttle > 0) vLong += DRIVE.accel * throttle * dt;
    else if (throttle < 0) vLong += (vLong > 0.6 ? -DRIVE.brake : -DRIVE.reverse) * dt;
    vLong -= vLong * DRIVE.drag * dt;
    vLong = Math.max(-DRIVE.maxReverse, Math.min(DRIVE.maxSpeed, vLong));

    const grip = controls.handbrake ? DRIVE.driftGrip : DRIVE.grip;
    vLat *= Math.pow(grip, dt * 60);

    const authority = Math.min(1, Math.abs(vLong) / 6.5);
    car.yaw += (controls.steer || 0) * DRIVE.turnRate * authority * (vLong < 0 ? -1 : 1) * dt;

    car.vel.x = sin * vLong + cos * vLat;
    car.vel.z = cos * vLong - sin * vLat;
    car.pos.x += car.vel.x * dt;
    car.pos.z += car.vel.z * dt;
    car.speed = vLong;
    car.steer = controls.steer || 0;

    let hit = hitBuildings(car);
    if (hitCars(car)) hit = true;
    if (hit) {
      car.vel.multiplyScalar(-0.25);
      car.speed *= -0.25;
      car.bump = 1;
    }
    if (car.pos.x < -limitX || car.pos.x > limitX) {
      car.pos.x = Math.max(-limitX, Math.min(limitX, car.pos.x));
      car.vel.x *= -0.3;
    }
    if (car.pos.z > limitZ) {
      car.pos.z = limitZ;
      car.vel.z *= -0.3;
      car.speed *= 0.4;
    }

    car.pos.y = world.groundAt(car.pos.x, car.pos.z);
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.yaw;
    car.spin += vLong * dt * 2.6;
    for (const w of car.wheels) w.rotation.x = car.spin;
    for (const w of car.front) w.rotation.y = car.steer * 0.42;
    if (car.bump > 0) car.bump = Math.max(0, car.bump - dt * 2.5);
  }

  return {
    cars,
    drive,
    spawn(kind, x, z, yaw, paint, options) {
      return add(kind, x, z, yaw, paint, options);
    },
    // Nearest car within reach of a door — but never a traffic car or a cruiser.
    nearest(point, reach = 3.6) {
      let best = null;
      let bestDist = reach;
      for (const car of cars) {
        if (car.driver === 'player' || car.driver === 'traffic' || car.police) continue;
        const d = Math.hypot(car.pos.x - point.x, car.pos.z - point.z);
        if (d < bestDist) {
          bestDist = d;
          best = car;
        }
      }
      return best;
    },
    update(dt) {
      for (const car of cars) {
        if (car.driver === 'player' || car.driver === 'traffic' || car.police) continue;
        if (Math.abs(car.speed) > 0.01) drive(car, dt, { throttle: 0, steer: 0, handbrake: true });
      }
    },
    tuning: DRIVE,
  };
}
