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

  /* ---------- 羁绊：模块带标签，凑够数量触发质变 ---------- */
  var TAG_OF = {
    ballista: 'gun', flak: 'gun', harpoon: 'gun',
    flamer: 'fire', depth: 'fire', tesla: 'fire',
    gen: 'mech', mag: 'mech', armor: 'mech', pump: 'mech', salvage: 'mech'
  };

  var TAGS = {
    gun: {
      name: '炮击', color: '#e0a458', t2: 2, t4: 4,
      d2: '所有武器伤害 +8%',
      d4: '伤害提升到 +20%，所有武器射程 +1 列'
    },
    fire: {
      name: '燃烧', color: '#e2703a', t2: 2, t4: 4,
      d2: '范围伤害半径 +30%',
      d4: '击杀时对周围 90px 造成 18 伤害'
    },
    mech: {
      name: '机械', color: '#8fd14f', t2: 2, t4: 4,
      d2: '发电机加成 20% → 40%',
      d4: '另外：每波结束 +20 木材，加固费用 -25%'
    }
  };
  var TAG_ORDER = ['gun', 'fire', 'mech'];

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

  /* ---------- 起始船：每局开局三选一 ---------- */
  var SHIPS = {
    barge: {
      name: '驳船', cols: [1, 2, 3, 4], wood: 38, hp: 200,
      perk: 'none', color: '#9aa5b1',
      desc: '甲板宽、血厚，但穷。稳扎稳打'
    },
    gunboat: {
      name: '炮艇', cols: [2, 3], wood: 56, hp: 140,
      perk: 'dmg', color: '#e0a458',
      desc: '甲板窄、血薄，但所有武器伤害 +25%'
    },
    carrier: {
      name: '母舰', cols: [2, 3, 4], wood: 44, hp: 170,
      perk: 'stock', color: '#7fc8e8',
      desc: '开局白送 2 个随机模块（放进库存）'
    }
  };
  var SHIP_ORDER = ['barge', 'gunboat', 'carrier'];

  /* ---------- 遗物：整局生效的规则改变 ---------- */
  var RELICS = {
    searchlight: { name: '探照灯', desc: '所有武器射程 +1 列' },
    ram: { name: '铁甲船首', desc: '耐久上限 +60' },
    autoloader: { name: '自动装填', desc: '所有武器射速 +15%' },
    ap: { name: '穿甲弹', desc: '所有武器伤害 +15%' },
    net: { name: '打捞网', desc: '每波结束 +15 木材' },
    depthrack: { name: '深水弹架', desc: '对潜伤害 +40%' },
    radar: { name: '雷达', desc: '对空伤害 +40%' },
    bilge: { name: '排水泵', desc: '潮水上涌速度 -15%' },
    spares: { name: '备用零件', desc: '每波开始修复 +15' },
    twin: { name: '双联装', desc: '弹药库加成 +25%' },
    tidechild: { name: '潮汐之子', desc: '满潮时敌人不再狂暴（仍会进水）' },
    blueprint: { name: '扩建图纸', desc: '加固甲板费用 -40%' },
    furnace: { name: '熔炉', desc: '武器伤害 -15%，但击杀时爆炸 25' },
    doubleedge: { name: '双刃', desc: '伤害 +30%，耐久上限 -35%' },
    tideclock: { name: '潮汐钟', desc: '潮水上涨速度 -30%' },
    echo: { name: '回响', desc: '每波开始随机获得 1 个模块' }
  };
  var RELIC_ORDER = ['searchlight', 'ram', 'autoloader', 'ap', 'net', 'depthrack', 'radar', 'bilge', 'spares', 'twin', 'tidechild', 'blueprint', 'furnace', 'doubleedge', 'tideclock', 'echo'];

  /* ---------- 事件：路线里的一次故事 ----------
     eff 支持：wood / hp / relic / module / upgrade / modHp（下一波难度） */
  var EVENTS = [
    {
      id: 'hulk', name: '漏水的货轮', icon: 'ship',
      text: '一艘半沉的货轮横在航线上。舱门后面还有动静，货舱里也有东西。',
      choices: [
        { label: '拆了它', desc: '+45 木材', eff: { wood: 45 } },
        { label: '救人', desc: '-15 耐久，获得 1 件遗物', eff: { hp: -15, relic: 1 } }
      ]
    },
    {
      id: 'ghost', name: '幽灵船', icon: 'ship',
      text: '一条没有灯火的船在雾里漂着，甲板上的东西看上去还能用。',
      choices: [
        { label: '登船', desc: '55% 拿到遗物 / 45% 掉 25 耐久', eff: { gamble: 0.55, win: { relic: 1 }, lose: { hp: -25 } } },
        { label: '绕开', desc: '+15 木材', eff: { wood: 15 } }
      ]
    },
    {
      id: 'oil', name: '油污海域', icon: 'oil',
      text: '前方海面浮着一层油。点着了能烧掉一批东西，也会把它们都引过来。',
      choices: [
        { label: '点火', desc: '下一波敌人生命 -25%，但多 1 个单位', eff: { modHp: 0.75, modAdd: 1 } },
        { label: '绕开', desc: '无事发生', eff: {} }
      ]
    },
    {
      id: 'port', name: '港口废墟', icon: 'ship',
      text: '一座被淹了一半的港口。船坞还能用，仓库也还没被搬空。',
      choices: [
        { label: '进坞修补', desc: '+55 耐久', eff: { hp: 55 } },
        { label: '搜刮仓库', desc: '+50 木材，-20 耐久', eff: { wood: 50, hp: -20 } }
      ]
    },
    {
      id: 'beacon', name: '深海信标', icon: 'oil',
      text: '海底有个还在闪的信标，下面挂着一整箱没开封的货。',
      choices: [
        { label: '打捞上来', desc: '+1 随机模块 +1 改装件', eff: { module: 1, augment: 1 } },
        { label: '不管它', desc: '+10 木材', eff: { wood: 10 } }
      ]
    },
    {
      id: 'altar', name: '潮汐祭坛', icon: 'oil',
      text: '礁石上立着一座祭坛，凹槽的形状刚好能放进一块船板。',
      choices: [
        { label: '献祭船板', desc: '-35 耐久，获得 1 件遗物', eff: { hp: -35, relic: 1 } },
        { label: '搬走供品', desc: '+25 木材, +1 随机改造', eff: { wood: 25, upgrade: 1 } }
      ]
    }
  ];

  /* ---------- 局外成长：用残骸永久解锁 ---------- */
  var META = [
    { id: 'carrier', name: '解锁母舰', cost: 120, max: 1, desc: '开局可选「母舰」' },
    { id: 'wood', name: '补给舱', cost: 80, max: 3, desc: '每局起始木材 +15' },
    { id: 'hp', name: '加固船体', cost: 80, max: 3, desc: '每局起始耐久 +25' },
    { id: 'relic', name: '祖传遗物', cost: 220, max: 1, desc: '每局开局随机带 1 件遗物' }
  ];

  /* ---------- 敌人 ---------- */
  var ENEMIES = {
    drifter: { name: '漂流者', lane: 'surface', hp: 34, spd: 64, dmg: 5, r: 16, color: '#79b86a', pts: 1 },
    bat: { name: '潮蝠', lane: 'air', hp: 26, spd: 96, dmg: 4, r: 14, color: '#9b7fd4', pts: 0.9 },
    diver: { name: '深潜者', lane: 'under', hp: 62, spd: 58, dmg: 7, r: 17, color: '#4fb3c9', pts: 1.9 },
    shellback: { name: '甲壳兽', lane: 'surface', hp: 100, spd: 38, dmg: 9, r: 23, color: '#a5744a', pts: 2.8 },
    raider: { name: '掠夺艇', lane: 'surface', hp: 140, spd: 50, dmg: 11, r: 24, color: '#c2564a', pts: 3.4 },
    boss: {
      name: '潮汐巨兽', lane: 'surface', hp: 600, spd: 18, dmg: 14, r: 50, color: '#e0577f', boss: true, pts: 99,
      hint: '半血后会狂暴并召来援军',
      phases: [
        { at: 0.5, spd: 1.45, dmg: 1.3, summon: ['drifter'], text: '潮汐巨兽撕开了船壳' }
      ]
    },

    /* ---- 第二幕：深潮 ---- */
    eel: { name: '电鳗', lane: 'under', hp: 70, spd: 92, dmg: 11, r: 15, color: '#5fe0d0', pts: 2.2 },
    shade: { name: '幽影', lane: 'air', hp: 52, spd: 118, dmg: 9, r: 15, color: '#8f7fd4', pts: 2.1 },
    crab: { name: '深渊钳虫', lane: 'surface', hp: 220, spd: 30, dmg: 18, r: 27, color: '#b06a4a', pts: 4.2 },
    eye: {
      name: '潮汐之眼', lane: 'surface', hp: 1100, spd: 14, dmg: 22, r: 50, color: '#c85fd0', boss: true, pts: 99,
      hint: '会在水面与水下之间切换',
      phases: [
        { at: 0.7, lane: 'under', spd: 1.9, text: '潮汐之眼沉入水下' },
        { at: 0.35, lane: 'surface', spd: 1.5, dmg: 1.5, summon: ['bat', 'bat', 'eel'], text: '潮汐之眼浮出水面 —— 它在拼命' }
      ]
    }
  };

  /* ---------- 模块改装：挂到单台武器上的词条 ---------- */
  var AUGMENTS = {
    heavy: { name: '重弹', desc: '伤害 +45%，射速 -25%', dmg: 1.45, cd: 1.25, color: '#e0a458' },
    rapid: { name: '连射', desc: '射速 +40%，伤害 -25%', dmg: 0.75, cd: 0.7, color: '#7fc8e8' },
    splash: { name: '溅射', desc: '命中时对 55px 内敌人造成 35% 伤害', splash: 0.35, radius: 55, color: '#e2703a' },
    pierce: { name: '穿透', desc: '额外命中同泳道后方 2 个目标', pierce: 2, color: '#f2e06b' },
    burn: { name: '燃烧弹', desc: '命中附加 9/秒，持续 3 秒', burn: 9, burnT: 3, color: '#e2703a' },
    frost: { name: '冷凝', desc: '命中减速 35%，持续 2 秒', slow: 0.65, slowT: 2, color: '#7fc8e8' },
    elevate: { name: '高角', desc: '可打相邻泳道，伤害 -30%', cross: true, dmg: 0.7, color: '#9b8ae0' },
    recharge: { name: '回充', desc: '击杀后立刻重置冷却', recharge: true, color: '#8fd14f' },
    amp: { name: '扩音', desc: '相邻模块射速 +12%', aura: 0.12, color: '#c9a227' }
  };
  var AUG_ORDER = ['heavy', 'rapid', 'splash', 'pierce', 'burn', 'frost', 'elevate', 'recharge', 'amp'];

  /* ---------- 潮汐词条：每波一个，逼你换打法 ---------- */
  var MODS = [
    { id: 'current', name: '逆流', desc: '敌方移动速度 +35%', spd: 1.35 },
    { id: 'fog', name: '浓雾', desc: '所有武器射程 -20%', range: 0.8 },
    { id: 'iron', name: '铁潮', desc: '敌方生命 +30%', hp: 1.3 },
    { id: 'swarm', name: '蜂群', desc: '敌方数量 +3，生命 -25%', hp: 0.75, add: 3 },
    { id: 'blood', name: '血月', desc: '敌方啃咬伤害 +50%', dmg: 1.5 },
    { id: 'deep', name: '暗流', desc: '额外 2 只深潜者', extra: ['diver', 'diver'] }
  ];

  var ACT1_END = 8;
  var MAX_WAVE = 12;

  /* ---------- 每局异变：整局生效的一条规则，好坏都有 ---------- */
  var MUTATIONS = [
    { id: 'reverse', name: '逆潮', desc: '潮水上涨 +20%，但每波结束 +25 木材', tide: 1.2, woodFlat: 25 },
    { id: 'bounty', name: '丰饶', desc: '木材收益 +35%，敌方生命 +18%', wood: 1.35, hp: 1.18 },
    { id: 'still', name: '静水', desc: '敌方移速 -15%，但你的射程 -10%', spd: 0.85, range: 0.9 },
    { id: 'blood', name: '血月', desc: '敌方啃咬 +30%，但每波修复 +25', bite: 1.3, repair: 25 },
    { id: 'steel', name: '钢铁', desc: '敌方生命 +28%，但加固费用 -30%', hp: 1.28, expand: 0.7 },
    { id: 'abyss', name: '深潜', desc: '水下敌人生命 +50%，你对潜伤害 +50%', underHp: 1.5, underDmg: 1.5 },
    { id: 'fogbank', name: '浓雾', desc: '所有射程 -20%，敌方生命 -15%', range: 0.8, hp: 0.85 },
    { id: 'swarm', name: '蜂群', desc: '每波多 2 个单位，生命 -20%', add: 2, hp: 0.8 },
    { id: 'slowtide', name: '慢潮', desc: '潮水上涨 -25%，但每波多 1 个单位', tide: 0.75, add: 1 },
    { id: 'waste', name: '废土', desc: '起始木材 -20，但每波结束 +18', woodFlat: 18, startWood: -20 }
  ];

  /* ---------- 潮汐刻度：通关后解锁的进阶难度 ---------- */
  var MAX_ASC = 5;
  function ascMods(lv) {
    lv = Math.max(0, Math.min(MAX_ASC, lv | 0));
    return {
      lv: lv,
      hp: 1 + 0.08 * lv,
      add: lv >= 3 ? 1 : 0,
      wood: lv >= 3 ? -10 : 0,
      spd: lv >= 4 ? 1.1 : 1,
      tide: lv >= 5 ? 1.15 : 1,
      wreck: 1 + 0.3 * lv
    };
  }
  var ASC_NAME = ['平静', '涟漪', '涌浪', '暗涌', '风暴', '大潮'];

  function makeMutation(rng) {
    return MUTATIONS[Math.floor(rng() * MUTATIONS.length)];
  }

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
    if (wave >= 9) p.push('eel', 'shade');
    if (wave >= 10) p.push('crab');
    if (wave >= 3) p.push('bat');
    if (wave >= 5) p.push('diver');
    if (wave >= 6) p.push('shellback');
    if (wave >= 7) p.push('raider');
    return p;
  }

  /* ---------- 生成一波 ----------
     用 run 的 rng：同一局内可复现，不同局完全不同 */
  function makePlan(wave, rng) {
    var isBoss = (wave === ACT1_END) || (wave === MAX_WAVE);
    var list = [];
    var pool = poolFor(wave);
    var budget;
    var mod = null;

    if (isBoss) {
      var finalBoss = wave >= MAX_WAVE;
      list.push({ kind: finalBoss ? 'eye' : 'boss', side: rng() < 0.5 ? 'L' : 'R' });
      budget = finalBoss ? 11 : 7;
    } else if (wave > ACT1_END) {
      /* 第二幕不沿指数曲线：甲板已经到顶，只能温和加量 */
      var base8 = 4.4 * Math.pow(1.315, ACT1_END - 1);
      budget = base8 * (1 + 0.09 * (wave - ACT1_END));
    } else {
      budget = 4.4 * Math.pow(1.315, wave - 1);
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
      hpMul: (isBoss ? (wave >= MAX_WAVE ? 1.6 : 1.45) : 1 + (Math.min(wave, ACT1_END) - 1) * 0.10) * (mod && mod.hp ? mod.hp : 1),
      spdMul: mod && mod.spd ? mod.spd : 1,
      dmgMul: mod && mod.dmg ? mod.dmg : 1,
      rangeMul: mod && mod.range ? mod.range : 1
    };
  }

  /* ---------- 路线：每波结束后二选一 / 三选一 ----------
     每个选项 = 下一波的难度 + 一份看得见的奖励。
     选项是明牌的：你知道会多难，也知道能拿到什么，只是不能都要。 */
  function makeRoute(run, rng) {
    var upPool = UPGRADE_ORDER.filter(function (k) {
      return (run.up[k] || 0) < UPGRADES[k].max;
    });
    var owned = run.relics || [];
    var relicPool = RELIC_ORDER.filter(function (k) { return owned.indexOf(k) < 0; });

    function randOf(arr, fb) {
      if (!arr.length) return fb;
      return arr[Math.floor(rng() * arr.length)];
    }

    var calm = {
      id: 'calm', name: '平静潮汐', tag: '安全', tone: 'safe',
      hpMul: 0.82, add: 0,
      desc: '敌方生命 -18%',
      reward: rng() < 0.5
        ? { type: 'wood', amt: 32 + run.wave * 4 }
        : { type: 'repair', amt: 28 + run.wave * 3 }
    };
    var normal = {
      id: 'normal', name: '寻常潮汐', tag: '常规', tone: 'mid',
      hpMul: 1, add: 0,
      desc: '标准强度',
      reward: { type: 'module', id: randOf(ORDER, 'ballista') }
    };
    var assault = {
      id: 'assault', name: '强袭', tag: '危险', tone: 'risk',
      hpMul: 1.2, add: 1,
      desc: '敌方生命 +20%，多 1 个单位',
      reward: (function () {
        if (rng() < 0.45) return { type: 'augment', id: AUG_ORDER[Math.floor(rng() * AUG_ORDER.length)] };
        if (upPool.length) return { type: 'upgrade', id: randOf(upPool, 'ap') };
        return { type: 'module', id: randOf(ORDER, 'ballista') };
      })()
    };
    var elite = {
      id: 'elite', name: '精英潮', tag: '致命', tone: 'elite',
      hpMul: 1.38, add: 2,
      desc: '敌方生命 +38%，多 2 个单位',
      reward: relicPool.length
        ? { type: 'relic', id: randOf(relicPool, 'ram') }
        : { type: 'upgrade', id: randOf(upPool, 'ap') || { type: 'wood', amt: 40 } }
    };

    var opts = [calm];
    opts.push(rng() < 0.55 ? assault : normal);
    if (run.wave >= 2 && relicPool.length) opts.push(elite);

    /* 有时会撞上一次事件，而不是一场硬仗 */
    if (rng() < 0.5) {
      var ev = EVENTS[Math.floor(rng() * EVENTS.length)];
      if (opts.length >= 3) opts.pop();
      opts.splice(1, 0, {
        id: 'event', name: ev.name, tag: '事件', tone: 'event',
        hpMul: 1, add: 0, desc: '未知的遭遇', event: ev
      });
    }
    return opts;
  }

  function previewOf(plan) {
    var count = {};    plan.spawns.forEach(function (s) {
      count[s.kind] = (count[s.kind] || 0) + 1;
    });
    var parts = [];
    Object.keys(count).forEach(function (k) {
      parts.push(ENEMIES[k].name + '×' + count[k]);
    });
    var hint = null;
    plan.spawns.forEach(function (sp) {
      var d = ENEMIES[sp.kind];
      if (d && d.hint) hint = d.name + '：' + d.hint;
    });
    return {
      sides: plan.sides.map(function (s) { return s === 'L' ? '左舷' : '右舷'; }).join(' + '),
      text: parts.join(' · '),
      mod: plan.mod,
      hint: hint
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
    SHIPS: SHIPS, SHIP_ORDER: SHIP_ORDER,
    RELICS: RELICS, RELIC_ORDER: RELIC_ORDER,
    TAGS: TAGS, TAG_ORDER: TAG_ORDER, TAG_OF: TAG_OF,
    MUTATIONS: MUTATIONS, MAX_ASC: MAX_ASC, ASC_NAME: ASC_NAME, ascMods: ascMods, makeMutation: makeMutation,
    EVENTS: EVENTS, META: META,
    AUGMENTS: AUGMENTS, AUG_ORDER: AUG_ORDER,
    ENEMIES: ENEMIES, MODS: MODS, MAX_WAVE: MAX_WAVE, ACT1_END: ACT1_END,
    makePlan: makePlan, makeRoute: makeRoute, previewOf: previewOf, mulberry32: mulberry32
  };
})(typeof window !== 'undefined' ? window : globalThis);
