import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import { normalize } from '../shared/physics.js';
import { SOLIDS } from '../shared/config.js';

const port = 18080 + Math.floor(Math.random() * 500);
let server;
const clients = new Set();

class Client {
  constructor() {
    this.messages = []; this.waiters = new Set(); this.ws = null; this.id = null;
  }
  join(room, name, operator = 'vyron', mode = 'single') {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      this.ws.on('open', () => this.ws.send(JSON.stringify({ type: 'join', room, name, operator, mode })));
      this.ws.on('message', (raw) => {
        const data = JSON.parse(raw);
        this.messages.push(data);
        if (data.type === 'welcome') { this.id = data.id; resolve(data); }
        for (const waiter of this.waiters) {
          if (waiter.type === data.type && waiter.predicate(data)) {
            clearTimeout(waiter.timer); this.waiters.delete(waiter); waiter.resolve(data);
          }
        }
      });
      this.ws.on('error', reject);
      clients.add(this);
    });
  }
  send(data) { this.ws.send(JSON.stringify(data)); }
  waitFor(type, predicate = () => true, timeout = 3000) {
    const existing = this.messages.find((message) => message.type === type && predicate(message));
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = { type, predicate, resolve, timer: null };
      waiter.timer = setTimeout(() => { this.waiters.delete(waiter); reject(new Error(`等待 ${type} 超时`)); }, timeout);
      this.waiters.add(waiter);
    });
  }
  close() { this.ws?.close(); clients.delete(this); }
}

before(async () => {
  server = spawn(process.execPath, ['server.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port) }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('测试服务器未启动');
});

after(() => {
  for (const client of clients) client.close();
  server?.kill('SIGTERM');
});

test('HTTP 服务与健康检查可用', async () => {
  const response = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /三角洲：网页行动/);
  const health = await fetch(`http://127.0.0.1:${port}/health`).then((res) => res.json());
  assert.equal(health.ok, true);
});

test('两个客户端可进入同一房间并收到彼此状态', async () => {
  const a = new Client(); const b = new Client();
  await a.join('TEST42', '甲', 'vyron'); await b.join('TEST42', '乙', 'luna');
  assert.ok(a.id); assert.ok(b.id); assert.notEqual(a.id, b.id);
  const snapshot = await a.waitFor('snapshot', (data) => data.players.length === 2);
  assert.deepEqual(snapshot.players.map((player) => player.operator).sort(), ['luna', 'vyron']);
  b.send({ type: 'move', position: { x: 1, y: 0, z: -31 }, yaw: .4, pitch: .1, stance: 'crouch', velocity: { x: 1, y: 0, z: 0 } });
  const moved = await a.waitFor('snapshot', (data) => data.players.some((player) => player.id === b.id && player.position.x === 1));
  const remote = moved.players.find((player) => player.id === b.id);
  assert.equal(remote.stance, 'crouch');
  a.close(); b.close();
});

test('M7 射击命中共享靶标并扣除弹药', async () => {
  const client = new Client(); await client.join('AIM100', '射手');
  await client.waitFor('snapshot');
  client.send({ type: 'move', position: { x: 0, y: 0, z: 26 }, yaw: 0, pitch: 0, stance: 'stand', velocity: { x: 0, y: 0, z: 0 } });
  await new Promise((resolve) => setTimeout(resolve, 60));
  const origin = { x: 0, y: 1.64, z: 26 };
  const direction = normalize({ x: 0, y: 1.45 - origin.y, z: 12 - origin.z });
  client.send({ type: 'shot', origin, direction });
  await client.waitFor('hit', (data) => data.target === 'target');
  const snapshot = await client.waitFor('snapshot', (data) => data.self.loadout.m7.ammo === 29);
  assert.ok(snapshot.self.loadout.m7.reserve > 1000);
  const target = snapshot.targets.find((entry) => entry.id === 't2');
  assert.ok(target.hp < 100);
  client.close();
});

test('露娜技能生成侦察箭且服务器执行冷却', async () => {
  const client = new Client(); await client.join('LUNA42', '侦察员', 'luna');
  await client.waitFor('snapshot');
  const message = { type: 'ability', ability: 'primary', origin: { x: 0, y: 1.64, z: 26 }, direction: { x: 0, y: .1, z: -.9949874371 } };
  client.send(message);
  const snapshot = await client.waitFor('snapshot', (data) => data.projectiles.some((projectile) => projectile.kind === 'recon'));
  assert.ok(snapshot.self.cooldowns.primary > Date.now());
  const count = snapshot.projectiles.length;
  client.send(message);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const latest = client.messages.filter((data) => data.type === 'snapshot').at(-1);
  assert.equal(latest.projectiles.length, count);
  client.close();
});

test('露娜蓄力量决定箭矢初速', async () => {
  const low = new Client(); const high = new Client();
  await low.join('LOWCHG', '低蓄力', 'luna'); await high.join('HICHG', '满蓄力', 'luna');
  await low.waitFor('snapshot'); await high.waitFor('snapshot');
  const base = { type: 'ability', ability: 'primary', origin: { x: 0, y: 1.64, z: 26 }, direction: { x: 0, y: 0, z: -1 } };
  low.send({ ...base, charge: 0 }); high.send({ ...base, charge: 1 });
  const a = await low.waitFor('snapshot', (data) => data.projectiles.length > 0);
  const b = await high.waitFor('snapshot', (data) => data.projectiles.length > 0);
  assert.ok(Math.abs(a.projectiles[0].velocity.z) < 18);
  assert.ok(Math.abs(b.projectiles[0].velocity.z) > 59, JSON.stringify(b.projectiles));
  low.close(); high.close();
});

test('红狼一次击发间隔生成三发独立榴弹', async () => {
  const client = new Client(); await client.join('TRIPLE', '红狼', 'redwolf');
  await client.waitFor('snapshot');
  client.send({ type: 'ability', ability: 'tactical', origin: { x: 0, y: 1.64, z: 26 }, direction: { x: 0, y: .15, z: -0.9886859967 } });
  await client.waitFor('snapshot', (data) => data.projectiles.filter((p) => p.kind === 'triple').length === 1);
  const snapshot = await client.waitFor('snapshot', (data) => data.projectiles.filter((p) => p.kind === 'triple').length === 3);
  assert.equal(new Set(snapshot.projectiles.map((p) => p.id)).size, 3);
  client.close();
});

test('探头后的头部受击框随人物朝向侧移', async () => {
  const shooter = new Client(); const victim = new Client();
  await shooter.join('LEANHIT', '射手'); await victim.join('LEANHIT', '目标');
  await shooter.waitFor('snapshot', (data) => data.players.length === 2);
  victim.send({ type: 'move', position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, stance: 'stand', lean: 1, velocity: { x: 0, y: 0, z: 0 } });
  await shooter.waitFor('snapshot', (data) => data.players.some((player) => player.id === victim.id && player.lean === 1));
  shooter.send({ type: 'move', position: { x: 0, y: 0, z: 10 }, yaw: 0, pitch: 0, stance: 'stand', lean: 0, velocity: { x: 0, y: 0, z: 0 } });
  await new Promise((resolve) => setTimeout(resolve, 80));
  const origin = { x: 0, y: 1.64, z: 10 };
  shooter.send({ type: 'shot', origin, direction: normalize({ x: .42, y: 1.6 - origin.y, z: -10 }) });
  const hit = await shooter.waitFor('hit', (data) => data.target === 'player');
  assert.equal(hit.headshot, true);
  const snapshot = await victim.waitFor('snapshot', (data) => data.self.hp < 100);
  assert.ok(snapshot.self.hp <= 51);
  shooter.close(); victim.close();
});

test('靶子击倒复位后可以再次命中', async () => {
  const client = new Client(); await client.join('RESETGT', '射手');
  await client.waitFor('snapshot');
  client.send({ type: 'move', position: { x: 0, y: 0, z: 26 }, yaw: 0, pitch: 0, stance: 'stand', velocity: { x: 0, y: 0, z: 0 } });
  await new Promise((resolve) => setTimeout(resolve, 80));
  const origin = { x: 0, y: 1.64, z: 26 };
  for (let cycle = 0; cycle < 2; cycle += 1) {
    const started = Date.now() - 5;
    for (let shot = 0; shot < 4; shot += 1) {
      client.send({ type: 'shot', origin, direction: normalize({ x: 0, y: 1.45 - origin.y, z: -14 }) });
      await new Promise((resolve) => setTimeout(resolve, 115));
    }
    const down = await client.waitFor('snapshot', (data) => data.time > started && data.targets.find((target) => target.id === 't2').down, 2000);
    if (cycle === 0) {
      await client.waitFor('snapshot', (data) => data.time > down.time && !data.targets.find((target) => target.id === 't2').down && data.targets.find((target) => target.id === 't2').hp === 100, 4500);
    }
  }
  assert.equal(client.messages.filter((data) => data.type === 'hit' && data.target === 'target').length, 8);
  client.close();
});

test('联机死亡后在安全的地图边缘随机复活', async () => {
  const shooter = new Client(); const victim = new Client();
  await shooter.join('SPAWNR', '射手', 'vyron', 'online');
  await victim.join('SPAWNR', '目标', 'luna', 'online');
  await shooter.waitFor('snapshot', (data) => data.players.length === 2);
  victim.send({ type: 'move', position: { x: 18, y: 0, z: 24 }, yaw: 0, pitch: 0, stance: 'stand', lean: 0, velocity: { x: 0, y: 0, z: 0 } });
  await shooter.waitFor('snapshot', (data) => data.players.some((player) => player.id === victim.id && player.position.z === 24));
  shooter.send({ type: 'move', position: { x: 18, y: 0, z: 14 }, yaw: 0, pitch: 0, stance: 'stand', lean: 0, velocity: { x: 0, y: 0, z: 0 } });
  await new Promise((resolve) => setTimeout(resolve, 80));
  const started = Date.now() - 5;
  for (let shot = 0; shot < 2; shot += 1) {
    shooter.send({ type: 'shot', origin: { x: 18, y: 1.64, z: 14 }, direction: normalize({ x: 0, y: -.04, z: 10 }) });
    await new Promise((resolve) => setTimeout(resolve, 130));
  }
  const dead = await victim.waitFor('snapshot', (data) => data.time > started && data.self.dead);
  const respawned = await victim.waitFor('snapshot', (data) => data.time > dead.time && !data.self.dead, 4500);
  const position = respawned.self ? respawned.players.find((player) => player.id === victim.id).position : null;
  assert.ok(position);
  assert.ok(Math.abs(position.x) > 15 || Math.abs(position.z) > 18);
  assert.ok(position.x <= 28 && Math.abs(position.z) <= 28);
  assert.equal(SOLIDS.some((box) => position.x >= box.min[0] && position.x <= box.max[0] && position.z >= box.min[2] && position.z <= box.max[2]), false);
  shooter.close(); victim.close();
});
