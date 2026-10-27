/* headless 数值回归：用贪心 AI 跑多局，检验 8 波是否可通、曲线是否合理 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const base = path.join(__dirname, '..');
const ctx = { console, Math, Object, Array, JSON, isNaN, parseInt, parseFloat };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(base, 'data.js'), 'utf8'), ctx, { filename: 'data.js' });
vm.runInContext(fs.readFileSync(path.join(base, 'core.js'), 'utf8'), ctx, { filename: 'core.js' });

const D = ctx.Data, C = ctx.Core;

/* ---------- 布局工具 ---------- */
function colOrder(sides) {
  if (sides.length === 1) {
    return sides[0] === 'L' ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0];
  }
  return [0, 5, 1, 4, 2, 3];
}

function findSpot(run, id, order) {
  const def = D.MODULES[id];
  for (const c of order) {
    if (C.canPlace(run, id, c, def.row) === null) return { col: c, row: def.row };
  }
  return null;
}

function laneWeapons(run, lane) {
  return C.cellsOf(run).filter(x => x.def.kind === 'weapon' && (x.def.lane === lane || x.def.lane === 'any'));
}

function tryBuy(run, id, order) {
  if (C.costOf(run, id) > run.wood) return false;
  const spot = findSpot(run, id, order);
  if (!spot) return false;
  return C.place(run, id, spot.col, spot.row) === null;
}

/* ---------- 贪心 AI ---------- */
function buildPhase(run, plan, verbose) {
  const lanesNeeded = {};
  plan.spawns.forEach(s => {
    const l = D.ENEMIES[s.kind].lane;
    lanesNeeded[l] = (lanesNeeded[l] || 0) + 1;
  });
  const order = colOrder(plan.sides);
  const lanePick = { surface: run.wave >= 5 ? 'tesla' : 'ballista', air: 'flak', under: 'harpoon' };
  const laneBase = { surface: 'ballista', air: 'flak', under: 'harpoon' };
  let guard = 0;

  while (guard++ < 60) {
    const st = C.computeStats(run);
    const cells = C.cellsOf(run);

    /* 1. 缺电的层先配发电机（发电机可放任意层） */
    const unpowered = cells.filter(x => x.def.kind === 'weapon' && !st.powered[C.idx(x.c, x.r)]);
    if (unpowered.length > 0) {
      const target = unpowered[0];
      let placed = false;
      const cols = [target.c, target.c - 1, target.c + 1, target.c + 2, target.c - 2]
        .filter(c => c >= 0 && c < D.COLS);
      for (const c of cols) {
        if (C.canPlace(run, 'gen', c, target.r) === null) { C.place(run, 'gen', c, target.r); placed = true; break; }
      }
      if (placed) continue;
    }

    /* 2. 按"敌人数 / 已有武器数"给泳道补炮 */
    const lanes = Object.keys(lanesNeeded).sort((a, b) => {
      const ra = lanesNeeded[a] / (laneWeapons(run, a).length + 1);
      const rb = lanesNeeded[b] / (laneWeapons(run, b).length + 1);
      return rb - ra;
    });
    let acted = false;
    for (const lane of lanes) {
      for (const id of [lanePick[lane], laneBase[lane]]) {
        if (tryBuy(run, id, order)) { acted = true; break; }
      }
      if (acted) break;
    }
    if (acted) continue;

    /* 3. 弹药库加成 */
    if (run.wood >= 40) {
      const w = cells.filter(x => x.def.kind === 'weapon' && !x.def.chain);
      if (w.length) {
        const t = w[Math.floor(Math.random() * w.length)];
        if (C.canPlace(run, 'mag', t.c + 1, 1) === null) { C.place(run, 'mag', t.c + 1, 1); continue; }
        if (C.canPlace(run, 'mag', t.c - 1, 1) === null) { C.place(run, 'mag', t.c - 1, 1); continue; }
      }
    }

    /* 4. 耐久 / 抽水泵 */
    if (run.wood >= 30) {
      if (C.canPlace(run, 'armor', order[0], 2) === null) { C.place(run, 'armor', order[0], 2); continue; }
      if (run.wave >= 5 && C.canPlace(run, 'pump', order[0], 2) === null) { C.place(run, 'pump', order[0], 2); continue; }
    }

    /* 5. 打捞臂 */
    if (run.wood >= 30) {
      if (C.canPlace(run, 'salvage', order[0], 0) === null) { C.place(run, 'salvage', order[0], 0); continue; }
    }
    break;
  }
}

function pickCard(run, cards) {
  const mods = cards.filter(c => c.type === 'module');
  if (run.hp < C.computeStats(run).maxHp * 0.5) {
    const rep = cards.find(c => c.type === 'repair');
    if (rep) return rep;
  }
  if (mods.length) return mods[0];
  return cards.find(c => c.type === 'wood') || cards[0];
}

/* ---------- 单局 ---------- */
const TRACE = process.argv.includes('--trace');

function dumpBoard(run, w) {
  console.log(`\n--- W${w} 甲板 (wood ${run.wood}, hp ${run.hp}) ---`);
  for (let r = 0; r < D.ROWS; r++) {
    const row = [];
    for (let c = 0; c < D.COLS; c++) {
      const id = run.grid[r * D.COLS + c];
      row.push(id ? D.MODULES[id].name : '·'.repeat(4));
    }
    console.log('  ' + D.ROW_NAME[r] + ' | ' + row.join(' | '));
  }
}

function logBattle(b) {
  const laneDps = {};
  b.modules.filter(m => m.def.kind === 'weapon').forEach(m => {
    const base = (m.def.radius || m.def.chain) ? m.def.dmg * (m.def.chain || 2.2) / m.def.cd : m.def.dmg / m.def.cd;
    const lane = m.def.lane;
    laneDps[lane] = (laneDps[lane] || 0) + base * (1 + m.mag) * (m.powered ? 1 : 0.78) * (m.flooded ? 0.53 : 1);
  });
  const alive = {};
  b.enemies.forEach(e => { alive[e.kind] = (alive[e.kind] || 0) + 1; });
  const latched = b.enemies.filter(e => e.latched).length;
  console.log(`  t=${b.t.toFixed(0).padStart(3)}s tide=${b.tide.toFixed(2)} hp=${b.hp.toFixed(0).padStart(3)}/${b.maxHp} ` +
    `alive=${b.enemies.length}(${latched}咬) 击杀=${b.killed} ` +
    `DPS[海${(laneDps.surface || 0).toFixed(0)} 空${(laneDps.air || 0).toFixed(0)} 潜${(laneDps.under || 0).toFixed(0)} 全${(laneDps.any || 0).toFixed(0)}] ` +
    JSON.stringify(alive));
}

function playOne(log) {
  const run = C.newRun();
  const trace = [];

  for (let w = 1; w <= D.MAX_WAVE; w++) {
    const plan = D.wavePlan(w, run.extraDivers);
    buildPhase(run, plan);
    if (TRACE && w === D.MAX_WAVE) dumpBoard(run, w);

    const b = C.startBattle(run);
    const enemyHp = b.enemies.length; // 0, spawn later
    let totalHp = 0;
    b.plan.spawns.forEach(s => { totalHp += D.ENEMIES[s.kind].hp * b.plan.hpMul; });

    let guard = 0;
    let nextLog = 0;
    while (!b.result && guard++ < 60 * 200) {
      C.step(b, 1 / 60);
      if (TRACE && w === D.MAX_WAVE && b.t >= nextLog) { nextLog += 3; logBattle(b); }
    }
    if (TRACE && w === D.MAX_WAVE) console.log(`  => ${b.result}, 总伤害 ${Math.round(b.dmgDealt)} / 敌方 ${Math.round(totalHp)}`);

    const weapons = b.modules.filter(m => m.def.kind === 'weapon');
    trace.push({
      wave: w,
      enemyHp: Math.round(totalHp),
      dmg: Math.round(b.dmgDealt),
      weapons: weapons.length,
      modules: b.modules.length,
      hp: Math.round(b.hp),
      maxHp: Math.round(b.maxHp),
      leak: Math.round(b.leak),
      tide: +b.tide.toFixed(2),
      kills: b.killed,
      result: b.result
    });

    if (b.result !== 'won') {
      return { won: false, wave: w, trace, run };
    }
    run.kills += b.killed;

    C.afterWave(run, b);
    const cards = C.rollCards(run);
    C.applyCard(run, pickCard(run, cards));
    run.extraDivers = 0;
    run.wave = w + 1;
  }
  return { won: true, wave: D.MAX_WAVE, trace, run };
}

/* ---------- 批量 ---------- */
if (TRACE) {
  const r = playOne(true);
  console.log(`\n结果: ${r.won ? '通关' : '止步 W' + r.wave}`);
  process.exit(0);
}

const N = parseInt(process.argv[2] || '400', 10);
const dist = {};
let wins = 0;
const agg = {};

for (let i = 0; i < N; i++) {
  const r = playOne();
  if (r.won) wins++;
  dist[r.wave] = (dist[r.wave] || 0) + 1;
  r.trace.forEach(t => {
    if (!agg[t.wave]) agg[t.wave] = { dmg: 0, enemyHp: 0, hp: 0, maxHp: 0, weapons: 0, modules: 0, n: 0, tide: 0, leak: 0 };
    agg[t.wave].dmg += t.dmg;
    agg[t.wave].enemyHp += t.enemyHp;
    agg[t.wave].hp += t.hp;
    agg[t.wave].maxHp += t.maxHp;
    agg[t.wave].weapons += t.weapons;
    agg[t.wave].modules += t.modules;
    agg[t.wave].leak += t.leak;
    agg[t.wave].tide += t.tide;
    agg[t.wave].n++;
  });
}

console.log(`\n=== 潮汐方舟 · 数值回归 (${N} 局) ===`);
console.log(`通关率: ${(wins / N * 100).toFixed(1)}%   (${wins}/${N})`);
console.log('\n停留波次分布:');
Object.keys(dist).sort((a, b) => a - b).forEach(k => {
  const bar = '█'.repeat(Math.round(dist[k] / N * 50));
  console.log(`  W${k}: ${String(dist[k]).padStart(4)}  ${(dist[k] / N * 100).toFixed(1).padStart(5)}%  ${bar}`);
});

console.log('\n逐波均值:');
console.log('  波次  武器  模块  敌方HP   我方伤害  伤害/HP   掉血   剩余耐久   满潮');
Object.keys(agg).sort((a, b) => a - b).forEach(k => {
  const a = agg[k];
  const ratio = (a.dmg / Math.max(1, a.enemyHp)).toFixed(2);
  console.log(`  W${String(k).padStart(2)}  ${(a.weapons / a.n).toFixed(1).padStart(4)}  ${(a.modules / a.n).toFixed(1).padStart(4)}  ${String(Math.round(a.enemyHp / a.n)).padStart(6)}  ${String(Math.round(a.dmg / a.n)).padStart(8)}  ${String(ratio).padStart(6)}  ${String(Math.round(a.leak / a.n)).padStart(5)}   ${String(Math.round(a.hp / a.n)).padStart(3)}/${Math.round(a.maxHp / a.n)}   ${(a.tide / a.n).toFixed(2)}`);
});
console.log('');
