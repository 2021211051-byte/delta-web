import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function addMesh(parent, geometry, material, position = [0, 0, 0], rotation = null) {
  const object = new THREE.Mesh(geometry, material); object.position.set(...position);
  if (rotation) object.rotation.set(...rotation);
  object.frustumCulled = false; parent.add(object); return object;
}

function limb(parent, start, end, radius, material, sleeves) {
  const a = new THREE.Vector3(...start); const b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a); const length = direction.length();
  const object = addMesh(parent, new THREE.CapsuleGeometry(radius, Math.max(.01, length - radius * 2), 10, 24), material);
  object.position.copy(a.add(b).multiplyScalar(.5));
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  sleeves.push(object);
  return object;
}

function glove(parent, material, accent, side) {
  const hand = new THREE.Group(); parent.add(hand);
  addMesh(hand, new RoundedBoxGeometry(.098, .058, .135, 5, .023), material);
  addMesh(hand, new RoundedBoxGeometry(.078, .016, .08, 4, .01), accent, [0, .035, .005]);
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * .023;
    const finger = addMesh(hand, new THREE.CapsuleGeometry(.011, .062, 7, 14), material, [x, -.018, -.078], [.78, 0, 0]);
    addMesh(finger, new THREE.SphereGeometry(.012, 14, 10), accent, [0, -.038, 0]);
    addMesh(hand, new THREE.BoxGeometry(.016, .006, .02), accent, [x, .041, -.025]);
  }
  const thumb = addMesh(hand, new THREE.CapsuleGeometry(.015, .06, 7, 16), material, [side * -.056, -.01, -.012], [.35, 0, side * .65]);
  addMesh(thumb, new THREE.SphereGeometry(.016, 14, 10), accent, [0, -.036, 0]);
  for (let i = 0; i < 3; i++) addMesh(hand, new THREE.BoxGeometry(.07, .004, .005), accent, [0, .037, -.005 + i * .024]);
  return hand;
}

export function createFirstPersonArms(materials) {
  const root = new THREE.Group();
  const right = new THREE.Group(); const left = new THREE.Group(); root.add(right, left);
  const sleeves = []; const exo = [];
  limb(right, [.32, -.5, .4], [.095, -.22, .28], .055, materials.camo, sleeves);
  limb(right, [.095, -.22, .28], [.05, -.17, .25], .045, materials.camo, sleeves);
  addMesh(right, new THREE.TorusGeometry(.044, .008, 10, 32), materials.leather, [.052, -.17, .25], [1.15, 0, .1]);
  const rightHand = glove(right, materials.leather, materials.armor, 1);
  rightHand.position.set(.032, -.15, .265); rightHand.rotation.set(.1, 0, -.08);
  limb(left, [-.29, -.45, .02], [-.13, -.19, -.22], .056, materials.camo, sleeves);
  limb(left, [-.13, -.19, -.22], [-.035, -.1, -.49], .045, materials.camo, sleeves);
  addMesh(left, new THREE.TorusGeometry(.045, .008, 10, 32), materials.leather, [-.035, -.1, -.47], [1.05, 0, -.1]);
  const leftHand = glove(left, materials.leather, materials.armor, -1);
  leftHand.position.set(-.025, -.095, -.53); leftHand.rotation.set(-.15, 0, .08);
  exo.push(addMesh(right, new RoundedBoxGeometry(.07, .055, .2, 4, .012), materials.gunEdge, [.105, -.225, .3], [.65, 0, -.1]));
  exo.push(addMesh(left, new RoundedBoxGeometry(.07, .055, .2, 4, .012), materials.gunEdge, [-.12, -.2, -.22], [.65, 0, .1]));
  exo.push(addMesh(right, new RoundedBoxGeometry(.074, .018, .05, 3, .006), materials.redAccent, [.115, -.2, .28]));
  exo.push(addMesh(left, new RoundedBoxGeometry(.074, .018, .05, 3, .006), materials.redAccent, [-.12, -.17, -.2]));
  root.userData = { right, left, rightHand, leftHand, sleeves, exo };
  return root;
}

export function setFirstPersonOperator(arms, operator, materials) {
  if (!arms.userData.vyronSleeve) {
    arms.userData.vyronSleeve = materials.camo.clone(); arms.userData.vyronSleeve.color.set(0x697782);
  }
  const sleeve = operator === 'luna' ? materials.skin : operator === 'redwolf' ? materials.blackCloth : arms.userData.vyronSleeve;
  for (const object of arms.userData.sleeves) object.material = sleeve;
  for (const object of arms.userData.exo) object.visible = operator === 'redwolf';
}

export function poseFirstPersonArms(arms, equipment) {
  const { right, left } = arms.userData;
  arms.scale.setScalar(equipment === 'bow' ? .9 : 1);
  right.position.set(0, 0, 0); left.position.set(0, 0, 0);
  right.rotation.set(0, 0, 0); left.rotation.set(0, 0, 0);
  if (equipment === 'awm') {
    left.position.set(0, -.005, .18); left.rotation.x = -.05;
    right.position.set(.008, -.005, .04);
  } else if (equipment === 'bow') {
    left.position.set(-.015, .08, .49); left.rotation.set(-.35, 0, -.2);
    right.position.set(-.05, .08, -.06); right.rotation.set(.3, 0, .15);
  } else if (equipment === 'launcher') {
    left.position.set(.02, -.02, -.1); right.position.set(0, -.015, -.02);
  } else if (equipment === 'magnetic') {
    right.position.set(-.18, .03, -.2); left.position.set(.12, .05, .37);
  }
  left.userData.basePosition = left.position.clone();
  right.userData.basePosition = right.position.clone();
}
