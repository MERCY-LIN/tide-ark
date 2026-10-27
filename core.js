/* ============================================================
   潮汐方舟  Tide Ark
   core.js —— 建造 / 供电 / 潮汐战斗，纯逻辑，零 DOM 依赖
   （可被 headless 直接跑，用于数值回归）
   ============================================================ */
(function (root) {
  'use strict';

  var D = root.Data;
  var CELL = D.CELL, COLS = D.COLS, ROWS = D.ROWS;

  function idx(col, row) { return row * COLS + col; }
  function mx(col) { return D.RAFT_X + col * CELL + CELL / 2; }
  function my(row) { return D.RAFT_Y + row * CELL + CELL / 2; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ============================================================
     存档 / 局
     ============================================================ */
  function newRun() {
    var stock = {};
    D.ORDER.forEach(function (id) { stock[id] = 0; });
    return {
      wave: 1,
      wood: 40,
      hp: 160,
      grid: new Array(COLS * ROWS).fill(null),
      stock: stock,
      extraDivers: 0,
      dived: false,
      over: false,
      won: false,
      kills: 0
    };
  }

  /* ============================================================
     派生属性：供电 / 弹药 / 潮速 / 耐久 / 打捞
     ============================================================ */
  function cellsOf(run) {
    var out = [];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var id = run.grid[idx(c, r)];
        if (id) out.push({ c: c, r: r, id: id, def: D.MODULES[id] });
      }
    }
    return out;
  }

  function computeStats(run) {
    var st = {
      maxHp: 160,
      tideMul: 1,
      powered: {},
      mag: {},
      salvage: 0,
      pumps: 0,
      rowGen: [false, false, false]
    };
    var cells = cellsOf(run);

    cells.forEach(function (x) {
      var e = x.def.effect;
      if (e === 'armor') st.maxHp += 40;
      if (e === 'pump') st.pumps++;
      if (e === 'salvage') st.salvage += 8;
      if (e === 'power') st.rowGen[x.r] = true;
    });
    st.tideMul = 1 - Math.min(0.3, st.pumps * 0.1);

    /* 供电：发电机为整层供电；弹药库给相邻武器增伤 */
    cells.forEach(function (x) {
      if (x.def.kind !== 'weapon') return;
      st.powered[idx(x.c, x.r)] = st.rowGen[x.r];
      var m = 0;
      cells.forEach(function (y) {
        if (y.def.effect === 'mag' && Math.abs(y.c - x.c) <= 1 && Math.abs(y.r - x.r) <= 1) m++;
      });
      st.mag[idx(x.c, x.r)] = Math.min(0.5, m * 0.25);
    });

    return st;
  }

  /* ============================================================
     建造
     ============================================================ */
  function costOf(run, id) {
    return (run.stock[id] || 0) > 0 ? 0 : D.MODULES[id].cost;
  }

  function canPlace(run, id, col, row) {
    var def = D.MODULES[id];
    if (!def) return '未知模块';
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return '超出甲板';
    if (def.row >= 0 && row !== def.row) return def.name + ' 只能放在' + D.ROW_NAME[def.row];
    if (run.grid[idx(col, row)]) return '这一格已经有东西了';
    if (costOf(run, id) > run.wood) return '木材不足';
    return null;
  }

  function place(run, id, col, row) {
    var err = canPlace(run, id, col, row);
    if (err) return err;
    var cost = costOf(run, id);
    if (run.stock[id] > 0) run.stock[id]--;
    run.wood -= cost;
    run.grid[idx(col, row)] = id;
    return null;
  }

  function sell(run, col, row) {
    var id = run.grid[idx(col, row)];
    if (!id) return 0;
    var refund = Math.floor(D.MODULES[id].cost * 0.5);
    run.wood += refund;
    run.grid[idx(col, row)] = null;
    return refund;
  }

  /* ============================================================
     战斗
     ============================================================ */
  function startBattle(run) {
    var st = computeStats(run);
    var plan = D.wavePlan(run.wave, run.extraDivers);

    var b = {
      run: run,
      st: st,
      wave: run.wave,
      plan: plan,
      t: 0,
      tide: 0,
      tideDur: plan.dur,
      tideMul: st.tideMul,
      waterY: D.WATER_LOW,
      hp: run.hp,
      maxHp: st.maxHp,
      enemies: [],
      queue: plan.spawns.slice(),
      modules: [],
      tracers: [],
      particles: [],
      texts: [],
      blasts: [],
      seq: 1,
      result: null,
      enraged: false,
      killed: 0,
      dmgDealt: 0,
      shake: 0,
      leak: 0,
      leakByLane: { surface: 0, air: 0, under: 0 },
      floodShown: false
    };

    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var id = run.grid[idx(c, r)];
        if (!id) continue;
        b.modules.push({
          id: id,
          def: D.MODULES[id],
          col: c,
          row: r,
          x: mx(c),
          y: my(r),
          cd: 0,
          powered: !!st.powered[idx(c, r)],
          mag: st.mag[idx(c, r)] || 0,
          flooded: false,
          flash: 0
        });
      }
    }
    return b;
  }

  function laneY(b, lane) {
    if (lane === 'surface') return b.waterY - 10;
    if (lane === 'air') return 226;
    return 470;
  }

  function spawn(b, s) {
    var def = D.ENEMIES[s.kind];
    var hp = def.hp * b.plan.hpMul;
    b.enemies.push({
      id: b.seq++,
      kind: s.kind,
      def: def,
      lane: def.lane,
      side: s.side,
      x: s.side === 'L' ? -40 : D.VIEW_W + 40,
      y: laneY(b, def.lane),
      hp: hp,
      maxHp: hp,
      r: def.r,
      latched: false,
      enraged: false,
      bob: Math.random() * 6.283,
      hit: 0,
      dead: false,
      biteCd: 0
    });
  }

  function edgeX(side) {
    return side === 'L' ? D.RAFT_X - 10 : D.RAFT_X + D.RAFT_W + 10;
  }

  function deadCheck(b) {
    for (var i = b.enemies.length - 1; i >= 0; i--) {
      if (b.enemies[i].dead) b.enemies.splice(i, 1);
    }
  }

  function burst(b, x, y, color, n, spd) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283;
      var v = (0.4 + Math.random()) * (spd || 90);
      b.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 30,
        life: 0.35 + Math.random() * 0.35,
        max: 0.7,
        color: color,
        r: 1.5 + Math.random() * 2.5
      });
    }
  }

  function floatText(b, x, y, text, color, size) {
    b.texts.push({
      x: x, y: y, text: String(text),
      color: color || '#fff',
      size: size || 14,
      life: 0.85, max: 0.85,
      vy: -34, vx: (Math.random() - 0.5) * 18
    });
  }

  function hurt(b, e, amount, color) {
    if (e.dead) return;
    e.hp -= amount;
    e.hit = 0.14;
    b.dmgDealt += amount;
    if (e.hp <= 0) {
      e.dead = true;
      b.killed++;
      burst(b, e.x, e.y, e.def.color, e.def.boss ? 26 : 8, e.def.boss ? 160 : 110);
      if (!e.def.boss) floatText(b, e.x, e.y - 14, '✦', color || '#ffd479', 15);
    }
  }

  function acquire(b, m) {
    var lane = m.def.lane;
    var reach = m.def.range * CELL;
    var best = null, bestScore = Infinity;
    for (var i = 0; i < b.enemies.length; i++) {
      var e = b.enemies[i];
      if (e.dead) continue;
      if (lane !== 'any' && e.lane !== lane) continue;
      if (Math.abs(e.x - m.x) > reach) continue;
      var score = e.latched ? -1e6 : Math.abs(e.x - edgeX(e.side));
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  function fire(b, m, target) {
    var dmg = m.def.dmg * (1 + m.mag);
    var hits = [];
    var i, e;

    if (m.def.radius) {
      for (i = 0; i < b.enemies.length; i++) {
        e = b.enemies[i];
        if (e.dead) continue;
        var dx = e.x - target.x, dy = e.y - target.y;
        if (dx * dx + dy * dy <= m.def.radius * m.def.radius) hits.push(e);
      }
      b.blasts.push({ x: target.x, y: target.y, r: m.def.radius, life: 0.3, max: 0.3, color: m.def.color });
    } else if (m.def.chain) {
      var pool = [];
      for (i = 0; i < b.enemies.length; i++) {
        e = b.enemies[i];
        if (e.dead) continue;
        var d2 = (e.x - target.x) * (e.x - target.x) + (e.y - target.y) * (e.y - target.y);
        if (d2 <= 140 * 140) pool.push({ e: e, d: d2 });
      }
      pool.sort(function (a, c) { return a.d - c.d; });
      for (i = 0; i < pool.length && hits.length < m.def.chain; i++) hits.push(pool[i].e);
    } else {
      hits.push(target);
    }

    for (i = 0; i < hits.length; i++) {
      hurt(b, hits[i], dmg, m.def.color);
      b.tracers.push({
        x1: m.x, y1: m.y,
        x2: hits[i].x, y2: hits[i].y,
        life: m.def.chain ? 0.16 : 0.09,
        max: m.def.chain ? 0.16 : 0.09,
        color: m.def.color,
        w: m.def.chain ? 2.4 : 1.6,
        arc: !!m.def.chain
      });
    }
    m.flash = 0.1;
    b.tracers.push({
      x1: m.x, y1: m.y - 6,
      x2: m.x + (target.x > m.x ? 10 : -10),
      y2: m.y - 10,
      life: 0.06, max: 0.06, color: m.def.color, w: 1, arc: false
    });
  }

  /* ---------------- 单步推进 ---------------- */
  function step(b, dt) {
    if (b.result) return;
    dt = clamp(dt, 0, 0.05);
    b.t += dt;

    /* 潮位 */
    if (b.tide < 1) {
      b.tide = Math.min(1, b.tide + (dt / b.tideDur) * b.tideMul);
      if (b.tide >= 1 && !b.enraged) {
        b.enraged = true;
        b.enemies.forEach(function (e) { e.enraged = true; });
        floatText(b, D.VIEW_W / 2, 118, '满 潮 · 敌 群 狂 暴', '#ff8b6b', 26);
        floatText(b, D.VIEW_W / 2, 148, '海水开始灌进船舱', '#7fc8e8', 15);
      }
    }
    b.waterY = D.WATER_LOW + (D.WATER_HIGH - D.WATER_LOW) * b.tide;

    /* 满潮后持续进水：逼玩家在潮水涨满前清场 */
    if (b.enraged) {
      b.hp -= 3.5 * dt;
      b.leak += 3.5 * dt;
    }

    var flooded = b.waterY < D.FLOOD_Y;
    for (var mi = 0; mi < b.modules.length; mi++) {
      var m = b.modules[mi];
      m.flooded = (m.row === 1) && flooded;
      if (m.flash > 0) m.flash -= dt;
    }

    /* 出场 */
    while (b.queue.length && b.t >= b.queue[0].t) {
      spawn(b, b.queue.shift());
    }

    /* 移动 + 啃咬 */
    for (var ei = 0; ei < b.enemies.length; ei++) {
      var e = b.enemies[ei];
      if (e.dead) continue;
      if (e.lane === 'surface') e.y = b.waterY - 10;
      if (e.hit > 0) e.hit -= dt;

      if (!e.latched) {
        var spd = e.def.spd * (e.enraged ? 1.35 : 1);
        if (e.side === 'L') {
          e.x += spd * dt;
          if (e.x >= edgeX('L')) { e.x = edgeX('L'); e.latched = true; }
        } else {
          e.x -= spd * dt;
          if (e.x <= edgeX('R')) { e.x = edgeX('R'); e.latched = true; }
        }
      } else {
        e.biteCd -= dt;
        if (e.biteCd <= 0) {
          e.biteCd = 0.55;
          e.hit = 0.12;
        }
        var bite = e.def.dmg * (e.enraged ? 1.8 : 1) * dt;
        b.hp -= bite;
        b.leak += bite;
        b.leakByLane[e.lane] += bite;
        b.shake = Math.min(9, b.shake + dt * 26);
      }
    }

    /* 开火 */
    for (mi = 0; mi < b.modules.length; mi++) {
      m = b.modules[mi];
      if (m.def.kind !== 'weapon') continue;
      if (m.cd > 0) { m.cd -= dt; continue; }
      var target = acquire(b, m);
      if (!target) continue;
      var rate = 1;
      if (!m.powered) rate *= 1.28;
      if (m.flooded) rate *= 1.25;
      m.cd = m.def.cd * rate;
      fire(b, m, target);
    }

    deadCheck(b);

    /* 特效衰减 */
    for (var i = b.particles.length - 1; i >= 0; i--) {
      var p = b.particles[i];
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 260 * dt;
      p.vx *= (1 - 2.2 * dt);
      if (p.life <= 0) b.particles.splice(i, 1);
    }
    for (i = b.tracers.length - 1; i >= 0; i--) {
      b.tracers[i].life -= dt;
      if (b.tracers[i].life <= 0) b.tracers.splice(i, 1);
    }
    for (i = b.blasts.length - 1; i >= 0; i--) {
      b.blasts[i].life -= dt;
      if (b.blasts[i].life <= 0) b.blasts.splice(i, 1);
    }
    for (i = b.texts.length - 1; i >= 0; i--) {
      var tx = b.texts[i];
      tx.life -= dt;
      tx.y += tx.vy * dt;
      tx.x += tx.vx * dt;
      tx.vy *= (1 - 1.4 * dt);
      if (tx.life <= 0) b.texts.splice(i, 1);
    }
    b.shake = Math.max(0, b.shake - dt * 22);

    /* 结算 */
    if (b.hp <= 0) {
      b.hp = 0;
      b.result = 'lost';
      b.run.hp = 0;
    } else if (b.queue.length === 0 && b.enemies.length === 0) {
      b.result = 'won';
      b.run.hp = Math.max(1, Math.round(b.hp));
    }
  }

  /* ============================================================
     奖励 / 打捞
     ============================================================ */
  function rewardWood(run, b) {
    var base = 12 + Math.round(run.wave * 2.5);
    var salvage = b ? b.st.salvage : computeStats(run).salvage;
    return base + salvage;
  }

  /* 一波结束后的资源结算：木材 + 自动修复 */
  function afterWave(run, b) {
    var wood = rewardWood(run, b);
    run.wood += wood;
    var st = computeStats(run);
    var want = 14 + run.wave * 2;
    var before = run.hp;
    run.hp = Math.min(st.maxHp, run.hp + want);
    return { wood: wood, heal: Math.round(run.hp - before) };
  }

  function rollCards(run) {
    var rnd = Math.random;
    var pool = D.ORDER.slice();
    var picks = [];
    var take = function () {
      var i = Math.floor(rnd() * pool.length);
      return pool.splice(i, 1)[0];
    };
    picks.push({ type: 'module', id: take() });
    picks.push({ type: 'module', id: take() });
    var roll = rnd();
    if (roll < 0.42) picks.push({ type: 'wood', amt: 38 });
    else if (roll < 0.72) picks.push({ type: 'repair', amt: 45 });
    else picks.push({ type: 'module', id: take() });
    /* 打乱位置 */
    for (var i = picks.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = picks[i]; picks[i] = picks[j]; picks[j] = t;
    }
    return picks;
  }

  function applyCard(run, card) {
    if (card.type === 'module') {
      run.stock[card.id] = (run.stock[card.id] || 0) + 1;
    } else if (card.type === 'wood') {
      run.wood += card.amt;
    } else if (card.type === 'repair') {
      var max = computeStats(run).maxHp;
      run.hp = Math.min(max, run.hp + card.amt);
    }
  }

  root.Core = {
    idx: idx, mx: mx, my: my,
    newRun: newRun, cellsOf: cellsOf, computeStats: computeStats,
    costOf: costOf, canPlace: canPlace, place: place, sell: sell,
    startBattle: startBattle, step: step,
    rewardWood: rewardWood, afterWave: afterWave, rollCards: rollCards, applyCard: applyCard,
    edgeX: edgeX
  };
})(typeof window !== 'undefined' ? window : globalThis);
