// Low-poly vehicles. A sedan, a coupé and a van share one wheelbase and one lamp rig,
// so they differ only in silhouette and paint — never in how they drive.

import * as THREE from 'three';

export const BODIES = {
  sedan: { length: 4.5, width: 1.92, height: 1.42, cabin: 2.05, roof: 0.6, wheel: 0.34 },
  coupe: { length: 4.15, width: 1.86, height: 1.2, cabin: 1.65, roof: 0.48, wheel: 0.33 },
  van: { length: 5.3, width: 2.08, height: 2.1, cabin: 3.2, roof: 0.95, wheel: 0.4 },
};

const rubber = new THREE.MeshLambertMaterial({ color: 0x1a1c1f });
const chrome = new THREE.MeshLambertMaterial({ color: 0xc9ccd1 });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x2b3a44 });
const headMat = new THREE.MeshLambertMaterial({ color: 0xfff6dc, emissive: 0x8a7a4a });
const tailMat = new THREE.MeshLambertMaterial({ color: 0xc8402f, emissive: 0x551610 });

export function makeVehicleMesh(spec, paint, options = {}) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: paint });
  const darkMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(paint).multiplyScalar(0.7),
  });

  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width, spec.height * 0.62, spec.length),
    bodyMat,
  );
  hull.position.y = spec.height * 0.31 + spec.wheel;
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width * 0.86, spec.roof + 0.2, spec.cabin),
    glassMat,
  );
  cabin.position.set(0, spec.height * 0.62 + spec.wheel + (spec.roof + 0.2) / 2, -0.12);
  cabin.castShadow = true;
  group.add(cabin);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width * 0.9, 0.11, spec.cabin + 0.08),
    darkMat,
  );
  roof.position.set(0, spec.height * 0.62 + spec.wheel + spec.roof + 0.26, -0.12);
  group.add(roof);

  const skirt = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width * 1.02, 0.16, spec.length * 0.94),
    darkMat,
  );
  skirt.position.y = spec.wheel * 0.9;
  group.add(skirt);

  const wheelGeo = new THREE.CylinderGeometry(spec.wheel, spec.wheel, 0.26, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const axleX = spec.width / 2 - 0.04;
  const axleZ = spec.length / 2 - 0.92;
  const wheels = [];
  const front = [];
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeo, rubber);
      wheel.position.set(sx * axleX, spec.wheel, sz * axleZ);
      wheel.castShadow = true;
      group.add(wheel);
      wheels.push(wheel);
      if (sz > 0) front.push(wheel);
    }
  }

  const tail = [];
  for (const sx of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), headMat);
    head.position.set(sx * (spec.width / 2 - 0.27), spec.height * 0.38 + spec.wheel, spec.length / 2 + 0.01);
    group.add(head);
    const rear = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.06), tailMat);
    rear.position.set(sx * (spec.width / 2 - 0.25), spec.height * 0.4 + spec.wheel, -spec.length / 2 - 0.01);
    group.add(rear);
    tail.push(rear);
  }

  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width * 0.98, 0.14, 0.12),
    chrome,
  );
  bumper.position.set(0, spec.wheel + 0.12, spec.length / 2 - 0.02);
  group.add(bumper);

  let lights = null;
  if (options.police) {
    // White door panels read as a patrol car even in a small contact-sheet thumbnail.
    for (const sx of [-1, 1]) {
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.62, 1.7),
        new THREE.MeshLambertMaterial({ color: 0xf2f0e8 }),
      );
      door.position.set(sx * (spec.width / 2 + 0.01), spec.wheel + 0.78, -0.1);
      group.add(door);
    }
    // A light bar with its own materials, so the cruiser can flash red and blue.
    const red = new THREE.MeshLambertMaterial({ color: 0xd93b3b, emissive: 0xd93b3b, emissiveIntensity: 1 });
    const blue = new THREE.MeshLambertMaterial({ color: 0x3b6fd9, emissive: 0x2a55b8, emissiveIntensity: 1 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.62, 0.16, 0.34), rubber);
    bar.position.set(0, spec.height * 0.62 + spec.wheel + spec.roof + 0.42, 0.1);
    group.add(bar);
    const left = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.26, 0.2, 0.28), red);
    left.position.set(-spec.width * 0.16, bar.position.y + 0.13, 0.1);
    const right = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.26, 0.2, 0.28), blue);
    right.position.set(spec.width * 0.16, bar.position.y + 0.13, 0.1);
    group.add(left);
    group.add(right);
    lights = { red, blue };
  }

  return { group, wheels, front, tail, lights, spec };
}
