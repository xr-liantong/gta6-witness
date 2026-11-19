// The city, drawn. Everything is procedural geometry and canvas textures, so the whole
// world ships as source: no image, model or font is downloaded at runtime.

import * as THREE from 'three';
import { PALETTE, WORLD } from './config.js';

const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFrag = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 sunColor;
  uniform vec3 sunDir;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y * 1.2, 0.0, 1.0);
    vec3 col = mix(horizonColor, topColor, pow(h, 0.62));
    float disc = pow(max(dot(d, normalize(sunDir)), 0.0), 340.0);
    float glow = pow(max(dot(d, normalize(sunDir)), 0.0), 7.0);
    col += sunColor * (disc * 1.7 + glow * 0.20);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function canvasTexture(w, h, paint, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// One tile of facade: warm render, two rows of glass and a shopfront band at the foot.
function facadeTexture() {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const shade = 138 + ((col * 11 + row * 17) % 46);
        g.fillStyle = `rgb(${shade},${shade + 14},${shade + 26})`;
        g.fillRect(col * 32 + 6, 18 + row * 32, 20, 17);
      }
      g.fillStyle = 'rgba(80, 70, 55, 0.16)';
      g.fillRect(0, 18 + row * 32 + 19, w, 3);
    }
    g.fillStyle = 'rgba(46, 52, 56, 0.9)';
    g.fillRect(0, h - 30, w, 30);
    g.fillStyle = 'rgba(255, 246, 220, 0.5)';
    for (let i = 0; i < 4; i += 1) g.fillRect(i * 32 + 5, h - 24, 22, 16);
  });
}

// Asphalt with a dashed centre line and solid paint at both edges. Dashes run along the
// texture's U axis so one tile is one 30 m stretch of road once repeat.x is set below.
function roadTexture() {
  return canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#50555d';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f0ead6';
    g.globalAlpha = 0.85;
    for (let x = 0; x < w; x += 64) g.fillRect(x + 10, h / 2 - 2, 30, 4);
    g.globalAlpha = 0.5;
    g.fillRect(0, 4, w, 3);
    g.fillRect(0, h - 7, w, 3);
    g.globalAlpha = 0.08;
    for (let i = 0; i < 40; i += 1) {
      const x = (i * 37) % w;
      const y = (i * 91) % h;
      g.fillStyle = i % 2 ? '#ffffff' : '#000000';
      g.fillRect(x, y, 2, 2);
    }
  });
}

function seaTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#2e7f96';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i += 1) {
      const x = (i * 53) % w;
      const y = (i * 97) % h;
      g.strokeStyle = i % 3 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(120,220,220,0.16)';
      g.lineWidth = 1 + (i % 3);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 9, y - 2, x + 18, y);
      g.stroke();
    }
  });
}

function skyDome(sunDir) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 32, 20),
    new THREE.ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x3f87c0) },
        horizonColor: { value: new THREE.Color(0xf6dfc2) },
        sunColor: { value: new THREE.Color(0xffecc6) },
        sunDir: { value: sunDir.clone().normalize() },
      },
    }),
  );
  mesh.frustumCulled = false;
  return mesh;
}

function buildingMesh(spec, walls) {
  const group = new THREE.Group();
  const key = `${spec.tint}-${Math.round(spec.w)}-${Math.round(spec.h)}`;
  let mat = walls.get(key);
  if (!mat) {
    const tex = facadeTexture();
    tex.repeat.set(Math.max(1, Math.round(spec.w / 12)), Math.max(1, Math.round(spec.h / 12)));
    mat = new THREE.MeshLambertMaterial({ color: spec.tint, map: tex });
    walls.set(key, mat);
  }
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.d), mat);
  body.position.y = spec.h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(spec.w + 0.7, 0.55, spec.d + 0.7),
    solid(spec.roof),
  );
  roof.position.y = spec.h + 0.27;
  roof.castShadow = true;
  group.add(roof);

  if (spec.crown) {
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(spec.crown.w, spec.crown.h, spec.crown.d),
      new THREE.MeshLambertMaterial({ color: spec.tint }),
    );
    crown.position.y = spec.h + spec.crown.h / 2;
    crown.castShadow = true;
    group.add(crown);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(spec.crown.w + 0.6, 0.4, spec.crown.d + 0.6),
      solid(spec.roof),
    );
    cap.position.y = spec.h + spec.crown.h + 0.2;
    group.add(cap);
  }

  if (spec.awning) {
    const awn = new THREE.Mesh(
      new THREE.BoxGeometry(spec.w * 0.8, 0.5, 2.4),
      new THREE.MeshLambertMaterial({ color: spec.awning.color }),
    );
    awn.position.set(0, spec.awning.h, spec.d / 2 + 1.1);
    awn.castShadow = true;
    group.add(awn);
  }

  for (let i = 0; i < (spec.vents || 0); i += 1) {
    const vent = new THREE.Mesh(
      new THREE.BoxGeometry(2.4 + i, 1.4, 2 + i * 0.5),
      solid(0x9aa0a6),
    );
    vent.position.set(-spec.w * 0.18 + i * 3.2, spec.h + 1.2, -spec.d * 0.12);
    vent.castShadow = true;
    group.add(vent);
  }

  group.position.set(spec.x, 0.22, spec.z);
  return group;
}

const solidCache = new Map();
function solid(color, flat = false) {
  const key = `${color}${flat ? 'f' : ''}`;
  if (!solidCache.has(key)) {
    solidCache.set(key, new THREE.MeshLambertMaterial({ color, flatShading: flat }));
  }
  return solidCache.get(key);
}

function palmMesh(spec) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.36, spec.h, 6),
    solid(PALETTE.trunk, true),
  );
  trunk.position.y = spec.h / 2;
  trunk.castShadow = true;
  group.add(trunk);
  const crown = new THREE.Group();
  crown.position.y = spec.h;
  for (let i = 0; i < 7; i += 1) {
    const frond = new THREE.Mesh(
      new THREE.BoxGeometry(2.9, 0.07, 0.66),
      solid(i % 2 ? PALETTE.palm : 0x5d9f4d, true),
    );
    frond.position.x = 1.25;
    frond.castShadow = true;
    const arm = new THREE.Group();
    arm.add(frond);
    arm.rotation.y = (i / 7) * Math.PI * 2;
    arm.rotation.z = -0.32 - (i % 2) * 0.1;
    crown.add(arm);
  }
  group.add(crown);
  group.rotation.z = spec.lean || 0;
  group.position.set(spec.x, 0.22, spec.z);
  return group;
}

function umbrellaMesh(spec) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 5), solid(0xd8d2c2));
  pole.position.y = 1.15;
  group.add(pole);
  const top = new THREE.Mesh(
    new THREE.ConeGeometry(1.7, 0.6, 8, 1, true),
    new THREE.MeshLambertMaterial({ color: spec.color, side: THREE.DoubleSide }),
  );
  top.position.y = 2.3;
  top.castShadow = true;
  group.add(top);
  group.position.set(spec.x, WORLD.seaLevel + 0.32, spec.z);
  group.rotation.z = spec.lean || 0;
  return group;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  return renderer;
}

export function buildScene(renderer, world) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTE.haze, 240, 1050);

  const sunDir = new THREE.Vector3(-0.52, 0.55, 0.66).normalize();
  scene.add(skyDome(sunDir));

  // The reference build read too dark on the ground; a real ambient term plus a bright
  // hemisphere keeps asphalt and sand in the same afternoon light as the towers. The sun
  // now carries the contrast instead of blowing out the pavement to white.
  // Warm bounced light, so white stucco reads as afternoon sun instead of grey card.
  scene.add(new THREE.AmbientLight(0xffe2c4, 0.3));
  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0xe8c9a0, 0.75));

  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.0);
  sun.position.copy(sunDir.clone().multiplyScalar(420));
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const span = 320;
  sun.shadow.camera.left = -span;
  sun.shadow.camera.right = span;
  sun.shadow.camera.top = span;
  sun.shadow.camera.bottom = -span;
  sun.shadow.camera.near = 60;
  sun.shadow.camera.far = 950;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.06;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);
  scene.add(sun.target);

  const walls = new Map();
  const citySpan = world.bounds.max - world.bounds.min;

  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(citySpan * 3.2, citySpan * 3.2),
    new THREE.MeshLambertMaterial({ color: 0xc9c39c }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.45;
  grass.receiveShadow = true;
  scene.add(grass);

  // Sand first, then the sea on top of its far edge: the beach is the city's front yard.
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(citySpan * 2.4, 40),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.015, WORLD.shore + 20);
  beach.receiveShadow = true;
  scene.add(beach);

  const seaTex = seaTexture();
  seaTex.repeat.set(26, 26);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 1500),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea, map: seaTex }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, WORLD.seaLevel, WORLD.sea + 750);
  scene.add(sea);

  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 5),
    new THREE.MeshBasicMaterial({ color: 0xf2f6f2, transparent: true, opacity: 0.7 }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.02, WORLD.sea - 2);
  scene.add(foam);

  // Roads: one textured strip per avenue, laid both ways. The tile is 30 m of road, so
  // repeat.x counts stretches, not metres.
  const roadTex = roadTexture();
  const roadLen = citySpan + 80;
  roadTex.repeat.set(roadLen / 30, 1);
  const roadMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: roadTex });
  for (const a of world.axis) {
    const mid = (world.bounds.min + world.bounds.max) / 2;
    const across = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, WORLD.road), roadMat);
    across.rotation.x = -Math.PI / 2;
    across.position.set(mid, 0.03, a.mid);
    across.receiveShadow = true;
    scene.add(across);

    const along = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, WORLD.road), roadMat);
    along.rotation.x = -Math.PI / 2;
    along.rotation.z = Math.PI / 2;
    along.position.set(a.mid, 0.032, mid);
    along.receiveShadow = true;
    scene.add(along);
  }

  const paveMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const kerbMat = new THREE.MeshLambertMaterial({ color: PALETTE.kerb });
  for (const b of world.sidewalks) {
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(b.w + 1.4, 0.3, b.d + 1.4), kerbMat);
    kerb.position.set(b.x, 0.05, b.z);
    kerb.receiveShadow = true;
    scene.add(kerb);
    const pave = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.22, b.d), paveMat);
    pave.position.set(b.x, 0.11, b.z);
    pave.receiveShadow = true;
    scene.add(pave);
  }

  for (const spec of world.buildings) scene.add(buildingMesh(spec, walls));
  for (const spec of world.palms) scene.add(palmMesh(spec));
  for (const lamp of world.lamps) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 6.2, 5), solid(0x8d9299, true));
    pole.position.set(lamp.x, 3.3, lamp.z);
    pole.castShadow = true;
    scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.18, 0.36), solid(0xffeecb));
    head.position.set(lamp.x, 6.25, lamp.z);
    scene.add(head);
  }
  for (const spec of world.umbrellas) scene.add(umbrellaMesh(spec));
  for (const t of world.towels) {
    const towel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 2.2),
      new THREE.MeshLambertMaterial({ color: t.color }),
    );
    towel.rotation.x = -Math.PI / 2;
    towel.rotation.z = 0.2;
    towel.position.set(t.x, 0.04, t.z);
    scene.add(towel);
  }

  // The pier: a low plank deck that starts where the sand does, so it reads as a jetty
  // lying on the beach rather than a slab floating over the promenade.
  const pier = world.pier;
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(pier.w, 0.3, pier.d),
    new THREE.MeshLambertMaterial({ color: 0xb08a5e }),
  );
  deck.position.set(pier.x, 0.42, pier.z + pier.d / 2 - 6);
  deck.receiveShadow = true;
  deck.castShadow = true;
  scene.add(deck);
  for (let i = 0; i < 9; i += 1) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.4, 6), solid(0x6b543b, true));
      post.position.set(pier.x + side * (pier.w / 2 - 0.6), -1.45, pier.z + 10 + i * 9);
      scene.add(post);
    }
  }
  // The far end of the pier just tapers into the water: no sign board hanging in the air.

  return { scene, sun, sunDir, walls };
}

// Re-exported so traffic, police and the player build cars with the same materials.
export { solid };
