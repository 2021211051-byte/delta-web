import * as THREE from 'three';
import { OPERATORS, WEAPONS } from '../../shared/config.js';
import { clamp, eyeHeight, nearestSolidHit, resolveMovement } from '../../shared/physics.js';
import { makeTextures } from './textures.js';
import { animateOperator, createModelMaterials, createOperator, createViewModel, createWeapon, setViewModelDevice, setViewModelWeapon } from './models.js';
import { createWorld } from './world.js';
import { Effects } from './effects.js';
import { TacticalAudio } from './audio.js';
import { setFirstPersonOperator } from './first-person.js';
import { AssetLibrary, setModelAssets } from './asset-library.js';

const $ = (id) => document.getElementById(id);
const moveKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyC', 'ControlLeft', 'ControlRight', 'KeyZ', 'KeyQ', 'KeyE']);

export class Game {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, .025, 420);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.textures = makeTextures();
    this.materials = createModelMaterials(this.textures);
    this.world = createWorld(this.scene, this.renderer, this.textures);
    this.audio = new TacticalAudio();
    this.effects = new Effects(this.scene, this.materials, this.audio);
    this.viewScene = new THREE.Scene(); this.viewScene.environment = this.scene.environment;
    this.viewCamera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, .01, 12);
    this.viewScene.add(new THREE.HemisphereLight(0xdde8db, 0x273027, 1.6));
    const viewKey = new THREE.DirectionalLight(0xffe5c4, 2.4); viewKey.position.set(-2, 3, 4); this.viewScene.add(viewKey);
    this.viewModel = createViewModel(this.materials);
    this.viewModel.scale.setScalar(.55);
    this.viewModel.position.set(.25, -.23, -.48); this.viewScene.add(this.viewModel);
    this.viewModel.visible = false;
    this.renderer.autoClear = false;
    this.muzzleLight = new THREE.PointLight(0xffa342, 0, 3); this.viewScene.add(this.muzzleLight);
    this.muzzleLight.position.set(.2, -.15, -1.1);
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(.14, .14), new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flash.visible = false;
    this.keys = new Set();
    this.active = false; this.paused = false; this.dead = false;
    this.operator = 'vyron'; this.network = null;
    this.position = { x: 0, y: 0, z: 32 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.yaw = 0; this.pitch = 0; this.stance = 'stand';
    this.firing = false; this.ads = false; this.localWeapon = 'm7'; this.equipment = 'gun';
    this.bowAbility = 'primary'; this.bowDrawing = false; this.bowChargeStart = 0; this.bowCharge = 0;
    this.magneticHolding = false; this.launcherFireTime = 0;
    this.lastFrame = performance.now(); this.lastMoveSent = 0; this.lastLocalShot = 0;
    this.self = null; this.players = []; this.avatars = new Map();
    this.recoil = 0; this.muzzleTime = 0; this.bob = 0; this.reloadAnim = 0; this.boltTime = 0;
    this.lookSway = { x: 0, y: 0 }; this.landingDip = 0; this.wasGrounded = true;
    this.dashTime = 0; this.dashDirection = new THREE.Vector3(); this.vyronBoostUntil = 0;
    this.slideTime = 0; this.highZoom = false; this.pointerWanted = false;
    this.sensitivity = 1; this.lastDead = false; this.started = false;
    this.onDisconnect = options.onDisconnect || (() => {});
    this.onPause = options.onPause || (() => {});
    this.bindInput();
    this.resize = () => {
      this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
      this.viewCamera.aspect = innerWidth / innerHeight; this.viewCamera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    };
    window.addEventListener('resize', this.resize);
    this.renderer.setAnimationLoop((time) => this.frame(time));
    this.ready = this.loadBlenderAssets();
    window.__deltaGame = this;
  }

  async loadBlenderAssets() {
    this.assets = await new AssetLibrary(this.materials, this.textures).load();
    setModelAssets(this.assets);
    this.viewModel.userData.weaponId = '';
    setViewModelWeapon(this.viewModel, this.localWeapon, this.materials);
    this.viewModel.userData.arms.visible = false;
    this.lobbyScene = new THREE.Scene(); this.lobbyScene.environment = this.scene.environment;
    this.lobbyScene.add(new THREE.HemisphereLight(0xe0e9df, 0x303830, 3));
    const key = new THREE.DirectionalLight(0xffe4c2, 6); key.position.set(-3, 5, 4); this.lobbyScene.add(key);
    const rim = new THREE.DirectionalLight(0x8fb7c9, 3); rim.position.set(3, 3, -2); this.lobbyScene.add(rim);
    this.lobbyCamera = new THREE.PerspectiveCamera(34, .55, .05, 20);
    this.lobbyCamera.position.set(0, 1.15, 4.4); this.lobbyCamera.lookAt(0, 1.02, 0);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(.75, .8, .05, 64), new THREE.MeshStandardMaterial({ color: 0x1d2621, roughness: .8 }));
    floor.position.y = -.025; this.lobbyScene.add(floor);
    this.setLobbyOperator('vyron');
    return this.assets;
  }

  setLobbyOperator(operator) {
    if (!this.assets || !this.lobbyScene) return;
    if (this.lobbyModel) this.lobbyScene.remove(this.lobbyModel);
    this.lobbyModel = this.assets.operator(operator, OPERATORS[operator].name);
    this.lobbyModel.rotation.y = 0;
    this.lobbyModel.userData.nameSprite.visible = false;
    this.lobbyModel.userData.leftArm.shoulder.rotation.x = .8;
    this.lobbyModel.userData.rightArm.shoulder.rotation.x = .72;
    this.lobbyModel.userData.leftArm.elbow.rotation.x = .9;
    this.lobbyModel.userData.rightArm.elbow.rotation.x = .9;
    this.lobbyScene.add(this.lobbyModel);
  }

  bindInput() {
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Tab' && this.active) {
        event.preventDefault(); $('scoreboard').classList.remove('hidden'); this.updateScoreboard();
      }
      if (!this.active || this.paused || event.target.matches('input,select')) return;
      if (moveKeys.has(event.code) || ['KeyR', 'Digit1', 'Digit2', 'KeyX', 'KeyV', 'KeyG', 'KeyN', 'KeyF'].includes(event.code)) event.preventDefault();
      if (!event.repeat) this.actionKey(event.code, true);
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
      if (event.code === 'Tab') $('scoreboard').classList.add('hidden');
      if (this.active) this.actionKey(event.code, false);
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.firing = false; this.ads = false; });
    document.addEventListener('mousemove', (event) => {
      if (!this.active || this.paused || document.pointerLockElement !== this.canvas || this.dead) return;
      const scale = .00175 * this.sensitivity * (this.ads && this.localWeapon === 'awm' ? .38 : 1);
      this.yaw -= event.movementX * scale;
      this.pitch = clamp(this.pitch - event.movementY * scale, -1.52, 1.52);
      this.lookSway.x = clamp(this.lookSway.x + event.movementX * .00022, -.035, .035);
      this.lookSway.y = clamp(this.lookSway.y + event.movementY * .00018, -.025, .025);
    });
    this.canvas.addEventListener('mousedown', (event) => {
      if (!this.active || this.paused || this.dead) return;
      this.audio.init();
      if (document.pointerLockElement !== this.canvas) { this.lockPointer(); return; }
      if (event.button === 0) {
        if (this.equipment === 'launcher') this.fireLauncher();
        else if (this.equipment === 'gun') { this.firing = true; this.tryFire(); }
      }
      if (event.button === 2) {
        if (this.equipment === 'bow') this.startBowDraw();
        else if (this.equipment === 'gun') this.ads = true;
      }
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.firing = false;
      if (event.button === 2) {
        if (this.bowDrawing) this.releaseBow();
        this.ads = false;
      }
    });
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.canvas.addEventListener('wheel', (event) => {
      if (this.active && !this.paused) { event.preventDefault(); this.switchWeapon(this.localWeapon === 'm7' ? 'awm' : 'm7'); }
    }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      if (this.active && !document.pointerLockElement && !this.paused && this.pointerWanted) this.pause();
    });
  }

  actionKey(code, down) {
    if (code === 'Digit1' && down) this.switchWeapon('m7');
    if (code === 'Digit2' && down) this.switchWeapon('awm');
    if (code === 'KeyR' && down && this.equipment === 'gun') this.reload();
    if (code === 'KeyX' && down) {
      if (this.operator === 'luna') this.equipBow('primary');
      else this.useAbility('primary');
    }
    if (code === 'KeyV') {
      if (down && this.operator === 'luna') this.equipBow('tactical');
      else if (down && this.operator === 'redwolf') this.equipLauncher();
      else if (down && this.operator === 'vyron') this.holdMagnetic();
      else if (!down && this.magneticHolding) this.throwMagnetic();
    }
    if (code === 'KeyG' && down) { this.setEquipment('gun'); this.useAbility('throwable'); }
    if (code === 'KeyN' && down && this.localWeapon === 'awm') {
      this.highZoom = !this.highZoom; this.notify(`瞄准倍率 ${this.highZoom ? '8.0×' : '4.0×'}`);
    }
    if (code === 'KeyF' && down) { this.network?.send({ type: 'resetStats' }); this.notify('个人训练数据已重置'); }
    if (code === 'KeyZ' && down) this.stance = this.stance === 'prone' ? 'stand' : 'prone';
    if (code === 'KeyC' && down) {
      if (this.operator === 'redwolf' && this.isSprinting() && this.stance === 'stand') this.startSlide();
      else this.stance = this.stance === 'crouch' ? 'stand' : 'crouch';
    }
    if (['ControlLeft', 'ControlRight'].includes(code)) {
      if (down && this.operator === 'redwolf' && this.isSprinting()) this.startSlide();
      else if (down) this.stance = 'crouch';
      else if (this.stance === 'crouch') this.stance = 'stand';
    }
    if (code === 'Space' && down && this.position.y <= .001 && this.stance !== 'prone') {
      this.velocity.y = 5.5; this.position.y = .01; this.audio.jump();
      if (this.stance === 'slide') { this.slideTime = 0; this.stance = 'stand'; }
    }
  }

  async start(operator, network) {
    this.operator = operator; this.network = network;
    setFirstPersonOperator(this.viewModel.userData.arms, operator, this.materials);
    this.position = { x: 0, y: 0, z: 32 }; this.velocity = { x: 0, y: 0, z: 0 };
    this.yaw = 0; this.pitch = 0; this.stance = 'stand'; this.dead = false;
    this.self = null; this.players = []; this.lastDead = false; this.localWeapon = 'm7';
    this.equipment = 'gun'; this.bowDrawing = false; this.magneticHolding = false; this.boltTime = 0;
    this.started = false; this.active = true; this.paused = false;
    this.viewModel.visible = true; setViewModelWeapon(this.viewModel, 'm7', this.materials);
    this.bindNetwork(network);
    $('hud').classList.remove('hidden'); $('lobby').classList.add('hidden');
    $('pause').classList.add('hidden'); $('death').classList.add('hidden');
    $('hud-room').textContent = network.room;
    const info = OPERATORS[operator];
    $('hud-operator').textContent = info.name; $('hud-operator-icon').textContent = info.name[0];
    $('passive-label').textContent = info.passive;
    for (const [ability, id] of [['primary', 'skill-x'], ['tactical', 'skill-v'], ['throwable', 'skill-g']]) $(id).textContent = info.skills[ability].name;
    document.documentElement.style.setProperty('--accent', info.color);
    this.notify('已进入零号训练基地', '单击画面锁定鼠标，开始行动');
    this.lockPointer();
  }

  bindNetwork(network) {
    network.addEventListener('snapshot', (event) => this.onSnapshot(event.detail));
    network.addEventListener('event', (event) => this.onEvent(event.detail.event));
    network.addEventListener('hit', (event) => this.onHit(event.detail));
    network.addEventListener('damaged', (event) => {
      $('damage-vignette').classList.add('show');
      setTimeout(() => $('damage-vignette').classList.remove('show'), 180);
    });
    network.addEventListener('disconnect', () => { if (this.active) this.onDisconnect(); });
  }

  onSnapshot(data) {
    this.players = data.players; this.self = data.self;
    const own = data.players.find((player) => player.id === this.network.id);
    if (own && (!this.started || (this.lastDead && !own.dead))) {
      this.position = { ...own.position }; this.velocity = { x: 0, y: 0, z: 0 }; this.yaw = 0; this.pitch = 0;
      this.localWeapon = 'm7'; this.setEquipment('gun');
      this.started = true;
      if (!own.dead) this.notify('重新部署完成');
    }
    if (own) { this.dead = own.dead; this.lastDead = own.dead; }
    $('death').classList.toggle('hidden', !this.dead);
    if (this.dead) { this.firing = false; this.ads = false; $('respawn-time').textContent = Math.max(1, Math.ceil((data.self.respawnAt - Date.now()) / 1000)); }
    const activeIds = new Set();
    for (const player of data.players) {
      if (player.id === this.network.id) continue;
      activeIds.add(player.id);
      if (!this.avatars.has(player.id)) {
        const avatar = createOperator(player.operator, player.name, this.materials);
        avatar.userData.materials = this.materials;
        avatar.userData.target = { ...player, position: { ...player.position } };
        avatar.position.set(player.position.x, player.position.y, player.position.z);
        this.scene.add(avatar); this.avatars.set(player.id, avatar);
      }
      const avatar = this.avatars.get(player.id);
      avatar.userData.target = { ...player, position: { ...player.position } };
      if (avatar.userData.currentWeapon !== player.weapon) {
        avatar.userData.torso.remove(avatar.userData.weapon);
        avatar.userData.weapon = createWeapon(player.weapon, this.materials);
        avatar.userData.weapon.scale.setScalar(.72); avatar.userData.weapon.position.set(.12, .21, -.4);
        avatar.userData.torso.add(avatar.userData.weapon); avatar.userData.currentWeapon = player.weapon;
      }
      avatar.visible = !player.dead;
    }
    for (const [id, avatar] of this.avatars) if (!activeIds.has(id)) { this.scene.remove(avatar); this.avatars.delete(id); }
    for (const target of data.targets) this.world.updateTarget(target.id, target, .05);
    this.effects.syncProjectiles(data.projectiles);
    $('player-count').textContent = data.players.length;
    $('ping').textContent = `${this.network.ping || '--'} ms`;
    this.updateHUD();
  }

  onEvent(event) {
    switch (event.kind) {
      case 'shot': {
        if (event.player !== this.network.id) {
          this.audio.gun(event.weapon, true);
          this.effects.tracer(event.origin, event.direction, 65, 0xffd18a);
        }
        break;
      }
      case 'dash':
        if (event.player === this.network.id) {
          const input = this.movementDirection();
          if (input.lengthSq() > .1) this.dashDirection.copy(input.normalize());
          else this.dashDirection.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
          this.dashTime = .2; this.vyronBoostUntil = performance.now() + 2600; this.audio.dash();
          this.notify('动力推进');
        }
        break;
      case 'exo': if (event.player === this.network.id) { this.audio.exo(); this.notify('动力外骨骼已启动', '击倒回复生命并延长持续时间'); } break;
      case 'reload': if (event.player === this.network.id) {
        const model = this.viewModel.userData.weapon;
        if (model.userData.blender && this.assets.play(model, 'Reload')) this.reloadAnim = 0;
        else this.reloadAnim = WEAPONS[event.weapon].reload / 1000;
        this.audio.reload();
      } break;
      case 'explosion': this.effects.explosion(event.position, event.radius); this.audio.explosion(Math.hypot(event.position.x - this.position.x, event.position.z - this.position.z)); break;
      case 'smoke': this.effects.smoke(event.position, event.duration); this.audio.burst(.3, .08, 900); break;
      case 'scan': this.effects.scan(event.position, event.radius); this.audio.scan(); break;
      case 'shock': this.effects.scan(event.position, event.radius); this.audio.shock(); break;
      case 'targetHit': this.effects.impact(event.position, true); break;
      case 'targetDown': this.audio.hit(true); break;
      case 'kill': {
        const feed = document.createElement('p');
        feed.innerHTML = `<b>${this.escape(event.attackerName)}</b> ${event.headshot ? '◈ 爆头' : '—'} ${this.escape(event.victimName)}`;
        $('killfeed').prepend(feed); setTimeout(() => feed.remove(), 6000);
        break;
      }
      case 'join': if (event.player !== this.network.id) this.notify(`${event.name} 加入行动`); break;
      case 'leave': this.notify(`${event.name} 离开行动`); break;
      default: break;
    }
  }

  onHit(data) {
    this.audio.hit(data.killed);
    $('hitmarker').classList.remove('show', 'kill');
    void $('hitmarker').offsetWidth;
    $('hitmarker').classList.add('show'); if (data.killed) $('hitmarker').classList.add('kill');
    if (data.killed && data.target === 'target') this.notify('靶标击倒', '靶标将在 3 秒后复位');
  }

  escape(value) {
    const span = document.createElement('span'); span.textContent = String(value); return span.innerHTML;
  }

  notify(text, subtext = '') {
    const item = document.createElement('div'); item.className = 'notification';
    const main = document.createElement('span'); main.textContent = text; item.append(main);
    if (subtext) { const small = document.createElement('small'); small.textContent = subtext; item.append(small); }
    $('notifications').append(item); setTimeout(() => item.remove(), 3100);
  }

  lockPointer() {
    if (!this.active || this.paused) return;
    this.pointerWanted = true;
    try {
      const result = this.canvas.requestPointerLock();
      if (result?.catch) result.catch(() => { $('interact-hint').style.opacity = 1; });
    } catch { $('interact-hint').style.opacity = 1; }
  }

  pause() {
    if (!this.active || this.paused) return;
    this.paused = true; this.firing = false; this.ads = false; this.keys.clear();
    this.bowDrawing = false; this.magneticHolding = false;
    if (this.equipment !== 'gun') this.setEquipment('gun');
    $('pause').classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
    this.onPause();
  }

  resume() {
    if (!this.active) return;
    this.paused = false; $('pause').classList.add('hidden'); $('controls-modal').classList.add('hidden');
    this.lockPointer();
  }

  stop() {
    this.active = false; this.paused = false; this.pointerWanted = false;
    this.firing = false; this.ads = false; this.keys.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    this.viewModel.visible = false;
    for (const avatar of this.avatars.values()) this.scene.remove(avatar);
    this.avatars.clear(); this.effects.syncProjectiles([]);
    this.network?.close(); this.network = null;
    for (const id of ['hud', 'pause', 'death', 'scoreboard', 'controls-modal']) $(id).classList.add('hidden');
    $('lobby').classList.remove('hidden');
  }

  setEquipment(equipment) {
    this.equipment = equipment; this.ads = false; this.firing = false;
    this.bowDrawing = false; this.bowCharge = 0; this.magneticHolding = false;
    if (equipment === 'gun') setViewModelWeapon(this.viewModel, this.localWeapon, this.materials);
    else setViewModelDevice(this.viewModel, equipment, this.materials);
    this.recoil = .35;
  }

  switchWeapon(id) {
    if (!this.self || this.dead || (this.localWeapon === id && this.equipment === 'gun') || !WEAPONS[id]) return;
    this.localWeapon = id; this.network.send({ type: 'switch', weapon: id });
    this.setEquipment('gun'); this.reloadAnim = 0;
  }

  equipBow(ability) {
    if (!this.self || this.dead) return;
    this.bowAbility = ability; this.setEquipment('bow');
    this.notify(OPERATORS.luna.skills[ability].name, '按住右键蓄力，松开右键发射 · 1/2 切回枪械');
  }

  startBowDraw() {
    if (!this.self || this.dead || this.bowDrawing) return;
    if (this.self.cooldowns[this.bowAbility] > Date.now()) { this.notify('箭矢尚未冷却'); return; }
    this.bowDrawing = true; this.bowChargeStart = performance.now(); this.bowCharge = 0;
    this.audio.tone(180, .35, .025, 'sawtooth', 90);
  }

  releaseBow() {
    if (!this.bowDrawing) return;
    this.bowCharge = clamp((performance.now() - this.bowChargeStart) / 1500, .06, 1);
    const charge = this.bowCharge; this.bowDrawing = false;
    this.useAbility(this.bowAbility, { charge });
    this.audio.tone(240, .12, .055, 'triangle', 480);
  }

  holdMagnetic() {
    if (!this.self || this.dead || this.self.cooldowns.tactical > Date.now()) return;
    this.setEquipment('magnetic'); this.magneticHolding = true;
    this.notify('磁吸炸弹已握持', '松开 V 键投掷');
  }

  throwMagnetic() {
    if (!this.magneticHolding) return;
    this.useAbility('tactical'); this.setEquipment('gun');
  }

  equipLauncher() {
    if (!this.self || this.dead) return;
    this.setEquipment('launcher');
    this.notify('三联装手炮已就绪', '单击左键依次发射三枚榴弹 · 1/2 切回枪械');
  }

  fireLauncher() {
    if (!this.self || this.dead || this.equipment !== 'launcher') return;
    if (this.self.cooldowns.tactical > Date.now()) { this.notify('手炮尚未冷却'); return; }
    this.useAbility('tactical'); this.launcherFireTime = .5;
  }

  reload() {
    if (!this.self || this.dead || this.equipment !== 'gun') return;
    const state = this.self.loadout[this.localWeapon]; const weapon = WEAPONS[this.localWeapon];
    if (state.ammo < weapon.magazine && state.reserve > 0 && !state.reloading) this.network.send({ type: 'reload' });
  }

  useAbility(ability, extra = {}) {
    if (!this.self || this.paused || this.dead || this.self.cooldowns[ability] > Date.now()) return;
    const direction = new THREE.Vector3(); this.camera.getWorldDirection(direction);
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    this.network.send({ type: 'ability', ability, direction, origin, ...extra });
    this.recoil = Math.max(this.recoil, .22);
  }

  tryFire() {
    if (!this.active || this.paused || this.dead || !this.self || this.equipment !== 'gun' || document.pointerLockElement !== this.canvas) return;
    const weapon = WEAPONS[this.localWeapon]; const state = this.self.loadout[this.localWeapon];
    const now = performance.now();
    if (now - this.lastLocalShot < weapon.interval || state.reloading) return;
    if (state.ammo <= 0) { this.audio.empty(); this.lastLocalShot = now + 250; return; }
    const direction = new THREE.Vector3(); this.camera.getWorldDirection(direction);
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const spread = (this.ads ? weapon.adsSpread : weapon.spread) * (1 + speed * .13) * (this.stance === 'crouch' ? .75 : 1);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    direction.addScaledVector(right, (Math.random() - .5) * spread * 2).addScaledVector(up, (Math.random() - .5) * spread * 2).normalize();
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    this.network.send({ type: 'shot', origin, direction });
    state.ammo = Math.max(0, state.ammo - 1); this.lastLocalShot = now;
    this.audio.gun(this.localWeapon); this.pitch = clamp(this.pitch + weapon.recoil * (.8 + Math.random() * .4), -1.52, 1.52);
    this.yaw += (Math.random() - .5) * weapon.recoil * .3;
    this.recoil = 1; this.muzzleTime = .055;
    if (this.localWeapon === 'awm') {
      const model = this.viewModel.userData.weapon;
      if (model.userData.blender && this.assets.play(model, 'Bolt')) this.boltTime = 0;
      else { this.boltTime = 1.12; this.boltStage = 0; }
    }
    const muzzle = this.viewModel.userData.weapon.userData.muzzle;
    if (muzzle) { this.viewModel.userData.weapon.add(this.flash); this.flash.position.copy(muzzle.position); this.flash.position.z -= .025; this.flash.rotation.z = Math.random() * Math.PI; }
    this.effects.tracer(origin, direction, 65);
  }

  isSprinting() {
    return (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) && this.keys.has('KeyW') && this.stance === 'stand' && !this.ads;
  }

  movementDirection() {
    const forward = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
    const side = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    const vector = new THREE.Vector3(side, 0, -forward);
    if (vector.lengthSq() > 0) vector.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    return vector;
  }

  startSlide() {
    if (this.slideTime > 0) return;
    this.slideTime = .72; this.stance = 'slide';
    const direction = this.movementDirection();
    if (direction.lengthSq() < .1) direction.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.velocity.x = direction.x * 9.4; this.velocity.z = direction.z * 9.4;
    this.audio.burst(.35, .06, 650);
  }

  updateMovement(dt) {
    if (this.dead) return;
    const input = this.movementDirection();
    if (this.ads && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) && this.keys.has('KeyW')) this.ads = false;
    const sprinting = this.isSprinting();
    let speed = this.stance === 'prone' ? 1.35 : this.stance === 'crouch' ? 2.65 : sprinting ? 7.3 : 5.15;
    if (this.operator === 'redwolf' && this.self?.exoUntil > Date.now()) speed *= 1.22;
    if (this.operator === 'vyron' && performance.now() < this.vyronBoostUntil) speed *= 1.14;
    if (this.ads) speed *= .62;
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.velocity.x = this.dashDirection.x * 18; this.velocity.z = this.dashDirection.z * 18;
      this.velocity.y = Math.max(this.velocity.y, 1.4);
    } else if (this.slideTime > 0) {
      this.slideTime -= dt;
      const slideSpeed = Math.max(4.2, Math.hypot(this.velocity.x, this.velocity.z) - dt * 8);
      const direction = new THREE.Vector3(this.velocity.x, 0, this.velocity.z).normalize();
      this.velocity.x = direction.x * slideSpeed; this.velocity.z = direction.z * slideSpeed;
      if (this.slideTime <= 0) this.stance = 'crouch';
    } else {
      const responsiveness = this.position.y > 0 ? 4.5 : 13;
      this.velocity.x += (input.x * speed - this.velocity.x) * Math.min(1, dt * responsiveness);
      this.velocity.z += (input.z * speed - this.velocity.z) * Math.min(1, dt * responsiveness);
    }
    this.velocity.y -= 15.5 * dt;
    const next = resolveMovement(this.position, { x: this.velocity.x * dt, z: this.velocity.z * dt }, this.stance);
    if (Math.abs(next.x - this.position.x - this.velocity.x * dt) > .01) this.velocity.x = 0;
    if (Math.abs(next.z - this.position.z - this.velocity.z * dt) > .01) this.velocity.z = 0;
    this.position.x = next.x; this.position.z = next.z;
    const fallingSpeed = this.velocity.y;
    this.position.y += this.velocity.y * dt;
    if (this.position.y <= 0) {
      this.position.y = 0; this.velocity.y = 0;
      if (!this.wasGrounded) this.landingDip = clamp(-fallingSpeed * .012, .025, .095);
      this.wasGrounded = true;
    } else this.wasGrounded = false;
    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.position.y === 0 && horizontalSpeed > 1) {
      this.bob += dt * horizontalSpeed * 1.5;
      this.audio.step(sprinting);
    }
    const now = performance.now();
    if (now - this.lastMoveSent > 33) {
      this.network.send({ type: 'move', position: this.position, velocity: this.velocity, yaw: this.yaw, pitch: this.pitch, stance: this.stance });
      this.lastMoveSent = now;
    }
  }

  updateCamera(dt) {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const sprinting = this.isSprinting() && speed > 2;
    const moving = this.position.y === 0 && speed > .6;
    const bobAmount = moving && !this.ads ? Math.min(sprinting ? .052 : .034, speed * .006) : 0;
    this.landingDip *= Math.exp(-dt * 9);
    const lean = (this.keys.has('KeyE') ? 1 : 0) - (this.keys.has('KeyQ') ? 1 : 0);
    const height = eyeHeight(this.stance);
    this.camera.position.set(this.position.x, this.position.y + height + Math.sin(this.bob * 2) * bobAmount - this.landingDip, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, -lean * .065 + Math.sin(this.bob) * bobAmount * .12);
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.camera.position.addScaledVector(right, lean * .14 + Math.cos(this.bob) * bobAmount * .32);
    const viewDirection = this.camera.getWorldDirection(new THREE.Vector3());
    const wallHit = nearestSolidHit(this.camera.position, viewDirection, 1.25);
    const wallAmount = wallHit.solid ? 1 - wallHit.distance / 1.25 : 0;
    if (wallHit.solid && wallHit.distance < .42) this.ads = false;
    const aiming = this.ads && this.equipment === 'gun';
    const targetFov = aiming ? (this.localWeapon === 'awm' ? (this.highZoom ? 10 : 20) : 57) : 75;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 13);
    this.camera.updateProjectionMatrix();
    this.viewCamera.fov = this.camera.fov; this.viewCamera.updateProjectionMatrix();
    const model = this.viewModel.userData.weapon;
    model.userData.mixer?.update(dt);
    const scale = this.viewModel.scale.x;
    const adsHeight = model.userData.adsHeight || .17;
    const targetPosition = aiming ? new THREE.Vector3(0, -adsHeight * scale, -.48) : new THREE.Vector3(.18, -.2, -.9);
    if (this.equipment === 'bow') targetPosition.set(.1, -.09, -.7);
    if (this.equipment === 'magnetic') targetPosition.set(.08, -.16, -.46);
    if (sprinting) targetPosition.set(.19, -.29, -.6);
    if (this.equipment === 'gun' && !aiming) targetPosition.y -= wallAmount * .2;
    if (this.stance === 'prone') targetPosition.y -= .035;
    targetPosition.y += Math.sin(this.bob * 2) * bobAmount * .85;
    targetPosition.x += Math.cos(this.bob) * bobAmount * .75;
    targetPosition.z += this.recoil * (this.localWeapon === 'awm' ? .1 : .05);
    this.viewModel.position.lerp(targetPosition, Math.min(1, dt * 16));
    this.lookSway.x *= Math.exp(-dt * 10); this.lookSway.y *= Math.exp(-dt * 10);
    let targetRotation = { x: -this.recoil * .055 - this.lookSway.y, y: this.lookSway.x, z: 0 };
    if (sprinting) targetRotation = { x: .13 - this.lookSway.y, y: .48 + this.lookSway.x, z: -.36 };
    if (this.equipment === 'bow') targetRotation.z = -.09;
    if (this.equipment === 'gun' && !aiming) targetRotation.x += wallAmount * .35;
    this.viewModel.rotation.x += (targetRotation.x - this.viewModel.rotation.x) * Math.min(1, dt * 13);
    this.viewModel.rotation.y += (targetRotation.y - this.viewModel.rotation.y) * Math.min(1, dt * 13);
    this.viewModel.rotation.z += (targetRotation.z - this.viewModel.rotation.z) * Math.min(1, dt * 13);
    this.recoil = Math.max(0, this.recoil - dt * (this.localWeapon === 'awm' ? 2.2 : 8));

    const arms = this.viewModel.userData.arms.userData;
    const leftBase = arms.left.userData.basePosition || new THREE.Vector3();
    const rightBase = arms.right.userData.basePosition || new THREE.Vector3();
    if (this.reloadAnim > 0 && this.equipment === 'gun') {
      this.reloadAnim = Math.max(0, this.reloadAnim - dt);
      const phase = 1 - this.reloadAnim / (WEAPONS[this.localWeapon].reload / 1000);
      this.viewModel.rotation.z = Math.sin(phase * Math.PI) * .55;
      this.viewModel.rotation.x = Math.sin(phase * Math.PI) * .24;
      const magazine = model.userData.magazine;
      const baseY = magazine?.userData.baseY ?? -.085;
      if (magazine) magazine.position.y = baseY - Math.sin(phase * Math.PI) * .28;
      arms.left.position.set(leftBase.x, leftBase.y - Math.sin(phase * Math.PI) * .14, leftBase.z + Math.sin(phase * Math.PI) * .12);
    } else {
      const magazine = model.userData.magazine;
      if (magazine) magazine.position.y = magazine.userData.baseY ?? -.085;
      arms.left.position.lerp(leftBase, Math.min(1, dt * 16));
    }

    const bolt = model.userData.blender ? null : model.userData.bolt;
    if (bolt) {
      if (this.boltTime > 0) {
        this.boltTime = Math.max(0, this.boltTime - dt);
        const elapsed = 1.12 - this.boltTime;
        const ramp = (value, start, end) => clamp((value - start) / (end - start), 0, 1);
        const lift = ramp(elapsed, .18, .36) - ramp(elapsed, .88, 1.07);
        const pull = ramp(elapsed, .34, .55) - ramp(elapsed, .68, .9);
        bolt.rotation.z = -lift * .78; bolt.position.z = .21 + pull * .16;
        arms.right.position.set(rightBase.x + pull * .08, rightBase.y, rightBase.z + pull * .13);
        arms.right.rotation.z = -lift * .25;
        if (elapsed > .2 && this.boltStage === 0) { this.audio.tone(720, .035, .035, 'square', -240); this.boltStage = 1; }
        if (elapsed > .55 && this.boltStage === 1) { this.audio.burst(.04, .04, 2600); this.boltStage = 2; }
        if (elapsed > .9 && this.boltStage === 2) { this.audio.tone(580, .045, .045, 'square', -180); this.boltStage = 3; }
      } else {
        bolt.rotation.z = 0; bolt.position.z = .21;
        arms.right.position.lerp(rightBase, Math.min(1, dt * 16));
        arms.right.rotation.z *= Math.exp(-dt * 15);
      }
    }

    if (this.equipment === 'bow') {
      if (this.bowDrawing) this.bowCharge = clamp((performance.now() - this.bowChargeStart) / 1500, 0, 1);
      else this.bowCharge *= Math.exp(-dt * 16);
      const positions = model.userData.string.geometry.attributes.position;
      positions.setZ(1, .04 + this.bowCharge * .28); positions.needsUpdate = true;
      model.userData.arrow.position.z = -.03 + this.bowCharge * .28;
      arms.right.position.z = rightBase.z + this.bowCharge * .24;
      $('charge-label').classList.toggle('hidden', !this.bowDrawing);
      $('charge-label').textContent = `蓄力 ${Math.round(this.bowCharge * 100)}%`;
    } else $('charge-label').classList.add('hidden');
    if (this.equipment === 'magnetic' && model.userData.light) model.userData.light.scale.setScalar(1 + Math.sin(performance.now() * .012) * .25);
    this.launcherFireTime = Math.max(0, this.launcherFireTime - dt);
    this.muzzleTime -= dt; this.flash.visible = this.muzzleTime > 0;
    this.muzzleLight.intensity = this.muzzleTime > 0 ? 3 : 0;
    $('crosshair').classList.toggle('ads', aiming || (this.equipment !== 'gun' && this.equipment !== 'bow'));
    const scoped = aiming && this.localWeapon === 'awm' && this.camera.fov < 30;
    if (model.userData.scope) model.userData.scope.visible = !scoped;
    if (model.userData.frontSight) model.userData.frontSight.visible = !aiming;
    this.viewModel.visible = !scoped;
    $('scope').classList.toggle('hidden', !scoped);
    const spread = Math.min(15, 5 + speed * 1.2 + this.recoil * 8);
    $('crosshair').style.setProperty('--gap', `${spread}px`);
  }

  updateAvatars(dt, time) {
    for (const avatar of this.avatars.values()) {
      const target = avatar.userData.target;
      avatar.position.x += (target.position.x - avatar.position.x) * Math.min(1, dt * 18);
      avatar.position.y += (target.position.y - avatar.position.y) * Math.min(1, dt * 18);
      avatar.position.z += (target.position.z - avatar.position.z) * Math.min(1, dt * 18);
      let delta = target.yaw + (avatar.userData.blender ? Math.PI : 0) - avatar.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      avatar.rotation.y += delta * Math.min(1, dt * 16);
      animateOperator(avatar, target, time, dt);
    }
  }

  updateMarkers() {
    const layer = $('marker-layer'); layer.replaceChildren();
    for (const player of this.players) {
      if (player.id === this.network.id || player.dead || !player.marked) continue;
      const point = new THREE.Vector3(player.position.x, player.position.y + 2.25, player.position.z).project(this.camera);
      if (point.z < -1 || point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1) continue;
      const marker = document.createElement('div'); marker.className = 'enemy-marker';
      marker.style.left = `${(point.x * .5 + .5) * innerWidth}px`; marker.style.top = `${(-point.y * .5 + .5) * innerHeight}px`;
      const label = document.createElement('small'); label.textContent = `${player.name} · ${Math.round(Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z))}m`;
      marker.append(label); layer.append(marker);
    }
  }

  updateHUD() {
    if (!this.self) return;
    const state = this.self.loadout[this.localWeapon]; const weapon = WEAPONS[this.localWeapon];
    $('health').textContent = this.self.hp; $('health-bar').style.width = `${this.self.hp}%`;
    $('health-bar').style.background = this.self.hp < 30 ? '#ef745e' : 'var(--accent)';
    const deviceNames = { bow: OPERATORS.luna.skills[this.bowAbility].name, launcher: '三联装手炮', magnetic: '磁吸炸弹' };
    $('ammo').textContent = this.equipment === 'gun' ? state.ammo : this.equipment === 'launcher' ? 3 : this.equipment === 'bow' ? 1 : '—';
    $('reserve').textContent = this.equipment === 'gun' ? state.reserve : '技能';
    $('weapon-name').textContent = this.equipment === 'gun' ? weapon.name : deviceNames[this.equipment];
    $('weapon-class').textContent = this.equipment === 'gun' ? weapon.label : this.equipment === 'bow' ? '复合弓' : '战术装备';
    $('fire-mode').textContent = this.equipment === 'gun' ? (weapon.automatic ? '全自动' : '栓动') : this.equipment === 'bow' ? '右键蓄力' : this.equipment === 'magnetic' ? '松开 V 投掷' : '左键三连射';
    $('slot-m7').classList.toggle('active', this.equipment === 'gun' && this.localWeapon === 'm7');
    $('slot-awm').classList.toggle('active', this.equipment === 'gun' && this.localWeapon === 'awm');
    $('reload-label').classList.toggle('hidden', !state.reloading || this.equipment !== 'gun');
    $('stance-label').textContent = { stand: '站立', crouch: '蹲伏', prone: '卧倒', slide: '战术滑铲' }[this.stance];
    $('score').textContent = this.self.score; $('kills').textContent = this.self.kills;
    $('accuracy').textContent = this.self.shots ? `${Math.round(this.self.hits / this.self.shots * 100)}%` : '--%';
    for (const ability of ['primary', 'tactical', 'throwable']) {
      const element = document.querySelector(`[data-skill="${ability}"]`);
      const remaining = Math.max(0, this.self.cooldowns[ability] - Date.now());
      element.classList.toggle('cooling', remaining > 0);
      element.querySelector('i').textContent = remaining > 0 ? `${Math.ceil(remaining / 1000)}s` : '';
      const total = OPERATORS[this.operator].skills[ability].cooldown;
      element.querySelector(':scope > span').style.width = `${(1 - remaining / total) * 100}%`;
    }
  }

  updateScoreboard() {
    const rows = $('score-rows'); rows.replaceChildren();
    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    for (const player of sorted) {
      const row = document.createElement('tr');
      for (const value of [player.id === this.network.id ? `${player.name}（你）` : player.name, OPERATORS[player.operator].name, player.score, player.kills, player.deaths]) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      rows.append(row);
    }
  }

  setQuality(value) { this.world.setQuality(value); }
  setSensitivity(value) { this.sensitivity = Number(value); }
  setVolume(value) { this.audio.setVolume(value); }

  frame(time) {
    const dt = Math.min(.05, Math.max(.001, (time - this.lastFrame) / 1000)); this.lastFrame = time;
    if (this.active) {
      if (!this.paused) {
        this.updateMovement(dt); this.updateCamera(dt);
        const weapon = WEAPONS[this.localWeapon];
        if (this.firing && weapon.automatic && this.equipment === 'gun') this.tryFire();
      }
      this.updateAvatars(dt, time); this.updateMarkers(); this.updateHUD();
      const degrees = ((-this.yaw * 180 / Math.PI) % 360 + 360) % 360;
      const cardinal = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8];
      $('heading').textContent = `${cardinal}  ${String(Math.round(degrees)).padStart(3, '0')}`;
    } else {
      const angle = time * .000035;
      this.camera.position.set(23 + Math.sin(angle) * 7, 7.5, 33 + Math.cos(angle) * 4);
      this.camera.lookAt(0, 1.8, 5);
      this.camera.fov = 58; this.camera.updateProjectionMatrix();
    }
    this.effects.update(dt);
    this.renderer.clear(); this.renderer.render(this.scene, this.camera);
    if (this.active && this.viewModel.visible) {
      this.renderer.clearDepth(); this.renderer.render(this.viewScene, this.viewCamera);
    } else if (!this.active && this.lobbyModel && this.lobbyScene) {
      const stage = $('operator-stage');
      if (stage && getComputedStyle(stage).display !== 'none') {
        const rect = stage.getBoundingClientRect();
        this.lobbyCamera.aspect = rect.width / rect.height; this.lobbyCamera.updateProjectionMatrix();
        this.lobbyModel.rotation.y = Math.sin(time * .00045) * .12;
        this.renderer.setViewport(rect.left, innerHeight - rect.bottom, rect.width, rect.height);
        this.renderer.setScissor(rect.left, innerHeight - rect.bottom, rect.width, rect.height);
        this.renderer.setScissorTest(true); this.renderer.clearDepth();
        this.renderer.render(this.lobbyScene, this.lobbyCamera);
        this.renderer.setScissorTest(false); this.renderer.setViewport(0, 0, innerWidth, innerHeight);
      }
    }
  }
}
