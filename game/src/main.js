// The director: builds the city once, wires every module together, and runs the frame.
// Title card, pause, saving and the four reproducible screenshot poses also live here.

import * as THREE from 'three';
import { CITY, PALETTE, SAVE_KEY, SHOTS } from './config.js';
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
  const params = new URLSearchParams(location.search);
  const shotName = SHOTS[params.get('shot')] ? params.get('shot') : null;
  const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;

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
    new THREE.CylinderGeometry(0.55, 1.1, 16, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: PALETTE.marker, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
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
    hint.classList.add('hidden');
    loop.pause(false);
    if (!auto) audio.start();
    missions.begin();
    hud.intro();
    if (!auto) canvas.requestPointerLock?.();
    status.textContent = `${CITY.name}: ${CITY.tagline}`;
  }

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
    if (!playing || frozen) return;
    if (document.pointerLockElement !== canvas && !paused) setPaused(true);
  });

  // The four contact-sheet poses. Each one is a fixed frame, not a timed cutscene.
  function setupShot(name) {
    const p = player.state;
    frozen = true;
    title.classList.add('hidden');
    hint.classList.add('hidden');
    clue(name);
    if (name === 'street') {
      // La Marina's avenue: stand on the centre line and look down the canyon of towers.
      p.pos.set(-85, 0.03, 132);
      p.yaw = Math.PI;
      cam.pose(0, 0.15);
      missions.load({ step: 0, done: false });
    } else if (name === 'chase') {
      const car = fleet.cars.find((c) => c.isJobCar);
      car.pos.set(-70, 0, 85);
      car.yaw = Math.PI / 2;
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.yaw;
      player.state.pos.copy(car.pos);
      player.enter(fleet);
      car.speed = 19;
      car.vel.set(19, 0, 0);
      cam.pose(-Math.PI / 2, 0.17);
      police.report(3);
      const a = police.spawnAt(-18, 82, -Math.PI / 2);
      const b = police.spawnAt(4, 89, -Math.PI / 2 + 0.2);
      for (const cruiser of [a, b]) {
        cruiser.mesh.position.copy(cruiser.pos);
        cruiser.mesh.rotation.y = cruiser.yaw;
        if (cruiser.lights) {
          cruiser.lights.red.emissiveIntensity = 2;
          cruiser.lights.blue.emissiveIntensity = 0.2;
        }
      }
      missions.load({ step: 2, done: false });
    } else if (name === 'mission') {
      p.pos.set(-78, 0.22, 276);
      p.yaw = Math.PI;
      cam.pose(Math.PI, 0.1);
      missions.begin();
      missions.update(0.016, player);
      missions.update(0.016, player);
    } else if (name === 'beach') {
      p.pos.set(-24, 0.22, 291);
      p.yaw = Math.PI;
      cam.pose(Math.PI, 0.08);
    }
    for (let i = 0; i < 60; i += 1) {
      player.aim(camAim);
      cam.follow(1 / 60, camAim);
    }
  }
  function clue(name) {
    status.textContent = `Solvara screenshot pose: ${name}`;
  }

  if (shotName) {
    setupShot(shotName);
    playing = true;
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
      else if (e === 'crash') audio.crash();
      else if (e === 'shot') audio.gun();
      else if (e === 'jump') audio.step();
      else if (e === 'enter' || e === 'exit') audio.ui();
    }
    for (const e of missions.drain()) {
      if (e.type === 'objective') hud.showBanner(e.text);
      else if (e.type === 'reward') {
        audio.cash();
        hud.showBanner(`+$${e.amount} — paid in full`);
      } else if (e.type === 'complete') {
        hud.showBanner('The Emerald Coupé: complete', '#bfe6c6');
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
        hud.showBanner('Patched up at Solvara General. Minus $50.');
      }
    }

    player.aim(camAim);
    cam.follow(dt, camAim);
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
