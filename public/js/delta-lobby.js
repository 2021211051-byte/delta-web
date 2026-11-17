import * as THREE from 'three';
import { NetworkClient } from './network.js';
import { AssetLibrary } from './asset-library.js';
import { makeTextures } from './textures.js';
import { createModelMaterials } from './models.js';
import { DeltaMultiplayer } from './delta-multiplayer.js';

const portal = document.createElement('section');
portal.id = 'delta-portal';
portal.innerHTML = `<header class="delta-brand"><strong>DELTA / WEB</strong><span>战术训练终端 · 全部界面中文</span></header><div class="delta-form"><h1>选择行动模式</h1><p>独立靶场训练 / 原港口地图联机</p><div class="delta-modes"><button data-mode="single" class="active"><b>01</b><strong>单人靶场</strong><small>固定与移动靶 · 自由练习</small></button><button data-mode="online"><b>02</b><strong>联机房间</strong><small>原港口地图 · 无占点与人机</small></button></div><div class="delta-operators"><button data-op="vyron" class="active"><b>威龙</b><small>动力推进 / 磁吸炸弹</small></button><button data-op="luna"><b>露娜</b><small>侦察箭矢 / 电击箭矢</small></button><button data-op="redwolf"><b>红狼</b><small>动力外骨骼 / 三联手炮</small></button></div><label class="delta-field">干员呼号<input id="delta-name" maxlength="14" value="干员"></label><label class="delta-field" id="delta-room-field" hidden>联机房间号<input id="delta-room" maxlength="8" value="RANGE42"></label><button class="delta-deploy" id="delta-deploy">进入单人靶场</button><div class="delta-error" id="delta-error"></div></div><div class="delta-preview"><canvas id="delta-preview-canvas"></canvas><span class="delta-preview-label">实时 3D 干员预览</span></div><footer class="delta-controls"><span>WASD <b>移动</b></span><span>SHIFT <b>冲刺</b></span><span>Q / E <b>左右探头</b></span><span>M <b>战术地图</b></span><span>1 / 2 <b>M7 / AWM</b></span><span>X / V / G <b>干员技能</b></span><span>R <b>换弹</b></span></footer>`;
document.body.append(portal);

class OperatorPreview {
  constructor() {
    this.canvas = document.getElementById('delta-preview-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(34, 1, .05, 20);
    this.camera.position.set(0, 1.18, 4); this.camera.lookAt(0, 1.04, 0);
    this.scene.add(new THREE.HemisphereLight(0xdce8dc, 0x293229, 2.6));
    const key = new THREE.DirectionalLight(0xffe5c4, 5); key.position.set(-3, 4, 4); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x92b7c9, 3); rim.position.set(3, 3, -2); this.scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(.75, .8, .05, 48), new THREE.MeshStandardMaterial({ color: 0x27332b, roughness: .8 })); floor.position.y = -.025; this.scene.add(floor);
    this.active = true; this.frame = this.frame.bind(this); requestAnimationFrame(this.frame);
  }
  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.renderer.setSize(rect.width, rect.height, !1); this.camera.aspect = rect.width / rect.height; this.camera.updateProjectionMatrix();
  }
  setOperator(operator, assets) {
    if (this.model) this.scene.remove(this.model);
    this.model = assets.operator(operator, operator); this.model.userData.nameSprite.visible = !1;
    this.model.userData.leftArm.shoulder.rotation.x = .8; this.model.userData.rightArm.shoulder.rotation.x = .72;
    this.model.userData.leftArm.elbow.rotation.x = .9; this.model.userData.rightArm.elbow.rotation.x = .9;
    this.scene.add(this.model);
  }
  frame(time) {
    if (!this.active) return;
    this.resize(); if (this.model) this.model.rotation.y = -.16 + Math.sin(time * .00045) * .12;
    this.renderer.render(this.scene, this.camera); requestAnimationFrame(this.frame);
  }
}

let operator = 'vyron';
let preview;
let assetsPromise;
let assets;
const wait = (predicate) => new Promise((resolve) => {
  const check = () => predicate() ? resolve() : setTimeout(check, 50);
  check();
});

function localizeInterface() {
  const actions = { deploy: '开始行动', settings: '设置', controls: '操作说明', resume: '继续行动', restart: '重新部署', retry: '重新部署', redeploy: '再次部署', 'close-panel': '关闭', invert: '反转 Y 轴', fullscreen: '全屏显示' };
  document.querySelectorAll('[data-act]').forEach((element) => { if (actions[element.dataset.act]) element.textContent = actions[element.dataset.act]; });
  const text = (selector, value) => document.querySelectorAll(selector).forEach((element) => { element.textContent = value; });
  text('.m-card[data-s="paused"] .m-k', '行动暂时中断');
  text('.m-card[data-s="paused"] .m-h', '已暂停');
  text('.m-card[data-s="dead"] .m-k', '干员阵亡'); text('.m-card[data-s="dead"] .m-h', '连接中断');
  text('.m-card[data-s="dead"] dt:first-child', '行动时间'); text('.m-card[data-s="dead"] dt:last-child', '训练得分');
  text('.m-card[data-s="complete"] .m-h', '行动结算'); text('.m-rating span', '评价');
  text('.m-stats dt:nth-child(1)', '时间');
  const labels = { 'l-q': '画面质量', 'l-inv': '反转 Y 轴', 'l-fs': '显示模式' };
  for (const [id, value] of Object.entries(labels)) text(`#${id}`, value);
  const labelFor = { 's-sens': '鼠标灵敏度', 's-vol': '主音量', 's-fov': '视场角' };
  for (const [id, value] of Object.entries(labelFor)) text(`[for="${id}"]`, value);
  const qualities = { low: '低', medium: '中', high: '高', ultra: '极高' };
  document.querySelectorAll('[data-q]').forEach((element) => { element.textContent = qualities[element.dataset.q] || element.dataset.q; });
  const settingsPane = document.querySelector('.panel-b[data-pane="settings"]');
  if (settingsPane && !settingsPane.querySelector('[data-act="ads-mode"]')) {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<label>开镜方式</label><button class="btn small" data-act="ads-mode">${localStorage.getItem('delta-ads-mode') === 'toggle' ? '切换开镜' : '长按开镜'}</button><label>探头方式</label><button class="btn small" data-act="lean-mode">${localStorage.getItem('delta-lean-mode') === 'toggle' ? '切换探头' : '长按探头'}</button>`;
    settingsPane.append(row);
  }
  text('.panel-b[data-pane="controls"]', '');
  const controls = document.querySelector('.panel-b[data-pane="controls"]');
  if (controls) controls.innerHTML = '<h3>键盘与鼠标</h3><p>WASD 移动 · 鼠标控制视角 · 左键射击 · 右键瞄准</p><p>Shift 冲刺 · Q/E 左右探头 · Space 跳跃 · C 蹲伏 · R 换弹 · 1/2 切换 M7/AWM</p><p>X 核心装备 · V 战术装备 · G 投掷物 · M 展开/收起地图 · Esc 暂停</p><p>威龙按住 V 握持磁吸炸弹，松开投掷；露娜右键蓄力；红狼左键发射三联榴弹。</p><h3>触屏</h3><p>左侧移动，右侧调整视角，屏幕按钮用于射击、瞄准、换弹与跳跃。</p><h3>手柄</h3><p>摇杆移动与视角 · RT 射击 · LT 瞄准 · A 跳跃 · B 蹲伏 · X 换弹 · L3 冲刺 · Start 暂停。</p>';
  const pausedActions = document.querySelector('.m-card[data-s="paused"] .m-actions');
  if (pausedActions && !pausedActions.querySelector('[data-act="lobby"]')) {
    const button = document.createElement('button'); button.className = 'btn'; button.dataset.act = 'lobby'; button.textContent = '返回主页'; pausedActions.append(button);
  }
  text('.h-k', '目标 / 状态'); text('.h-health .h-k', '生命状态');
  const replacements = [
    [/\bObjective\b/g, '目标'], [/\bVitals\b/g, '生命状态'], [/Reloading/g, '正在换弹'], [/Low ammo/g, '弹药不足'], [/\bEmpty\b/g, '弹匣已空'],
    [/Click the view to capture the mouse/g, '单击画面锁定鼠标'], [/Mouse captured — Esc releases it/g, '鼠标已锁定 · Esc 释放'],
    [/Resume recaptures the mouse\./g, '继续行动将重新锁定鼠标。'], [/Enter fullscreen/g, '进入全屏'], [/Exit fullscreen/g, '退出全屏'],
    [/Fullscreen is not available here/g, '当前环境不支持全屏'], [/Quality changes apply at once[^<]*/g, '画质调整立即生效；帧率下降时可降低画质。'],
    [/Quality was picked for this device \(([^)]+)\)\. Lower it if the frame rate struggles\./g, '已根据设备选择画质；帧率下降时可降低画质。'],
  ];
  const translate = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) for (const [pattern, value] of replacements) {
      const translated = node.data.replace(pattern, value);
      if (translated !== node.data) node.data = translated;
    }
  };
  translate(document.getElementById('ui'));
  new MutationObserver((records) => records.forEach((record) => {
    if (record.type === 'characterData') translate(record.target.parentNode);
    record.addedNodes.forEach((node) => { if (node.nodeType === Node.TEXT_NODE) translate(node.parentNode); else if (node.nodeType === Node.ELEMENT_NODE) translate(node); });
  })).observe(document.getElementById('ui'), { childList: true, subtree: true, characterData: true });
}

async function loadAssets() {
  if (!assetsPromise) {
    const textures = makeTextures(); const materials = createModelMaterials(textures);
    assetsPromise = new AssetLibrary(materials, textures).load();
  }
  assets = await assetsPromise; return assets;
}

let mode = new URLSearchParams(location.search).get('mode') === 'online' ? 'online' : 'single';
function selectMode(value) {
  mode = value;
  portal.querySelectorAll('[data-mode]').forEach((item) => item.classList.toggle('active', item.dataset.mode === value));
  document.getElementById('delta-room-field').hidden = value !== 'online';
  document.getElementById('delta-deploy').textContent = value === 'online' ? '创建 / 加入联机房间' : '进入单人靶场';
}
for (const button of portal.querySelectorAll('[data-mode]')) button.addEventListener('click', () => selectMode(button.dataset.mode));
selectMode(mode);

for (const button of portal.querySelectorAll('[data-op]')) button.addEventListener('click', async () => {
  operator = button.dataset.op;
  portal.querySelectorAll('[data-op]').forEach((item) => item.classList.toggle('active', item === button));
  preview ||= new OperatorPreview(); preview.setOperator(operator, await loadAssets());
});

async function deploy(event) {
  event?.preventDefault();
  const button = document.getElementById('delta-deploy'); const error = document.getElementById('delta-error');
  const name = document.getElementById('delta-name').value;
  let room = document.getElementById('delta-room').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (mode === 'online' && room.length < 4) { error.textContent = '房间号至少为 4 位字母或数字'; return; }
  const requestedMode = mode === 'online' ? 'online' : 'single';
  if ((new URLSearchParams(location.search).get('mode') || 'single') !== requestedMode) {
    sessionStorage.setItem('delta-mode-deploy', JSON.stringify({ room, name, operator, mode: requestedMode }));
    location.href = `/?mode=${requestedMode}`;
    return;
  }
  if (mode === 'single') room = `SOLO${Math.floor(Math.random() * 9000 + 1000)}`;
  button.disabled = true; error.textContent = mode === 'online' ? '正在连接联机房间…' : '正在准备单人靶场…';
  try {
    await loadAssets(); await wait(() => window.__ready && window.__G?.game);
    const network = new NetworkClient();
    await network.join(room, name, operator, mode);
    const game = window.__G;
    game.onlineMode = mode;
    game.weapon = game.m7Weapon; game.m7Weapon.setVisible(!0); game.awmWeapon.setVisible(!1);
    game.game.start({ skipIntro: !0 });
    new DeltaMultiplayer(game, network, assets, operator);
    portal.classList.add('hidden');
    if (preview) preview.active = false;
    sessionStorage.removeItem('delta-mode-deploy');
  } catch (cause) {
    error.textContent = cause.message || String(cause); button.disabled = false;
  }
}

document.getElementById('delta-deploy').addEventListener('click', deploy);
document.getElementById('delta-room').addEventListener('keydown', (event) => { if (event.key === 'Enter') deploy(event); });
loadAssets().then(() => {
  preview = new OperatorPreview(); preview.setOperator(operator, assets);
}).catch((cause) => { document.getElementById('delta-error').textContent = cause.message; });
wait(() => window.__ready && window.__G?.hud).then(localizeInterface);
const pendingMode = sessionStorage.getItem('delta-mode-deploy');
if (pendingMode) {
  try {
    const pending = JSON.parse(pendingMode);
    if (pending.mode === mode) {
      operator = pending.operator; document.getElementById('delta-name').value = pending.name;
      document.getElementById('delta-room').value = pending.room;
      portal.querySelectorAll('[data-op]').forEach((item) => item.classList.toggle('active', item.dataset.op === operator));
      wait(() => window.__ready && assets).then(() => deploy());
    }
  } catch { sessionStorage.removeItem('delta-mode-deploy'); }
}
document.addEventListener('click', (event) => {
  if (event.target.closest('[data-act="lobby"]')) location.href = '/';
  const adsButton = event.target.closest('[data-act="ads-mode"]');
  if (adsButton) {
    const mode = localStorage.getItem('delta-ads-mode') === 'toggle' ? 'hold' : 'toggle';
    localStorage.setItem('delta-ads-mode', mode); adsButton.textContent = mode === 'toggle' ? '切换开镜' : '长按开镜';
    window.__G?.delta?.setAdsMode(mode);
  }
  const leanButton = event.target.closest('[data-act="lean-mode"]');
  if (leanButton) {
    const mode = localStorage.getItem('delta-lean-mode') === 'toggle' ? 'hold' : 'toggle';
    localStorage.setItem('delta-lean-mode', mode); leanButton.textContent = mode === 'toggle' ? '切换探头' : '长按探头';
    window.__G?.delta?.setLeanMode(mode);
  }
});
window.__deltaPortal = { deploy, get assets() { return assets; }, get operator() { return operator; }, get mode() { return mode; } };
