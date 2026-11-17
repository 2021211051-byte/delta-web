import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

let library = null;

function nameSprite(name, color) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
  const c = canvas.getContext('2d'); c.fillStyle = 'rgba(8,12,10,.72)'; c.fillRect(70, 10, 372, 62);
  c.strokeStyle = color; c.lineWidth = 3; c.strokeRect(70, 10, 372, 62);
  c.font = '600 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#f0f4eb'; c.fillText(name.slice(0, 14), 256, 41);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(1.7, .32, 1); sprite.position.set(0, 2.08, 0); return sprite;
}

export class AssetLibrary {
  constructor(materials, textures) {
    this.materials = materials; this.textures = textures; this.assets = new Map(); this.loader = new GLTFLoader();
  }

  async load() {
    const names = ['m7', 'm7_fps', 'awm', 'awm_fps', 'vyron', 'luna', 'redwolf'];
    await Promise.all(names.map(async (name) => {
      const asset = await this.loader.loadAsync(`/assets/models/${name}.glb`);
      this.assets.set(name, asset);
    }));
    return this;
  }

  applyMaterials(root, fps = false) {
    const textureMap = {
      Gunmetal: this.textures.gunmetal, DarkMetal: this.textures.gunmetal,
      Polymer: this.textures.rubber, OliveChassis: this.textures.awm,
      Fabric: this.textures.fabric, GloveLeather: this.textures.rubber,
    };
    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = !fps; object.receiveShadow = true; object.frustumCulled = false;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      object.material = materials.map((source) => {
        const material = source.clone();
        const map = textureMap[source.name];
        if (map) {
          material.map = map; material.bumpMap = map; material.bumpScale = source.name.includes('Glove') ? .008 : .015;
          material.color.set(0xffffff);
        }
        if (source.name === 'Glass' || source.name === 'AmberGlass') { material.transparent = true; material.depthWrite = false; }
        return material;
      });
      if (object.material.length === 1) object.material = object.material[0];
    });
  }

  weapon(id, fps = false) {
    const asset = this.assets.get(`${id}${fps ? '_fps' : ''}`);
    if (!asset) return null;
    const model = cloneSkeleton(asset.scene); this.applyMaterials(model, fps);
    model.rotation.y = Math.PI;
    const rig = model.getObjectByName('WeaponRig') || model;
    const animationSource = id === 'awm' && !fps ? this.assets.get('awm_fps') : asset;
    const animations = animationSource?.animations || [];
    const clips = {};
    for (const name of ['Reload', 'Bolt']) {
      const matches = animations.filter((clip) => clip.name === name || clip.name.startsWith(`${name}.`));
      if (matches.length) {
        const tracks = matches.flatMap((clip) => clip.tracks).filter((track) => ['WeaponRig', 'Magazine', 'BoltHandle'].includes(track.name.split('.')[0]));
        clips[name] = new THREE.AnimationClip(name, -1, tracks);
      }
    }
    const mixer = new THREE.AnimationMixer(model);
    const actions = Object.fromEntries(Object.entries(clips).map(([name, clip]) => [name, mixer.clipAction(clip)]));
    model.userData = {
      weapon: id, blender: true, hasHands: fps, mixer, actions,
      adsHeight: Number(rig.userData.adsHeight ?? .235), muzzle: rig.getObjectByName('Muzzle'),
      magazine: rig.getObjectByName('Magazine'), bolt: rig.getObjectByName('BoltHandle'),
      scope: rig.getObjectByName('Scope'), frontSight: rig.getObjectByName('FrontSight'),
    };
    if (model.userData.magazine) model.userData.magazine.userData.baseY = model.userData.magazine.position.y;
    let triangles = 0;
    model.traverse((object) => { if (object.isMesh) triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3; });
    model.userData.triangles = Math.round(triangles);
    return model;
  }

  operator(id, name) {
    const asset = this.assets.get(id); if (!asset) return null;
    const model = cloneSkeleton(asset.scene); this.applyMaterials(model);
    const root = model.getObjectByName('OperatorRoot') || model;
    const visual = root.getObjectByName('Visual');
    const hips = root.getObjectByName('Hips'); const torso = root.getObjectByName('Torso');
    const weapon = this.weapon('m7'); weapon.rotation.y = 0; weapon.scale.setScalar(.72); weapon.position.set(.12, .21, -.4); torso.add(weapon);
    if (id !== 'luna') for (const shoulder of [root.getObjectByName('LeftShoulder'), root.getObjectByName('RightShoulder')]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(.115, 24, 16), this.materials.armor);
      pad.scale.set(1.15, .85, 1.05); pad.position.set(0, 0, -.015); shoulder.add(pad);
    }
    const sprite = nameSprite(name, id === 'redwolf' ? '#ef745e' : id === 'luna' ? '#70d5e8' : '#d8ef8b'); root.add(sprite);
    root.userData = {
      visual, hips, torso, head: root.getObjectByName('Head'),
      leftArm: { shoulder: root.getObjectByName('LeftShoulder'), elbow: root.getObjectByName('LeftElbow'), hand: root.getObjectByName('LeftHandRig') },
      rightArm: { shoulder: root.getObjectByName('RightShoulder'), elbow: root.getObjectByName('RightElbow'), hand: root.getObjectByName('RightHandRig') },
      leftLeg: { hip: root.getObjectByName('LeftHip'), knee: root.getObjectByName('LeftKnee') },
      rightLeg: { hip: root.getObjectByName('RightHip'), knee: root.getObjectByName('RightKnee') },
      weapon, nameSprite: sprite, phase: 0, currentWeapon: 'm7', blender: true,
    };
    return root;
  }

  play(model, name) {
    const action = model.userData.actions?.[name]; if (!action) return false;
    Object.values(model.userData.actions).forEach((other) => { if (other !== action) other.fadeOut(.06); });
    action.reset().setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = false; action.fadeIn(.04).play();
    return true;
  }
}

export function setModelAssets(value) { library = value; }
export function modelAssets() { return library; }
