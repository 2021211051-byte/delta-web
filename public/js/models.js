import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { labelTexture, standardMaterial } from './textures.js';
import { createReferencedWeapon } from './weapon-factory.js';
import { createFirstPersonArms, poseFirstPersonArms } from './first-person.js';
import { createBow, createLauncher, createMagnetic } from './equipment.js';
import { modelAssets } from './asset-library.js';

const geometryCache = new Map();
function roundedGeometry(x, y, z, radius = 0.025) {
  const key = `${x}/${y}/${z}/${radius}`;
  if (!geometryCache.has(key)) geometryCache.set(key, new RoundedBoxGeometry(x, y, z, 2, Math.min(radius, x / 3, y / 3, z / 3)));
  return geometryCache.get(key);
}

function mesh(parent, geometry, material, position = [0, 0, 0], rotation = null) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  if (rotation) object.rotation.set(...rotation);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(parent, size, position, material, radius = .025, rotation = null) {
  return mesh(parent, roundedGeometry(...size, radius), material, position, rotation);
}

function cylinder(parent, top, bottom, length, position, material, rotation = null, segments = 12) {
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, length, segments), material, position, rotation);
}

function sphere(parent, radius, position, material, scale = [1, 1, 1], segments = 20) {
  const object = mesh(parent, new THREE.SphereGeometry(radius, segments, Math.max(10, segments / 2)), material, position);
  object.scale.set(...scale);
  return object;
}

export function createModelMaterials(textures) {
  return {
    gun: standardMaterial(textures.gunmetal, { roughness: .38, metalness: .76, bumpScale: .008 }),
    gunDark: new THREE.MeshStandardMaterial({ color: 0x101512, roughness: .5, metalness: .65 }),
    gunEdge: new THREE.MeshStandardMaterial({ color: 0x717970, roughness: .3, metalness: .85 }),
    polymer: standardMaterial(textures.rubber, { roughness: .68, bumpScale: .01 }),
    awm: standardMaterial(textures.awm, { color: 0xb0b09c, roughness: .55, metalness: .12, bumpScale: .012 }),
    cloth: standardMaterial(textures.fabric, { roughness: .95, bumpScale: .025 }),
    camo: standardMaterial(textures.camo, { roughness: .92, bumpScale: .02 }),
    vest: new THREE.MeshStandardMaterial({ color: 0x343e31, roughness: .92, map: textures.fabric, bumpMap: textures.fabric, bumpScale: .025 }),
    armor: new THREE.MeshStandardMaterial({ color: 0x465040, roughness: .65, metalness: .12 }),
    blackCloth: new THREE.MeshStandardMaterial({ color: 0x191f1c, roughness: .93, map: textures.fabric }),
    leather: new THREE.MeshStandardMaterial({ color: 0x242822, roughness: .76, map: textures.rubber }),
    skin: new THREE.MeshStandardMaterial({ color: 0xc89675, roughness: .82 }),
    skinDark: new THREE.MeshStandardMaterial({ color: 0x79543f, roughness: .82 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x171814, roughness: .9 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xb8d1c8, metalness: 0, roughness: .08, transmission: 0, transparent: true, opacity: .14, depthWrite: false }),
    redGlass: new THREE.MeshPhysicalMaterial({ color: 0x9b251c, emissive: 0x8f160e, emissiveIntensity: .8, roughness: .15 }),
    lunaAccent: new THREE.MeshStandardMaterial({ color: 0x5d8990, roughness: .55, metalness: .35 }),
    redAccent: new THREE.MeshStandardMaterial({ color: 0x914235, roughness: .55, metalness: .3 }),
    light: new THREE.MeshStandardMaterial({ color: 0xd8ef8b, emissive: 0xaacb5e, emissiveIntensity: 1.5 }),
  };
}

function addPicatinny(parent, material, startZ, endZ, y, width = .085) {
  box(parent, [width, .025, Math.abs(endZ - startZ)], [0, y, (startZ + endZ) / 2], material, .004);
  const count = Math.floor(Math.abs(endZ - startZ) / .035);
  for (let i = 0; i <= count; i++) {
    box(parent, [width + .018, .014, .016], [0, y + .016, startZ + (endZ - startZ) * (i / count)], material, .002);
  }
}

function addScrew(parent, position, material, rotation = [0, 0, Math.PI / 2]) {
  const screw = cylinder(parent, .008, .008, .004, position, material, rotation, 10);
  return screw;
}

function addWeaponLabel(parent, text, position, rotation, width = .16) {
  const material = new THREE.MeshBasicMaterial({ map: labelTexture(text, { width: 256, height: 64, background: '#252a27', color: '#b9c0ad', border: false, fontSize: 32 }), transparent: false });
  return mesh(parent, new THREE.PlaneGeometry(width, width / 4), material, position, rotation);
}

function createWeaponBase(id, materials, viewModel = false) {
  const gun = new THREE.Group();
  gun.name = id.toUpperCase();
  const m = materials;
  if (id === 'm7') {
    box(gun, [.105, .145, .47], [0, 0, -.08], m.gun, .022);
    box(gun, [.096, .11, .45], [0, -.005, .365], m.polymer, .02);
    box(gun, [.11, .13, .37], [0, .002, -.48], m.polymer, .018);
    cylinder(gun, .025, .025, .55, [0, .015, -.88], m.gun, [Math.PI / 2, 0, 0], 16);
    cylinder(gun, .042, .037, .14, [0, .015, -1.21], m.gunDark, [Math.PI / 2, 0, 0], 12);
    for (let i = 0; i < 5; i++) box(gun, [.085 - i * .004, .006, .014], [0, .015, -1.26 + i * .022], m.gunEdge, .001);
    cylinder(gun, .016, .016, .09, [0, .015, -1.31], m.gunDark, [Math.PI / 2, 0, 0], 12);
    addPicatinny(gun, m.gunDark, .24, -.67, .09);
    for (let i = 0; i < 7; i++) {
      box(gun, [.008, .037, .04], [-.059, .005, -.34 - i * .043], m.gunDark, .002);
      box(gun, [.008, .037, .04], [.059, .005, -.34 - i * .043], m.gunDark, .002);
    }
    const magazine = new THREE.Group(); magazine.position.set(0, -.085, -.1); magazine.rotation.x = -.13; gun.add(magazine);
    box(magazine, [.085, .25, .12], [0, -.105, 0], m.gun, .018);
    box(magazine, [.095, .025, .13], [0, -.24, 0], m.polymer, .007);
    for (let i = 0; i < 4; i++) box(magazine, [.09, .008, .125], [0, -.04 - i * .05, 0], m.gunDark, .002);
    box(gun, [.075, .21, .1], [0, -.15, .2], m.polymer, .022, [-.18, 0, 0]);
    box(gun, [.12, .055, .12], [0, -.01, .63], m.polymer, .014);
    box(gun, [.085, .18, .12], [0, -.015, .54], m.polymer, .02, [0, 0, 0]);
    box(gun, [.035, .07, .22], [0, .015, .32], m.gunDark, .006);
    cylinder(gun, .025, .025, .105, [0, .02, .59], m.gun, [0, 0, Math.PI / 2]);
    box(gun, [.07, .025, .05], [.083, .04, .02], m.gunEdge, .004);
    cylinder(gun, .012, .012, .045, [.1, .04, .02], m.gunDark, [0, 0, Math.PI / 2]);
    const sight = new THREE.Group(); sight.position.set(0, .12, -.11); gun.add(sight);
    box(sight, [.105, .025, .1], [0, 0, 0], m.gunDark, .007);
    box(sight, [.014, .1, .065], [-.045, .055, 0], m.gunDark, .005);
    box(sight, [.014, .1, .065], [.045, .055, 0], m.gunDark, .005);
    box(sight, [.105, .014, .065], [0, .105, 0], m.gunDark, .005);
    mesh(sight, new THREE.PlaneGeometry(.075, .075), m.glass, [0, .057, .034]);
    sphere(sight, .004, [0, .055, .037], m.redGlass, [1, 1, 1], 8);
    const frontSight = new THREE.Group(); gun.add(frontSight);
    box(frontSight, [.032, .1, .045], [0, .15, -.63], m.gunDark, .004);
    box(frontSight, [.055, .016, .04], [0, .205, -.63], m.gunDark, .003);
    gun.userData.frontSight = frontSight;
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) addScrew(gun, [side * .055, .025, -.02 - i * .12], m.gunEdge);
    addWeaponLabel(gun, 'M7  6.8×51', [-.054, .01, -.05], [0, -Math.PI / 2, 0]);
    gun.userData.muzzle = new THREE.Object3D(); gun.userData.muzzle.position.set(0, .015, -1.39); gun.add(gun.userData.muzzle);
    gun.userData.magazine = magazine;
    gun.userData.adsHeight = .17;
  } else {
    box(gun, [.1, .15, .5], [0, 0, -.16], m.gun, .02);
    box(gun, [.115, .15, .58], [0, -.025, .26], m.awm, .028);
    box(gun, [.12, .22, .2], [0, -.04, .62], m.awm, .035, [-.1, 0, 0]);
    box(gun, [.125, .07, .18], [0, -.09, .72], m.polymer, .018);
    box(gun, [.075, .18, .12], [0, -.17, .2], m.polymer, .022, [-.22, 0, 0]);
    box(gun, [.095, .2, .15], [0, -.14, -.17], m.awm, .014);
    box(gun, [.105, .025, .16], [0, -.25, -.17], m.gunDark, .005);
    cylinder(gun, .027, .031, .96, [0, .015, -.89], m.gun, [Math.PI / 2, 0, 0], 20);
    for (let i = 0; i < 7; i++) cylinder(gun, .034, .034, .012, [0, .015, -.52 - i * .095], m.gunEdge, [Math.PI / 2, 0, 0], 16);
    cylinder(gun, .051, .046, .2, [0, .015, -1.46], m.gunDark, [Math.PI / 2, 0, 0], 16);
    for (const side of [-1, 1]) box(gun, [.012, .045, .11], [side * .047, .015, -1.46], m.gunEdge, .002);
    addPicatinny(gun, m.gunDark, .08, -.39, .092);
    const scope = new THREE.Group(); scope.position.set(0, .18, -.12); gun.add(scope);
    mesh(scope, new THREE.CylinderGeometry(.047, .047, .39, 40, 1, true), m.gunDark, [0, 0, 0], [Math.PI / 2, 0, 0]);
    mesh(scope, new THREE.CylinderGeometry(.068, .052, .13, 40, 1, true), m.gunDark, [0, 0, -.23], [Math.PI / 2, 0, 0]);
    mesh(scope, new THREE.CylinderGeometry(.057, .047, .1, 40, 1, true), m.gunDark, [0, 0, .23], [Math.PI / 2, 0, 0]);
    cylinder(scope, .052, .052, .003, [0, 0, -.298], m.glass, [Math.PI / 2, 0, 0], 40);
    for (const z of [-.13, .12]) box(gun, [.035, .13, .045], [0, .105, z - .12], m.gunEdge, .006);
    cylinder(scope, .024, .024, .065, [0, .065, 0], m.gunEdge, null, 24);
    cylinder(scope, .024, .024, .065, [.064, 0, 0], m.gunEdge, [0, 0, Math.PI / 2], 24);
    const bolt = new THREE.Group(); bolt.position.set(0, .035, .12); gun.add(bolt);
    cylinder(bolt, .016, .016, .19, [0, 0, 0], m.gunEdge, [Math.PI / 2, 0, 0], 24);
    cylinder(bolt, .018, .018, .12, [.09, 0, .08], m.gunEdge, [0, 0, Math.PI / 2], 24);
    sphere(bolt, .027, [.15, 0, .08], m.gunDark, [1, 1, 1], 20);
    gun.userData.bolt = bolt;
    gun.userData.scope = scope;
    for (const x of [-.045, .045]) {
      const bipod = cylinder(gun, .012, .012, .48, [x, -.07, -.68], m.gunDark, [Math.PI / 2, 0, 0], 10);
      bipod.rotation.z = x * 2;
    }
    addWeaponLabel(gun, 'AWM  .338', [-.059, .01, -.13], [0, -Math.PI / 2, 0], .19);
    gun.userData.muzzle = new THREE.Object3D(); gun.userData.muzzle.position.set(0, .015, -1.57); gun.add(gun.userData.muzzle);
    gun.userData.adsHeight = .18;
  }
  gun.userData.weapon = id;
  gun.traverse((object) => { if (object.isMesh) { object.castShadow = !viewModel; object.receiveShadow = true; object.frustumCulled = false; } });
  return gun;
}

export function createWeapon(id, materials, viewModel = false) {
  return modelAssets()?.weapon(id, viewModel) || createReferencedWeapon(id, materials, viewModel);
}

function makeNameSprite(name, color) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
  const c = canvas.getContext('2d'); c.fillStyle = 'rgba(8,12,10,.72)'; c.fillRect(70, 10, 372, 62);
  c.strokeStyle = color; c.lineWidth = 3; c.strokeRect(70, 10, 372, 62);
  c.font = '600 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#f0f4eb'; c.fillText(name.slice(0, 14), 256, 41);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true }));
  sprite.scale.set(1.7, .32, 1); sprite.position.set(0, 2.08, 0);
  return sprite;
}

function createArm(parent, side, materials, operator) {
  const shoulder = new THREE.Group(); shoulder.position.set(side * (operator === 'luna' ? .32 : .36), .45, 0); parent.add(shoulder);
  const bare = operator === 'luna';
  const sleeve = bare ? materials.skin : operator === 'redwolf' ? materials.blackCloth : materials.camo;
  sphere(shoulder, bare ? .105 : .13, [0, -.05, 0], sleeve, [1, 1.15, 1]);
  cylinder(shoulder, bare ? .077 : .095, bare ? .07 : .085, .31, [0, -.2, 0], sleeve);
  const elbow = new THREE.Group(); elbow.position.set(0, -.36, 0); shoulder.add(elbow);
  sphere(elbow, bare ? .068 : .085, [0, 0, 0], sleeve);
  cylinder(elbow, bare ? .065 : .082, .06, .29, [0, -.17, 0], sleeve);
  if (!bare) box(elbow, [.13, .14, .1], [0, -.05, -.065], materials.armor, .025);
  if (operator === 'redwolf') {
    box(shoulder, [.055, .28, .09], [side * .105, -.18, 0], materials.gunEdge, .012, [0, 0, side * -.08]);
    box(elbow, [.055, .26, .08], [side * .085, -.17, 0], materials.gunEdge, .01);
    cylinder(elbow, .035, .035, .075, [side * .1, -.02, 0], materials.redAccent, [0, 0, Math.PI / 2], 16);
  }
  const hand = sphere(elbow, .075, [0, -.36, 0], materials.leather, [.8, 1.15, .8]);
  for (let i = 0; i < 4; i++) box(elbow, [.018, .075, .025], [(i - 1.5) * .021, -.4, -.025], materials.leather, .006, [.2, 0, 0]);
  shoulder.rotation.x = .8; shoulder.rotation.z = side * -.17;
  elbow.rotation.x = .9;
  return { shoulder, elbow, hand };
}

function createLeg(parent, side, materials) {
  const hip = new THREE.Group(); hip.position.set(side * .16, 0, 0); parent.add(hip);
  cylinder(hip, .13, .105, .4, [0, -.23, 0], materials.camo);
  box(hip, [.2, .16, .17], [0, -.16, -.055], materials.cloth, .025);
  const knee = new THREE.Group(); knee.position.set(0, -.45, 0); hip.add(knee);
  sphere(knee, .105, [0, 0, 0], materials.camo, [1, .9, 1]);
  box(knee, [.19, .17, .09], [0, -.015, -.09], materials.armor, .035);
  cylinder(knee, .1, .075, .38, [0, -.24, 0], materials.camo);
  box(knee, [.17, .14, .28], [0, -.47, -.06], materials.leather, .035);
  box(knee, [.175, .035, .3], [0, -.55, -.065], materials.polymer, .01);
  for (let i = 0; i < 3; i++) box(knee, [.13, .009, .015], [0, -.425, -.15 + i * .035], materials.gunEdge, .002);
  return { hip, knee };
}

export function createOperator(operator, name, materials) {
  const asset = modelAssets()?.operator(operator, name);
  if (asset) return asset;
  const kit = { ...materials };
  if (operator === 'luna') {
    kit.camo = materials.camo.clone(); kit.camo.color.set(0x92977b);
    kit.cloth = materials.cloth.clone(); kit.cloth.color.set(0x677255);
    kit.vest = materials.vest.clone(); kit.vest.color.set(0x606b50);
  } else if (operator === 'redwolf') {
    kit.camo = materials.blackCloth; kit.cloth = materials.blackCloth;
    kit.vest = materials.vest.clone(); kit.vest.color.set(0x29332c);
  } else {
    kit.camo = materials.camo.clone(); kit.camo.color.set(0x7f8c9b);
  }
  const root = new THREE.Group();
  const visual = new THREE.Group(); root.add(visual);
  const hips = new THREE.Group(); hips.position.y = .96; visual.add(hips);
  box(hips, [operator === 'luna' ? .33 : .36, .2, .24], [0, -.02, 0], kit.cloth, .07);
  box(hips, [.42, .075, .29], [0, .08, 0], materials.leather, .015);
  box(hips, [.075, .065, .025], [0, .08, -.158], materials.gunEdge, .006);
  const torso = new THREE.Group(); torso.position.set(0, .08, 0); hips.add(torso);
  box(torso, [operator === 'luna' ? .43 : .52, .58, .27], [0, .25, 0], kit.camo, .09);
  box(torso, [operator === 'luna' ? .4 : .47, .42, .12], [0, .25, -.18], kit.vest, .04);
  box(torso, [.35, .27, .035], [0, .3, -.25], operator === 'luna' ? kit.vest : materials.armor, .025);
  box(torso, [.4, .42, .12], [0, .23, .18], kit.vest, .04);
  for (const side of [-1, 1]) {
    box(torso, [.08, .43, .065], [side * .17, .32, -.235], materials.leather, .012, [0, 0, side * -.09]);
    for (let i = 0; i < 2; i++) box(torso, [.12, .15, .09], [side * (.085 + i * .07), .05, -.26], kit.cloth, .012);
    box(hips, [.14, .2, .1], [side * .23, -.05, 0], kit.cloth, .02);
  }
  box(torso, [.14, .2, .1], [-.29, .12, .04], materials.blackCloth, .015);
  cylinder(torso, .009, .009, .32, [-.29, .36, .04], materials.gunDark, null, 10);
  const patchMaterial = operator === 'luna' ? materials.lunaAccent : operator === 'redwolf' ? materials.redAccent : materials.light;
  box(torso, [.1, .055, .012], [.11, .41, -.27], patchMaterial, .005);
  const skin = operator === 'redwolf' ? materials.skinDark : materials.skin;
  cylinder(torso, .075, .085, .12, [0, .59, 0], skin);
  const head = new THREE.Group(); head.position.set(0, .72, 0); torso.add(head);
  sphere(head, .155, [0, 0, 0], skin, [.88, 1.12, .92], 32);
  sphere(head, .026, [0, -.015, -.151], skin, [.75, 1.1, 1], 20);
  for (const side of [-1, 1]) {
    sphere(head, .035, [side * .14, 0, 0], skin, [.55, 1, .8]);
    box(head, [.052, .012, .012], [side * .058, .035, -.139], materials.hair, .003);
    sphere(head, .012, [side * .054, .015, -.147], materials.hair, [1.2, .55, .5], 12);
  }
  if (operator === 'vyron') {
    sphere(head, .165, [0, .07, .015], materials.armor, [1, .72, 1.05], 28);
    box(head, [.28, .055, .055], [0, .075, -.12], materials.armor, .015);
    const amber = new THREE.MeshPhysicalMaterial({ color: 0xc78745, roughness: .16, transparent: true, opacity: .55 });
    box(head, [.24, .07, .025], [0, .045, -.153], amber, .014);
    box(head, [.23, .14, .04], [0, -.09, -.12], materials.blackCloth, .04);
    box(head, [.075, .07, .07], [0, .19, -.1], materials.gunDark, .008);
    box(head, [.035, .17, .035], [0, .27, -.07], materials.gunEdge, .005, [-.3, 0, 0]);
    for (const side of [-1, 1]) {
      cylinder(head, .035, .035, .025, [side * .145, .015, 0], materials.gunDark, [0, 0, Math.PI / 2]);
      cylinder(head, .035, .035, .13, [side * .055, .33, -.09], materials.gunEdge, [-.25, 0, 0], 24);
      cylinder(head, .036, .036, .015, [side * .055, .27, -.11], materials.redGlass, [-.25, 0, 0], 24);
    }
  } else if (operator === 'luna') {
    sphere(head, .16, [0, .07, .025], materials.hair, [1, .75, 1], 28);
    const pony = new THREE.Group(); pony.position.set(0, .08, .14); head.add(pony);
    cylinder(pony, .045, .07, .36, [0, -.13, .05], materials.hair, [-.35, 0, 0], 24);
    sphere(pony, .075, [0, -.28, .11], materials.hair, [.8, 1.4, .8], 20);
    box(head, [.07, .13, .06], [-.135, .025, .01], materials.lunaAccent, .015);
    const quiver = new THREE.Group(); quiver.position.set(-.13, .23, .28); quiver.rotation.z = -.22; torso.add(quiver);
    cylinder(quiver, .07, .07, .55, [0, 0, 0], materials.blackCloth, null, 24);
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * .025;
      cylinder(quiver, .005, .005, .75, [x, .22, 0], materials.gunEdge, null, 10);
      box(quiver, [.035, .07, .012], [x, .58, 0], materials.lunaAccent, .004, [0, 0, i % 2 ? .3 : -.3]);
    }
  } else {
    sphere(head, .155, [0, -.085, -.055], materials.hair, [.86, .55, .9], 24);
    sphere(head, .16, [0, .075, .02], materials.blackCloth, [1, .58, 1], 28);
    box(head, [.19, .025, .17], [0, .065, -.16], materials.blackCloth, .012, [-.12, 0, 0]);
    const amber = new THREE.MeshPhysicalMaterial({ color: 0xc67736, roughness: .2, transparent: true, opacity: .55 });
    for (const side of [-1, 1]) {
      box(head, [.105, .055, .018], [side * .06, .025, -.153], amber, .015);
      cylinder(head, .052, .052, .04, [side * .16, .015, .015], materials.gunDark, [0, 0, Math.PI / 2], 24);
      box(head, [.025, .12, .035], [side * .155, .06, .02], materials.gunEdge, .006);
    }
    cylinder(head, .008, .008, .15, [-.13, -.055, -.09], materials.gunDark, [Math.PI / 2, 0, -.5], 12);
    sphere(head, .018, [-.08, -.075, -.16], materials.gunDark, [1, 1, 1], 12);
    box(torso, [.42, .08, .12], [0, .51, 0], materials.blackCloth, .025);
  }
  const leftArm = createArm(torso, -1, materials, operator);
  const rightArm = createArm(torso, 1, materials, operator);
  const leftLeg = createLeg(hips, -1, kit);
  const rightLeg = createLeg(hips, 1, kit);
  const weapon = createWeapon('m7', materials);
  weapon.scale.setScalar(.72); weapon.position.set(.12, .21, -.4); weapon.rotation.set(.06, 0, 0); torso.add(weapon);
  const nameSprite = makeNameSprite(name, operator === 'redwolf' ? '#ef745e' : operator === 'luna' ? '#70d5e8' : '#d8ef8b');
  root.add(nameSprite);
  root.userData = { visual, hips, torso, head, leftArm, rightArm, leftLeg, rightLeg, weapon, nameSprite, phase: 0, currentWeapon: 'm7' };
  root.traverse((object) => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
  return root;
}

export function animateOperator(model, data, time, dt) {
  const joints = model.userData;
  if (!joints?.hips) return;
  const speed = Math.hypot(data.velocity?.x || 0, data.velocity?.z || 0);
  const amount = Math.min(1, speed / 4.5);
  joints.phase += dt * (3 + speed * 1.45);
  const swing = Math.sin(joints.phase) * .68 * amount;
  joints.leftLeg.hip.rotation.x = swing;
  joints.rightLeg.hip.rotation.x = -swing;
  joints.leftLeg.knee.rotation.x = Math.max(0, -swing) * .72;
  joints.rightLeg.knee.rotation.x = Math.max(0, swing) * .72;
  joints.hips.position.y = .96 + Math.abs(Math.sin(joints.phase * 2)) * .027 * amount;
  joints.torso.rotation.z = Math.sin(joints.phase) * .025 * amount - (data.lean || 0) * .24;
  joints.visual.position.x = (data.lean || 0) * .16;
  joints.torso.rotation.x = .03 + amount * .06;
  joints.head.rotation.x = -(data.pitch || 0) * .45;
  joints.leftArm.shoulder.rotation.x = .88 + (data.pitch || 0) * .45 - swing * .08;
  joints.rightArm.shoulder.rotation.x = .72 + (data.pitch || 0) * .45 + swing * .08;
  const stance = data.stance || 'stand';
  const crouchTarget = stance === 'crouch' || stance === 'slide' ? 1 : 0;
  joints.crouch = (joints.crouch || 0) + (crouchTarget - (joints.crouch || 0)) * Math.min(1, dt * 12);
  const crouch = joints.crouch;
  joints.leftLeg.hip.rotation.x = swing * (1 - crouch) + crouch * 1;
  joints.rightLeg.hip.rotation.x = -swing * (1 - crouch) + crouch * 1;
  joints.leftLeg.knee.rotation.x -= crouch * 2;
  joints.rightLeg.knee.rotation.x -= crouch * 2;
  joints.hips.position.y = .96 - crouch * .36 + Math.abs(Math.sin(joints.phase * 2)) * .027 * amount * (1 - crouch);
  joints.visual.scale.y += (1 - joints.visual.scale.y) * Math.min(1, dt * 12);
  const prone = stance === 'prone' ? 1.42 : 0;
  joints.visual.rotation.x += (prone - joints.visual.rotation.x) * Math.min(1, dt * 10);
  joints.visual.position.y = stance === 'prone' ? .18 : crouch * .14;
  joints.nameSprite.visible = stance !== 'prone';
}

export function createViewModel(materials) {
  const root = new THREE.Group();
  const weapon = createWeapon('m7', materials, true); root.add(weapon);
  const arms = createFirstPersonArms(materials); root.add(arms);
  poseFirstPersonArms(arms, 'm7');
  root.userData = { weapon, arms, weaponId: 'm7' };
  return root;
}

function equipViewModel(root, object, id) {
  root.remove(root.userData.weapon);
  root.userData.weapon = object; root.add(object); root.userData.weaponId = id;
  root.userData.arms.visible = !object.userData.hasHands;
  poseFirstPersonArms(root.userData.arms, id);
}

export function setViewModelWeapon(root, id, materials) {
  if (root.userData.weaponId === id) return;
  equipViewModel(root, createWeapon(id, materials, true), id);
}

export function setViewModelDevice(root, id, materials) {
  const factory = id === 'bow' ? createBow : id === 'launcher' ? createLauncher : createMagnetic;
  const device = factory(materials);
  if (id === 'bow') device.scale.setScalar(.5);
  if (id === 'launcher') device.scale.setScalar(.88);
  equipViewModel(root, device, id);
}
