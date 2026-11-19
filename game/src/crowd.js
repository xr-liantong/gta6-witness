// People. They walk the block perimeters, gather on the promenade and scatter when the
// guns come out. Simple bodies, simple schedules; the point is that the streets are alive.

import * as THREE from 'three';
import { PALETTE } from './config.js';

const SHIRTS = [0xf4f0e6, 0xd9543c, 0x3f6f9f, 0xe0b33c, 0x7fa86b, 0xb2506a, 0x5c6470];
const SKINS = [0xc58d63, 0x9a6b49, 0xe0b090, 0x6f4a34];

function makePed(shirt, skin) {
  const group = new THREE.Group();
  const cloth = new THREE.MeshLambertMaterial({ color: shirt });
  const flesh = new THREE.MeshLambertMaterial({ color: skin });
  const pants = new THREE.MeshLambertMaterial({ color: 0x36414c });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.56, 0.26), cloth);
  torso.position.y = 1.28;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.24), flesh);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);

  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.11, 1.0, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.0, 0.16), pants);
    leg.position.y = -0.5;
    leg.castShadow = true;
    pivot.add(leg);
    group.add(pivot);
    legs.push(pivot);
  }
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.28, 1.5, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.58, 0.13), cloth);
    arm.position.y = -0.29;
    pivot.add(arm);
    group.add(pivot);
    arms.push(pivot);
  }
  return { group, legs, arms };
}

export function createCrowd(world, scene) {
  const peds = [];
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Block-walkers: clockwise or anti-clockwise around one pavement ring.
  for (const path of world.pedPaths) {
    for (let i = 0; i < 3; i += 1) {
      const body = makePed(SHIRTS[Math.floor(rand() * SHIRTS.length)], SKINS[Math.floor(rand() * SKINS.length)]);
      scene.add(body.group);
      peds.push({
        body,
        kind: 'block',
        path,
        u: rand(),
        dir: rand() < 0.5 ? 1 : -1,
        speed: 1.05 + rand() * 0.5,
        phase: rand() * 6.28,
        pos: new THREE.Vector3(),
        yaw: 0,
        dead: 0,
        home: rand(),
        flee: 0,
      });
    }
  }
  // Promenade strollers, walking the length of the beach.
  for (let i = 0; i < 9; i += 1) {
    const body = makePed(SHIRTS[Math.floor(rand() * SHIRTS.length)], SKINS[Math.floor(rand() * SKINS.length)]);
    scene.add(body.group);
    peds.push({
      body,
      kind: 'beach',
      x: -240 + i * 56 + rand() * 20,
      z: 286 + rand() * 8,
      dir: rand() < 0.5 ? 1 : -1,
      speed: 0.9 + rand() * 0.5,
      phase: rand() * 6.28,
      pos: new THREE.Vector3(),
      yaw: 0,
      dead: 0,
      flee: 0,
      home: 0,
    });
  }

  function perimeter(path, u) {
    const p = path.points;
    const side = u * 4;
    const i = Math.floor(side) % 4;
    const f = side - Math.floor(side);
    const a = p[i];
    const b = p[(i + 1) % 4];
    return {
      x: a.x + (b.x - a.x) * f,
      z: a.z + (b.z - a.z) * f,
      angle: Math.atan2(b.x - a.x, b.z - a.z),
    };
  }

  function place(ped, dt) {
    if (ped.kind === 'block') {
      ped.u = (ped.u + (ped.dir * ped.speed * dt) / (world.blocks[0].w * 4) + 1) % 1;
      const at = perimeter(ped.path, ped.u);
      ped.pos.set(at.x, 0.22, at.z);
      ped.yaw = at.angle + (ped.dir > 0 ? 0 : Math.PI);
    } else {
      ped.x += ped.dir * ped.speed * dt;
      if (ped.x > 262) { ped.x = 262; ped.dir = -1; }
      if (ped.x < -262) { ped.x = -262; ped.dir = 1; }
      ped.pos.set(ped.x, 0.22, ped.z);
      ped.yaw = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  function aimAt(ped, playerPos) {
    // Running away: face the opposite way and pick up the pace.
    ped.yaw = Math.atan2(ped.pos.x - playerPos.x, ped.pos.z - playerPos.z);
    ped.pos.x += (ped.pos.x - playerPos.x) * 0.6 * 0.06;
    ped.pos.z += (ped.pos.z - playerPos.z) * 0.6 * 0.06;
  }

  // Put everyone where they belong before the first frame: the frozen screenshot poses
  // never run update(), and a pavement full of pedestrians is exactly what they show.
  for (const ped of peds) {
    place(ped, 0);
    ped.body.group.position.set(ped.pos.x, ped.pos.y, ped.pos.z);
    ped.body.group.rotation.y = ped.yaw;
  }

  return {
    peds,
    update(dt, playerPos, alarm, aimPoint) {
      for (const ped of peds) {
        if (ped.dead > 0) {
          ped.dead -= dt;
          ped.body.group.rotation.z = Math.min(1.5, ped.body.group.rotation.z + dt * 4);
          if (ped.dead <= 0) {
            ped.body.group.rotation.z = 0;
            ped.body.group.visible = true;
            ped.u = ped.home;
          }
          continue;
        }
        const distance = Math.hypot(ped.pos.x - playerPos.x, ped.pos.z - playerPos.z);
        const scared = alarm && distance < 34;
        if (scared) {
          aimAt(ped, playerPos);
          const run = 2.6;
          ped.pos.x += (ped.pos.x - playerPos.x) / (distance || 1) * run * dt;
          ped.pos.z += (ped.pos.z - playerPos.z) / (distance || 1) * run * dt;
          ped.pos.y = 0.22;
          ped.speed = 2.2;
        } else {
          ped.speed = ped.kind === 'beach' ? 0.9 : 1.1;
          place(ped, dt);
        }
        ped.phase += dt * (scared ? 12 : 5.2);
        const swing = Math.sin(ped.phase) * (scared ? 0.9 : 0.45);
        ped.body.legs[0].rotation.x = swing;
        ped.body.legs[1].rotation.x = -swing;
        ped.body.arms[0].rotation.x = -swing * 0.7;
        ped.body.arms[1].rotation.x = swing * 0.7;
        ped.body.group.position.set(ped.pos.x, ped.pos.y + Math.abs(Math.sin(ped.phase)) * 0.03, ped.pos.z);
        ped.body.group.rotation.y = ped.yaw;
        if (aimPoint) aimPoint.set(ped.pos.x, 1.3, ped.pos.z);
      }
    },
    // First person in front of the muzzle within range; the hit point is returned too.
    shoot(origin, dir, maxDist) {
      let best = null;
      let bestT = maxDist;
      for (const ped of peds) {
        if (ped.dead > 0) continue;
        const cx = ped.pos.x - origin.x;
        const cz = ped.pos.z - origin.z;
        const along = cx * dir.x + cz * dir.z;
        if (along < 0 || along > bestT) continue;
        const side = Math.abs(cx * dir.z - cz * dir.x);
        if (side > 0.55) continue;
        const height = 1.2 - origin.y;
        if (Math.abs(height) > 1.2 && Math.abs(dir.y) < 0.2) continue;
        best = ped;
        bestT = along;
      }
      if (!best) return null;
      best.dead = 18;
      best.body.arms[0].rotation.z = 2.2;
      best.body.arms[1].rotation.z = -2.2;
      return {
        ped: best,
        point: {
          x: origin.x + dir.x * bestT,
          y: origin.y + dir.y * bestT,
          z: origin.z + dir.z * bestT,
        },
      };
    },
    alert() {
      for (const ped of peds) ped.phase += 0.4;
    },
  };
}
