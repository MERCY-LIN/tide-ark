/* ============================================================
   潮汐方舟  Tide Ark  v0.2
   data.js —— 纯数值与内容表（无 DOM 依赖）
   ============================================================ */
(function (root) {
  'use strict';

  /* ---------- 舞台几何 ---------- */
  var CELL = 58;
  var COLS = 6;
  var ROWS = 3;
  var VIEW_W = 1120;
  var VIEW_H = 560;
  var RAFT_W = COLS * CELL;                 // 348
  var RAFT_X = (VIEW_W - RAFT_W) / 2;       // 386
  var RAFT_Y = 268;
  var RAFT_H = ROWS * CELL;                 // 174
  var WATER_LOW = RAFT_Y + 2 * CELL;        // 384 低潮水位
  var WATER_HIGH = 300;                     // 满潮水位
  var FLOOD_Y = RAFT_Y + CELL;              // 326 越过这里主甲板进水

  var ROW_LANE = ['air', 'surface', 'under'];
  var ROW_NAME = ['高空甲板', '主甲板', '水下舱'];

  /* ---------- 甲板：一开始只有中间两列 ---------- */
  var START_COLS = [2, 3];
  /* 只能买"挨着已解锁列"的列；外挂列最贵，但它决定你能打多远 */
  var EXPAND = [
    { col: 1, cost: 30, hp: 20 },
    { col: 4, cost: 30, hp: 20 },
    { col: 0, cost: 50, hp: 30 },
    { col: 5, cost: 50, hp: 30 }
  ];

  /* ---------- 模块 ---------- */
  var MODULES = {
    flak: {
      name: '高射炮', row: 0, kind: 'weapon', lane: 'air', cost: 16,
      dmg: 15, cd: 0.8, range: 6, color: '#7fc8e8', icon: 'flak',
      desc: '对空 · 射程 6 列 · 15 伤害'
    },
    salvage: {
      name: '打捞臂', row: 0, kind: 'utility', effect: 'salvage', cost: 15,
      color: '#d4a373', icon: 'salvage',
      desc: '每波结束额外 +8 木材'
    },
    ballista: {
      name: '弩炮', row: 1, kind: 'weapon', lane: 'surface', cost: 12,
      dmg: 16, cd: 1.05, range: 6, color: '#e0a458', icon: 'bolt',
      desc: '对海 · 射程 6 列 · 16 伤害'
    },
    flamer: {
      name: '喷火器', row: 1, kind: 'weapon', lane: 'surface', cost: 18,
      dmg: 8, cd: 0.3, range: 2.5, radius: 70, color: '#e2703a', icon: 'flame',
      desc: '对海 · 近距范围灼烧 · 8 伤害'
    },
    tesla: {
      name: '电击塔', row: 1, kind: 'weapon', lane: 'any', cost: 26,
      dmg: 12, cd: 1.2, range: 4, chain: 3, color: '#f2e06b', icon: 'tesla',
      desc: '全泳道 · 连锁 3 目标 · 12 伤害'
    },
    gen: {
      name: '发电机', row: -1, kind: 'utility', effect: 'power', cost: 12,
      color: '#8fd14f', icon: 'gen',
      desc: '可放任意层 · 本层武器射速 +20%'
    },
    mag: {
      name: '弹药库', row: 1, kind: 'utility', effect: 'mag', cost: 20,
      color: '#c9a227', icon: 'mag',
      desc: '相邻武器伤害 +25%（最多 +50%）'
    },
    harpoon: {
      name: '鱼叉炮', row: 2, kind: 'weapon', lane: 'under', cost: 16,
      dmg: 30, cd: 1.8, range: 6, color: '#9b8ae0', icon: 'harpoon',
      desc: '对潜 · 射程 6 列 · 30 伤害'
    },
    depth: {
      name: '深水炸弹', row: 2, kind: 'weapon', lane: 'under', cost: 22,
      dmg: 18, cd: 2.0, range: 4, radius: 90, color: '#6fb7a8', icon: 'depth',
      desc: '对潜 · 范围伤害 · 18 伤害'
    },
    armor: {
      name: '装甲板', row: 2, kind: 'utility', effect: 'armor', cost: 18,
      color: '#9aa5b1', icon: 'armor',
      desc: '木筏耐久上限 +40'
    },
    pump: {
      name: '抽水泵', row: 2, kind: 'utility', effect: 'pump', cost: 20,
      color: '#5bb3d1', icon: 'pump',
      desc: '潮水上涌速度 -10%（最多 -30%）'
    }
  };

  var ORDER = ['ballista', 'flamer', 'tesla', 'gen', 'mag', 'flak', 'salvage', 'harpoon', 'depth', 'armor', 'pump'];

  /* ---------- 全局改造（打捞三选一里的被动） ---------- */
  var UPGRADES = {
    barrel: { name: '加长炮管', desc: '所有武器射程 +1 列', max: 3 },
    ap: { name: '穿甲弹头', desc: '所有武器伤害 +12%', max: 5 },
    loader: { name: '快速装填', desc: '所有武器射速 +12%', max: 4 },
    hull: { name: '船体加固', desc: '木筏耐久上限 +40', max: 4 },
    salvager: { name: '打捞专家', desc: '每波结束额外 +10 木材', max: 3 },
    aa: { name: '防空火控', desc: '对空伤害 +35%', max: 3 },
    asw: { name: '深水猎手', desc: '对潜伤害 +35%', max: 3 },
    tide: { name: '潮汐预感', desc: '潮水上涌速度 -12%', max: 3 },
    patch: { name: '维修班', desc: '每波开始修复 +10 耐久', max: 3 }
  };
  var UPGRADE_ORDER = ['barrel', 'ap', 'loader', 'hull', 'salvager', 'aa', 'asw', 'tide', 'patch'];

  /* ---------- 敌人 ---------- */
  var ENEMIES = {
    drifter: { name: '漂流者', lane: 'surface', hp: 34, spd: 64, dmg: 5, r: 16, color: '#79b86a', pts: 1 },
    bat: { name: '潮蝠', lane: 'air', hp: 26, spd: 96, dmg: 4, r: 14, color: '#9b7fd4', pts: 0.9 },
    diver: { name: '深潜者', lane: 'under', hp: 62, spd: 58, dmg: 7, r: 17, color: '#4fb3c9', pts: 1.9 },
    shellback: { name: '甲壳兽', lane: 'surface', hp: 100, spd: 38, dmg: 9, r: 23, color: '#a5744a', pts: 2.8 },
    raider: { name: '掠夺艇', lane: 'surface', hp: 140, spd: 50, dmg: 11, r: 24, color: '#c2564a', pts: 3.4 },
    boss: { name: '潮汐巨兽', lane: 'surface', hp: 600, spd: 18, dmg: 14, r: 50, color: '#e0577f', boss: true, pts: 99 }
  };

  /* ---------- 潮汐词条：每波一个，逼你换打法 ---------- */
  var MODS = [
    { id: 'current', name: '逆流', desc: '敌方移动速度 +35%', spd: 1.35 },
    { id: 'fog', name: '浓雾', desc: '所有武器射程 -20%', range: 0.8 },
    { id: 'iron', name: '铁潮', desc: '敌方生命 +30%', hp: 1.3 },
    { id: 'swarm', name: '蜂群', desc: '敌方数量 +3，生命 -25%', hp: 0.75, add: 3 },
    { id: 'blood', name: '血月', desc: '敌方啃咬伤害 +50%', dmg: 1.5 },
    { id: 'deep', name: '暗流', desc: '额外 2 只深潜者', extra: ['diver', 'diver'] }
  ];

  var MAX_WAVE = 8;

  /* ---------- 确定性随机 ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function poolFor(wave) {
    var p = ['drifter'];
    if (wave >= 3) p.push('bat');
    if (wave >= 5) p.push('diver');
    if (wave >= 6) p.push('shellback');
    if (wave >= 7) p.push('raider');
    return p;
  }

  /* ---------- 生成一波 ----------
     用 run 的 rng：同一局内可复现，不同局完全不同 */
  function makePlan(wave, rng) {
    var isBoss = wave >= MAX_WAVE;
    var list = [];
    var pool = poolFor(wave);
    var budget;
    var mod = null;

    if (isBoss) {
      list.push({ kind: 'boss', side: rng() < 0.5 ? 'L' : 'R' });
      budget = 7;
    } else {
      budget = 4.4 * Math.pow(1.235, wave - 1);
    }

    var guard = 0;
    while (budget >= 0.8 && guard++ < 80) {
      var affordable = pool.filter(function (k) { return ENEMIES[k].pts <= budget; });
      if (!affordable.length) break;
      var k = affordable[Math.floor(rng() * affordable.length)];
      list.push({ kind: k, side: rng() < 0.5 ? 'L' : 'R' });
      budget -= ENEMIES[k].pts;
    }

    /* 词条：第 3 波起可能出现，Boss 波不带 */
    if (!isBoss && wave >= 4 && rng() < 0.6) {
      mod = MODS[Math.floor(rng() * MODS.length)];
      if (mod.add) {
        for (var i = 0; i < mod.add; i++) {
          list.push({ kind: pool[Math.floor(rng() * pool.length)], side: rng() < 0.5 ? 'L' : 'R' });
        }
      }
      if (mod.extra) {
        mod.extra.forEach(function (k) {
          list.push({ kind: k, side: rng() < 0.5 ? 'L' : 'R' });
        });
      }
    }

    /* 不要把所有东西都堆在一边 */
    var lefts = list.filter(function (e) { return e.side === 'L'; }).length;
    if (lefts === 0 && list.length > 1) list[0].side = 'L';
    if (lefts === list.length && list.length > 1) list[list.length - 1].side = 'R';

    /* 打散后按时间铺开 */
    for (var j = list.length - 1; j > 0; j--) {
      var q = Math.floor(rng() * (j + 1));
      var t = list[j]; list[j] = list[q]; list[q] = t;
    }
    list.sort(function (a, b) { return (b.kind === 'boss' ? 1 : 0) - (a.kind === 'boss' ? 1 : 0); });

    var dur = isBoss ? 38 : Math.min(34, 20 + list.length * 1.15);
    var n = list.length;
    var t0 = 1.4, t1 = dur * 0.46;
    list.forEach(function (e, i) {
      e.t = n <= 1 ? t0 : t0 + (t1 - t0) * (i / (n - 1));
    });

    var sides = {};
    list.forEach(function (e) { sides[e.side] = true; });

    return {
      wave: wave,
      dur: dur,
      spawns: list,
      sides: Object.keys(sides).sort(),
      mod: mod,
      hpMul: (isBoss ? 1.25 : 1 + (wave - 1) * 0.06) * (mod && mod.hp ? mod.hp : 1),
      spdMul: mod && mod.spd ? mod.spd : 1,
      dmgMul: mod && mod.dmg ? mod.dmg : 1,
      rangeMul: mod && mod.range ? mod.range : 1
    };
  }

  function previewOf(plan) {
    var count = {};
    plan.spawns.forEach(function (s) {
      count[s.kind] = (count[s.kind] || 0) + 1;
    });
    var parts = [];
    Object.keys(count).forEach(function (k) {
      parts.push(ENEMIES[k].name + '×' + count[k]);
    });
    return {
      sides: plan.sides.map(function (s) { return s === 'L' ? '左舷' : '右舷'; }).join(' + '),
      text: parts.join(' · '),
      mod: plan.mod
    };
  }

  root.Data = {
    CELL: CELL, COLS: COLS, ROWS: ROWS,
    VIEW_W: VIEW_W, VIEW_H: VIEW_H,
    RAFT_X: RAFT_X, RAFT_Y: RAFT_Y, RAFT_W: RAFT_W, RAFT_H: RAFT_H,
    WATER_LOW: WATER_LOW, WATER_HIGH: WATER_HIGH, FLOOD_Y: FLOOD_Y,
    ROW_LANE: ROW_LANE, ROW_NAME: ROW_NAME,
    START_COLS: START_COLS, EXPAND: EXPAND,
    MODULES: MODULES, ORDER: ORDER,
    UPGRADES: UPGRADES, UPGRADE_ORDER: UPGRADE_ORDER,
    ENEMIES: ENEMIES, MODS: MODS, MAX_WAVE: MAX_WAVE,
    makePlan: makePlan, previewOf: previewOf, mulberry32: mulberry32
  };
})(typeof window !== 'undefined' ? window : globalThis);
