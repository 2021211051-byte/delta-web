import * as THREE from 'three';
import { animateOperator } from './models.js';
import { createBow, createLauncher, createMagnetic, createThrowable } from './equipment.js';
import { OPERATORS } from '../../shared/config.js';
import { TacticalMap } from './tactical-map.js';

export class DeltaMultiplayer {
  constructor(game, network, assets, operator) {
    this.G = game; this.network = network; this.assets = assets; this.operator = operator;
    this.avatars = new Map(); this.projectiles = new Map(); this.self = null;
    this.weaponId = 'm7'; this.equipment = 'gun'; this.bowAbility = 'primary'; this.bowCharge = 0;
    this.bowDrawing = !1; this.magneticHeld = !1; this.throwableHeld = !1; this.lastMove = 0; this.lastDead = !1;
    this.boltStart = -10; this.lastAwmState = 'idle';
    this.lean = 0; this.leanLeft = !1; this.leanRight = !1; this.leanToggled = 0;
    this.leanMode = localStorage.getItem('delta-lean-mode') === 'toggle' ? 'toggle' : 'hold';
    game.delta = this;
    this.setupWeapons();
    this.setupSkills();
    this.setupLean();
    if (game.onlineMode === 'online') this.tacticalMap = new TacticalMap(game, network);
    this.bindNetwork();
  }

  setupWeapons() {
    const G = this.G;
    G.m7Weapon.name = 'M7'; G.awmWeapon.name = 'AWM';
    this.awmVisual = this.assets.weapon('awm');
    this.awmVisual.scale.setScalar(.36); this.awmVisual.position.set(0, -.015, .03);
    for (const child of G.awmWeapon.root.children) child.visible = ['SaltlineGripHand', 'SaltlineSupportHand'].includes(child.name);
    G.awmWeapon.root.add(this.awmVisual);
    G.awmWeapon.sightObject = this.awmVisual.userData.scope;
    G.awmWeapon.muzzleObject = this.awmVisual.userData.muzzle;
    G.awmWeapon.setVisible(!1);
    this.scope = document.createElement('div'); this.scope.id = 'delta-scope'; this.scope.style.display = 'none'; this.scope.innerHTML = '<i></i>';
    document.getElementById('ui').append(this.scope);
    G.events.on('weapon:reload', (event) => {
      if (event.phase === 'start' && G.weapon.root.visible) this.network.send({ type: 'reload' });
    });
    G.combat.playerShot = (origin, direction, options = {}) => {
      try {
        window.__deltaShotCalls = (window.__deltaShotCalls || 0) + 1;
        const directionData = { x: direction.x, y: direction.y, z: direction.z };
        const message = { type: 'shot', origin: { x: origin.x, y: origin.y, z: origin.z }, direction: directionData };
        if (options.muzzle) message.muzzle = { x: options.muzzle.x, y: options.muzzle.y, z: options.muzzle.z };
        this.network.send(message);
      } catch (error) {
        console.error('[delta] shot transport failed', error);
      }
      return null;
    };
    this.adsMode = localStorage.getItem('delta-ads-mode') === 'toggle' ? 'toggle' : 'hold';
    this.adsToggled = !1;
    const inputUpdate = G.input.update.bind(G.input);
    G.input.update = (dt) => {
      inputUpdate(dt);
      if (this.adsMode === 'toggle' && this.equipment === 'gun') G.input.ads = this.adsToggled;
      G.input.leanActive = this.requestedLean() !== 0 || Math.abs(this.lean) > .02;
    };
    G.renderer.domElement.addEventListener('mousedown', (event) => {
      if (event.button !== 2 || this.adsMode !== 'toggle' || this.equipment !== 'gun' || G.game.state !== 'playing') return;
      event.preventDefault(); event.stopImmediatePropagation();
      this.adsToggled = !this.adsToggled; G.input.ads = this.adsToggled;
    }, !0);
    window.addEventListener('keydown', (event) => {
      if (!G.delta || G.game.state !== 'playing') return;
      if (event.code === 'Digit1') this.switchWeapon('m7');
      if (event.code === 'Digit2') this.switchWeapon('awm');
    });
  }

  setAdsMode(mode) {
    this.adsMode = mode === 'toggle' ? 'toggle' : 'hold';
    this.adsToggled = !1; this.G.input.ads = !1;
  }

  setLeanMode(mode) {
    this.leanMode = mode === 'toggle' ? 'toggle' : 'hold';
    this.leanLeft = !1; this.leanRight = !1; this.leanToggled = 0;
    this.G.input.leanActive = !1;
  }

  requestedLean() {
    if (!this.G.player.alive || this.G.game.state !== 'playing') return 0;
    return this.leanMode === 'toggle' ? this.leanToggled : Number(this.leanRight) - Number(this.leanLeft);
  }

  switchWeapon(id) {
    if (this.weaponId === id && this.equipment === 'gun') return;
    this.G.weapon.setVisible(!1);
    this.weaponId = id; this.equipment = 'gun'; this.clearDevice();
    this.G.weapon = id === 'awm' ? this.G.awmWeapon : this.G.m7Weapon;
    this.G.weapon.setVisible(!0); this.network.send({ type: 'switch', weapon: id });
  }

  setupSkills() {
    const info = OPERATORS[this.operator];
    const hud = document.createElement('div'); hud.id = 'delta-skills';
    hud.innerHTML = `<div class="delta-operator">${info.name}<small>${info.role} / ${info.passive}</small></div><div class="delta-skill" data-skill="throwable"><kbd>G</kbd><span>${info.skills.throwable.name}</span><b></b></div><div class="delta-skill" data-skill="tactical"><kbd>V</kbd><span>${info.skills.tactical.name}</span><b></b></div><div class="delta-skill" data-skill="primary"><kbd>X</kbd><span>${info.skills.primary.name}</span><b></b></div><div class="delta-room">房间 ${this.network.room} · <span>0</span> 分</div>`;
    document.getElementById('ui').append(hud); this.skillHud = hud;
    this.fpsElement = document.createElement('div'); this.fpsElement.id = 'delta-fps'; this.fpsElement.textContent = '-- FPS';
    document.getElementById('ui').append(this.fpsElement);
    this.fpsFrames = 0; this.fpsStarted = performance.now();
    this.ultElement = document.createElement('div'); this.ultElement.id = 'delta-ult';
    this.ultElement.innerHTML = '<span>动力外骨骼</span><div><i></i></div><b>20.0s</b>';
    this.ultElement.style.display = 'none'; document.getElementById('ui').append(this.ultElement);
    window.addEventListener('keydown', (event) => {
      if (this.G.game.state !== 'playing' || event.repeat) return;
      if (event.code === 'KeyX') {
        if (this.operator === 'luna') this.equipBow('primary');
        else this.sendAbility('primary');
      }
      if (event.code === 'KeyV') {
        if (this.operator === 'luna') this.equipBow('tactical');
        else if (this.operator === 'redwolf') this.equipDevice('launcher');
        else this.holdMagnetic();
      }
      if (event.code === 'KeyG') this.holdThrowable();
    });
    window.addEventListener('keyup', (event) => {
      if (event.code === 'KeyV' && this.magneticHeld) { this.sendAbility('tactical'); this.setGun(); }
      if (event.code === 'KeyG' && this.throwableHeld) { this.sendAbility('throwable'); this.setGun(); }
    });
    window.addEventListener('mousedown', (event) => {
      if (this.G.game.state !== 'playing') return;
      if (this.equipment === 'launcher' && event.button === 0) this.sendAbility('tactical');
      if (this.equipment === 'bow' && event.button === 2) this.startBow();
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 2 && this.bowDrawing) this.releaseBow();
    });
  }

  equipBow(ability) {
    this.bowAbility = ability; this.equipDevice('bow');
  }

  equipDevice(type) {
    this.G.weapon.setVisible(!1); this.equipment = type; this.clearDevice();
    const model = ['frag', 'smoke'].includes(type) ? createThrowable(type, this.assets.materials) : type === 'bow' ? createBow(this.assets.materials) : type === 'launcher' ? createLauncher(this.assets.materials) : createMagnetic(this.assets.materials);
    model.position.set(type === 'bow' ? .08 : .18, type === 'bow' ? -.12 : -.2, type === 'bow' ? -.7 : -.6);
    model.scale.setScalar(type === 'bow' ? .45 : .7);
    this.G.camera.add(model); this.device = model;
    if (type !== 'bow') this.createTrajectory();
  }

  createTrajectory() {
    this.clearTrajectory();
    this.trajectory = new THREE.Group(); this.trajectory.name = 'throw-trajectory';
    this.trajectoryLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xd8ef8b, dashSize: .22, gapSize: .14, transparent: true, opacity: .85 }));
    this.trajectoryDots = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xe9f8b5, size: .075, sizeAttenuation: true, transparent: true, opacity: .9, depthWrite: false }));
    this.trajectoryEnd = new THREE.Mesh(new THREE.RingGeometry(.1, .16, 28), new THREE.MeshBasicMaterial({ color: 0xd8ef8b, transparent: true, opacity: .75, side: THREE.DoubleSide, depthWrite: false }));
    this.trajectory.add(this.trajectoryLine, this.trajectoryDots, this.trajectoryEnd); this.G.scene.add(this.trajectory);
  }

  clearTrajectory() {
    if (this.trajectory) { this.G.scene.remove(this.trajectory); this.trajectory = null; }
  }

  updateTrajectory() {
    if (!this.trajectory || this.equipment === 'gun') return;
    const origin = this.G.camera.getWorldPosition(new THREE.Vector3()); origin.y -= .08;
    const direction = this.G.camera.getWorldDirection(new THREE.Vector3());
    let speed = 17; let gravity = 12; let lift = 2.4;
    if (this.equipment === 'bow') { speed = 17 + this.bowCharge * 43; gravity = 9.8; lift = 0; }
    else if (this.equipment === 'magnetic') speed = 21;
    else if (this.equipment === 'launcher') speed = 24;
    const velocity = direction.multiplyScalar(speed); velocity.y += lift;
    const points = [origin.clone()]; let previous = origin.clone(); let end = null;
    for (let i = 1; i <= 55; i++) {
      const time = i * .07;
      const point = origin.clone().addScaledVector(velocity, time); point.y -= gravity * time * time * .5;
      const delta = point.clone().sub(previous); const length = delta.length();
      if (length > 0) {
        const hit = this.G.physics.raycast?.(previous, delta.normalize(), length);
        if (hit?.point) { points.push(hit.point.clone()); end = hit.point.clone(); break; }
      }
      if (point.y <= .035) { point.y = .035; points.push(point); end = point.clone(); break; }
      points.push(point); previous = point;
    }
    this.trajectoryLine.geometry.setFromPoints(points); this.trajectoryLine.computeLineDistances();
    this.trajectoryDots.geometry.setFromPoints(points);
    if (end) { this.trajectoryEnd.visible = true; this.trajectoryEnd.position.copy(end); this.trajectoryEnd.lookAt(origin); }
    else this.trajectoryEnd.visible = false;
  }

  clearDevice() {
    this.clearTrajectory();
    if (this.device) { this.G.camera.remove(this.device); this.device = null; }
  }

  setGun() {
    this.clearDevice(); this.equipment = 'gun'; this.bowDrawing = !1; this.magneticHeld = !1; this.throwableHeld = !1;
    this.adsToggled = !1; this.G.input.ads = !1;
    this.G.weapon.setVisible(!0);
  }

  holdThrowable() {
    if (this.cooling('throwable')) return;
    this.equipDevice(this.operator === 'luna' ? 'frag' : 'smoke'); this.throwableHeld = !0;
  }

  holdMagnetic() {
    if (this.cooling('tactical')) return;
    this.equipDevice('magnetic'); this.magneticHeld = !0;
  }

  startBow() {
    if (this.cooling(this.bowAbility)) return;
    this.bowDrawing = !0; this.bowStart = performance.now();
  }

  releaseBow() {
    this.bowCharge = Math.min(1, Math.max(.06, (performance.now() - this.bowStart) / 1500));
    this.bowDrawing = !1; this.sendAbility(this.bowAbility, this.bowCharge);
  }

  cooling(ability) { return !this.self || this.self.cooldowns[ability] > Date.now(); }

  sendAbility(ability, charge = 0) {
    if (this.cooling(ability)) return;
    const direction = this.G.camera.getWorldDirection(new THREE.Vector3());
    const origin = this.G.camera.position.clone();
    this.network.send({ type: 'ability', ability, charge, origin, direction });
  }

  bindNetwork() {
    this.network.addEventListener('snapshot', (event) => this.snapshot(event.detail));
    this.network.addEventListener('event', (event) => this.onEvent(event.detail.event));
    this.network.addEventListener('hit', () => this.G.hud.hitmarker?.('hit'));
    this.network.addEventListener('damaged', (event) => {
      this.G.player.hurtPulse = 1;
      if (this.G.player.damage) this.G.player.damage(event.detail.amount);
    });
  }

  snapshot(data) {
    this.self = data.self; this.latestProjectiles = data.projectiles; this.latestPlayers = data.players;
    const active = new Set();
    for (const player of data.players) {
      if (player.id === this.network.id) {
        this.G.player.health = player.hp;
        if (this.lastDead && !player.dead) {
          this.G.player.reset({ pos: new THREE.Vector3(player.position.x, player.position.y, player.position.z), yaw: player.yaw });
        }
        this.lastDead = player.dead;
        continue;
      }
      active.add(player.id);
      if (!this.avatars.has(player.id)) {
        const avatar = this.assets.operator(player.operator, player.name);
        avatar.position.set(player.position.x, player.position.y, player.position.z); this.G.scene.add(avatar);
        avatar.userData.target = player; this.avatars.set(player.id, avatar);
      }
      this.avatars.get(player.id).userData.target = player;
    }
    for (const [id, avatar] of this.avatars) if (!active.has(id)) { this.G.scene.remove(avatar); this.avatars.delete(id); }
    const targetModels = this.G.level.targets;
    for (const target of targetModels ? data.targets : []) {
      const model = targetModels.get(target.id); if (!model) continue;
      model.group.position.x = target.position.x; model.group.position.z = target.position.z;
      model.group.rotation.x += ((target.down ? -Math.PI / 2 : 0) - model.group.rotation.x) * .2;
    }
    const score = this.skillHud.querySelector('.delta-room span'); score.textContent = data.self.score;
  }

  onEvent(event) {
    if (event.kind === 'shot' && event.player !== this.network.id) {
      const source = event.muzzle || event.origin;
      const start = new THREE.Vector3(source.x, source.y, source.z);
      const direction = new THREE.Vector3(event.direction.x, event.direction.y, event.direction.z);
      const end = start.clone().addScaledVector(direction, 60);
      this.G.fx.muzzleFlash?.(start, direction, { scale: .65 });
      this.G.fx.tracer?.(start, end, { width: .014, trail: !1 });
    }
    if (event.kind === 'dash' && event.player === this.network.id) {
      const direction = new THREE.Vector3(event.direction.x, 0, event.direction.z).normalize();
      this.G.player.vel.addScaledVector(direction, 12);
    }
    if (event.kind === 'explosion') this.G.fx.explosion?.(new THREE.Vector3(event.position.x, event.position.y, event.position.z), event.radius);
    if (event.kind === 'smoke') this.G.fx.smoke?.(new THREE.Vector3(event.position.x, event.position.y, event.position.z), { count: 42, size: 2.8, life: (event.duration || 12000) / 1000, alpha: .65, rise: .12 });
  }

  setupLean() {
    window.addEventListener('keydown', (event) => {
      if (!['KeyQ', 'KeyE'].includes(event.code) || this.G.game.state !== 'playing') return;
      const side = event.code === 'KeyQ' ? -1 : 1;
      if (this.leanMode === 'toggle') {
        if (!event.repeat) this.leanToggled = this.leanToggled === side ? 0 : side;
      } else if (side < 0) this.leanLeft = !0;
      else this.leanRight = !0;
    });
    window.addEventListener('keyup', (event) => {
      if (this.leanMode !== 'toggle' && event.code === 'KeyQ') this.leanLeft = !1;
      if (this.leanMode !== 'toggle' && event.code === 'KeyE') this.leanRight = !1;
    });
    window.addEventListener('blur', () => {
      this.leanLeft = !1; this.leanRight = !1; this.leanToggled = 0; this.G.input.leanActive = !1;
    });
  }

  updateLean(dt) {
    const player = this.G.player;
    const requested = this.requestedLean();
    this.lean = THREE.MathUtils.damp(this.lean, requested * .42, 12, dt);
    if (Math.abs(this.lean) < .0001) this.lean = 0;
    const camera = this.G.camera;
    const base = camera.position.clone();
    let offset = this.lean;
    if (Math.abs(offset) > .0001) {
      const direction = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw)).multiplyScalar(Math.sign(offset));
      const hit = this.G.physics.raycast?.(base, direction, Math.abs(offset) + .08);
      if (hit) offset = Math.sign(offset) * Math.max(0, Math.min(Math.abs(offset), hit.dist - .12));
    }
    camera.position.addScaledVector(new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw)), offset);
    camera.rotation.z -= offset * .36;
    player.eye.copy(camera.position);
    player.lean = offset / .42;
    if (requested || Math.abs(offset) > .01) player.sprinting = !1;
  }

  updateProjectiles(list) {
    const active = new Set();
    for (const data of list) {
      active.add(data.id);
      if (!this.projectiles.has(data.id)) {
        const isArrow = ['recon', 'shock'].includes(data.kind);
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(isArrow ? .045 : .09, 12, 8), new THREE.MeshStandardMaterial({ color: isArrow ? 0x72d9e8 : 0x3d453b, emissive: isArrow ? 0x247888 : 0x000000 }));
        this.G.scene.add(mesh); this.projectiles.set(data.id, mesh);
      }
      this.projectiles.get(data.id).position.set(data.position.x, data.position.y, data.position.z);
    }
    for (const [id, mesh] of this.projectiles) if (!active.has(id)) { this.G.scene.remove(mesh); this.projectiles.delete(id); }
  }

  update(dt) {
    const now = performance.now();
    this.fpsFrames += 1;
    if (now - this.fpsStarted >= 500) {
      this.fpsElement.textContent = `${Math.round(this.fpsFrames * 1000 / (now - this.fpsStarted))} FPS`;
      this.fpsFrames = 0; this.fpsStarted = now;
    }
    if (now - this.lastMove > 33) {
      const player = this.G.player;
      this.network.send({ type: 'move', position: player.pos, velocity: player.vel, yaw: player.yaw, pitch: player.pitch, stance: player.crouching ? 'crouch' : 'stand', lean: player.lean || 0 });
      this.lastMove = now;
    }
    for (const avatar of this.avatars.values()) {
      const target = avatar.userData.target;
      avatar.position.lerp(new THREE.Vector3(target.position.x, target.position.y, target.position.z), Math.min(1, dt * 16));
      avatar.rotation.y = target.yaw + Math.PI;
      animateOperator(avatar, target, 0, dt);
    }
    if (this.self) {
      this.G.player.tuning.sprint = this.self.exoUntil > Date.now() ? 7.8 : 6.4;
      for (const ability of ['primary', 'tactical', 'throwable']) {
        const element = this.skillHud.querySelector(`[data-skill="${ability}"]`);
        const remaining = Math.max(0, this.self.cooldowns[ability] - Date.now());
        element.classList.toggle('cooling', remaining > 0);
        element.dataset.cooldown = remaining > 0 ? `${Math.ceil(remaining / 1000)}s` : '';
        element.querySelector('b').style.width = `${(1 - remaining / OPERATORS[this.operator].skills[ability].cooldown) * 100}%`;
      }
      const ultRemaining = Math.max(0, this.self.exoUntil - Date.now());
      this.ultElement.style.display = this.operator === 'redwolf' && ultRemaining > 0 ? 'flex' : 'none';
      if (ultRemaining > 0) {
        this.ultElement.querySelector('i').style.width = `${Math.min(100, ultRemaining / 20000 * 100)}%`;
        this.ultElement.querySelector('b').textContent = `${(ultRemaining / 1000).toFixed(1)}s`;
      }
    }
    if (this.bowDrawing && this.device) {
      this.bowCharge = Math.min(1, (performance.now() - this.bowStart) / 1500);
      const string = this.device.userData.string;
      if (string) { string.geometry.attributes.position.setZ(1, .04 + this.bowCharge * .28); string.geometry.attributes.position.needsUpdate = !0; }
    }
    if (this.equipment !== 'gun') this.updateTrajectory();
    const scoped = this.weaponId === 'awm' && this.G.awmWeapon.ads > .7;
    this.scope.style.display = scoped ? 'block' : 'none';
    this.awmVisual.visible = !scoped;
    for (const name of ['SaltlineGripHand', 'SaltlineSupportHand']) {
      const hand = this.G.awmWeapon.root.getObjectByName(name);
      if (hand) hand.visible = !scoped;
    }
    this.awmVisual.userData.mixer?.update(dt);
    if (this.weaponId === 'awm') {
      const state = this.G.awmWeapon.state;
      if (state !== this.lastAwmState) {
        if (state === 'reloading') this.assets.play(this.awmVisual, 'Reload');
        if (state === 'firing') this.assets.play(this.awmVisual, 'Bolt');
        this.lastAwmState = state;
      }
    }
    this.updateProjectiles(this.latestProjectiles || []);
    this.updateLean(dt);
    this.tacticalMap?.update(this.latestPlayers, now);
  }
}
