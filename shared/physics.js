import { SOLIDS, WORLD_LIMIT } from './config.js';

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const length3 = (v) => Math.hypot(v.x, v.y, v.z);
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const normalize = (v) => {
  const length = length3(v) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
};

export function raySphere(origin, direction, center, radius) {
  const oc = { x: origin.x - center.x, y: origin.y - center.y, z: origin.z - center.z };
  const b = oc.x * direction.x + oc.y * direction.y + oc.z * direction.z;
  const c = oc.x * oc.x + oc.y * oc.y + oc.z * oc.z - radius * radius;
  const h = b * b - c;
  if (h < 0) return Infinity;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : Infinity;
}

export function rayAABB(origin, direction, box) {
  let near = 0;
  let far = Infinity;
  for (const axis of ['x', 'y', 'z']) {
    const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const min = box.min[index];
    const max = box.max[index];
    if (Math.abs(direction[axis]) < 1e-8) {
      if (origin[axis] < min || origin[axis] > max) return Infinity;
      continue;
    }
    let a = (min - origin[axis]) / direction[axis];
    let b = (max - origin[axis]) / direction[axis];
    if (a > b) [a, b] = [b, a];
    near = Math.max(near, a);
    far = Math.min(far, b);
    if (near > far) return Infinity;
  }
  return near >= 0 ? near : far >= 0 ? far : Infinity;
}

export function nearestSolidHit(origin, direction, maxDistance = 200, solids = SOLIDS) {
  let closest = maxDistance;
  let solid = null;
  for (const box of solids) {
    const hit = rayAABB(origin, direction, box);
    if (hit < closest) {
      closest = hit;
      solid = box;
    }
  }
  if (direction.y < -1e-8) {
    const ground = -origin.y / direction.y;
    if (ground >= 0 && ground < closest) {
      closest = ground;
      solid = { id: 'ground' };
    }
  }
  return { distance: closest, solid };
}

export function hasLineOfSight(a, b, solids = SOLIDS) {
  const delta = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const dist = length3(delta);
  const direction = normalize(delta);
  return nearestSolidHit(a, direction, dist, solids).distance >= dist - 0.05;
}

export function eyeHeight(stance) {
  return stance === 'prone' ? 0.58 : stance === 'crouch' || stance === 'slide' ? 1.08 : 1.64;
}

function resolveMovementStep(position, delta, stance, radius) {
  const height = eyeHeight(stance);
  const next = { x: position.x, y: Math.max(0, position.y), z: position.z };
  const moveAxis = (axis, amount) => {
    next[axis] += amount;
    next.x = clamp(next.x, -WORLD_LIMIT, WORLD_LIMIT);
    next.z = clamp(next.z, -WORLD_LIMIT, WORLD_LIMIT);
    for (const box of SOLIDS) {
      if (next.y > box.max[1] || next.y + height < box.min[1]) continue;
      const other = axis === 'x' ? 'z' : 'x';
      const otherIndex = other === 'x' ? 0 : 2;
      const axisIndex = axis === 'x' ? 0 : 2;
      if (next[other] + radius <= box.min[otherIndex] || next[other] - radius >= box.max[otherIndex]) continue;
      if (next[axis] + radius > box.min[axisIndex] && next[axis] - radius < box.max[axisIndex]) {
        next[axis] = amount > 0 ? box.min[axisIndex] - radius : box.max[axisIndex] + radius;
      }
    }
  };
  moveAxis('x', delta.x);
  moveAxis('z', delta.z);
  return next;
}

export function resolveMovement(position, delta, stance = 'stand', radius = .45) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(delta.x), Math.abs(delta.z)) / .16));
  let current = { x: position.x, y: position.y, z: position.z };
  for (let i = 0; i < steps; i++) current = resolveMovementStep(current, { x: delta.x / steps, z: delta.z / steps }, stance, radius);
  return current;
}

export function validDirection(direction) {
  return direction && ['x', 'y', 'z'].every((axis) => Number.isFinite(direction[axis]))
    && Math.abs(length3(direction) - 1) < 0.08;
}
