import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { labelTexture } from './textures.js';

function mesh(parent, geometry, material, position = [0, 0, 0], rotation = null) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position); if (rotation) object.rotation.set(...rotation);
  object.frustumCulled = false; parent.add(object); return object;
}

function box(parent, size, position, material, radius = .006, rotation = null) {
  return mesh(parent, new RoundedBoxGeometry(...size, 3, Math.min(radius, ...size.map((value) => value / 3))), material, position, rotation);
}

function cylinder(parent, radius, length, position, material, rotation = [Math.PI / 2, 0, 0], segments = 40, open = false, radiusBack = radius) {
  return mesh(parent, new THREE.CylinderGeometry(radius, radiusBack, length, segments, 2, open), material, position, rotation);
}

function torus(parent, radius, tubeRadius, position, material, rotation = null) {
  return mesh(parent, new THREE.TorusGeometry(radius, tubeRadius, 10, 48), material, position, rotation);
}

function pathFrom(points) {
  const shape = new THREE.Shape(); shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath(); return shape;
}

function profile(parent, points, depth, material, holes = []) {
  const shape = pathFrom(points);
  for (const holePoints of holes) {
    const hole = pathFrom(holePoints); shape.holes.push(hole);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 3, steps: 1, curveSegments: 16 });
  geometry.translate(0, 0, -depth / 2); geometry.rotateY(-Math.PI / 2);
  return mesh(parent, geometry, material);
}

function rectangularHole(z, y, length, height) {
  return [[z - length / 2, y - height / 2], [z - length / 2, y + height / 2], [z + length / 2, y + height / 2], [z + length / 2, y - height / 2]];
}

function screw(parent, x, y, z, materials, radius = .009) {
  cylinder(parent, radius + .003, .006, [x, y, z], materials.gunDark, [0, 0, Math.PI / 2], 24);
  cylinder(parent, radius, .009, [x + Math.sign(x) * .004, y, z], materials.gunEdge, [0, 0, Math.PI / 2], 24);
  box(parent, [.002, radius * .8, .002], [x + Math.sign(x) * .009, y, z], materials.gunDark, .0004);
}

function rail(parent, start, end, y, materials, width = .09) {
  box(parent, [width, .024, end - start], [0, y, (start + end) / 2], materials.gunDark, .004);
  const count = Math.floor((end - start) / .035);
  for (let i = 0; i <= count; i++) box(parent, [width + .015, .014, .017], [0, y + .016, start + i / count * (end - start)], materials.gun, .002);
}

function label(parent, text, x, y, z, materials, width = .2) {
  const map = labelTexture(text, { width: 512, height: 80, background: '#252a27', color: '#aeb7a8', border: false, fontSize: 34 });
  mesh(parent, new THREE.PlaneGeometry(width, width * .156), new THREE.MeshStandardMaterial({ map, roughness: .55, metalness: .4 }), [x, y, z], [0, -Math.PI / 2, 0]);
}

function redDot(parent, materials) {
  const sight = new THREE.Group(); sight.position.set(0, .17, .02); parent.add(sight);
  box(sight, [.12, .035, .12], [0, 0, 0], materials.gunDark, .009);
  for (const x of [-.052, .052]) box(sight, [.016, .11, .075], [x, .065, 0], materials.gunDark, .005);
  box(sight, [.12, .018, .075], [0, .12, 0], materials.gunDark, .005);
  mesh(sight, new THREE.PlaneGeometry(.086, .09), materials.glass, [0, .065, .04]);
  mesh(sight, new THREE.SphereGeometry(.0035, 10, 8), materials.redGlass, [0, .065, .043]);
  cylinder(sight, .018, .025, [.068, .01, 0], materials.gunEdge, [0, 0, Math.PI / 2], 24);
  return sight;
}

function suppressor(parent, start, end, radius, materials) {
  const center = (start + end) / 2; const length = Math.abs(end - start);
  cylinder(parent, radius, length, [0, .015, center], materials.gunDark, [Math.PI / 2, 0, 0], 64);
  for (let i = 0; i < 5; i++) torus(parent, radius + .001, .0025, [0, .015, Math.min(start, end) + i / 4 * length], materials.gun);
  cylinder(parent, radius * .72, .008, [0, .015, Math.min(start, end) - .005], materials.gunDark, [Math.PI / 2, 0, 0], 40);
  for (const side of [-1, 1]) for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2;
    box(parent, [.006, .012, length * .5], [Math.cos(angle) * radius, .015 + Math.sin(angle) * radius, center], materials.gun, .001, [0, 0, angle]);
  }
}

function createM7(materials) {
  const gun = new THREE.Group(); gun.name = 'M7';
  const m = materials;
  profile(gun, [[-.29, .02], [-.25, .12], [.39, .12], [.46, .07], [.4, -.025], [-.25, -.035]], .125, m.gun);
  profile(gun, [[-.25, -.015], [.29, -.015], [.27, -.12], [.16, -.18], [-.02, -.19], [-.09, -.15], [-.25, -.12]], .115, m.gun);
  const handguardHoles = [];
  for (let i = 0; i < 5; i++) handguardHoles.push(rectangularHole(-.79 + i * .115, -.005, .087, .026));
  for (let i = 0; i < 4; i++) handguardHoles.push(rectangularHole(-.74 + i * .12, .066, .07, .014));
  profile(gun, [[-.94, -.075], [-.97, .035], [-.91, .105], [-.28, .105], [-.25, .055], [-.28, -.07]], .14, m.gun, handguardHoles);
  box(gun, [.072, .055, .62], [0, .015, -.62], m.gunDark, .008);
  cylinder(gun, .025, .38, [0, .015, -1.02], m.gun, [Math.PI / 2, 0, 0], 40);
  suppressor(gun, -1.5, -1.15, .052, m);
  rail(gun, -.93, .41, .125, m);
  for (const side of [-1, 1]) {
    box(gun, [.018, .027, .62], [side * .078, -.073, -.61], m.gunDark, .004);
    for (let i = 0; i < 10; i++) box(gun, [.022, .014, .024], [side * .08, -.086, -.88 + i * .06], m.polymer, .003);
    for (const z of [-.89, -.32, -.2, .29]) screw(gun, side * .073, .01, z, m);
  }
  const magazine = new THREE.Group(); magazine.userData.baseY = 0; gun.add(magazine);
  profile(magazine, [[-.18, -.14], [.015, -.14], [.025, -.45], [-.17, -.45], [-.2, -.29]], .095, m.polymer);
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) box(magazine, [.009, .025, .15], [side * .052, -.23 - i * .07, -.08], m.gun, .003);
  box(magazine, [.11, .025, .21], [0, -.46, -.07], m.gunDark, .005);
  profile(gun, [[.16, -.12], [.29, -.1], [.39, -.38], [.27, -.43], [.16, -.26]], .09, m.polymer);
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) box(gun, [.006, .012, .085], [side * .049, -.2 - i * .035, .26 + i * .012], m.gunDark, .002, [0, 0, -.15]);
  const triggerGuard = pathFrom([[.02, -.13], [.17, -.13], [.18, -.22], [.13, -.27], [.03, -.26], [-.01, -.2]]);
  triggerGuard.holes.push(pathFrom([[.035, -.17], [.13, -.17], [.135, -.215], [.1, -.235], [.04, -.225], [.02, -.2]]));
  const guardGeometry = new THREE.ExtrudeGeometry(triggerGuard, { depth: .035, bevelEnabled: true, bevelSize: .003, bevelThickness: .003, bevelSegments: 2 });
  guardGeometry.translate(0, 0, -.0175); guardGeometry.rotateY(-Math.PI / 2); mesh(gun, guardGeometry, m.gun);
  box(gun, [.018, .08, .018], [0, -.18, .09], m.gunEdge, .004, [-.35, 0, 0]);
  profile(gun, [[.39, .08], [.54, .08], [.56, -.03], [.4, -.04]], .12, m.polymer);
  const stockHoles = [
    [[.57, .035], [.77, .035], [.61, -.08]],
    [[.68, -.11], [.86, -.04], [.85, -.18]],
  ];
  profile(gun, [[.5, .08], [.87, .1], [.94, .04], [.92, -.29], [.79, -.28], [.58, -.1], [.51, -.04]], .11, m.polymer, stockHoles);
  box(gun, [.15, .34, .045], [0, -.085, .94], m.polymer, .014, [0, 0, -.06]);
  box(gun, [.13, .06, .36], [0, .115, .68], m.polymer, .012);
  for (const side of [-1, 1]) cylinder(gun, .018, .34, [side * .046, .015, .58], m.gunEdge, [Math.PI / 2, 0, 0], 24, true);
  box(gun, [.012, .06, .24], [.07, .03, .04], m.gunDark, .005);
  box(gun, [.014, .038, .19], [.077, .03, .035], m.gunEdge, .004);
  box(gun, [.055, .022, .08], [.102, .07, .21], m.gun, .005);
  cylinder(gun, .023, .02, [.071, -.065, .21], m.gunDark, [0, 0, Math.PI / 2], 28);
  box(gun, [.02, .014, .08], [.084, -.065, .19], m.gunEdge, .003, [.35, 0, 0]);
  redDot(gun, m);
  const frontSight = new THREE.Group(); gun.add(frontSight);
  box(frontSight, [.035, .09, .04], [0, .185, -.86], m.gunDark, .005);
  box(frontSight, [.065, .018, .04], [0, .23, -.86], m.gunDark, .004);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, .015, -1.52); gun.add(muzzle);
  label(gun, 'M7  6.8×51', -.069, .025, .08, m, .22);
  gun.userData = { weapon: 'm7', magazine, muzzle, frontSight, adsHeight: .235 };
  return gun;
}

function scope(parent, materials) {
  const group = new THREE.Group(); group.position.set(0, .235, .02); parent.add(group);
  cylinder(group, .042, .46, [0, 0, 0], materials.gunDark, [Math.PI / 2, 0, 0], 48, true);
  cylinder(group, .068, .18, [0, 0, -.3], materials.gunDark, [Math.PI / 2, 0, 0], 48, true, .043);
  cylinder(group, .054, .13, [0, 0, .28], materials.gunDark, [Math.PI / 2, 0, 0], 48, true, .043);
  for (const z of [-.39, -.2, .2, .34]) torus(group, z === -.39 ? .068 : .046, .004, [0, 0, z], materials.gunEdge);
  cylinder(group, .06, .003, [0, 0, -.393], materials.glass, [Math.PI / 2, 0, 0], 48);
  for (const z of [-.14, .16]) {
    torus(group, .044, .009, [0, 0, z], materials.gunEdge);
    box(group, [.035, .13, .05], [0, -.09, z], materials.gunEdge, .005);
  }
  cylinder(group, .026, .075, [0, .065, .02], materials.gunDark, null, 32);
  cylinder(group, .026, .075, [.065, 0, .02], materials.gunDark, [0, 0, Math.PI / 2], 32);
  for (let i = 0; i < 24; i++) {
    const angle = i / 24 * Math.PI * 2;
    box(group, [.005, .06, .005], [Math.cos(angle) * .027, .065, .02 + Math.sin(angle) * .027], materials.gunEdge, .001);
  }
  return group;
}

function createAWM(materials) {
  const gun = new THREE.Group(); gun.name = 'AWM'; const m = materials;
  profile(gun, [[-.4, -.04], [-.42, .07], [.31, .1], [.42, .04], [.35, -.08], [-.35, -.09]], .115, m.awm, [rectangularHole(-.12, .005, .42, .035)]);
  profile(gun, [[-.25, .06], [.31, .07], [.36, .015], [.26, -.07], [-.22, -.06]], .105, m.gun);
  cylinder(gun, .023, .88, [0, .025, -.82], m.gun, [Math.PI / 2, 0, 0], 48);
  for (let i = 0; i < 8; i++) torus(gun, .024, .002, [0, .025, -.48 - i * .09], m.gunEdge);
  suppressor(gun, -1.68, -1.23, .061, m);
  cylinder(gun, .038, .09, [0, .025, -1.2], m.gun, [Math.PI / 2, 0, 0], 40);
  rail(gun, -.25, .34, .11, m, .08);
  const magazine = new THREE.Group(); magazine.userData.baseY = 0; gun.add(magazine);
  profile(magazine, [[-.02, -.07], [.16, -.07], [.18, -.28], [0, -.31], [-.03, -.2]], .09, m.gunDark);
  box(magazine, [.11, .025, .22], [0, -.3, .08], m.polymer, .005);
  const stockHole = [[.48, -.06], [.56, .015], [.67, .015], [.72, -.07], [.68, -.18], [.55, -.18], [.48, -.12]];
  profile(gun, [[.27, .03], [.43, .07], [.5, .1], [.93, .09], [1, .04], [1, -.25], [.82, -.27], [.62, -.32], [.42, -.22], [.32, -.12]], .12, m.awm, [stockHole]);
  profile(gun, [[.28, -.07], [.38, -.06], [.47, -.3], [.36, -.36], [.27, -.21]], .085, m.awm);
  box(gun, [.14, .32, .05], [0, -.08, 1], m.polymer, .014);
  for (let i = 0; i < 4; i++) box(gun, [.13, .25, .012], [0, -.07, .91 + i * .018], m.gunDark, .003);
  box(gun, [.15, .07, .36], [0, .13, .78], m.polymer, .014);
  box(gun, [.13, .025, .31], [0, .1, .77], m.gunDark, .006);
  for (const side of [-1, 1]) {
    for (const [y, z] of [[.02, -.31], [.02, .18], [.04, .4], [-.19, .82], [.04, .92]]) screw(gun, side * .066, y, z, m, .009);
    torus(gun, .022, .005, [side * .075, -.1, .89], m.gunEdge, [0, Math.PI / 2, 0]);
    box(gun, [.016, .04, .32], [side * .054, -.09, -.52], m.gunDark, .004, [.09, 0, 0]);
  }
  const scopeGroup = scope(gun, m);
  const bolt = new THREE.Group(); bolt.position.set(0, .055, .21); gun.add(bolt);
  cylinder(bolt, .017, .23, [0, 0, 0], m.gunEdge, [Math.PI / 2, 0, 0], 32);
  cylinder(bolt, .018, .13, [.095, 0, .08], m.gunEdge, [0, 0, Math.PI / 2], 24);
  mesh(bolt, new THREE.SphereGeometry(.03, 24, 16), m.gunDark, [.16, 0, .08]);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, .015, -1.7); gun.add(muzzle);
  label(gun, 'AWM  .338 LAPUA', -.064, .015, .13, m, .22);
  gun.userData = { weapon: 'awm', magazine, muzzle, bolt, scope: scopeGroup, adsHeight: .235 };
  return gun;
}

export function createReferencedWeapon(id, materials, viewModel = false) {
  const gun = id === 'm7' ? createM7(materials) : createAWM(materials);
  let triangles = 0;
  gun.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = !viewModel; object.receiveShadow = true;
    triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
  });
  gun.userData.triangles = Math.round(triangles);
  return gun;
}
