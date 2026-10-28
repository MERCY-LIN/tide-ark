/* headless 数值回归：用贪心 AI 跑多局，检验曲线是否合理
   用法：
     node tools/balance.js 400
     node tools/balance.js 1 --trace
*/
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
const TRACE = process.argv.includes('--trace');

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
function buildPhase(run) {
  const plan = run.plan;
  const lanesNeeded = {};
  plan.spawns.forEach(s => {
    const l = D.ENEMIES[s.kind].lane;
    lanesNeeded[l] = (lanesNeeded[l] || 0) + 1;
  });
  const order = colOrder(plan.sides);
  const lanePick = { surface: run.wave >= 5 ? 'tesla' : 'ballista', air: 'flak', under: 'harpoon' };
  const laneBase = { surface: 'ballista', air: 'flak', under: 'harpoon' };

  /* 0. 扩建：空位紧张、钱又够，就加一列 */
  let guard0 = 0;
  while (guard0++ < 5) {
    let free = 0;
    for (const r of [0, 1, 2]) for (const c of run.unlocked) if (!run.grid[r * D.COLS + c]) free++;
    if (free >= 4) break;
    const candidates = D.EXPAND
      .filter(e => !C.isUnlocked(run, e.col))
      .filter(e => C.canExpand(run, e.col) === null)
      .filter(e => run.wood >= e.cost + 14);
    if (!candidates.length) break;
    /* 只看威胁侧是否已经有外挂列，没有就优先补 */
    const wantCol = order[0];
    candidates.sort((a, b) => Math.abs(a.col - wantCol) - Math.abs(b.col - wantCol));
    if (C.expand(run, candidates[0].col) !== null) break;
  }

  let guard = 0;
  while (guard++ < 60) {
    const st = C.computeStats(run);
    const cells = C.cellsOf(run);
    const unlocked = run.unlocked;

    /* 1. 先用库存里的武器（免费，不占木材） */
    const lanesSorted = Object.keys(lanesNeeded).sort((a, b) => {
      const ra = lanesNeeded[a] / (laneWeapons(run, a).length + 1);
      const rb = lanesNeeded[b] / (laneWeapons(run, b).length + 1);
      return rb - ra;
    });
    let actedStock = false;
    for (const lane of lanesSorted) {
      const ids = D.ORDER.filter(function (id) {
        return run.stock[id] > 0 && D.MODULES[id].kind === 'weapon' &&
          (D.MODULES[id].lane === lane || D.MODULES[id].lane === 'any');
      });
      for (const id of ids) {
        if (tryBuy(run, id, order)) { actedStock = true; break; }
      }
      if (actedStock) break;
    }
    if (actedStock) continue;

    /* 2. 按"敌人数 / 已有武器数"补炮 */
    const lanes = lanesSorted;
    let acted = false;
    for (const lane of lanes) {
      for (const id of [lanePick[lane], laneBase[lane]]) {
        if (tryBuy(run, id, order)) { acted = true; break; }
      }
      if (acted) break;
    }
    if (acted) continue;

    /* 2. 弹药库（贴着已有武器） */
    if (run.wood >= 44) {
      const w = cells.filter(x => x.def.kind === 'weapon' && !x.def.chain);
      if (w.length) {
        const t = w[Math.floor(Math.random() * w.length)];
        for (const c of [t.c + 1, t.c - 1]) {
          if (unlocked.includes(c) && C.canPlace(run, 'mag', c, 1) === null) {
            C.place(run, 'mag', c, 1); acted = true; break;
          }
        }
      }
      if (acted) continue;
    }

    /* 3. 发电机（给武器最多的那一层） */
    if (run.wood >= 34) {
      const perRow = [0, 0, 0];
      cells.filter(x => x.def.kind === 'weapon').forEach(x => { perRow[x.r]++; });
      let bestRow = -1, bestN = 0;
      for (let r = 0; r < 3; r++) {
        if (!st.boost[r] && perRow[r] > bestN) { bestN = perRow[r]; bestRow = r; }
      }
      if (bestRow >= 0) {
        for (const c of order) {
          if (unlocked.includes(c) && C.canPlace(run, 'gen', c, bestRow) === null) {
            C.place(run, 'gen', c, bestRow); acted = true; break;
          }
        }
      }
      if (acted) continue;
    }

    /* 4. 耐久 / 抽水泵 */
    if (run.wood >= 30) {
      for (const c of order) {
        if (unlocked.includes(c) && C.canPlace(run, 'armor', c, 2) === null) {
          C.place(run, 'armor', c, 2); acted = true; break;
        }
      }
      if (acted) continue;
    }
    break;
  }
}

function pickRoute(run, opts) {
  const st = C.computeStats(run);
  const hpFrac = run.hp / st.maxHp;
  const safe = opts.find(o => o.tone === 'safe');
  const elite = opts.find(o => o.tone === 'elite');
  const risk = opts.find(o => o.tone === 'risk');
  if (hpFrac < 0.45 && safe) return safe;
  if (elite && hpFrac > 0.62) return elite;
  if (risk) return risk;
  return opts[0];
}

function dumpBoard(run, w) {
  console.log(`\n--- W${w} 甲板 (wood ${run.wood}, hp ${run.hp}/${C.computeStats(run).maxHp}) ---`);
  console.log('  解锁列: ' + run.unlocked.join(','));
  const ups = Object.keys(run.up).filter(k => run.up[k] > 0).map(k => D.UPGRADES[k].name + '×' + run.up[k]);
  console.log('  改造: ' + (ups.join(' · ') || '无'));
  const p = run.plan;
  console.log('  词条: ' + (p.mod ? p.mod.name + '（' + p.mod.desc + '）' : '无') +
    '  来袭: ' + p.sides.join('/') + '  单位: ' + p.spawns.length);
  for (let r = 0; r < D.ROWS; r++) {
    const row = [];
    for (let c = 0; c < D.COLS; c++) {
      if (!run.unlocked.includes(c)) { row.push('  ▩ '); continue; }
      const id = run.grid[r * D.COLS + c];
      row.push(id ? D.MODULES[id].name.padEnd(4, '　') : '　·　');
    }
    console.log('  ' + D.ROW_NAME[r] + ' | ' + row.join('|'));
  }
}

function logBattle(b) {
  const alive = {};
  b.enemies.forEach(e => { alive[e.kind] = (alive[e.kind] || 0) + 1; });
  const latched = b.enemies.filter(e => e.latched).length;
  console.log(`  t=${b.t.toFixed(0).padStart(3)}s tide=${b.tide.toFixed(2)} hp=${b.hp.toFixed(0).padStart(3)}/${b.maxHp} ` +
    `活=${b.enemies.length}(${latched}咬) 杀=${b.killed} ${JSON.stringify(alive)}`);
}

/* ---------- 单局 ---------- */
function playOne(log) {
  const ship = ['barge', 'gunboat', 'carrier'][Math.floor(Math.random() * 3)];
  const ascArg = parseInt((process.argv.find(a => a.startsWith('--asc=')) || '--asc=0').split('=')[1], 10) || 0;
  const run = C.newRun(12345 + (log ? 0 : Math.floor(Math.random() * 1e6)), ship, {}, ascArg);
  const trace = [];

  for (let w = 1; w <= D.MAX_WAVE; w++) {
    const plan = run.plan;
    buildPhase(run);
    if (TRACE && w === D.MAX_WAVE) dumpBoard(run, w);

    const b = C.startBattle(run);
    let totalHp = 0;
    b.plan.spawns.forEach(s => { totalHp += D.ENEMIES[s.kind].hp * b.plan.hpMul; });

    let guard = 0;
    let nextLog = 0;
    while (!b.result && guard++ < 60 * 200) {
      C.step(b, 1 / 60);
      if (TRACE && w === D.MAX_WAVE && b.t >= nextLog) { nextLog += 4; logBattle(b); }
    }

    const weapons = b.modules.filter(m => m.def.kind === 'weapon');
    trace.push({
      wave: w,
      enemyHp: Math.round(totalHp),
      dmg: Math.round(b.dmgDealt),
      leak: Math.round(b.leak),
      weapons: weapons.length,
      modules: b.modules.length,
      cols: run.unlocked.length,
      hp: Math.round(b.hp),
      maxHp: Math.round(b.maxHp),
      tide: +b.tide.toFixed(2),
      killed: b.killed,
      mod: b.plan.mod ? b.plan.mod.name : '',
      result: b.result
    });

    if (TRACE && w === D.MAX_WAVE) {
      console.log(`  => ${b.result} · 伤害 ${Math.round(b.dmgDealt)} / 敌方 ${Math.round(totalHp)} · 掉血 ${Math.round(b.leak)}`);
      console.log('  战报: ' + b.log.slice(-4).map(x => `[${x.t.toFixed(0)}s]${x.txt}`).join(' | '));
    }

    if (b.result !== 'won') return { won: false, wave: w, trace, run, battle: b };
    run.kills += b.killed;

    const gain = C.afterWave(run, b);
    if (w >= D.MAX_WAVE) return { won: true, wave: w, trace, run, battle: b, gain };

    const opts = D.makeRoute(run, Math.random);
    const opt = pickRoute(run, opts);

    run.wave = w + 1;
    run.dived = false;
    C.applyRoute(run, opt);
    C.planWave(run);
  }
  return { won: true, wave: D.MAX_WAVE, trace, run };
}

/* ---------- 批量 ---------- */
if (TRACE) {
  const r = playOne(true);
  console.log(`\n结果: ${r.won ? '通关' : '止步 W' + r.wave}（击杀 ${r.run.kills}）`);
  process.exit(0);
}

const N = parseInt(process.argv[2] || '400', 10);
const dist = {};
let wins = 0;
const agg = {};

for (let i = 0; i < N; i++) {
  const r = playOne(false);
  if (r.won) wins++;
  dist[r.wave] = (dist[r.wave] || 0) + 1;
  r.trace.forEach(t => {
    if (!agg[t.wave]) agg[t.wave] = { dmg: 0, enemyHp: 0, hp: 0, maxHp: 0, weapons: 0, modules: 0, cols: 0, n: 0, tide: 0, leak: 0, mods: 0 };
    agg[t.wave].dmg += t.dmg;
    agg[t.wave].enemyHp += t.enemyHp;
    agg[t.wave].hp += t.hp;
    agg[t.wave].maxHp += t.maxHp;
    agg[t.wave].weapons += t.weapons;
    agg[t.wave].modules += t.modules;
    agg[t.wave].cols += t.cols;
    agg[t.wave].leak += t.leak;
    agg[t.wave].tide += t.tide;
    if (t.mod) agg[t.wave].mods++;
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
console.log('  波次  武器  模块  列数  敌方HP   我方伤害  伤害/HP   掉血   剩余耐久   潮位  带词条');
Object.keys(agg).sort((a, b) => a - b).forEach(k => {
  const a = agg[k];
  const ratio = (a.dmg / Math.max(1, a.enemyHp)).toFixed(2);
  console.log(`  W${String(k).padStart(2)}  ${(a.weapons / a.n).toFixed(1).padStart(4)}  ${(a.modules / a.n).toFixed(1).padStart(4)}  ${(a.cols / a.n).toFixed(1).padStart(4)}  ${String(Math.round(a.enemyHp / a.n)).padStart(6)}  ${String(Math.round(a.dmg / a.n)).padStart(8)}  ${String(ratio).padStart(6)}  ${String(Math.round(a.leak / a.n)).padStart(5)}   ${String(Math.round(a.hp / a.n)).padStart(3)}/${Math.round(a.maxHp / a.n)}   ${(a.tide / a.n).toFixed(2)}   ${Math.round(a.mods / a.n * 100)}%`);
});
console.log('');
