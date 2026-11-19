// Third-person rig: the mouse aims, the boom trails the body with a little lag, and a
// short ray keeps the lens out of towers and out of the pavement.

import * as THREE from 'three';
import { TUNING } from './config.js';

export function createCamera(canvas, world) {
  const camera = new THREE.PerspectiveCamera(
    62,
    (canvas.clientWidth || 16) / (canvas.clientHeight || 9),
    0.12,
    1800,
  );
  const state = { yaw: 0, pitch: 0.14, dist: TUNING.camBack, shake: 0 };
  const pivot = new THREE.Vector3(0, 2, 0);
  const want = new THREE.Vector3();
  const position = new THREE.Vector3();
  const offset = new THREE.Vector3();

  // Towers, grown by a hand's width: the boom may not pass through these boxes.
  const solids = world.buildings.map((b) => ({
    minX: b.x - b.w / 2 - 0.5,
    maxX: b.x + b.w / 2 + 0.5,
    minZ: b.z - b.d / 2 - 0.5,
    maxZ: b.z + b.d / 2 + 0.5,
    top: b.h + 0.4,
  }));

  function blocked(x, y, z) {
    if (y < 0.45) return true;
    for (let i = 0; i < solids.length; i += 1) {
      const s = solids[i];
      if (x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ && y < s.top) return true;
    }
    return false;
  }

  function look(dx, dy) {
    state.yaw -= dx * TUNING.mouse;
    state.pitch = Math.max(TUNING.pitchMin, Math.min(TUNING.pitchMax, state.pitch + dy * TUNING.mouse));
  }

  // A small impulse for gunfire and hard landings; decays on its own.
  function kick(amount) {
    state.shake = Math.min(1, state.shake + amount);
  }

  function follow(dt, aim) {
    pivot.lerp(aim, Math.min(1, dt * TUNING.camLag));
    const cp = Math.cos(state.pitch);
    const d = state.dist;
    offset.set(Math.sin(state.yaw) * cp, Math.sin(state.pitch), Math.cos(state.yaw) * cp).multiplyScalar(d);
    want.set(
      pivot.x + offset.x,
      pivot.y + 1.15 + offset.y * 0.95,
      pivot.z + offset.z,
    );
    if (want.y < 0.9) want.y = 0.9;

    // March from the shoulder to the wanted lens; stop at the first solid thing.
    let t = 1;
    for (let i = 1; i <= 10; i += 1) {
      const k = i / 10;
      if (blocked(
        pivot.x + (want.x - pivot.x) * k,
        pivot.y + (want.y - pivot.y) * k,
        pivot.z + (want.z - pivot.z) * k,
      )) {
        t = Math.max(0.22, (i - 1) / 10);
        break;
      }
    }
    position.set(
      pivot.x + (want.x - pivot.x) * t,
      pivot.y + (want.y - pivot.y) * t,
      pivot.z + (want.z - pivot.z) * t,
    );

    state.shake = Math.max(0, state.shake - dt * 1.9);
    if (state.shake > 0.001) {
      const s = state.shake * state.shake * 0.5;
      position.x += (Math.random() - 0.5) * s;
      position.y += (Math.random() - 0.5) * s;
    }
    camera.position.copy(position);
    camera.lookAt(pivot.x, pivot.y + 0.35, pivot.z);
  }

  return {
    camera,
    state,
    look,
    kick,
    follow,
    get yaw() { return state.yaw; },
    set yaw(v) { state.yaw = v; },
    // Screenshot poses need an exact angle, not a nudge.
    pose(yaw, pitch = state.pitch) {
      state.yaw = yaw;
      state.pitch = Math.max(TUNING.pitchMin, Math.min(TUNING.pitchMax, pitch));
    },
    // Ground-plane direction the lens points at; movement "forward" follows it.
    forward() {
      return { x: -Math.sin(state.yaw), z: -Math.cos(state.yaw) };
    },
    // Point a shot from the lens through the crosshair.
    ray(out) {
      return out.set(
        -Math.sin(state.yaw) * Math.cos(state.pitch),
        -Math.sin(state.pitch),
        -Math.cos(state.yaw) * Math.cos(state.pitch),
      ).normalize();
    },
    resize(w, h) {
      camera.aspect = w / (h || 1);
      camera.updateProjectionMatrix();
    },
  };
}
