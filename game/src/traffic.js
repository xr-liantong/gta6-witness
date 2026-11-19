// Civilian traffic. Every car belongs to a lane and slides along it; when it reaches the
// end it wraps around. No pathfinding, no navmesh — the grid is the path.

const SPEEDS = [9.5, 11, 12.5, 14, 8.5];
const PAINTS = [0xd9543c, 0xe9e5d8, 0x3c6f8f, 0x8c93a1, 0xdcb347, 0x6a8f5f, 0xb2506a];

export function createTraffic(world, fleet) {
  const items = [];
  const count = 16;

  for (let i = 0; i < count; i += 1) {
    const lane = world.lanes[(i * 5 + 3) % world.lanes.length];
    const car = fleet.spawn(
      i % 5 === 0 ? 'van' : i % 3 === 0 ? 'coupe' : 'sedan',
      lane.a.x,
      lane.a.z,
      0,
      PAINTS[i % PAINTS.length],
    );
    car.driver = 'traffic';
    const dx = lane.b.x - lane.a.x;
    const dz = lane.b.z - lane.a.z;
    items.push({
      car,
      lane,
      len: Math.hypot(dx, dz),
      t: (i * 0.173) % 1,
      speed: SPEEDS[i % SPEEDS.length],
      dir: { x: dx, z: dz },
    });
  }

  function place(item) {
    const { lane, t, car } = item;
    car.pos.x = lane.a.x + (lane.b.x - lane.a.x) * t;
    car.pos.z = lane.a.z + (lane.b.z - lane.a.z) * t;
    car.yaw = Math.atan2(item.dir.x, item.dir.z);
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.yaw;
  }

  for (const item of items) place(item);

  return {
    cars: items.map((i) => i.car),
    update(dt, slow = 1, playerCar = null) {
      for (const item of items) {
        let pace = item.speed * slow;
        if (playerCar) {
          // Brake for a car that is close and in front of us, instead of driving through it.
          const dx = playerCar.pos.x - item.car.pos.x;
          const dz = playerCar.pos.z - item.car.pos.z;
          const ahead = dx * Math.sin(item.car.yaw) + dz * Math.cos(item.car.yaw);
          const side = Math.abs(dx * Math.cos(item.car.yaw) - dz * Math.sin(item.car.yaw));
          if (ahead > 0 && ahead < 11 && side < 2.4) pace = Math.min(pace, 1.5);
        }
        if (pace < 0.01) continue;
        item.t += (pace * dt) / item.len;
        if (item.t >= 1) item.t -= 1;
        place(item);
        item.car.spin += pace * dt * 2.6;
        for (const w of item.car.wheels) w.rotation.x = item.car.spin;
      }
    },
    stop() {
      for (const item of items) {
        item.speed = 0;
      }
    },
  };
}
