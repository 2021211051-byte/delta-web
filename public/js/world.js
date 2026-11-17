import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SOLIDS, TARGETS } from '../../shared/config.js';
import { labelTexture, standardMaterial, targetTexture } from './textures.js';

function mesh(parent, geometry, material, position, rotation = null, shadow = true) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  if (rotation) object.rotation.set(...rotation);
  object.castShadow = shadow;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(parent, size, position, material, rotation = null) {
  return mesh(parent, new THREE.BoxGeometry(...size), material, position, rotation);
}

function cylinder(parent, radius, height, position, material, rotation = null, segments = 16) {
  return mesh(parent, new THREE.CylinderGeometry(radius, radius, height, segments), material, position, rotation);
}

function sign(parent, text, position, size, options = {}) {
  const material = new THREE.MeshStandardMaterial({ map: labelTexture(text, options), roughness: .8 });
  return mesh(parent, new THREE.PlaneGeometry(...size), material, position, options.rotation || null, false);
}

export function createWorld(scene, renderer, textures) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, .03).texture;
  scene.environmentIntensity = .36;
  room.dispose();
  pmrem.dispose();
  scene.fog = new THREE.FogExp2(0x9aa69b, .0085);

  const sky = new Sky(); sky.scale.setScalar(450); scene.add(sky);
  sky.material.uniforms.turbidity.value = 7;
  sky.material.uniforms.rayleigh.value = 1.5;
  sky.material.uniforms.mieCoefficient.value = .008;
  sky.material.uniforms.mieDirectionalG.value = .82;
  const sun = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(63), THREE.MathUtils.degToRad(128));
  sky.material.uniforms.sunPosition.value.copy(sun);
  const hemi = new THREE.HemisphereLight(0xcadbd2, 0x3e4235, 1.55); scene.add(hemi);
  const sunlight = new THREE.DirectionalLight(0xffe7c1, 3.1);
  sunlight.position.set(-35, 55, 24); sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 140 });
  sunlight.shadow.bias = -.00018; sunlight.shadow.normalBias = .035;
  scene.add(sunlight);

  const materials = {
    concrete: standardMaterial(textures.concrete, { roughness: .94, bumpScale: .07 }),
    asphalt: standardMaterial(textures.asphalt, { roughness: .98, bumpScale: .055 }),
    metal: standardMaterial(textures.metal, { roughness: .62, metalness: .5, bumpScale: .035 }),
    wood: standardMaterial(textures.wood, { roughness: .88, bumpScale: .045 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x26302b, roughness: .7, metalness: .35 }),
    green: new THREE.MeshStandardMaterial({ color: 0x465748, roughness: .65, metalness: .35, map: textures.metal }),
    tan: new THREE.MeshStandardMaterial({ color: 0x8b8268, roughness: .8, map: textures.concrete }),
    white: new THREE.MeshStandardMaterial({ color: 0xb8b8a8, roughness: .8 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xbfa64d, roughness: .75 }),
    red: new THREE.MeshStandardMaterial({ color: 0x7f382c, roughness: .67, metalness: .3 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x56706b, roughness: .18, metalness: .2, transparent: true, opacity: .68 }),
    rubber: standardMaterial(textures.rubber, { roughness: .88 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xffedc4, emissive: 0xffd897, emissiveIntensity: 2 }),
  };

  mesh(scene, new THREE.PlaneGeometry(90, 90), materials.asphalt, [0, -.035, 0], [-Math.PI / 2, 0, 0], false);
  mesh(scene, new THREE.PlaneGeometry(36, 29), materials.concrete, [0, -.018, 25], [-Math.PI / 2, 0, 0], false);
  for (let x = -18; x <= 18; x += 6) box(scene, [.055, .008, 26], [x, .002, 25], materials.white);
  for (let z = 16; z <= 34; z += 6) {
    box(scene, [35, .012, .08], [0, .004, z], materials.yellow);
    for (const x of [-15, -9, -3, 3, 9, 15]) sign(scene, String(Math.abs(z - 12)), [x, .015, z - .4], [1.1, .55], { rotation: [-Math.PI / 2, 0, 0], width: 128, height: 64, background: '#a7a68f', color: '#30352f', border: false, fontSize: 35 });
  }

  box(scene, [38, 4.5, .6], [0, 2.25, 9.7], materials.concrete);
  box(scene, [38, .25, 1.2], [0, 4.5, 9.7], materials.dark);
  for (const x of [-18, -12, -6, 0, 6, 12, 18]) {
    box(scene, [.22, 4.7, .5], [x, 2.35, 10.1], materials.dark);
    if (x < 18) box(scene, [5.6, .16, .18], [x + 3, 3.75, 10.2], materials.dark);
  }
  sign(scene, '零号训练基地  /  LIVE FIRE RANGE', [0, 3.25, 10.02], [9.5, 1.25], { background: '#202923', color: '#d8ef8b', fontSize: 36 });

  for (const x of [-15, -9, -3, 3, 9, 15]) {
    box(scene, [5.8, .16, 2.4], [x, 1, 27], materials.metal);
    box(scene, [.15, 1, 2.4], [x - 2.75, .5, 27], materials.dark);
    for (let z = 26.2; z < 28; z += .42) box(scene, [5.7, .015, .025], [x, 1.09, z], materials.gunEdge || materials.metal);
  }
  for (const x of [-17.8, 17.8]) {
    box(scene, [.12, 2.5, 28], [x, 1.25, 24], materials.dark);
    for (let z = 11; z < 39; z += 2) box(scene, [.25, .06, .06], [x, 1.5, z], materials.yellow);
  }

  const buildingA = SOLIDS.find((solid) => solid.id === 'left-building');
  const buildingB = SOLIDS.find((solid) => solid.id === 'right-building');
  for (const [solid, label] of [[buildingA, 'A-01\n装备库'], [buildingB, 'B-02\n观察站']]) {
    const sx = solid.max[0] - solid.min[0]; const sy = solid.max[1] - solid.min[1]; const sz = solid.max[2] - solid.min[2];
    const x = (solid.min[0] + solid.max[0]) / 2; const z = (solid.min[2] + solid.max[2]) / 2;
    box(scene, [sx, sy, sz], [x, sy / 2, z], materials.concrete);
    box(scene, [sx + .4, .28, sz + .4], [x, sy + .12, z], materials.dark);
    for (let y = .3; y < sy; y += 1.3) box(scene, [sx + .02, .035, sz + .02], [x, y, z], materials.tan);
    const frontZ = solid.max[2] + .012;
    box(scene, [2.2, 2.8, .12], [x, 1.4, frontZ], materials.dark);
    for (let i = 0; i < 7; i++) box(scene, [1.9, .04, .02], [x, .3 + i * .36, frontZ + .07], materials.metal);
    sign(scene, label, [x, 4.1, frontZ + .025], [3.2, 1.4], { background: '#353e36', color: '#d7d8c7', fontSize: 54 });
    for (const wx of [-sx * .33, sx * .33]) {
      box(scene, [1.65, 1.25, .08], [x + wx, 3.7, frontZ + .02], materials.dark);
      box(scene, [1.45, 1.05, .085], [x + wx, 3.7, frontZ + .065], materials.glass);
      box(scene, [.04, 1.08, .1], [x + wx, 3.7, frontZ + .12], materials.dark);
    }
    for (let i = 0; i < 3; i++) cylinder(scene, .32, .7, [x - 2 + i * 2, sy + .8, z], materials.metal, null, 20);
  }

  function container(solid, material, code) {
    const sx = solid.max[0] - solid.min[0]; const sy = solid.max[1] - solid.min[1]; const sz = solid.max[2] - solid.min[2];
    const x = (solid.min[0] + solid.max[0]) / 2; const z = (solid.min[2] + solid.max[2]) / 2;
    box(scene, [sx, sy, sz], [x, sy / 2, z], material);
    for (let px = solid.min[0] + .15; px < solid.max[0]; px += .3) {
      box(scene, [.045, sy - .18, .07], [px, sy / 2, solid.min[2] - .035], materials.dark);
      box(scene, [.045, sy - .18, .07], [px, sy / 2, solid.max[2] + .035], materials.dark);
    }
    for (const y of [.12, sy - .12]) box(scene, [sx + .15, .13, sz + .12], [x, y, z], materials.dark);
    sign(scene, code, [x, 1.6, solid.max[2] + .08], [1.8, .65], { background: '#35483c', color: '#c8cdbb', border: false, fontSize: 42 });
  }
  container(SOLIDS.find((s) => s.id === 'container-a'), materials.green, 'G.T.I.\n06-27');
  container(SOLIDS.find((s) => s.id === 'container-b'), materials.red, 'CARGO\n41-09');
  container(SOLIDS.find((s) => s.id === 'container-c'), materials.green, 'G.T.I.\n11-32');

  for (const solid of SOLIDS.filter((s) => s.id.startsWith('crate'))) {
    const sx = solid.max[0] - solid.min[0]; const sy = solid.max[1] - solid.min[1]; const sz = solid.max[2] - solid.min[2];
    const x = (solid.min[0] + solid.max[0]) / 2; const z = (solid.min[2] + solid.max[2]) / 2;
    box(scene, [sx, sy, sz], [x, sy / 2, z], materials.wood);
    for (const px of [solid.min[0] + .12, solid.max[0] - .12]) box(scene, [.16, sy + .04, sz + .04], [px, sy / 2, z], materials.dark);
    for (const y of [.15, sy - .15]) box(scene, [sx + .04, .15, sz + .04], [x, y, z], materials.dark);
  }
  for (const solid of SOLIDS.filter((s) => s.id.startsWith('wall-'))) {
    const sx = solid.max[0] - solid.min[0]; const sy = solid.max[1] - solid.min[1]; const sz = solid.max[2] - solid.min[2];
    box(scene, [sx, sy, sz], [(solid.min[0] + solid.max[0]) / 2, sy / 2, (solid.min[2] + solid.max[2]) / 2], materials.concrete);
    box(scene, [sx + .05, .09, sz + .05], [(solid.min[0] + solid.max[0]) / 2, sy, (solid.min[2] + solid.max[2]) / 2], materials.yellow);
  }

  for (const [x, z] of [[-21, 5], [21, -2], [-15, -27], [20, 29]]) {
    for (let i = 0; i < 3; i++) {
      cylinder(scene, .42, .9, [x + i * .9, .9, z], i === 1 ? materials.red : materials.green, null, 20);
      for (const y of [.25, 1.48]) cylinder(scene, .435, .04, [x + i * .9, y, z], materials.dark, null, 20);
    }
  }
  for (const [x, z] of [[-20, 30], [20, 30], [-20, -2], [20, -2], [0, -36]]) {
    cylinder(scene, .095, 7.5, [x, 3.75, z], materials.dark, null, 12);
    box(scene, [1.5, .12, .4], [x, 7.45, z], materials.dark);
    box(scene, [1.2, .06, .28], [x, 7.36, z], materials.lamp);
    const light = new THREE.PointLight(0xffe2ae, 12, 14, 2); light.position.set(x, 7.1, z); scene.add(light);
  }
  for (const [x, z, rotation] of [[-21, 20, 0], [21, 20, 0], [-21, -30, 0], [21, -30, 0]]) {
    const barrier = new THREE.Group(); barrier.position.set(x, 0, z); barrier.rotation.y = rotation; scene.add(barrier);
    box(barrier, [2.7, .8, .65], [0, .4, 0], materials.concrete);
    box(barrier, [2.8, .13, .7], [0, .8, 0], materials.yellow);
  }

  const targets = new Map();
  const face = targetTexture();
  for (const definition of TARGETS) {
    const group = new THREE.Group(); group.position.set(definition.x, 0, definition.z); scene.add(group);
    box(group, [.85, .12, .65], [0, .06, 0], materials.dark);
    box(group, [.08, definition.y, .08], [0, definition.y / 2, .03], materials.metal);
    const pivot = new THREE.Group(); pivot.position.set(0, definition.y, 0); group.add(pivot);
    const plate = cylinder(pivot, definition.radius, .07, [0, 0, 0], materials.dark, [Math.PI / 2, 0, 0], 40);
    const faceMaterial = new THREE.MeshStandardMaterial({ map: face, roughness: .75, metalness: .1 });
    mesh(pivot, new THREE.CircleGeometry(definition.radius * .94, 48), faceMaterial, [0, 0, .041], null, false);
    for (let i = 0; i < 4; i++) cylinder(pivot, .018, .015, [Math.cos(i * Math.PI / 2 + Math.PI / 4) * definition.radius * .77, Math.sin(i * Math.PI / 2 + Math.PI / 4) * definition.radius * .77, .05], materials.metal, [Math.PI / 2, 0, 0], 8);
    targets.set(definition.id, { group, pivot, plate, definition, hp: 100, down: false });
  }

  const perimeterMaterial = new THREE.MeshStandardMaterial({ color: 0x434d44, roughness: .8, metalness: .45 });
  for (const [x, z, sx, sz] of [[0, -40, 82, .12], [0, 40, 82, .12], [-40, 0, .12, 82], [40, 0, .12, 82]]) {
    box(scene, [sx, 2.8, sz], [x, 1.4, z], perimeterMaterial);
    for (let p = -40; p <= 40; p += 4) {
      if (sx > sz) box(scene, [.07, 3.2, .07], [p, 1.6, z], materials.dark);
      else box(scene, [.07, 3.2, .07], [x, 1.6, p], materials.dark);
    }
  }

  return {
    targets, materials, sunlight,
    setQuality(quality) {
      const high = quality === 'high';
      sunlight.castShadow = high;
      renderer.shadowMap.enabled = high;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 1.75 : 1.1));
    },
    updateTarget(id, state, dt) {
      const target = targets.get(id); if (!target) return;
      target.group.position.x = state.position.x;
      target.hp = state.hp;
      target.down = state.down;
      const desired = state.down ? -Math.PI / 2 : 0;
      pivotSafeLerp(target.pivot, desired, dt);
      target.group.visible = state.hp > 0 || state.down;
    },
  };
}

function pivotSafeLerp(pivot, desired, dt) {
  pivot.rotation.x += (desired - pivot.rotation.x) * Math.min(1, dt * 9);
}
