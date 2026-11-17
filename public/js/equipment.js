import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function mesh(parent, geometry, material, position = [0, 0, 0], rotation = null) {
  const object = new THREE.Mesh(geometry, material); object.position.set(...position);
  if (rotation) object.rotation.set(...rotation); object.frustumCulled = false; parent.add(object); return object;
}

function tube(parent, points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  return mesh(parent, new THREE.TubeGeometry(curve, 40, radius, 10, false), material);
}

function arrow(material, accent) {
  const group = new THREE.Group();
  mesh(group, new THREE.CylinderGeometry(.006, .006, .72, 12), material, [0, 0, -.25], [Math.PI / 2, 0, 0]);
  mesh(group, new THREE.ConeGeometry(.025, .1, 16), accent, [0, 0, -.66], [-Math.PI / 2, 0, 0]);
  for (const rotation of [0, Math.PI / 2]) {
    const fin = mesh(group, new THREE.BoxGeometry(.065, .006, .12), accent, [0, 0, .08]); fin.rotation.z = rotation;
  }
  return group;
}

export function createBow(materials) {
  const bow = new THREE.Group();
  const riser = new THREE.Group(); bow.add(riser);
  mesh(riser, new RoundedBoxGeometry(.075, .38, .085, 4, .025), materials.gun, [0, 0, 0]);
  mesh(riser, new RoundedBoxGeometry(.09, .17, .1, 4, .03), materials.polymer, [0, -.03, .005]);
  for (const y of [-.12, .12]) mesh(riser, new THREE.TorusGeometry(.035, .008, 8, 24), materials.lunaAccent, [0, y, -.05]);
  tube(bow, [[0, .15, 0], [0, .34, .04], [0, .53, .13], [0, .63, .04]], .025, materials.lunaAccent);
  tube(bow, [[0, -.15, 0], [0, -.34, .04], [0, -.53, .13], [0, -.63, .04]], .025, materials.lunaAccent);
  for (const y of [-.63, .63]) {
    mesh(bow, new THREE.TorusGeometry(.075, .015, 10, 36), materials.gunEdge, [0, y, .035]);
    mesh(bow, new THREE.CylinderGeometry(.022, .022, .045, 24), materials.gunDark, [0, y, .035], [Math.PI / 2, 0, 0]);
  }
  const stringGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -.63, .04), new THREE.Vector3(0, 0, .04), new THREE.Vector3(0, .63, .04)]);
  const string = new THREE.Line(stringGeometry, new THREE.LineBasicMaterial({ color: 0xbfc8b9 })); bow.add(string);
  const arrowGroup = arrow(materials.gunEdge, materials.lunaAccent); arrowGroup.position.set(0, 0, -.03); bow.add(arrowGroup);
  mesh(bow, new THREE.BoxGeometry(.16, .025, .12), materials.gunDark, [0, .09, -.025]);
  bow.userData = { weapon: 'bow', string, arrow: arrowGroup, adsHeight: 0 };
  return bow;
}

export function createLauncher(materials) {
  const launcher = new THREE.Group();
  for (const [x, y] of [[-.065, .045], [.065, .045], [0, -.06]]) {
    mesh(launcher, new THREE.CylinderGeometry(.052, .052, .54, 32, 1, true), materials.gun, [x, y, -.3], [Math.PI / 2, 0, 0]);
    mesh(launcher, new THREE.TorusGeometry(.053, .008, 8, 32), materials.gunEdge, [x, y, -.57]);
    mesh(launcher, new THREE.TorusGeometry(.053, .008, 8, 32), materials.gunEdge, [x, y, -.03]);
  }
  mesh(launcher, new RoundedBoxGeometry(.25, .22, .22, 4, .035), materials.gunDark, [0, 0, .02]);
  mesh(launcher, new RoundedBoxGeometry(.085, .24, .11, 4, .025), materials.polymer, [0, -.19, .08], [-.2, 0, 0]);
  mesh(launcher, new RoundedBoxGeometry(.11, .18, .2, 4, .025), materials.polymer, [0, -.11, -.3]);
  mesh(launcher, new THREE.BoxGeometry(.04, .09, .04), materials.gunEdge, [0, .17, -.24]);
  mesh(launcher, new THREE.TorusGeometry(.035, .006, 8, 24), materials.gunEdge, [0, .22, -.24]);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, -.62); launcher.add(muzzle);
  launcher.userData = { weapon: 'launcher', muzzle, adsHeight: .16 };
  return launcher;
}

function c4Display() {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
  const c = canvas.getContext('2d'); c.fillStyle = '#111813'; c.fillRect(0, 0, 256, 128);
  c.strokeStyle = '#52664d'; c.lineWidth = 6; c.strokeRect(6, 6, 244, 116);
  c.fillStyle = '#d7e7a2'; c.font = '700 46px monospace'; c.fillText('01:35', 34, 66);
  c.fillStyle = '#8a9c76'; c.font = '22px monospace'; c.fillText('C4 ARMED', 58, 102);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: .45 });
}

export function createMagnetic(materials) {
  const bomb = new THREE.Group(); bomb.name = 'C4';
  mesh(bomb, new RoundedBoxGeometry(.3, .18, .09, 5, .018), materials.gunDark);
  for (let i = 0; i < 4; i++) mesh(bomb, new RoundedBoxGeometry(.065, .145, .075, 4, .012), materials.awm, [(i - 1.5) * .068, 0, .025]);
  for (const x of [-.09, .09]) mesh(bomb, new THREE.BoxGeometry(.022, .19, .105), materials.polymer, [x, 0, .018]);
  mesh(bomb, new RoundedBoxGeometry(.11, .06, .025, 3, .006), c4Display(), [0, .025, .079]);
  mesh(bomb, new RoundedBoxGeometry(.07, .07, .05, 4, .009), materials.gun, [.09, .12, .01]);
  tube(bomb, [[-.12, .08, .06], [-.08, .16, .08], [.04, .18, .08], [.09, .15, .04]], .006, materials.redAccent);
  tube(bomb, [[-.08, .08, .065], [-.03, .14, .09], [.06, .17, .08], [.1, .13, .04]], .004, materials.gunEdge);
  const light = mesh(bomb, new THREE.SphereGeometry(.012, 16, 12), materials.redGlass, [.125, .15, .045]);
  bomb.userData = { weapon: 'magnetic', model: 'c4', light, adsHeight: 0 };
  return bomb;
}

export function createThrowable(type, materials) {
  const item = new THREE.Group();
  if (type === 'frag') {
    const body = mesh(item, new THREE.SphereGeometry(.085, 24, 18), materials.gun);
    body.scale.set(1, 1.15, 1);
    for (const y of [-.045, 0, .045]) mesh(item, new THREE.TorusGeometry(.083, .006, 8, 24), materials.gunEdge, [0, y, 0], [Math.PI / 2, 0, 0]);
  } else {
    mesh(item, new THREE.CylinderGeometry(.065, .065, .19, 32), materials.gunDark);
    mesh(item, new THREE.CylinderGeometry(.067, .067, .045, 32), materials.lunaAccent, [0, .02, 0]);
    for (const y of [-.1, .1]) mesh(item, new THREE.TorusGeometry(.065, .008, 8, 24), materials.gunEdge, [0, y, 0], [Math.PI / 2, 0, 0]);
  }
  mesh(item, new RoundedBoxGeometry(.045, .055, .025, 3, .008), materials.gunEdge, [0, .12, 0]);
  mesh(item, new THREE.TorusGeometry(.032, .006, 8, 20), materials.gunEdge, [.04, .12, 0], [0, Math.PI / 2, 0]);
  item.userData = { weapon: type, adsHeight: 0 };
  return item;
}
