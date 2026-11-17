export const TICK_RATE = 20;
export const MAX_PLAYERS = 12;
export const WORLD_LIMIT = 39;

export const WEAPONS = Object.freeze({
  m7: {
    id: 'm7', name: 'M7', label: '突击步枪', caliber: '6.8×51mm',
    magazine: 30, reserve: 120, damage: 27, headMultiplier: 1.85,
    interval: 92, reload: 2250, range: 52, minDamage: 19,
    spread: 0.0035, adsSpread: 0.0008, recoil: 0.014, automatic: true,
  },
  awm: {
    id: 'awm', name: 'AWM', label: '狙击步枪', caliber: '.338 Lapua Magnum',
    magazine: 5, reserve: 25, damage: 96, headMultiplier: 2,
    interval: 1450, reload: 3400, range: 150, minDamage: 82,
    spread: 0.009, adsSpread: 0.00012, recoil: 0.055, automatic: false,
  },
});

export const OPERATORS = Object.freeze({
  vyron: {
    id: 'vyron', name: '威龙', realName: '王宇昊', role: '突击', code: 'VYRON',
    color: '#b9d76d', passive: '动能辅助系统',
    passiveText: '高处落地不受伤害，推进后短暂提升移动速度。',
    skills: {
      primary: { name: '动力推进', cooldown: 18000, description: '向移动方向高速推进，可在空中使用。' },
      tactical: { name: '磁吸炸弹', cooldown: 24000, description: '吸附于接触表面，短暂延迟后造成范围伤害。' },
      throwable: { name: '烟雾弹', cooldown: 26000, description: '形成持续 12 秒的烟雾屏障。' },
    },
  },
  luna: {
    id: 'luna', name: '露娜', realName: '金卢娜', role: '侦察', code: 'LUNA',
    color: '#70d5e8', passive: '敌情分析',
    passiveText: '受到伤害的敌人会被短暂标记，侦察箭可暴露掩体外目标。',
    skills: {
      primary: { name: '侦察箭矢', cooldown: 32000, description: '箭矢持续扫描附近未被掩体遮挡的敌人。' },
      tactical: { name: '电击箭矢', cooldown: 22000, description: '形成持续电场，伤害并标记范围内敌人。' },
      throwable: { name: '增强型破片手雷', cooldown: 26000, description: '高爆手雷，对近处目标造成大量伤害。' },
    },
  },
  redwolf: {
    id: 'redwolf', name: '红狼', realName: '凯·席尔瓦', role: '突击', code: 'D-WOLF',
    color: '#ef745e', passive: '战术滑铲',
    passiveText: '冲刺中蹲伏触发滑铲；外骨骼期间击倒回复生命并延长时间。',
    skills: {
      primary: { name: '动力外骨骼', cooldown: 42000, description: '20 秒内提高移速，击倒回复 35 点生命。' },
      tactical: { name: '三联装手炮', cooldown: 26000, description: '连续发射三枚小型高爆榴弹。' },
      throwable: { name: '突破型烟雾弹', cooldown: 26000, description: '快速部署持续 12 秒的烟雾屏障。' },
    },
  },
});

export const SPAWNS = [
  { x: 0, y: 0, z: 26 }, { x: -15, y: 0, z: 28 },
  { x: 15, y: 0, z: 28 }, { x: -30, y: 0, z: 15 },
  { x: 30, y: 0, z: 15 }, { x: 0, y: 0, z: -31 },
  { x: -30, y: 0, z: -30 }, { x: 30, y: 0, z: -30 },
];

export const PORT_SPAWNS = [
  { x: -32, y: 0, z: 6 }, { x: -27, y: 0, z: 19 },
  { x: -18, y: 0, z: 23 }, { x: 18, y: 0, z: 24 },
  { x: 22, y: 0, z: -27 }, { x: -20, y: 0, z: -25 },
  { x: 27, y: 0, z: 10 }, { x: -34, y: 0, z: 25 },
  { x: 8, y: 0, z: -28 },
];

export const TARGETS = [
  { id: 't0', x: -12, y: 1.45, z: 12, radius: 0.5, move: 0 },
  { id: 't1', x: -6, y: 1.45, z: 12, radius: 0.5, move: 0 },
  { id: 't2', x: 0, y: 1.45, z: 12, radius: 0.5, move: 0 },
  { id: 't3', x: 6, y: 1.45, z: 12, radius: 0.5, move: 0 },
  { id: 't4', x: 12, y: 1.45, z: 12, radius: 0.5, move: 0 },
  { id: 't5', x: -8, y: 1.6, z: 2, radius: 0.48, move: 3.2, speed: 0.7 },
  { id: 't6', x: 8, y: 1.6, z: 2, radius: 0.48, move: 3.2, speed: 0.9 },
  { id: 't7', x: 0, y: 2.1, z: -5, radius: 0.42, move: 6, speed: 0.55 },
];

export const SOLIDS = [
  { id: 'left-building', min: [-36, 0, -22], max: [-25, 6.5, -5] },
  { id: 'right-building', min: [24, 0, -25], max: [36, 5, -13] },
  { id: 'container-a', min: [-10, 0, -17], max: [-3, 2.8, -13] },
  { id: 'container-b', min: [5, 0, -8], max: [12, 2.8, -4] },
  { id: 'container-c', min: [-2.5, 0, -30], max: [4.5, 2.8, -26] },
  { id: 'crate-a', min: [-19, 0, -15], max: [-16.5, 2.1, -12.5] },
  { id: 'crate-b', min: [15, 0, -20], max: [18, 2.4, -17] },
  { id: 'crate-c', min: [14, 0, 1], max: [17, 1.7, 4] },
  { id: 'wall-a', min: [-19, 0, -1], max: [-10, 1.35, 0.2] },
  { id: 'wall-b', min: [10, 0, -32], max: [20, 1.35, -30.8] },
  { id: 'wall-c', min: [-5, 0, 20], max: [-3.8, 1.1, 25] },
  { id: 'wall-d', min: [3.8, 0, 20], max: [5, 1.1, 25] },
  { id: 'range-backstop', min: [-19, 0, 9.4], max: [19, 4.5, 10] },
  ...[[-21, 20], [21, 20], [-21, -30], [21, -30]].map(([x, z], index) => ({ id: `barrier-${index}`, min: [x - 1.4, 0, z - .36], max: [x + 1.4, .9, z + .36] })),
];

export const RANGE_SOLIDS = [
  { id: 'indoor-backstop', min: [-20, 0, -32.35], max: [20, 4.8, -31.65] },
  { id: 'indoor-left-wall', min: [-20.18, 0, -39.5], max: [-19.82, 4.8, 39.5] },
  { id: 'indoor-right-wall', min: [19.82, 0, -39.5], max: [20.18, 4.8, 39.5] },
];

export function targetPosition(target, timeMs) {
  return {
    x: target.x + (target.move ? Math.sin(timeMs * 0.001 * target.speed + Number(target.id.slice(1))) * target.move : 0),
    y: target.y,
    z: target.z,
  };
}

export function makeLoadout() {
  return Object.fromEntries(Object.values(WEAPONS).map((weapon) => [weapon.id, {
    ammo: weapon.magazine,
    reserve: 999999,
    reloading: false,
    reloadEnd: 0,
  }]));
}

export function sanitizeRoom(value) {
  const room = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return room.length >= 4 ? room : '';
}

export function sanitizeName(value) {
  return String(value || '无名干员').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 14) || '无名干员';
}
