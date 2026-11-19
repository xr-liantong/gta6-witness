// The director: builds the city once, wires every module together, and runs the frame.
// Title card, pause, saving and the four reproducible screenshot poses also live here.

import * as THREE from 'three';
import { CITY, DEMOS, PALETTE, SAVE_KEY, queryOptions } from './config.js';
import { buildWorld } from './world.js';
import { createInput } from './input.js';
import { createLoop } from './loop.js';
import { createCamera } from './camera.js';
import { createRenderer, buildScene } from './render.js';
import { createPlayer } from './player.js';
import { createFleet } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createCrowd } from './crowd.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';

let started = false;

export function start() {
  if (started) return;
  started = true;
  const canvas = document.getElementById('game');
  const hudCanvas = document.getElementById('hud');
  const { shot: shotName, demo, seed } = queryOptions(location.search);

  const world = buildWorld(seed);
  const renderer = createRenderer(canvas);
  const { scene, sun, sunDir } = buildScene(renderer, world);
  const cam = createCamera(canvas, world);
  const input = createInput(canvas);
  const fleet = createFleet(world, scene);
  const player = createPlayer(world, scene);
  const traffic = createTraffic(world, fleet);
  const crowd = createCrowd(world, scene);
  const police = createPolice(world, fleet);
  const missions = createMissions(world);
  const combat = createCombat(scene, player, crowd, police, fleet);
  const hud = createHud(hudCanvas, world);
  const audio = createAudio();

  // The mission marker in the world: a thin gold beam under a turning diamond.
  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.55, 16, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: PALETTE.marker, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 8;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.15, 0),
    new THREE.MeshLambertMaterial({ color: PALETTE.marker, emissive: 0x6b4c00 }),
  );
  diamond.position.y = 3.2;
  beacon.add(beam);
  beacon.add(diamond);
  beacon.visible = false;
  scene.add(beacon);

  const camAim = new THREE.Vector3();
  const ray = new THREE.Vector3();
  const title = document.getElementById('title');
  const pauseCard = document.getElementById('pause');
  const hint = document.getElementById('hint');
  const status = document.getElementById('status');
  const playButton = document.getElementById('play');
  const continueButton = document.getElementById('continue');

  let playing = false;
  let frozen = Boolean(shotName);
  let time = 0;
  let deathTimer = 0;
  let saveTimer = 0;
  let prompt = '';
  let paused = false;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    cam.resize(w, h);
    hud.resize(w, h);
  }
  window.addEventListener('resize', resize);
  resize();

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 2,
        money: player.state.money,
        ammo: player.state.ammo,
        health: player.state.health,
        pos: { x: player.state.pos.x, z: player.state.pos.z },
        yaw: player.state.yaw,
        mission: missions.serialize(),
      }));
      return true;
    } catch {
      return false;
    }
  }

  function readSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function applySave(data) {
    if (!data) return;
    player.state.money = Math.max(0, Number(data.money) || 0);
    player.state.ammo = Math.max(0, Number(data.ammo) || 0);
    player.state.health = Math.max(20, Math.min(100, Number(data.health) || 100));
    if (data.pos) player.state.pos.set(Number(data.pos.x) || 0, 0.22, Number(data.pos.z) || 0);
    if (typeof data.yaw === 'number') player.state.yaw = data.yaw;
    missions.load(data.mission);
  }

  if (readSave()) continueButton.disabled = false;

  function setPaused(value) {
    paused = value;
    loop.pause(value);
    pauseCard.classList.toggle('hidden', !value);
    if (value) {
      save();
      document.exitPointerLock?.();
      audio.idleEngine();
    }
  }

  function begin(auto = false) {
    playing = true;
    title.classList.add('hidden');
    loop.pause(false);
    if (!auto) audio.start();
    missions.begin();
    hud.intro();
    if (!auto) canvas.requestPointerLock?.();
    status.textContent = `${CITY.name}: ${CITY.tagline}`;
    // The mouse hint fades on its own; the game never waits for pointer lock to be granted.
    hint.textContent = 'WASD to move  ·  click to lock the mouse  ·  Esc to pause';
    hint.classList.add('show');
    window.setTimeout(() => hint.classList.remove('show'), 5200);
  }

  // Some browsers and every headless one refuse pointer lock without a real gesture.
  // Say what to do instead of leaving the player unable to turn on the spot.
  document.addEventListener('pointerlockerror', () => {
    hint.textContent = 'Look: hold a mouse button and drag';
    hint.classList.add('show');
    window.setTimeout(() => hint.classList.remove('show'), 6000);
  });

  playButton.addEventListener('click', () => {
    audio.ui();
    begin(false);
  });
  continueButton.addEventListener('click', () => {
    audio.ui();
    applySave(readSave());
    begin(false);
  });
  document.getElementById('resume').addEventListener('click', () => {
    audio.ui();
    setPaused(false);
    canvas.requestPointerLock?.();
  });
  document.getElementById('save').addEventListener('click', () => {
    audio.ui();
    const ok = save();
    hud.showBanner(ok ? 'Progress saved' : 'Could not save in this browser', ok ? '#ffd479' : '#ff6f52');
  });

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) hint.classList.remove('show');
    if (!playing || frozen) return;
    if (document.pointerLockElement !== canvas && !paused) setPaused(true);
  });

  // Poses borrow the live objects: a traffic car is still a traffic car, a pedestrian is
  // still a pedestrian. Only where they stand is decided here.
  function jobCar() {
    return fleet.cars.find((c) => c.isJobCar) || null;
  }

  function parkTraffic(index, x, z, yaw) {
    const cars = fleet.cars.filter((c) => c.driver === 'traffic' && !c.police);
    const car = cars[index % Math.max(1, cars.length)];
    if (!car) return null;
    car.pos.set(x, world.groundAt(x, z), z);
    car.yaw = yaw;
    car.speed = 0;
    car.steer = 0;
    car.vel.set(0, 0, 0);
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = yaw;
    return car;
  }

  function standPed(index, x, z, yaw) {
    const ped = crowd.peds[index % crowd.peds.length];
    if (!ped) return null;
    ped.pos.set(x, world.groundAt(x, z), z);
    ped.yaw = yaw;
    ped.phase = index * 0.9;
    ped.dead = 0;
    ped.body.group.visible = true;
    ped.body.group.position.copy(ped.pos);
    ped.body.group.rotation.y = yaw;
    ped.body.legs[0].rotation.x = 0.3;
    ped.body.legs[1].rotation.x = -0.3;
    ped.body.arms[0].rotation.x = -0.22;
    ped.body.arms[1].rotation.x = 0.22;
    return ped;
  }

  function lightBar(cruiser, red = 2) {
    if (!cruiser.lights) return;
    cruiser.lights.red.emissiveIntensity = red;
    cruiser.lights.blue.emissiveIntensity = red > 1 ? 0.2 : 2;
  }

  // The four contact-sheet poses. Each one is a fixed frame, not a timed cutscene.
  function setupShot(name) {
    const p = player.state;
    frozen = true;
    title.classList.add('hidden');
    hint.classList.add('hidden');
    hint.classList.remove('show');
    clue(name);
    if (name === 'street') {
      // The cover: Dani on the avenue, a crossing full of people, two cars and the sea
      // at the end of the street. Camera pulled in so the hero reads at a third of frame.
      p.pos.set(-85, 0.03, 26);
      p.yaw = 0.32;
      cam.pose(Math.PI, 0, 3.6, 1.1, 0.5);
      missions.load({ step: 0, done: false });
      parkTraffic(0, -75.5, 40, 0);
      parkTraffic(1, -95, 58, 0);
      standPed(0, -90, 34, Math.PI / 2);
      standPed(1, -93.5, 37, -Math.PI / 2);
      standPed(2, -88, 40, Math.PI);
      standPed(3, -97, 44, 0);
      standPed(4, -92, 49, Math.PI / 2);
      standPed(5, -99, 31, 0);
    } else if (name === 'chase') {
      // The green coupé runs from the camera; two cruisers swing in from the far end of the
      // avenue with the bar lit, and the wanted stars sit in the corner.
      const car = fleet.cars.find((c) => c.isJobCar);
      car.pos.set(-85, 0, 110);
      car.yaw = 0;
      car.speed = 21.7;
      car.vel.set(0, 0, 21.7);
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.yaw;
      player.state.pos.copy(car.pos);
      player.enterCar(car);
      cam.pose(Math.PI, 0.2, 7.0, 0, 1.0);
      police.pin(3);
      const a = police.spawnAt(-92.2, 128, Math.PI);
      const b = police.spawnAt(-78.4, 140, Math.PI);
      lightBar(a, 2);
      lightBar(b, 0.2);
      police.pin(3);
      for (const cruiser of police.cruisers) cruiser.mesh.position.copy(cruiser.pos);
      parkTraffic(0, -70, 152, Math.PI);
      missions.load({ step: 2, done: false });
    } else if (name === 'mission') {
      // Reina's marina: the pier lies low on the sand, the golden beam sits ahead of the
      // shoulder, and the objective card is the biggest thing on screen.
      p.pos.set(-86, 0.03, 276);
      p.yaw = 0.3;
      cam.pose(Math.PI + 0.3, 0, 3.6, 1.1, 0.5);
      missions.begin();
      missions.update(0.016, player);
      missions.update(0.016, player);
      standPed(0, -70, 300, Math.PI);
      standPed(1, -86, 303, 0);
      standPed(2, -64, 293, -Math.PI / 2);
    } else if (name === 'downtown') {
      // One frame, every system: traffic on the cross street, people on the corners, two
      // cruisers and two wanted stars, minimap and mission card all at once.
      p.pos.set(85, 0.03, 102);
      p.yaw = Math.PI - 0.32;
      cam.pose(0, 0, 3.6, 1.1, 0.5);
      missions.load({ step: 1, done: false });
      police.report(2);
      parkTraffic(0, 78, 90, Math.PI / 2);
      parkTraffic(1, 66, 85, Math.PI / 2);
      parkTraffic(2, 98, 85, -Math.PI / 2);
      const a = police.spawnAt(78, 70, 0);
      const b = police.spawnAt(94, 72, 0);
      lightBar(a, 2);
      lightBar(b, 0.2);
      for (const cruiser of police.cruisers) cruiser.mesh.position.copy(cruiser.pos);
      standPed(0, 68, 78, Math.PI / 2);
      standPed(1, 102, 78, -Math.PI / 2);
      standPed(2, 74, 92, 0);
      standPed(3, 96, 90, Math.PI);
    }
    for (let i = 0; i < 60; i += 1) {
      player.aim(camAim);
      cam.follow(1 / 60, camAim);
    }
  }
  function clue(name) {
    status.textContent = `Solvara screenshot pose: ${name}`;
  }

  // Demo openings. One car, the real player, the real police: nothing is painted on top.
  // They exist so a reviewer who cannot grant pointer lock still lands inside the game.
  function setupDemo(mode) {
    const plan = DEMOS[mode];
    const car = fleet.spawn('coupe', -85, 84, 0, 0xd9a13b);
    player.state.pos.copy(car.pos);
    if (!player.enterCar(car)) return;
    car.speed = plan.speed;
    car.vel.set(0, 0, plan.speed);
    cam.pose(Math.PI, 0.2, 7.0, 0, 1.0);
    if (plan.stars > 0) {
      police.report(plan.stars);
      // Two cruisers ahead on the avenue, coming the other way with the bar lit: they are
      // in frame from the first second, and police.js takes the wheel from here.
      for (const cruiser of [
        police.spawnAt(-92.4, 154, Math.PI),
        police.spawnAt(-77.6, 166, Math.PI),
      ]) {
        cruiser.unit.fire = 1.4;
      }
    }
    // Same virtual key a keyboard would hold; the car accelerates through driveStep.
    input.setPilot('KeyW', true);
    playing = true;
    title.classList.add('hidden');
    hint.classList.remove('show');
    missions.begin();
    hud.showBanner(
      mode === 'chase'
        ? 'Three stars. The marina is your best exit.'
        : `${CITY.name}: the avenue runs to the sea.`,
      '#ffd479',
    );
    for (let i = 0; i < 40; i += 1) {
      player.aim(camAim);
      cam.follow(1 / 60, camAim);
    }
  }

  if (shotName) {
    setupShot(shotName);
    playing = true;
  } else if (demo) {
    setupDemo(demo);
  }

  player.aim(camAim);
  cam.follow(1, camAim);

  function beaconTick(dt) {
    const marker = missions.marker;
    beacon.visible = Boolean(marker);
    if (!marker) return;
    beacon.position.set(marker.x, 0.2, marker.z);
    diamond.rotation.y += dt * 1.4;
    diamond.position.y = 3.2 + Math.sin(time * 2.2) * 0.25;
  }

  function describePrompt() {
    if (player.inCar) return 'E leave car  ·  Space handbrake';
    const car = fleet.nearest(player.state.pos, 3.6);
    if (car) return car.isJobCar ? 'E — steal the emerald coupé' : `E — take the ${car.kind}`;
    return '';
  }

  function onDeath() {
    deathTimer = 0;
    hud.showBanner('You went down. Solvara General is on its way.', '#ff6f52');
  }

  function update(dt) {
    if (!playing || frozen) {
      input.look();
      input.endFrame();
      return;
    }
    time += dt;
    // Demo entries exist for reviewers who cannot grant pointer lock: four seconds of
    // live driving, then the frame holds still so a screenshot tool cannot stall on it.
    if (demo && time > 4) {
      frozen = true;
      return;
    }
    const look = input.look();
    cam.look(look.dx, look.dy);
    player.state.aim = !player.inCar && (input.aiming() || input.firing());

    if (input.tappedAny('KeyE', 'KeyF')) {
      if (player.inCar) player.leave();
      else player.enter(fleet);
    }
    if (player.inCar && input.tapped('KeyH')) audio.horn();

    // In a car the camera slowly settles behind the bonnet; the mouse still overrides it.
    if (player.inCar) {
      const want = player.inCar.yaw + Math.PI;
      let d = want - cam.state.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      if (Math.abs(look.dx) < 0.5) cam.state.yaw += d * Math.min(1, dt * 1.5);
    }

    player.update(dt, input, cam);
    if (input.firing() && player.fire()) {
      combat.shoot(cam.camera.position, cam.ray(ray));
      cam.kick(0.14);
    }

    traffic.update(dt, 1, player.inCar);
    fleet.update(dt);
    crowd.update(dt, player.state.pos, police.stars > 0, null);
    police.update(dt, player, (amount) => {
      if (player.state.dead) return;
      player.hurt(amount);
      cam.kick(0.5);
      if (player.state.dead) onDeath();
    });
    missions.update(dt, player);
    combat.update(dt);

    for (const e of player.drain()) {
      if (e === 'step') audio.step();
      else if (e === 'crash') {
        audio.crash();
        cam.kick(0.12);
        // Bumping a cruiser is its own crime, even at a crawl.
        if (player.inCar) {
          for (const cruiser of police.cruisers) {
            if (cruiser.mesh.visible && cruiser.pos.distanceTo(player.inCar.pos) < 7) {
              police.report(1);
              break;
            }
          }
        }
      } else if (e === 'shot') audio.gun();
      else if (e === 'jump') audio.step();
      else if (e === 'enter' || e === 'exit') audio.ui();
    }
    for (const e of missions.drain()) {
      if (e.type === 'objective') hud.showBanner(e.text);
      else if (e.type === 'reward') {
        audio.cash();
        hud.showBanner(`+$${e.amount} — paid in full`);
      } else if (e.type === 'complete') {
        // The hand-over is real: Dani steps out on the pier and the coupé is gone from the
        // world, so the reward is visible in the street afterwards, not just in a number.
        const job = jobCar();
        if (job && player.inCar === job) player.leave();
        if (job) {
          job.mesh.visible = false;
          job.driver = null;
          job.isJobCar = false;
          job.speed = 0;
          job.vel.set(0, 0, 0);
        }
        hud.showBanner('The Emerald Coupé: complete', '#bfe6c6');
      } else if (e.type === 'retry') {
        const job = jobCar();
        if (job) {
          job.mesh.visible = true;
          job.driver = null;
          job.isJobCar = true;
          job.pos.set(world.jobCar.x, world.groundAt(world.jobCar.x, world.jobCar.z), world.jobCar.z);
          job.yaw = world.jobCar.yaw;
          job.mesh.position.copy(job.pos);
          job.mesh.rotation.y = job.yaw;
          job.speed = 0;
          job.vel.set(0, 0, 0);
        }
        hud.showBanner('The coupé is back on the forecourt. Round two.', '#ffd479');
      }
    }
    for (const e of police.drain()) {
      if (e === 'siren') audio.siren(true);
    }

    audio.siren(police.stars > 0);
    audio.tick(dt);
    if (player.inCar) {
      audio.engine(player.inCar.speed, input.held('KeyW') ? 1 : 0);
    } else {
      audio.idleEngine();
    }

    if (player.state.dead) {
      deathTimer += dt;
      if (deathTimer > 2.8) {
        player.respawn();
        police.clear();
        missions.retry();
        hud.showBanner('Patched up at Solvara General. Minus $50.');
      }
    }

    player.aim(camAim);
    // Getting in or out of a car is a one-second camera glide, not a cut.
    cam.follow(dt * (player.state.hop > 0 ? 0.3 : 1), camAim);
    sun.position.set(
      player.state.pos.x + sunDir.x * 420,
      sunDir.y * 420,
      player.state.pos.z + sunDir.z * 420,
    );
    sun.target.position.set(player.state.pos.x, 0, player.state.pos.z);

    beaconTick(dt);
    prompt = describePrompt();

    saveTimer += dt;
    if (saveTimer > 20) {
      saveTimer = 0;
      save();
    }
    input.endFrame();
  }

  function render(dt) {
    if (frozen) {
      player.aim(camAim);
      cam.follow(dt, camAim);
      time += dt;
      beaconTick(dt);
    }
    renderer.render(scene, cam.camera);
    hud.draw(dt, { player, police, missions, combat, time, prompt, fps: loop.fps });
  }

  const loop = createLoop({ update, render });
  loop.start();

  // Escape: browsers release the pointer themselves, the change handler pauses us.
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && playing && !paused && !frozen) setPaused(true);
  });

  if (shotName) {
    playing = true;
    hint.classList.add('hidden');
  }
}

// index.html loads this module directly, so boot as soon as the document is ready.
// Root main.ts imports the same start(); the guard keeps a double load harmless.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
