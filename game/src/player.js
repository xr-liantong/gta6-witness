// Dani Cruz, on foot and behind the wheel. The body is a handful of boxes with pivots
// for hips and shoulders, which is enough to read as walking, running and aiming.

import * as THREE from 'three';
import { PALETTE, TUNING, WORLD } from './config.js';

function limb(w, h, d, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = true;
  mesh.position.y = -h / 2;
  return mesh;
}

function buildBody() {
  const root = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc58d63 });
  const shirt = new THREE.MeshLambertMaterial({ color: PALETTE.heroShirt });
  const pants = new THREE.MeshLambertMaterial({ color: PALETTE.heroPants });
  const hair = new THREE.MeshLambertMaterial({ color: 0x2a2220 });

  const hips = new THREE.Group();
  hips.position.y = 0.94;
  root.add(hips);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), shirt);
  torso.position.y = 0.3;
  torso.castShadow = true;
  hips.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.29, 0.27), skin);
  head.position.y = 0.78;
  head.castShadow = true;
  hips.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.1, 0.29), hair);
  cap.position.y = 0.94;
  hips.add(cap);

  const legs = [];
  const arms = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.14, 0.02, 0);
    hips.add(hip);
    hip.add(limb(0.17, 0.92, 0.19, pants));
    legs.push(hip);

    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.33, 0.56, 0);
    hips.add(shoulder);
    shoulder.add(limb(0.14, 0.56, 0.15, shirt));
    arms.push(shoulder);
  }

  // A pistol in the right hand, pointed down the street when aiming.
  const gun = new THREE.Group();
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.34), new THREE.MeshLambertMaterial({ color: 0x2a2f36 }));
  slide.position.z = 0.14;
  gun.add(slide);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.08), new THREE.MeshLambertMaterial({ color: 0x1d2228 }));
  grip.position.set(0, -0.1, 0.02);
  gun.add(grip);
  gun.position.set(0.05, -0.5, 0.08);
  gun.rotation.x = Math.PI / 2;
  arms[1].add(gun);

  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9 }),
  );
  flash.position.set(0, 0.02, 0.3);
  flash.visible = false;
  gun.add(flash);

  return { root, hips, legs, arms, gun, flash };
}

export function createPlayer(world, scene) {
  const body = buildBody();
  scene.add(body.root);

  const state = {
    pos: new THREE.Vector3(world.spawn.x, world.groundAt(world.spawn.x, world.spawn.z), world.spawn.z),
    yaw: world.spawn.yaw,
    vel: new THREE.Vector3(),
    onGround: true,
    health: TUNING.healthMax,
    money: 40,
    ammo: 36,
    inCar: null,
    walk: 0,
    aim: false,
    cooldown: 0,
    dead: false,
  };
  const events = [];
  const aimPoint = new THREE.Vector3();
  const boxes = world.buildings.map((b) => ({
    minX: b.x - b.w / 2 - 0.4,
    maxX: b.x + b.w / 2 + 0.4,
    minZ: b.z - b.d / 2 - 0.4,
    maxZ: b.z + b.d / 2 + 0.4,
  }));
  const limit = (world.bounds.max - world.bounds.min) / 2 + 150;

  function pushedOut(p) {
    for (let i = 0; i < boxes.length; i += 1) {
      const b = boxes[i];
      if (p.x < b.minX || p.x > b.maxX || p.z < b.minZ || p.z > b.maxZ) continue;
      const left = p.x - b.minX;
      const right = b.maxX - p.x;
      const back = p.z - b.minZ;
      const front = b.maxZ - p.z;
      const m = Math.min(left, right, back, front);
      if (m === left) p.x = b.minX;
      else if (m === right) p.x = b.maxX;
      else if (m === back) p.z = b.minZ;
      else p.z = b.maxZ;
    }
    p.x = Math.max(-limit, Math.min(limit, p.x));
    p.z = Math.max(-limit, Math.min(WORLD.sea - 1, p.z));
  }

  function poseMesh(dt, moving) {
    body.root.position.set(state.pos.x, state.pos.y, state.pos.z);
    body.root.rotation.y = state.yaw;
    const pace = moving ? Math.min(1.25, Math.hypot(state.vel.x, state.vel.z) / TUNING.run) : 0;
    state.walk += dt * (4 + pace * 8);
    const swing = Math.sin(state.walk) * (0.22 + pace * 0.62);
    body.legs[0].rotation.x = swing;
    body.legs[1].rotation.x = -swing;
    body.arms[0].rotation.x = -swing * 0.8;
    body.arms[1].rotation.x = state.aim ? 1.42 : swing * 0.5;
    body.arms[1].rotation.z = state.aim ? -0.14 : 0;
  }

  function footStep(dt, input, cam) {
    const wish = input.move({ x: 0, y: 0, run: false });
    const speed = wish.run ? TUNING.run : TUNING.walk;
    const fwd = cam.forward();
    const rightX = -fwd.z;
    const rightZ = fwd.x;
    const wantX = (fwd.x * wish.y + rightX * wish.x) * speed;
    const wantZ = (fwd.z * wish.y + rightZ * wish.x) * speed;
    const k = Math.min(1, TUNING.accel * dt);
    state.vel.x += (wantX - state.vel.x) * k;
    state.vel.z += (wantZ - state.vel.z) * k;

    if (Math.hypot(wish.x, wish.y) > 0.05) {
      // Face the camera's forward when aiming, the movement direction otherwise.
      const target = state.aim ? Math.atan2(-fwd.x, -fwd.z) : Math.atan2(-wantX, -wantZ);
      let d = target - state.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      state.yaw += d * Math.min(1, TUNING.turn * dt);
    }

    state.pos.x += state.vel.x * dt;
    state.pos.z += state.vel.z * dt;
    pushedOut(state.pos);

    if (input.tapped('Space') && state.onGround) {
      state.vel.y = TUNING.jump;
      state.onGround = false;
      events.push('jump');
    }
    state.vel.y += TUNING.gravity * dt;
    state.pos.y += state.vel.y * dt;
    const floor = world.groundAt(state.pos.x, state.pos.z);
    if (state.pos.y <= floor) {
      if (!state.onGround && state.vel.y < -6) events.push('land');
      state.pos.y = floor;
      state.vel.y = 0;
      state.onGround = true;
    }

    // Footstep ticks for the audio module, one per half pace.
    const stride = Math.floor(state.walk / Math.PI);
    if (stride !== state.lastStride && Math.hypot(state.vel.x, state.vel.z) > 1.4) {
      state.lastStride = stride;
      events.push('step');
    }
    state.moving = Math.hypot(state.vel.x, state.vel.z) > 0.25;
  }

  function driveStep(dt, input) {
    const car = state.inCar;
    const steer = (input.held('KeyA') ? 1 : 0) - (input.held('KeyD') ? 1 : 0);
    const fwd = (input.held('KeyW') ? 1 : 0) - (input.held('KeyS') ? 1 : 0);
    const controls = {
      throttle: fwd,
      steer,
      handbrake: input.held('Space'),
    };
    const before = car.speed;
    car.driver = 'player';
    car.drive(car, dt, controls);
    if (car.bump > 0.9 && Math.abs(before) > 5) events.push('crash');
    state.pos.copy(car.pos);
    state.yaw = car.yaw;
    body.root.position.set(car.pos.x, 0, car.pos.z);
    body.root.visible = false;
  }

  return {
    state,
    body: body.root,
    get inCar() {
      return state.inCar;
    },
    // Where the camera should look: the chest on foot, a little above the roof in a car.
    aim(out) {
      if (state.inCar) {
        out.set(state.inCar.pos.x, 1.45, state.inCar.pos.z);
        const f = { x: Math.sin(state.inCar.yaw), z: Math.cos(state.inCar.yaw) };
        out.x += f.x * 1.6;
        out.z += f.z * 1.6;
      } else {
        out.set(state.pos.x, state.pos.y + TUNING.eye, state.pos.z);
      }
      return out;
    },
    muzzle(out) {
      if (!state.inCar) {
        out.set(state.pos.x, state.pos.y + 1.3, state.pos.z);
        out.x += -Math.sin(state.yaw) * 0.6;
        out.z += -Math.cos(state.yaw) * 0.6;
      }
      return out;
    },
    enter(fleet) {
      if (state.inCar) return false;
      const car = fleet.nearest(state.pos, 3.6);
      if (!car) return false;
      state.inCar = car;
      car.driver = 'player';
      car.speed = 0;
      body.root.visible = false;
      events.push('enter');
      return true;
    },
    leave() {
      if (!state.inCar) return false;
      const car = state.inCar;
      car.driver = null;
      const side = { x: Math.cos(car.yaw), z: -Math.sin(car.yaw) };
      state.pos.set(car.pos.x + side.x * 2.6, 0, car.pos.z + side.z * 2.6);
      pushedOut(state.pos);
      state.pos.y = world.groundAt(state.pos.x, state.pos.z);
      state.vel.set(0, 0, 0);
      state.inCar = null;
      body.root.visible = true;
      events.push('exit');
      return true;
    },
    fire() {
      if (state.cooldown > 0 || state.inCar || state.ammo <= 0 || state.dead) return false;
      state.ammo -= 1;
      state.cooldown = 0.17;
      body.flash.visible = true;
      events.push('shot');
      return true;
    },
    hurt(amount) {
      if (state.dead) return;
      state.health = Math.max(0, state.health - amount);
      events.push('hurt');
      if (state.health <= 0) {
        state.dead = true;
        state.inCar = null;
        body.root.visible = true;
      }
    },
    heal(amount) {
      state.health = Math.min(TUNING.healthMax, state.health + amount);
    },
    respawn() {
      state.dead = false;
      state.health = TUNING.healthMax;
      state.pos.set(world.spawn.x, world.groundAt(world.spawn.x, world.spawn.z), world.spawn.z);
      state.vel.set(0, 0, 0);
      state.ammo = Math.max(state.ammo, 24);
      state.money = Math.max(0, state.money - 50);
      body.root.visible = true;
    },
    // Called once per frame with the shared input and camera.
    update(dt, input, cam) {
      state.cooldown = Math.max(0, state.cooldown - dt);
      if (body.flash.visible) {
        state.flashLeft = (state.flashLeft || 0.06) - dt;
        if (state.flashLeft <= 0) {
          body.flash.visible = false;
          state.flashLeft = 0.06;
        }
      }
      if (state.dead) {
        body.root.rotation.z = Math.min(0.95, body.root.rotation.z + dt * 3);
        return;
      }
      if (state.inCar) {
        driveStep(dt, input);
        return;
      }
      footStep(dt, input, cam);
      poseMesh(dt, state.moving);
      body.root.rotation.z = 0;
    },
    drain() {
      const out = events.slice();
      events.length = 0;
      return out;
    },
    // The point a shot should be aimed at, for combat and for the HUD crosshair.
    aimPoint,
  };
}
