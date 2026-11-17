import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize as normalizePath, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import {
  MAX_PLAYERS, OPERATORS, RANGE_SOLIDS, SOLIDS, SPAWNS, PORT_SPAWNS, TARGETS, TICK_RATE, WEAPONS,
  makeLoadout, sanitizeName, sanitizeRoom, targetPosition,
} from './shared/config.js';
import {
  clamp, distance, eyeHeight, hasLineOfSight, nearestSolidHit,
  normalize, raySphere, validDirection,
} from './shared/physics.js';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8080);
const rooms = new Map();
let projectileId = 0;

const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.md': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, players: [...rooms.values()].reduce((n, room) => n + room.players.size, 0) }));
    return;
  }
  let base = join(root, 'public');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  if (pathname.startsWith('/shared/')) base = root;
  else if (pathname.startsWith('/vendor/three/')) {
    base = join(root, 'node_modules/three');
    pathname = pathname.slice('/vendor/three'.length);
  }
  const file = resolve(base, `.${normalizePath(pathname)}`);
  if (!file.startsWith(`${resolve(base)}/`) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': mime[extname(file)] || 'application/octet-stream',
    'Cache-Control': ['.html', '.js', '.css'].includes(extname(file)) ? 'no-cache' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 });
server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url, 'http://localhost').pathname !== '/ws') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

function send(ws, message) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function broadcast(room, message) {
  for (const player of room.players.values()) send(player.ws, message);
}

function roomEvent(room, event) {
  broadcast(room, { type: 'event', event });
}

function spawnPoint(room, mode = 'single') {
  const spawns = mode === 'online' ? PORT_SPAWNS : SPAWNS;
  const candidates = mode === 'online' ? spawns.map((spawn) => ({
    x: clamp(spawn.x + (Math.random() - .5) * 3.6, -34, 28),
    y: 0,
    z: clamp(spawn.z + (Math.random() - .5) * 3.6, -28, 27),
  })).filter((spawn) => !insideSolid(spawn)) : spawns;
  const scored = candidates.map((spawn) => ({
    spawn,
    nearest: Math.min(60, ...[...room.players.values()]
      .filter((player) => player.hp > 0)
      .map((player) => distance(spawn, player.position))),
  })).sort((a, b) => b.nearest - a.nearest);
  if (mode === 'online') return { ...scored[Math.floor(Math.random() * Math.min(3, scored.length))].spawn };
  return { ...scored[0].spawn };
}

function createPlayer(ws, data) {
  const operator = Object.hasOwn(OPERATORS, data.operator) ? data.operator : 'vyron';
  return {
    id: randomUUID(), ws, name: sanitizeName(data.name), operator,
    mode: data.mode === 'online' ? 'online' : 'single',
    position: { x: 0, y: 0, z: 32 }, yaw: Math.PI, pitch: 0, stance: 'stand', lean: 0,
    velocity: { x: 0, y: 0, z: 0 }, hp: 100, dead: false, respawnAt: 0,
    weapon: 'm7', loadout: makeLoadout(), lastShot: 0, lastMove: 0,
    cooldowns: { primary: 0, tactical: 0, throwable: 0 },
    exoUntil: 0, markedUntil: 0, markedBy: null, lastSeen: Date.now(),
    kills: 0, deaths: 0, score: 0, shots: 0, hits: 0,
  };
}

function publicPlayer(player, now) {
  return {
    id: player.id, name: player.name, operator: player.operator,
    position: player.position, yaw: player.yaw, pitch: player.pitch,
    stance: player.stance, velocity: player.velocity, hp: player.hp, lean: player.lean,
    dead: player.dead, weapon: player.weapon, kills: player.kills,
    deaths: player.deaths, score: player.score, marked: player.markedUntil > now,
    exo: player.exoUntil > now,
  };
}

function resetPlayer(player, room) {
  player.position = spawnPoint(room, player.mode);
  player.lean = 0;
  player.velocity = { x: 0, y: 0, z: 0 };
  player.hp = 100;
  player.dead = false;
  player.respawnAt = 0;
  player.weapon = 'm7';
  player.loadout = makeLoadout();
  player.cooldowns = { primary: 0, tactical: 0, throwable: 0 };
  player.exoUntil = 0;
  player.markedUntil = 0;
}

function applyDamage(room, victim, amount, attacker, kind = 'bullet', headshot = false) {
  if (victim.dead || amount <= 0) return;
  const now = Date.now();
  victim.hp = clamp(victim.hp - Math.round(amount), 0, 100);
  if (attacker && attacker.id !== victim.id && attacker.operator === 'luna') {
    victim.markedUntil = now + 3500;
    victim.markedBy = attacker.id;
  }
  send(victim.ws, { type: 'damaged', amount: Math.round(amount), from: attacker?.id, kind });
  if (attacker && attacker.id !== victim.id) send(attacker.ws, { type: 'hit', target: 'player', damage: Math.round(amount), headshot, killed: victim.hp <= 0 });
  if (victim.hp > 0) return;
  victim.dead = true;
  victim.deaths += 1;
  victim.respawnAt = now + 3200;
  if (attacker && attacker.id !== victim.id) {
    attacker.kills += 1;
    attacker.score += headshot ? 150 : 100;
    if (attacker.operator === 'redwolf' && attacker.exoUntil > now) {
      attacker.hp = clamp(attacker.hp + 35, 0, 100);
      attacker.exoUntil += 4000;
    }
  }
  roomEvent(room, {
    kind: 'kill', victim: victim.id, victimName: victim.name,
    attacker: attacker?.id, attackerName: attacker?.name || '训练场', headshot,
  });
}

function hitTarget(room, target, damage, attacker, hitPosition) {
  if (target.respawnAt) return;
  target.hp = clamp(target.hp - Math.round(damage), 0, 100);
  attacker.score += Math.round(damage);
  send(attacker.ws, { type: 'hit', target: 'target', damage: Math.round(damage), killed: target.hp <= 0 });
  roomEvent(room, { kind: 'targetHit', id: target.id, position: hitPosition, damage: Math.round(damage), hp: target.hp });
  if (target.hp <= 0) {
    target.respawnAt = Date.now() + 3200;
    attacker.score += 100;
    roomEvent(room, { kind: 'targetDown', id: target.id });
  }
}

function playerHitbox(victim, height, leanFactor = 1) {
  const offset = clamp(Number(victim.lean) || 0, -1, 1) * .42 * leanFactor;
  return {
    x: victim.position.x + Math.cos(victim.yaw) * offset,
    y: victim.position.y + height,
    z: victim.position.z - Math.sin(victim.yaw) * offset,
  };
}

function handleShot(player, room, data) {
  const now = Date.now();
  const weapon = WEAPONS[player.weapon];
  const ammo = player.loadout[player.weapon];
  if (player.dead || !weapon || now - player.lastShot < weapon.interval * 0.9 || ammo.ammo <= 0 || ammo.reloading) return;
  if (!validDirection(data.direction) || !data.origin || !['x', 'y', 'z'].every((axis) => Number.isFinite(data.origin[axis]))) return;
  const expected = playerHitbox(player, eyeHeight(player.stance));
  if (distance(expected, data.origin) > 2.2) return;
  player.lastShot = now;
  ammo.ammo -= 1;
  player.shots += 1;
  const direction = normalize(data.direction);
  const origin = { x: data.origin.x, y: data.origin.y, z: data.origin.z };
  const muzzle = data.muzzle && ['x', 'y', 'z'].every((axis) => Number.isFinite(data.muzzle[axis])) && distance(origin, data.muzzle) < 2.5 ? data.muzzle : origin;
  roomEvent(room, { kind: 'shot', player: player.id, origin, direction, muzzle, weapon: weapon.id });

  const wall = nearestSolidHit(origin, direction, 220, player.mode === 'single' ? RANGE_SOLIDS : SOLIDS).distance;
  let closest = wall;
  let hit = null;
  for (const victim of room.players.values()) {
    if (victim.id === player.id || victim.dead) continue;
    const height = eyeHeight(victim.stance);
    const head = playerHitbox(victim, height - 0.04);
    const chest = playerHitbox(victim, height * 0.62, .72);
    const legs = playerHitbox(victim, height * 0.27, .12);
    const headDistance = raySphere(origin, direction, head, 0.235);
    const chestDistance = raySphere(origin, direction, chest, 0.43);
    const legsDistance = raySphere(origin, direction, legs, 0.38);
    const t = Math.min(headDistance, chestDistance, legsDistance);
    if (t < closest) {
      closest = t;
      hit = { type: 'player', victim, headshot: headDistance <= chestDistance && headDistance <= legsDistance };
    }
  }
  for (const target of room.targets.values()) {
    if (target.respawnAt) continue;
    const t = raySphere(origin, direction, targetPosition(target, now), target.radius);
    if (t < closest) {
      closest = t;
      hit = { type: 'target', target };
    }
  }
  if (!hit) return;
  const falloff = clamp(1 - Math.max(0, closest - weapon.range) / 160, 0, 1);
  const damage = (weapon.minDamage + (weapon.damage - weapon.minDamage) * falloff) * (hit.headshot ? weapon.headMultiplier : 1);
  const hitPosition = { x: origin.x + direction.x * closest, y: origin.y + direction.y * closest, z: origin.z + direction.z * closest };
  player.hits += 1;
  if (hit.type === 'player') applyDamage(room, hit.victim, damage, player, 'bullet', hit.headshot);
  else hitTarget(room, hit.target, damage, player, hitPosition);
}

function insideSolid(point) {
  return SOLIDS.some((box) => point.x >= box.min[0] && point.x <= box.max[0]
    && point.y >= box.min[1] && point.y <= box.max[1]
    && point.z >= box.min[2] && point.z <= box.max[2]);
}

function makeProjectile(room, player, kind, origin, direction, options = {}) {
  if (!validDirection(direction)) return;
  const projectile = {
    id: `p${projectileId++}`, kind, owner: player.id, room, mode: player.mode,
    position: { x: origin.x, y: origin.y - 0.08, z: origin.z },
    velocity: { x: direction.x * (options.speed || 18), y: direction.y * (options.speed || 18) + (options.lift ?? 2.4), z: direction.z * (options.speed || 18) },
    gravity: options.gravity ?? 12, created: Date.now(), born: Date.now(),
    ttl: options.ttl || 2600, stuck: false, detonateAt: 0, nextPulse: 0,
  };
  room.projectiles.set(projectile.id, projectile);
  roomEvent(room, { kind: 'projectile', projectile: publicProjectile(projectile) });
}

function handleAbility(player, room, data) {
  const now = Date.now();
  const ability = data.ability;
  if (player.dead || !['primary', 'tactical', 'throwable'].includes(ability) || player.cooldowns[ability] > now) return;
  if (!validDirection(data.direction) || !data.origin) return;
  const origin = { x: player.position.x, y: player.position.y + eyeHeight(player.stance) - 0.08, z: player.position.z };
  if (distance(origin, data.origin) > 2.2) return;
  const direction = normalize(data.direction);
  player.cooldowns[ability] = now + OPERATORS[player.operator].skills[ability].cooldown;

  if (ability === 'primary' && player.operator === 'vyron') {
    roomEvent(room, { kind: 'dash', player: player.id, direction });
    return;
  }
  if (ability === 'primary' && player.operator === 'redwolf') {
    player.exoUntil = now + 20000;
    roomEvent(room, { kind: 'exo', player: player.id });
    return;
  }
  if (ability === 'primary' && player.operator === 'luna') {
    const charge = clamp(Number(data.charge) || 0, 0, 1);
    makeProjectile(room, player, 'recon', origin, direction, { speed: 17 + charge * 43, gravity: 9.8, lift: 0, ttl: 14000 });
    roomEvent(room, { kind: 'bowRelease', player: player.id, charge, arrow: 'recon' });
    return;
  }
  if (ability === 'tactical' && player.operator === 'luna') {
    const charge = clamp(Number(data.charge) || 0, 0, 1);
    makeProjectile(room, player, 'shock', origin, direction, { speed: 17 + charge * 43, gravity: 9.8, lift: 0, ttl: 14000 });
    roomEvent(room, { kind: 'bowRelease', player: player.id, charge, arrow: 'shock' });
    return;
  }
  if (ability === 'tactical' && player.operator === 'vyron') {
    makeProjectile(room, player, 'magnetic', origin, direction, { speed: 21, ttl: 9000 });
    roomEvent(room, { kind: 'magneticThrow', player: player.id });
    return;
  }
  if (ability === 'tactical' && player.operator === 'redwolf') {
    for (let i = 0; i < 3; i += 1) {
      const spread = (i - 1) * 0.038;
      const d = normalize({ x: direction.x + Math.cos(player.yaw) * spread, y: direction.y + (i === 1 ? 0.018 : 0), z: direction.z - Math.sin(player.yaw) * spread });
      const launch = () => {
        if (room.players.has(player.id) && !player.dead) makeProjectile(room, player, 'triple', origin, d, { speed: 24, gravity: 12, ttl: 7000 });
      };
      if (i === 0) launch();
      else room.delayed.push({ at: now + i * 160, launch });
    }
    return;
  }
  makeProjectile(room, player, player.operator === 'luna' ? 'frag' : 'smoke', origin, direction, { speed: 17, ttl: 2100 });
}

function publicProjectile(projectile) {
  return {
    id: projectile.id, kind: projectile.kind, owner: projectile.owner,
    position: projectile.position, velocity: projectile.velocity, stuck: projectile.stuck,
  };
}

function detonate(room, projectile) {
  const { kind, position } = projectile;
  room.projectiles.delete(projectile.id);
  if (kind === 'smoke') {
    roomEvent(room, { kind: 'smoke', position, duration: 12000, radius: 6.5 });
    return;
  }
  const maxDamage = kind === 'magnetic' ? 112 : kind === 'frag' ? 105 : 72;
  const radius = kind === 'magnetic' ? 7 : kind === 'frag' ? 6.5 : 5;
  roomEvent(room, { kind: 'explosion', position, explosionKind: kind, radius });
  const owner = room.players.get(projectile.owner);
  const solids = owner?.mode === 'single' ? RANGE_SOLIDS : SOLIDS;
  for (const victim of room.players.values()) {
    if (victim.dead || victim.id === projectile.owner) continue;
    const center = playerHitbox(victim, 0.8, .65);
    const dist = distance(position, center);
    if (dist > radius || !hasLineOfSight({ x: position.x, y: position.y + 0.12, z: position.z }, center, solids)) continue;
    applyDamage(room, victim, maxDamage * (1 - dist / radius) + 8, owner, 'explosive');
  }
  if (owner) {
    for (const target of room.targets.values()) {
      if (target.respawnAt) continue;
      const targetPos = targetPosition(target, Date.now());
      const dist = distance(position, targetPos);
      if (dist < radius) hitTarget(room, target, maxDamage * (1 - dist / radius) + 8, owner, targetPos);
    }
  }
}

function tickProjectile(room, projectile, now, dt) {
  if (!projectile.stuck) {
    const previous = { ...projectile.position };
    projectile.velocity.y -= projectile.gravity * dt;
    projectile.position.x += projectile.velocity.x * dt;
    projectile.position.y += projectile.velocity.y * dt;
    projectile.position.z += projectile.velocity.z * dt;
    const travel = distance(previous, projectile.position);
    const direction = normalize({ x: projectile.position.x - previous.x, y: projectile.position.y - previous.y, z: projectile.position.z - previous.z });
    const impact = nearestSolidHit(previous, direction, travel, projectile.mode === 'single' ? RANGE_SOLIDS : SOLIDS);
    const outside = Math.abs(projectile.position.x) > 39 || Math.abs(projectile.position.z) > 39;
    if ((impact.solid && impact.distance <= travel) || outside) {
      if (!outside) projectile.position = { x: previous.x + direction.x * Math.max(0, impact.distance - .04), y: previous.y + direction.y * Math.max(0, impact.distance - .04), z: previous.z + direction.z * Math.max(0, impact.distance - .04) };
      else projectile.position = previous;
      projectile.position.y = Math.max(0.06, projectile.position.y);
      projectile.velocity = { x: 0, y: 0, z: 0 };
      projectile.stuck = true;
      projectile.detonateAt = now + (projectile.kind === 'magnetic' ? 1350 : projectile.kind === 'triple' ? 1800 : 150);
      if (['recon', 'shock'].includes(projectile.kind)) projectile.nextPulse = now + 250;
      roomEvent(room, { kind: 'projectileStuck', id: projectile.id, position: projectile.position });
    }
  }
  if (projectile.kind === 'recon' && projectile.stuck && now >= projectile.nextPulse) {
    projectile.nextPulse = now + 700;
    roomEvent(room, { kind: 'scan', position: projectile.position, radius: 24 });
    for (const victim of room.players.values()) {
      if (victim.id === projectile.owner || victim.dead) continue;
      const head = playerHitbox(victim, eyeHeight(victim.stance));
      if (distance(projectile.position, head) < 24 && hasLineOfSight(projectile.position, head)) {
        victim.markedUntil = now + 1800;
        victim.markedBy = projectile.owner;
      }
    }
  }
  if (projectile.kind === 'shock' && projectile.stuck && now >= projectile.nextPulse) {
    projectile.nextPulse = now + 600;
    roomEvent(room, { kind: 'shock', position: projectile.position, radius: 4 });
    const owner = room.players.get(projectile.owner);
    for (const victim of room.players.values()) {
      if (victim.id === projectile.owner || victim.dead) continue;
      const center = playerHitbox(victim, 0.8, .65);
      if (distance(projectile.position, center) < 4 && hasLineOfSight(projectile.position, center)) {
        victim.markedUntil = now + 1800;
        applyDamage(room, victim, 9, owner, 'shock');
      }
    }
  }
  const lifespan = projectile.stuck && projectile.kind === 'recon' ? 6500 : projectile.stuck && projectile.kind === 'shock' ? 4800 : projectile.ttl;
  const timedOut = projectile.stuck && ['magnetic', 'triple', 'smoke', 'frag'].includes(projectile.kind)
    ? now >= projectile.detonateAt : now - projectile.born >= lifespan;
  if (timedOut) {
    if (['magnetic', 'triple', 'smoke', 'frag'].includes(projectile.kind)) detonate(room, projectile);
    else room.projectiles.delete(projectile.id);
  }
}

function handleMessage(player, room, data) {
  const now = Date.now();
  switch (data.type) {
    case 'move': {
      if (player.dead || now - player.lastMove < 15) return;
      const p = data.position;
      if (!p || !['x', 'y', 'z'].every((axis) => Number.isFinite(p[axis]))) return;
      const elapsed = Math.max(0.02, (now - player.lastMove) / 1000);
      const horizontal = Math.hypot(p.x - player.position.x, p.z - player.position.z);
      if (horizontal > Math.max(2.5, elapsed * 22) || Math.abs(p.y - player.position.y) > 5) return;
      player.position = { x: clamp(p.x, -39, 39), y: clamp(p.y, 0, 8), z: clamp(p.z, -39, 39) };
      player.yaw = Number.isFinite(data.yaw) ? data.yaw : player.yaw;
      player.pitch = Number.isFinite(data.pitch) ? clamp(data.pitch, -1.55, 1.55) : player.pitch;
      player.stance = ['stand', 'crouch', 'prone', 'slide'].includes(data.stance) ? data.stance : 'stand';
      player.lean = ['stand', 'crouch'].includes(player.stance) && Number.isFinite(data.lean) ? clamp(data.lean, -1, 1) : 0;
      if (data.velocity && ['x', 'y', 'z'].every((axis) => Number.isFinite(data.velocity[axis]))) player.velocity = data.velocity;
      player.lastMove = now;
      break;
    }
    case 'switch':
      if (!player.dead && Object.hasOwn(WEAPONS, data.weapon)) {
        for (const state of Object.values(player.loadout)) {
          state.reloading = false;
          state.reloadEnd = 0;
        }
        player.weapon = data.weapon;
      }
      break;
    case 'reload': {
      const state = player.loadout[player.weapon];
      const weapon = WEAPONS[player.weapon];
      if (!player.dead && state.ammo < weapon.magazine && state.reserve > 0 && !state.reloading) {
        state.reloading = true;
        state.reloadEnd = now + weapon.reload;
        roomEvent(room, { kind: 'reload', player: player.id, weapon: weapon.id });
      }
      break;
    }
    case 'shot': handleShot(player, room, data); break;
    case 'ability': handleAbility(player, room, data); break;
    case 'resetStats':
      player.score = 0; player.shots = 0; player.hits = 0;
      break;
    case 'ping': send(player.ws, { type: 'pong', time: data.time, serverTime: now }); break;
    default: break;
  }
  player.lastSeen = now;
}

wss.on('connection', (ws) => {
  let player = null;
  let room = null;
  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch { return; }
    if (!player) {
      if (data.type !== 'join') return;
      const code = sanitizeRoom(data.room);
      if (!code) {
        send(ws, { type: 'error', message: '房间号需为 4–8 位字母或数字' });
        ws.close();
        return;
      }
      room = rooms.get(code) || { code, players: new Map(), projectiles: new Map(), targets: new Map(), delayed: [], lastTick: Date.now() };
      if (room.players.size >= MAX_PLAYERS) {
        send(ws, { type: 'error', message: '房间已满（最多 12 人）' });
        ws.close();
        return;
      }
      if (!rooms.has(code)) {
        for (const definition of TARGETS) room.targets.set(definition.id, { ...definition, hp: 100, respawnAt: 0 });
        rooms.set(code, room);
      }
      player = createPlayer(ws, data);
      player.position = spawnPoint(room, player.mode);
      room.players.set(player.id, player);
      send(ws, { type: 'welcome', id: player.id, room: code, serverTime: Date.now(), operator: player.operator });
      roomEvent(room, { kind: 'join', player: player.id, name: player.name });
      return;
    }
    handleMessage(player, room, data);
  });
  ws.on('close', () => {
    if (!player || !room) return;
    room.players.delete(player.id);
    for (const projectile of room.projectiles.values()) if (projectile.owner === player.id) room.projectiles.delete(projectile.id);
    roomEvent(room, { kind: 'leave', player: player.id, name: player.name });
    if (!room.players.size) rooms.delete(room.code);
  });
  ws.on('error', () => {});
});

const interval = setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    const dt = Math.min(0.12, (now - room.lastTick) / 1000);
    room.lastTick = now;
    for (let i = room.delayed.length - 1; i >= 0; i--) {
      if (now >= room.delayed[i].at) {
        const action = room.delayed.splice(i, 1)[0];
        action.launch();
      }
    }
    for (const player of room.players.values()) {
      if (player.dead && now >= player.respawnAt) resetPlayer(player, room);
      const state = player.loadout[player.weapon];
      if (state.reloading && now >= state.reloadEnd) {
        const weapon = WEAPONS[player.weapon];
        const amount = Math.min(weapon.magazine - state.ammo, state.reserve);
        state.ammo += amount;
        state.reserve -= amount;
        state.reloading = false;
        state.reloadEnd = 0;
      }
    }
    for (const projectile of [...room.projectiles.values()]) tickProjectile(room, projectile, now, dt);
    for (const target of room.targets.values()) {
      if (target.respawnAt && now >= target.respawnAt) {
        target.hp = 100;
        target.respawnAt = 0;
        roomEvent(room, { kind: 'targetReset', id: target.id });
      }
    }
    for (const player of room.players.values()) {
      send(player.ws, {
        type: 'snapshot', time: now,
        players: [...room.players.values()].map((entry) => publicPlayer(entry, now)),
        targets: [...room.targets.values()].map((target) => ({ id: target.id, hp: target.hp, down: Boolean(target.respawnAt), position: targetPosition(target, now) })),
        projectiles: [...room.projectiles.values()].map(publicProjectile),
        self: {
          hp: player.hp, dead: player.dead, respawnAt: player.respawnAt,
          weapon: player.weapon, loadout: player.loadout, cooldowns: player.cooldowns,
          exoUntil: player.exoUntil, kills: player.kills, deaths: player.deaths, score: player.score,
          shots: player.shots, hits: player.hits,
        },
      });
    }
  }
}, 1000 / TICK_RATE);

server.listen(port, '0.0.0.0', () => {
  console.log(`Delta Web running at http://localhost:${port}`);
});

function shutdown() {
  clearInterval(interval);
  for (const client of wss.clients) client.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { server, rooms };
