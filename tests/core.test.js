import test from 'node:test';
import assert from 'node:assert/strict';
import { OPERATORS, TARGETS, WEAPONS, makeLoadout, sanitizeName, sanitizeRoom, targetPosition } from '../shared/config.js';
import { eyeHeight, hasLineOfSight, nearestSolidHit, normalize, rayAABB, raySphere, resolveMovement, validDirection } from '../shared/physics.js';

test('三名干员与双武器配置完整且数值合法', () => {
  assert.deepEqual(Object.keys(OPERATORS).sort(), ['luna', 'redwolf', 'vyron']);
  assert.deepEqual(Object.keys(WEAPONS).sort(), ['awm', 'm7']);
  for (const operator of Object.values(OPERATORS)) {
    assert.equal(Object.keys(operator.skills).length, 3);
    for (const skill of Object.values(operator.skills)) assert.ok(skill.cooldown >= 1000);
  }
  assert.equal(makeLoadout().m7.ammo, 30);
  assert.equal(makeLoadout().awm.ammo, 5);
  assert.ok(WEAPONS.awm.damage > WEAPONS.m7.damage);
});

test('房间号和呼号过滤安全', () => {
  assert.equal(sanitizeRoom('ab-12xyz99'), 'AB12XYZ9');
  assert.equal(sanitizeRoom('12'), '');
  assert.equal(sanitizeName('<img> 测试\u0000'), 'img 测试');
});

test('射线与球体、掩体求交正确', () => {
  const origin = { x: 0, y: 1, z: 5 };
  const direction = { x: 0, y: 0, z: -1 };
  assert.equal(raySphere(origin, direction, { x: 0, y: 1, z: 0 }, .5), 4.5);
  assert.equal(raySphere(origin, direction, { x: 2, y: 1, z: 0 }, .5), Infinity);
  assert.equal(rayAABB(origin, direction, { min: [-1, 0, -1], max: [1, 2, 1] }), 4);
});

test('遮挡判定能阻断隔墙命中', () => {
  const origin = { x: -30.5, y: 1.6, z: -3 };
  const direction = { x: 0, y: 0, z: -1 };
  const hit = nearestSolidHit(origin, direction, 100);
  assert.equal(hit.solid.id, 'left-building');
  assert.equal(hasLineOfSight(origin, { x: -30.5, y: 1.6, z: -10 }), false);
  assert.equal(hasLineOfSight(origin, { x: 0, y: 1.6, z: -3 }), true);
});

test('移动碰撞不会穿墙且不会越过地图边界', () => {
  const start = { x: -30.5, y: 0, z: -3 };
  const stopped = resolveMovement(start, { x: 0, z: -8 }, 'stand');
  assert.ok(stopped.z >= -4.65);
  const bounded = resolveMovement({ x: 38.8, y: 0, z: 0 }, { x: 5, z: 0 }, 'stand');
  assert.equal(bounded.x, 39);
  const dash = resolveMovement({ x: 0, y: 0, z: 12 }, { x: 0, z: -5 }, 'stand');
  assert.ok(dash.z >= 10.44, '高速冲刺也不能穿过挡弹墙');
  const table = resolveMovement({ x: 3, y: 0, z: 30 }, { x: 0, z: -8 }, 'stand');
  assert.ok(Math.abs(table.z - 22) < 1e-8, '桌面上方不再保留隐形碰撞');
});

test('姿态高度、移动靶和方向校验稳定', () => {
  assert.equal(eyeHeight('stand'), 1.64);
  assert.ok(eyeHeight('prone') < eyeHeight('crouch'));
  const target = TARGETS.find((entry) => entry.move);
  assert.notEqual(targetPosition(target, 0).x, targetPosition(target, 2000).x);
  const direction = normalize({ x: 3, y: 4, z: 0 });
  assert.equal(validDirection(direction), true);
  assert.equal(validDirection({ x: 2, y: 0, z: 0 }), false);
});

test('重构靶场移除旧挡弹墙并保留新后方挡弹墙', async () => {
  const { RANGE_SOLIDS } = await import('../shared/config.js');
  const origin = { x: 0, y: 1.6, z: 26 };
  const direction = { x: 0, y: 0, z: -1 };
  const hit = nearestSolidHit(origin, direction, 100, RANGE_SOLIDS);
  assert.equal(hit.solid.id, 'indoor-backstop');
  assert.ok(hit.distance > 55);
});
