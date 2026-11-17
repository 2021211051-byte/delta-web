import { Game } from './game.js';
import { NetworkClient } from './network.js';
import { sanitizeRoom } from '../../shared/config.js';

const $ = (id) => document.getElementById(id);
let selectedOperator = 'vyron';
let game;
let joining = false;

function randomRoom() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((value) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[value % 32]).join('');
}

function showError(error) {
  $('fatal-message').textContent = error.message || String(error);
  $('fatal').classList.remove('hidden');
}

async function deploy(room) {
  if (joining) return;
  const code = sanitizeRoom(room);
  if (!code) {
    $('room-code').focus(); $('room-code').style.borderBottom = '1px solid #ef745e';
    $('room-code').placeholder = '请输入有效房间号';
    return;
  }
  joining = true;
  const buttons = [$('join-room'), $('solo-range')]; buttons.forEach((button) => { button.disabled = true; });
  $('join-room').querySelector('span').textContent = '正在连接…';
  try {
    const network = new NetworkClient();
    await network.join(code, $('player-name').value, selectedOperator);
    await game.start(selectedOperator, network);
  } catch (error) {
    showError(error);
  } finally {
    joining = false; buttons.forEach((button) => { button.disabled = false; });
    $('join-room').querySelector('span').textContent = '联机部署';
  }
}

function openControls() { $('controls-modal').classList.remove('hidden'); }

function bindUI() {
  document.querySelectorAll('.operator-card').forEach((card) => card.addEventListener('click', () => {
    selectedOperator = card.dataset.operator;
    game.setLobbyOperator(selectedOperator);
    document.querySelectorAll('.operator-card').forEach((other) => {
      const selected = other === card; other.classList.toggle('selected', selected); other.setAttribute('aria-checked', selected);
      other.querySelector('.select-tick').textContent = selected ? '已选择' : '选择干员';
    });
    const accents = { vyron: '#d8ef8b', luna: '#70d5e8', redwolf: '#ef745e' };
    document.documentElement.style.setProperty('--accent', accents[selectedOperator]);
  }));
  $('random-room').addEventListener('click', () => { $('room-code').value = randomRoom(); });
  $('room-code').addEventListener('input', (event) => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); event.target.style.borderBottom = ''; });
  $('room-code').addEventListener('keydown', (event) => { if (event.key === 'Enter') deploy(event.target.value); });
  $('join-room').addEventListener('click', () => deploy($('room-code').value));
  $('solo-range').addEventListener('click', () => deploy(randomRoom()));
  $('open-controls').addEventListener('click', openControls);
  $('pause-controls').addEventListener('click', openControls);
  document.querySelectorAll('.modal-close').forEach((button) => button.addEventListener('click', () => $('controls-modal').classList.add('hidden')));
  $('controls-modal').addEventListener('click', (event) => { if (event.target === $('controls-modal')) $('controls-modal').classList.add('hidden'); });
  $('resume').addEventListener('click', () => game.resume());
  $('leave-room').addEventListener('click', () => game.stop());
  $('hud-exit').addEventListener('click', () => game.stop());
  const settings = JSON.parse(localStorage.getItem('delta-web-settings') || '{}');
  for (const [id, value] of [['sensitivity', settings.sensitivity ?? 1], ['volume', settings.volume ?? .65], ['quality', settings.quality || 'high']]) $(id).value = value;
  const applySettings = () => {
    game.setSensitivity($('sensitivity').value); game.setVolume($('volume').value); game.setQuality($('quality').value);
    $('sensitivity-value').textContent = Number($('sensitivity').value).toFixed(1);
    $('volume-value').textContent = `${Math.round($('volume').value * 100)}%`;
    localStorage.setItem('delta-web-settings', JSON.stringify({ sensitivity: Number($('sensitivity').value), volume: Number($('volume').value), quality: $('quality').value }));
  };
  for (const id of ['sensitivity', 'volume', 'quality']) $(id).addEventListener('input', applySettings);
  applySettings();
  $('player-name').value = localStorage.getItem('delta-web-name') || `干员${Math.floor(Math.random() * 900 + 100)}`;
  $('player-name').addEventListener('change', () => localStorage.setItem('delta-web-name', $('player-name').value));
  $('room-code').value = randomRoom();
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape' && !$('controls-modal').classList.contains('hidden')) $('controls-modal').classList.add('hidden');
  });
}

try {
  game = new Game($('game-canvas'), {
    onDisconnect: () => {
      game.stop();
      $('fatal-message').textContent = '与战术网络的连接已断开，请重新部署。';
      $('fatal').classList.remove('hidden');
    },
  });
  bindUI();
  game.ready.then(() => {
    $('loading').classList.add('hidden'); $('lobby').classList.remove('hidden');
  }).catch((error) => {
    console.error(error); $('loading').classList.add('hidden');
    showError(new Error('Blender 模型加载失败，请检查资产文件后重试。'));
  });
} catch (error) {
  console.error(error);
  $('loading').classList.add('hidden');
  showError(new Error('3D 画面初始化失败。请使用支持 WebGL 2 的新版 Chrome、Edge 或 Firefox，并开启硬件加速。'));
}
