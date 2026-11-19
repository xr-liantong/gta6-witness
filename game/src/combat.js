// Gunplay: a hitscan shot, a tracer that lives for a blink, sparks where it lands, and
// the consequences — money from a dropped wallet, heat from the city.

import * as THREE from 'three';

export function createCombat(scene, player, crowd, police, fleet) {
  const tracers = [];
  const sparks = [];
  let flash = 0;
  let shots = 0;
  const point = new THREE.Vector3();

  for (let i = 0; i < 6; i += 1) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0 });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  const sparkGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  for (let i = 0; i < 28; i += 1) {
    const mesh = new THREE.Mesh(sparkGeo, sparkMat);
    mesh.visible = false;
    scene.add(mesh);
    sparks.push({ mesh, life: 0, vel: new THREE.Vector3() });
  }

  function tracer(from, to) {
    let slot = tracers.find((t) => t.life <= 0) || tracers[0];
    slot.life = 0.09;
    const pos = slot.line.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    slot.line.material.opacity = 0.9;
  }

  function burst(at, n = 7) {
    for (let i = 0; i < n; i += 1) {
      const s = sparks.find((sp) => sp.life <= 0);
      if (!s) return;
      s.life = 0.35 + Math.random() * 0.3;
      s.mesh.visible = true;
      s.mesh.position.copy(at);
      s.vel.set((Math.random() - 0.5) * 6, Math.random() * 4 + 1, (Math.random() - 0.5) * 6);
    }
  }

  return {
    get flash() {
      return flash;
    },
    // Fired from the lens so the crosshair is honest; the tracer starts at the muzzle.
    shoot(origin, dir) {
      const far = new THREE.Vector3(
        origin.x + dir.x * 120,
        origin.y + dir.y * 120,
        origin.z + dir.z * 120,
      );
      const muzzle = player.muzzle(point.set(0, 0, 0)).clone();
      let hit = crowd.shoot(origin, dir, 120);
      let end = far;

      if (hit) {
        end = new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z);
        burst(end, 9);
        flash = 0.18;
        player.state.money += 12;
        police.report(2);
        crowd.alert();
      } else {
        // A shot still makes noise: three warnings before the city calls it in.
        shots += 1;
        if (shots >= 3) {
          police.report(1);
          shots = 0;
        }
        crowd.alert();
        // Sparks off a cruiser if the shot passes close to one.
        for (const car of fleet.cars) {
          if (!car.police || !car.mesh.visible) continue;
          const dx = car.pos.x - origin.x;
          const dz = car.pos.z - origin.z;
          const along = dx * dir.x + dz * dir.z;
          if (along < 0 || along > 90) continue;
          const side = Math.abs(dx * dir.z - dz * dir.x);
          if (side < 1.6) {
            end = new THREE.Vector3(car.pos.x, 1.1, car.pos.z);
            burst(end, 6);
            police.report(1);
            break;
          }
        }
      }
      tracer(muzzle, end);
    },
    update(dt) {
      flash = Math.max(0, flash - dt);
      for (const t of tracers) {
        if (t.life <= 0) continue;
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
      }
      for (const s of sparks) {
        if (s.life <= 0) continue;
        s.life -= dt;
        s.vel.y -= 14 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);
        if (s.life <= 0) s.mesh.visible = false;
      }
    },
  };
}
