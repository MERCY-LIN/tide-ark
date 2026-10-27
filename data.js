/* ============================================================
   潮汐方舟  Tide Ark
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
  var FLOOD_Y = RAFT_Y + CELL;              // 326 超过这里主甲板进水

  var ROW_LANE = ['air', 'surface', 'under'];
  var ROW_NAME = ['高空甲板', '主甲板', '水下舱'];

  /* ---------- 模块 ----------
     row   只能放在这一行（行 = 能打到哪条泳道）
     kind  weapon 武器 / utility 功能
     lane  weapon 的目标泳道，any = 全泳道
     range 以"列"为单位的半径（1 列 = 58px）
     radius 范围伤害半径(px)   chain 连锁目标数
     effect 功能模块效果：power 整层供电 / mag 相邻增伤 / pump 潮速 / armor 耐久 / salvage 打捞 */
  var MODULES = {
    /* ---- row 0 高空甲板 ---- */
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

    /* ---- row 1 主甲板 ---- */
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
      name: '发电机', row: -1, kind: 'utility', effect: 'power', cost: 14,
      color: '#8fd14f', icon: 'gen',
      desc: '可放任意层 · 为本层全部武器供电（缺电射速 -28%）'
    },
    mag: {
      name: '弹药库', row: 1, kind: 'utility', effect: 'mag', cost: 20,
      color: '#c9a227', icon: 'mag',
      desc: '相邻武器伤害 +25%（最多 +50%）'
    },

    /* ---- row 2 水下舱 ---- */
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

  /* ---------- 敌人 ---------- */
  var ENEMIES = {
    drifter: { name: '漂流者', lane: 'surface', hp: 34, spd: 64, dmg: 5, r: 16, color: '#79b86a' },
    shellback: { name: '甲壳兽', lane: 'surface', hp: 100, spd: 38, dmg: 9, r: 23, color: '#a5744a' },
    bat: { name: '潮蝠', lane: 'air', hp: 26, spd: 96, dmg: 4, r: 14, color: '#9b7fd4' },
    diver: { name: '深潜者', lane: 'under', hp: 62, spd: 58, dmg: 7, r: 17, color: '#4fb3c9' },
    raider: { name: '掠夺艇', lane: 'surface', hp: 140, spd: 50, dmg: 11, r: 24, color: '#c2564a' },
    boss: { name: '潮汐巨兽', lane: 'surface', hp: 520, spd: 18, dmg: 16, r: 50, color: '#e0577f', boss: true }
  };

  /* ---------- 波次表 ---------- */
  var WAVE_TABLE = [
    { dur: 26, comp: [['drifter', 5, 'L']] },
    { dur: 28, comp: [['drifter', 5, 'L'], ['drifter', 3, 'R']] },
    { dur: 30, comp: [['drifter', 5, 'L'], ['bat', 3, 'R']] },
    { dur: 30, comp: [['shellback', 2, 'L'], ['drifter', 4, 'R'], ['bat', 3, 'R']] },
    { dur: 32, comp: [['diver', 3, 'L'], ['drifter', 4, 'R'], ['bat', 2, 'L']] },
    { dur: 32, comp: [['shellback', 3, 'R'], ['diver', 3, 'R'], ['bat', 3, 'L'], ['drifter', 4, 'L']] },
    { dur: 34, comp: [['raider', 1, 'L'], ['shellback', 3, 'R'], ['diver', 3, 'L'], ['bat', 4, 'R']] },
    { dur: 38, comp: [['boss', 1, 'R'], ['diver', 2, 'L'], ['bat', 2, 'L'], ['drifter', 2, 'R']] }
  ];

  var MAX_WAVE = WAVE_TABLE.length;

  /* ---------- 确定性随机 ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 生成一波 ---------- */
  function wavePlan(wave, extraDivers) {
    var w = WAVE_TABLE[Math.min(wave, MAX_WAVE) - 1];
    var list = [];
    w.comp.forEach(function (c) {
      for (var i = 0; i < c[1]; i++) list.push({ kind: c[0], side: c[2] });
    });
    for (var i = 0; i < (extraDivers || 0); i++) {
      list.push({ kind: 'diver', side: i % 2 ? 'R' : 'L' });
    }

    /* 打散顺序（固定种子，可复现），Boss 提到最前 */
    var rnd = mulberry32(1000 + wave * 77);
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = list[i]; list[i] = list[j]; list[j] = t;
    }
    list.sort(function (a, b) { return (b.kind === 'boss' ? 1 : 0) - (a.kind === 'boss' ? 1 : 0); });

    var n = list.length;
    var t0 = 1.4, t1 = w.dur * 0.46;
    list.forEach(function (e, i) {
      e.t = n <= 1 ? t0 : t0 + (t1 - t0) * (i / (n - 1));
    });

    var sides = {};
    list.forEach(function (e) { sides[e.side] = true; });

    return {
      dur: w.dur,
      spawns: list,
      sides: Object.keys(sides).sort(),
      hpMul: 1 + (wave - 1) * 0.16
    };
  }

  /* ---------- 波次预告 ---------- */
  function wavePreview(wave, extraDivers) {
    var p = wavePlan(wave, extraDivers || 0);
    var count = {};
    p.spawns.forEach(function (s) {
      count[s.kind] = (count[s.kind] || 0) + 1;
    });
    var parts = [];
    Object.keys(count).forEach(function (k) {
      parts.push(ENEMIES[k].name + '×' + count[k]);
    });
    return {
      sides: p.sides.map(function (s) { return s === 'L' ? '左舷' : '右舷'; }).join(' + '),
      text: parts.join(' · ')
    };
  }

  root.Data = {
    CELL: CELL, COLS: COLS, ROWS: ROWS,
    VIEW_W: VIEW_W, VIEW_H: VIEW_H,
    RAFT_X: RAFT_X, RAFT_Y: RAFT_Y, RAFT_W: RAFT_W, RAFT_H: RAFT_H,
    WATER_LOW: WATER_LOW, WATER_HIGH: WATER_HIGH, FLOOD_Y: FLOOD_Y,
    ROW_LANE: ROW_LANE, ROW_NAME: ROW_NAME,
    MODULES: MODULES, ORDER: ORDER,
    ENEMIES: ENEMIES, WAVE_TABLE: WAVE_TABLE, MAX_WAVE: MAX_WAVE,
    wavePlan: wavePlan, wavePreview: wavePreview, mulberry32: mulberry32
  };
})(typeof window !== 'undefined' ? window : globalThis);
