/* ============================================================
   潮汐方舟  Tide Ark
   app.js —— 渲染 / 交互 / 流程
   ============================================================ */
(function () {
  'use strict';

  var D = window.Data, C = window.Core;
  var W = D.VIEW_W, H = D.VIEW_H;
  var CELL = D.CELL;

  var cv = document.getElementById('cv');
  var g = cv.getContext('2d');

  var S = {
    run: C.newRun(),
    phase: 'build',
    battle: null,
    sel: null,
    hoverCell: null,
    mouse: { x: -999, y: -999 },
    speed: 1,
    endTimer: 0,
    t: 0,
    route: null,
    event: null,
    selAug: null,
    contract: null,
    contractOffers: null,
    started: false,
    log: []
  };

  /* ================= 局外存档 ================= */
  var META_KEY = 'tideark.meta.v1';

  function loadMeta() {
    var def = { wreck: 0, runs: 0, wins: 0 };
    try {
      var raw = localStorage.getItem(META_KEY);
      if (raw) {
        var m = JSON.parse(raw) || {};
        for (var k in m) if (m.hasOwnProperty(k)) def[k] = m[k];
      }
    } catch (e) { /* 无痕模式等，忽略即可 */ }
    return def;
  }

  function saveMeta() {
    try { localStorage.setItem(META_KEY, JSON.stringify(S.meta)); } catch (e) { /* 忽略 */ }
  }

  function metaLv(id) { return S.meta[id] || 0; }

  /* 结束一局：结算残骸 */
  function settleRun(won) {
    var gain = C.wreckageOf(S.run, won);
    S.meta.wreck = (S.meta.wreck || 0) + gain;
    S.meta.runs = (S.meta.runs || 0) + 1;
    if (won) S.meta.wins = (S.meta.wins || 0) + 1;
    var w = S.run.wave || 0;
    if (w > (S.meta.best || 0)) S.meta.best = w;
    S.meta.kills = (S.meta.kills || 0) + (S.run.kills || 0);

    /* 今日挑战成绩 */
    if (S.dailyRun && S.dailyRun.key) {
      S.meta.daily = S.meta.daily || {};
      var dk = S.dailyRun.key;
      var rec = S.meta.daily[dk] || { best: 0, cleared: false };
      if (w > rec.best) rec.best = w;
      if (won) rec.cleared = true;
      S.meta.daily[dk] = rec;
    }

    /* 成就 */
    var got = [];
    D.ACHIEVEMENTS.forEach(function (a) {
      S.meta.ach = S.meta.ach || {};
      if (S.meta.ach[a.id]) return;
      var ok = false;
      try { ok = a.check(S.run, won, won && (S.run.wave || 0) >= D.MAX_WAVE); } catch (e) { ok = false; }
      if (!ok) return;
      S.meta.ach[a.id] = true;
      S.meta.wreck = (S.meta.wreck || 0) + a.reward;
      S.meta.wreck = S.meta.wreck;
      got.push(a);
    });
    S.achGained = got;
    saveMeta();
    return gain;
  }

  function achievementLine() {
    if (!S.achGained || !S.achGained.length) return '';
    var txt = S.achGained.map(function (a) { return a.name + ' +' + a.reward; }).join(' · ');
    return '<div class="k">成就</div><div class="v ok">' + txt + '</div>';
  }

  function rollContractOffers() {
    var pool = D.CONTRACTS.slice();
    var out = [];
    for (var i = 0; i < 3 && pool.length; i++) {
      out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    S.contractOffers = out;
  }

  /* ================= 工具 ================= */
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function hexA(h, a) {
    var n = parseInt(h.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  var toastTimer = 0;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, 1400);
  }

  /* ================= 图标 ================= */
  function drawIcon(ctx, id, cx, cy, s, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1.3, s * 0.1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    var k = s / 20;

    switch (id) {
      case 'bolt':
        ctx.beginPath(); ctx.arc(-7 * k, 0, 9 * k, -1.15, 1.15); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-9 * k, 0); ctx.lineTo(9 * k, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(4 * k, -4 * k); ctx.lineTo(10 * k, 0); ctx.lineTo(4 * k, 4 * k); ctx.closePath(); ctx.fill();
        break;
      case 'flame':
        ctx.beginPath();
        ctx.moveTo(0, -10 * k);
        ctx.bezierCurveTo(8 * k, -3 * k, 7 * k, 8 * k, 0, 9 * k);
        ctx.bezierCurveTo(-7 * k, 8 * k, -8 * k, -3 * k, 0, -10 * k);
        ctx.closePath();
        ctx.globalAlpha = 0.9; ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.moveTo(0, 1 * k); ctx.lineTo(5 * k, -3 * k); ctx.stroke();
        break;
      case 'flak':
        ctx.beginPath(); ctx.moveTo(-8 * k, 8 * k); ctx.lineTo(8 * k, 8 * k); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-2 * k, 8 * k); ctx.lineTo(-6 * k, -8 * k); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(2 * k, 8 * k); ctx.lineTo(6 * k, -8 * k); ctx.stroke();
        break;
      case 'harpoon':
        ctx.beginPath(); ctx.moveTo(-9 * k, 7 * k); ctx.lineTo(6 * k, -6 * k); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(6 * k, -6 * k); ctx.lineTo(9 * k, -9 * k); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(2 * k, -2 * k); ctx.lineTo(0, -7 * k); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(1 * k, -1 * k); ctx.lineTo(6 * k, 1 * k); ctx.stroke();
        break;
      case 'depth':
        rr(ctx, -6 * k, -7 * k, 12 * k, 14 * k, 3 * k); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-4 * k, -7 * k); ctx.lineTo(-4 * k, -10 * k); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(4 * k, -7 * k); ctx.lineTo(4 * k, -10 * k); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-6 * k, 2 * k); ctx.lineTo(-10 * k, 4 * k); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(6 * k, 2 * k); ctx.lineTo(10 * k, 4 * k); ctx.stroke();
        break;
      case 'tesla':
        ctx.beginPath();
        ctx.moveTo(2 * k, -10 * k); ctx.lineTo(-5 * k, 1 * k); ctx.lineTo(0, 1 * k);
        ctx.lineTo(-2 * k, 10 * k); ctx.lineTo(6 * k, -2 * k); ctx.lineTo(1 * k, -2 * k);
        ctx.closePath(); ctx.fill();
        break;
      case 'gen':
        rr(ctx, -8 * k, -8 * k, 16 * k, 16 * k, 3 * k); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(1 * k, -5 * k); ctx.lineTo(-4 * k, 0); ctx.lineTo(0, 0); ctx.lineTo(-1 * k, 5 * k);
        ctx.lineTo(4 * k, -0 * k); ctx.lineTo(0, -0 * k); ctx.closePath(); ctx.fill();
        break;
      case 'mag':
        rr(ctx, -8 * k, -6 * k, 16 * k, 12 * k, 2 * k); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-8 * k, -1 * k); ctx.lineTo(8 * k, -1 * k); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-2 * k, -6 * k); ctx.lineTo(-2 * k, 6 * k); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(3 * k, -6 * k); ctx.lineTo(3 * k, 6 * k); ctx.stroke();
        break;
      case 'armor':
        ctx.beginPath();
        ctx.moveTo(0, -9 * k); ctx.lineTo(8 * k, -5 * k); ctx.lineTo(8 * k, 3 * k);
        ctx.quadraticCurveTo(8 * k, 8 * k, 0, 10 * k);
        ctx.quadraticCurveTo(-8 * k, 8 * k, -8 * k, 3 * k);
        ctx.lineTo(-8 * k, -5 * k); ctx.closePath();
        ctx.globalAlpha = .35; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
        break;
      case 'pump':
        ctx.beginPath(); ctx.arc(0, 0, 8 * k, 0, 6.283); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -7 * k); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(6 * k, 3.5 * k); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-6 * k, 3.5 * k); ctx.stroke();
        break;
      case 'salvage':
        ctx.beginPath(); ctx.moveTo(-9 * k, 9 * k); ctx.lineTo(-9 * k, -8 * k); ctx.lineTo(6 * k, -8 * k); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(6 * k, -8 * k); ctx.lineTo(6 * k, 1 * k); ctx.stroke();
        ctx.beginPath(); ctx.arc(6 * k, 4 * k, 3.2 * k, -0.5, 3.4); ctx.stroke();
        break;
      default:
        ctx.beginPath(); ctx.arc(0, 0, 7 * k, 0, 6.283); ctx.stroke();
    }
    ctx.restore();
  }

  /* ================= 场景元素 ================= */
  var STARS = [];
  var RUINS = [];
  (function () {
    var r = D.mulberry32(20261027);
    for (var i = 0; i < 90; i++) {
      STARS.push({ x: r() * W, y: r() * 260, s: 0.5 + r() * 1.4, a: 0.15 + r() * 0.6, p: r() * 6.28 });
    }
    for (var j = 0; j < 16; j++) {
      RUINS.push({
        x: -40 + j * 78 + r() * 34,
        w: 20 + r() * 40,
        h: 26 + r() * 120,
        t: r()
      });
    }
  })();

  function drawSky(t) {
    var grd = g.createLinearGradient(0, 0, 0, H * 0.95);
    grd.addColorStop(0, '#050d15');
    grd.addColorStop(0.34, '#0b1e30');
    grd.addColorStop(0.62, '#153348');
    grd.addColorStop(0.82, '#244554');
    grd.addColorStop(1, '#2d4a55');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);

    for (var i = 0; i < STARS.length; i++) {
      var s = STARS[i];
      var tw = 0.55 + 0.45 * Math.sin(t * 1.4 + s.p);
      g.globalAlpha = s.a * tw;
      g.fillStyle = '#cfe8ff';
      g.fillRect(s.x, s.y, s.s, s.s);
    }
    g.globalAlpha = 1;

    /* 月亮 */
    var mx = 902, my = 96;
    var mg = g.createRadialGradient(mx, my, 6, mx, my, 120);
    mg.addColorStop(0, 'rgba(220,240,255,.30)');
    mg.addColorStop(0.35, 'rgba(160,210,240,.10)');
    mg.addColorStop(1, 'rgba(120,180,220,0)');
    g.fillStyle = mg;
    g.fillRect(mx - 120, my - 120, 240, 240);
    g.beginPath(); g.arc(mx, my, 24, 0, 6.283);
    g.fillStyle = '#dceaf5'; g.fill();
    g.beginPath(); g.arc(mx - 7, my - 5, 20, 0, 6.283);
    g.fillStyle = 'rgba(180,205,225,.55)'; g.fill();
  }

  function drawRuins(t, waterY) {
    g.fillStyle = '#0a1826';
    for (var i = 0; i < RUINS.length; i++) {
      var r = RUINS[i];
      var base = waterY + 4;
      g.globalAlpha = 0.85;
      g.fillRect(r.x, base - r.h, r.w, r.h);
      /* 几扇亮着的窗 */
      if (r.h > 70) {
        g.globalAlpha = 0.35 + 0.15 * Math.sin(t * 0.7 + r.t * 9);
        g.fillStyle = '#4d8fa8';
        g.fillRect(r.x + r.w * 0.3, base - r.h + 16, 4, 6);
        g.fillRect(r.x + r.w * 0.3, base - r.h + 34, 4, 6);
        g.fillStyle = '#0a1826';
        g.globalAlpha = 0.85;
      }
    }
    g.globalAlpha = 1;
  }

  function drawSea(t, waterY) {
    var grd = g.createLinearGradient(0, waterY, 0, H);
    grd.addColorStop(0, '#1a5b73');
    grd.addColorStop(0.22, '#0e3549');
    grd.addColorStop(0.62, '#071d29');
    grd.addColorStop(1, '#03090f');
    g.beginPath();
    g.moveTo(0, waterY);
    for (var x = 0; x <= W; x += 6) {
      g.lineTo(x, waterY + Math.sin(x * 0.011 + t * 1.25) * 3.4 + Math.sin(x * 0.029 - t * 0.85) * 1.7);
    }
    g.lineTo(W, H); g.lineTo(0, H); g.closePath();
    g.fillStyle = grd; g.fill();

    /* 水面高光 */
    g.save();
    g.globalAlpha = 0.5;
    g.strokeStyle = '#8fd8ef';
    g.lineWidth = 1.4;
    g.beginPath();
    for (x = 0; x <= W; x += 6) {
      var yy = waterY + Math.sin(x * 0.011 + t * 1.25) * 3.4 + Math.sin(x * 0.029 - t * 0.85) * 1.7;
      if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
    }
    g.stroke();
    g.restore();

    /* 水体里的光斑 */
    g.save();
    g.globalAlpha = 0.06;
    g.fillStyle = '#7fd4f0';
    for (var i = 0; i < 7; i++) {
      var bx = ((t * 12 + i * 173) % (W + 200)) - 100;
      g.beginPath();
      g.ellipse(bx, waterY + 40 + i * 18, 60, 8, 0, 0, 6.283);
      g.fill();
    }
    g.restore();
  }

  function drawRaft(t, waterY) {
    var x = D.RAFT_X, y = D.RAFT_Y, w = D.RAFT_W, h = D.RAFT_H;
    var bob = Math.sin(t * 0.9) * 2;

    g.save();
    g.translate(0, bob);

    /* 船体 */
    g.beginPath();
    g.moveTo(x - 14, y - 12);
    g.lineTo(x + w + 14, y - 12);
    g.lineTo(x + w + 2, y + h + 20);
    g.quadraticCurveTo(x + w / 2, y + h + 38, x - 2, y + h + 20);
    g.closePath();
    g.fillStyle = '#1d1510';
    g.fill();
    g.strokeStyle = '#3d2d1f';
    g.lineWidth = 2;
    g.stroke();

    /* 三层甲板 */
    var bands = ['#4a3527', '#402d20', '#33241a'];
    for (var r = 0; r < D.ROWS; r++) {
      g.fillStyle = bands[r];
      g.fillRect(x, y + r * CELL, w, CELL);
      /* 木板缝 */
      g.strokeStyle = 'rgba(0,0,0,.22)';
      g.lineWidth = 1;
      for (var px = x + 26; px < x + w; px += 27) {
        g.beginPath(); g.moveTo(px, y + r * CELL); g.lineTo(px, y + (r + 1) * CELL); g.stroke();
      }
      g.strokeStyle = 'rgba(140,110,80,.16)';
      g.beginPath(); g.moveTo(x, y + r * CELL); g.lineTo(x + w, y + r * CELL); g.stroke();
    }

    /* 立柱 */
    g.fillStyle = '#2a1e16';
    for (var c = 0; c <= D.COLS; c++) {
      g.fillRect(x + c * CELL - 2, y - 10, 4, h + 16);
    }

    /* 两舷护板 */
    g.fillStyle = '#543d2c';
    g.fillRect(x - 12, y - 12, 8, h + 22);
    g.fillRect(x + w + 4, y - 12, 8, h + 22);

    /* 上沿栏杆 */
    g.strokeStyle = '#6b4f38';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x - 6, y - 13);
    g.lineTo(x + w + 6, y - 13);
    g.stroke();
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(140,110,80,.5)';
    for (var q = 0; q <= D.COLS; q++) {
      g.beginPath();
      g.moveTo(x + q * CELL, y - 13);
      g.lineTo(x + q * CELL, y - 2);
      g.stroke();
    }

    g.restore();
    return bob;
  }

  /* ================= 模块 ================= */
  function moduleVisual(ctx, def, cx, cy, size, opt) {
    opt = opt || {};
    var half = size / 2;
    rr(ctx, cx - half, cy - half, size, size, 7);
    ctx.fillStyle = opt.hl ? '#22343f' : '#16232e';
    ctx.fill();
    ctx.strokeStyle = def.color;
    ctx.globalAlpha = opt.flooded ? 0.4 : 0.9;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.globalAlpha = 1;

    drawIcon(ctx, def.icon, cx, cy, size * 0.34, def.color);

    if (opt.flash > 0) {
      rr(ctx, cx - half, cy - half, size, size, 7);
      ctx.fillStyle = 'rgba(255,255,255,' + (opt.flash * 4) + ')';
      ctx.fill();
    }
    if (opt.augColor) {
      ctx.beginPath();
      ctx.arc(cx + half - 6, cy + half - 6, 2.6, 0, 6.283);
      ctx.fillStyle = opt.augColor;
      ctx.fill();
    }
    if (opt.boosted) {
      ctx.beginPath();
      ctx.arc(cx + half - 6, cy - half + 6, 2.6, 0, 6.283);
      ctx.fillStyle = '#8fd14f';
      ctx.fill();
    }
  }

  function drawModulesBuild(t, bob) {
    var st = C.computeStats(S.run);
    for (var r = 0; r < D.ROWS; r++) {
      for (var c = 0; c < D.COLS; c++) {
        var id = S.run.grid[C.idx(c, r)];
        if (!id) continue;
        var def = D.MODULES[id];
        var augKey = (S.run.moduleAug || {})[c + '_' + r];
        moduleVisual(g, def, D.RAFT_X + c * CELL + CELL / 2, D.RAFT_Y + r * CELL + CELL / 2 + bob, CELL - 10, {
          boosted: st.boost[r] && def.kind === 'weapon',
          augColor: augKey ? D.AUGMENTS[augKey].color : null
        });
      }
    }
  }

  function drawModulesBattle(b, bob) {
    for (var i = 0; i < b.modules.length; i++) {
      var m = b.modules[i];
      moduleVisual(g, m.def, m.x, m.y + bob, CELL - 10, {
        flash: m.flash,
        flooded: m.flooded,
        boosted: m.boosted && m.def.kind === 'weapon',
        augColor: m.aug ? m.aug.color : null
      });
    }
  }

  /* ================= 敌人 ================= */
  function drawEnemy(e, t) {
    var bob = Math.sin(t * 3 + e.bob) * 3;
    var x = e.x, y = e.y + bob;
    var col = e.def.color;

    g.save();
    g.translate(x, y);
    /* 从右舷来的敌人在向左走，要翻转朝向 */
    if (e.side === 'R') g.scale(-1, 1);

    /* 光晕 */
    var rad = g.createRadialGradient(0, 0, 2, 0, 0, e.r * 2.6);
    rad.addColorStop(0, hexA(col, 0.34));
    rad.addColorStop(1, hexA(col, 0));
    g.fillStyle = rad;
    g.beginPath(); g.arc(0, 0, e.r * 2.6, 0, 6.283); g.fill();

    var alpha = e.hit > 0 ? 0.55 : 1;
    g.globalAlpha = alpha;

    if (e.kind === 'bat') {
      var flap = Math.sin(t * 12 + e.bob) * 0.7;
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(-e.r * 2.2, -e.r * (1 + flap), -e.r * 2.6, e.r * 0.5);
      g.quadraticCurveTo(-e.r * 1.4, e.r * 0.2, 0, e.r * 0.4);
      g.closePath(); g.fill();
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(e.r * 2.2, -e.r * (1 + flap), e.r * 2.6, e.r * 0.5);
      g.quadraticCurveTo(e.r * 1.4, e.r * 0.2, 0, e.r * 0.4);
      g.closePath(); g.fill();
      g.beginPath(); g.arc(0, 0, e.r * 0.7, 0, 6.283); g.fill();
      g.fillStyle = '#0a1a22';
      g.beginPath(); g.arc(-2, 0, 1.6, 0, 6.283); g.fill();
      g.beginPath(); g.arc(3, 0, 1.6, 0, 6.283); g.fill();
    } else if (e.kind === 'diver') {
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(0, 0, e.r * 1.3, e.r * 0.78, 0, 0, 6.283);
      g.fill();
      g.beginPath();
      g.moveTo(-e.r * 1.2, 0);
      g.lineTo(-e.r * 2.1, -e.r * 0.7);
      g.lineTo(-e.r * 2.1, e.r * 0.7);
      g.closePath(); g.fill();
      g.fillStyle = '#0a1a22';
      g.beginPath(); g.arc(e.r * 0.55, -e.r * 0.15, 2.2, 0, 6.283); g.fill();
    } else if (e.kind === 'boss' || e.kind === 'eye') {
      /* 触手 */
      g.strokeStyle = col;
      g.lineWidth = 6;
      g.lineCap = 'round';
      g.globalAlpha = alpha * 0.85;
      for (var i = 0; i < 5; i++) {
        var a = -0.5 + i * 0.42;
        g.beginPath();
        g.moveTo(0, e.r * 0.5);
        g.quadraticCurveTo(
          Math.sin(t * 2 + i) * e.r * 0.7,
          e.r * (1.1 + 0.3 * Math.sin(t * 2.4 + i)),
          Math.sin(t * 1.6 + i * 2) * e.r * 1.0,
          e.r * (1.6 + 0.35 * Math.sin(t * 2 + i))
        );
        g.stroke();
      }
      g.globalAlpha = alpha;
      g.fillStyle = col;
      g.beginPath(); g.arc(0, 0, e.r, 0, 6.283); g.fill();
      g.fillStyle = 'rgba(0,0,0,.3)';
      g.beginPath(); g.arc(0, e.r * 0.25, e.r * 0.85, 0, 6.283); g.fill();
      g.fillStyle = '#fff3c4';
      g.beginPath(); g.arc(-e.r * 0.35, -e.r * 0.1, e.r * 0.2, 0, 6.283); g.fill();
      g.beginPath(); g.arc(e.r * 0.35, -e.r * 0.1, e.r * 0.2, 0, 6.283); g.fill();
      g.fillStyle = '#2a0b14';
      g.beginPath(); g.arc(-e.r * 0.35, -e.r * 0.1, e.r * 0.09, 0, 6.283); g.fill();
      g.beginPath(); g.arc(e.r * 0.35, -e.r * 0.1, e.r * 0.09, 0, 6.283); g.fill();
    } else if (e.kind === 'eel') {
      g.strokeStyle = col;
      g.lineWidth = e.r * 0.8;
      g.lineCap = 'round';
      g.beginPath();
      for (var seg = 0; seg <= 6; seg++) {
        var px = -e.r * 1.8 + seg * (e.r * 0.6);
        var py = Math.sin(t * 9 + seg * 0.9 + e.bob) * e.r * 0.5;
        if (seg === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.stroke();
      g.fillStyle = col;
      g.beginPath(); g.arc(e.r * 1.1, 0, e.r * 0.85, 0, 6.283); g.fill();
      g.fillStyle = '#0a1a22';
      g.beginPath(); g.arc(e.r * 1.35, -e.r * 0.15, e.r * 0.2, 0, 6.283); g.fill();
    } else if (e.kind === 'shade') {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, -e.r * 1.4);
      g.quadraticCurveTo(e.r * 1.15, -e.r * 0.2, e.r * 0.95, e.r * 0.95);
      g.quadraticCurveTo(0, e.r * 0.55, -e.r * 0.95, e.r * 0.95);
      g.quadraticCurveTo(-e.r * 1.15, -e.r * 0.2, 0, -e.r * 1.4);
      g.closePath();
      g.globalAlpha = alpha * 0.9;
      g.fill();
      g.globalAlpha = alpha;
      g.fillStyle = '#cfe9ff';
      g.beginPath(); g.arc(e.r * 0.32, -e.r * 0.35, e.r * 0.16, 0, 6.283); g.fill();
      g.beginPath(); g.arc(e.r * 0.72, -e.r * 0.35, e.r * 0.16, 0, 6.283); g.fill();
    } else if (e.kind === 'crab') {
      g.strokeStyle = col;
      g.lineWidth = e.r * 0.22;
      g.lineCap = 'round';
      for (var lg = -1; lg <= 1; lg++) {
        if (lg === 0) continue;
        g.beginPath();
        g.moveTo(lg * e.r * 0.8, e.r * 0.3);
        g.lineTo(lg * e.r * 1.35, e.r * 0.9);
        g.stroke();
      }
      g.fillStyle = col;
      g.beginPath(); g.ellipse(0, e.r * 0.15, e.r * 1.15, e.r * 0.78, 0, 0, 6.283); g.fill();
      g.lineWidth = e.r * 0.3;
      g.beginPath();
      g.moveTo(-e.r * 0.85, -e.r * 0.1); g.lineTo(-e.r * 1.45, -e.r * 0.75);
      g.moveTo(e.r * 0.85, -e.r * 0.1); g.lineTo(e.r * 1.45, -e.r * 0.75);
      g.stroke();
      g.fillStyle = '#0a1a22';
      g.beginPath(); g.arc(-e.r * 0.3, -e.r * 0.45, e.r * 0.16, 0, 6.283); g.fill();
      g.beginPath(); g.arc(e.r * 0.3, -e.r * 0.45, e.r * 0.16, 0, 6.283); g.fill();
    } else {
      /* 漂流者 / 甲壳兽 / 掠夺艇 —— 通用软体 */
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(0, 0, e.r * 1.25, e.r * 0.95, 0, 0, 6.283);
      g.fill();
      g.beginPath();
      g.moveTo(-e.r * 0.2, -e.r * 0.9);
      g.lineTo(0, -e.r * 1.6);
      g.lineTo(e.r * 0.5, -e.r * 0.8);
      g.closePath(); g.fill();
      if (e.kind === 'shellback') {
        g.strokeStyle = 'rgba(0,0,0,.35)';
        g.lineWidth = 2;
        for (var j = -1; j <= 1; j++) {
          g.beginPath();
          g.arc(0, 0, e.r * (0.55 + j * 0.22), -0.4, Math.PI + 0.4);
          g.stroke();
        }
      }
      if (e.kind === 'raider') {
        g.fillStyle = '#3a1f1c';
        g.fillRect(-e.r * 1.1, -e.r * 1.7, 4, e.r * 1.6);
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(e.r * 1.1, -e.r * 1.6);
        g.lineTo(e.r * 1.9, -e.r * 0.6);
        g.lineTo(e.r * 1.1, -e.r * 0.6);
        g.closePath(); g.fill();
      }
      g.fillStyle = '#f7f2d8';
      g.beginPath(); g.arc(e.r * 0.35, -e.r * 0.2, e.r * 0.28, 0, 6.283); g.fill();
      g.fillStyle = '#101c22';
      g.beginPath(); g.arc(e.r * 0.42, -e.r * 0.2, e.r * 0.14, 0, 6.283); g.fill();
    }

    g.globalAlpha = 1;
    g.restore();

    /* 血条 */
    if (e.hp < e.maxHp) {
      var bw = e.def.boss ? 96 : Math.max(26, e.r * 2.4);
      var bx = x - bw / 2, by = y - e.r - (e.def.boss ? 26 : 13);
      g.fillStyle = 'rgba(0,0,0,.55)';
      g.fillRect(bx - 1, by - 1, bw + 2, 5);
      g.fillStyle = e.def.boss ? '#e0577f' : '#7fe0b0';
      g.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 3);
    }

    /* 咬合提示 */
    if (e.latched) {
      g.save();
      g.globalAlpha = 0.5 + 0.4 * Math.sin(t * 16);
      g.strokeStyle = '#ff8b6b';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, e.r + 6, 0, 6.283);
      g.stroke();
      g.restore();
    }
  }

  /* ================= 特效 ================= */
  function drawFx(b) {
    var i, p;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (i = 0; i < b.tracers.length; i++) {
      var tr = b.tracers[i];
      var a = tr.life / tr.max;
      g.globalAlpha = a;
      g.strokeStyle = tr.color;
      g.lineWidth = tr.w;
      g.beginPath();
      if (tr.arc) {
        var mx0 = (tr.x1 + tr.x2) / 2;
        var my0 = Math.min(tr.y1, tr.y2) - 18;
        g.moveTo(tr.x1, tr.y1);
        g.quadraticCurveTo(mx0, my0, tr.x2, tr.y2);
      } else {
        g.moveTo(tr.x1, tr.y1);
        g.lineTo(tr.x2, tr.y2);
      }
      g.stroke();
    }
    for (i = 0; i < b.blasts.length; i++) {
      var bl = b.blasts[i];
      var k = 1 - bl.life / bl.max;
      g.globalAlpha = (1 - k) * 0.55;
      g.strokeStyle = bl.color;
      g.lineWidth = 2.5 * (1 - k) + 0.6;
      g.beginPath();
      g.arc(bl.x, bl.y, bl.r * (0.35 + k * 0.9), 0, 6.283);
      g.stroke();
    }
    g.restore();

    for (i = 0; i < b.particles.length; i++) {
      p = b.particles[i];
      g.globalAlpha = Math.max(0, p.life / p.max);
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, 6.283);
      g.fill();
    }
    g.globalAlpha = 1;

    for (i = 0; i < b.texts.length; i++) {
      var tx = b.texts[i];
      g.globalAlpha = Math.min(1, tx.life / tx.max * 2.2);
      g.font = '700 ' + tx.size + 'px "Microsoft YaHei", sans-serif';
      g.textAlign = 'center';
      g.fillStyle = 'rgba(0,0,0,.55)';
      g.fillText(tx.text, tx.x + 1, tx.y + 1);
      g.fillStyle = tx.color;
      g.fillText(tx.text, tx.x, tx.y);
    }
    g.globalAlpha = 1;
    g.textAlign = 'left';
  }

  /* ================= 建造提示 ================= */
  function drawBuildHints(t, waterY) {
    var x = D.RAFT_X, y = D.RAFT_Y;

    /* 网格 */
    g.save();
    g.strokeStyle = 'rgba(150,210,235,.10)';
    g.lineWidth = 1;
    for (var c = 0; c <= D.COLS; c++) {
      g.beginPath(); g.moveTo(x + c * CELL, y); g.lineTo(x + c * CELL, y + D.RAFT_H); g.stroke();
    }
    for (var r = 0; r <= D.ROWS; r++) {
      g.beginPath(); g.moveTo(x, y + r * CELL); g.lineTo(x + D.RAFT_W, y + r * CELL); g.stroke();
    }

    /* 未加固的列 */
    for (var lc = 0; lc < D.COLS; lc++) {
      if (C.isUnlocked(S.run, lc)) continue;
      var lx = x + lc * CELL;
      var e = C.expandDef(lc);
      var canBuy = C.canExpand(S.run, lc) === null;
      g.save();
      g.beginPath();
      g.rect(lx, y, CELL, D.RAFT_H);
      g.clip();
      g.fillStyle = 'rgba(4,9,14,.80)';
      g.fillRect(lx, y, CELL, D.RAFT_H);
      g.strokeStyle = 'rgba(120,160,180,.13)';
      g.lineWidth = 1;
      for (var dg = -D.RAFT_H; dg < CELL; dg += 13) {
        g.beginPath();
        g.moveTo(lx + dg, y + D.RAFT_H);
        g.lineTo(lx + dg + D.RAFT_H, y);
        g.stroke();
      }
      g.restore();

      g.save();
      g.textAlign = 'center';
      g.font = '11px "Microsoft YaHei", sans-serif';
      g.fillStyle = canBuy ? '#8ff0c4' : '#456575';
      g.fillText('加固', lx + CELL / 2, y + D.RAFT_H / 2 - 12);
      g.font = '700 13px "Microsoft YaHei", sans-serif';
      g.fillStyle = canBuy ? '#ffcf8a' : '#456575';
      g.fillText(e ? e.cost : '', lx + CELL / 2, y + D.RAFT_H / 2 + 8);
      g.restore();
      g.textAlign = 'left';
    }

    /* 选中模块时的可放置高亮 */
    if (S.sel) {
      var def = D.MODULES[S.sel];
      var pulse = 0.10 + 0.06 * Math.sin(t * 4);
      for (var cc = 0; cc < D.COLS; cc++) {
        var ok = C.canPlace(S.run, S.sel, cc, def.row) === null;
        var row = def.row >= 0 ? def.row : 0;
        if (def.row < 0) continue;
        g.fillStyle = ok ? 'rgba(130,230,180,' + pulse + ')' : 'rgba(220,90,70,.05)';
        g.fillRect(x + cc * CELL + 2, y + row * CELL + 2, CELL - 4, CELL - 4);
      }
      /* 覆盖范围（跟随鼠标列） */
      if (S.hoverCell) {
        var hc = S.hoverCell.col, hr = def.row >= 0 ? def.row : S.hoverCell.row;
        var cx = x + hc * CELL + CELL / 2;
        var reach = ((def.range || 0) + C.computeStats(S.run).rangeBonus) * CELL;
        if (reach > 0) {
          g.fillStyle = 'rgba(255,220,150,.10)';
          g.fillRect(cx - reach, y + hr * CELL, reach * 2, CELL);
          g.strokeStyle = 'rgba(255,220,150,.35)';
          g.setLineDash([5, 5]);
          g.strokeRect(cx - reach, y + hr * CELL, reach * 2, CELL);
          g.setLineDash([]);
          /* 两端箭头 */
          g.fillStyle = 'rgba(255,220,150,.5)';
          [-1, 1].forEach(function (sgn) {
            var ax = cx + sgn * reach;
            g.beginPath();
            g.moveTo(ax, y + hr * CELL + CELL / 2);
            g.lineTo(ax - sgn * 9, y + hr * CELL + CELL / 2 - 6);
            g.lineTo(ax - sgn * 9, y + hr * CELL + CELL / 2 + 6);
            g.closePath(); g.fill();
          });
        }
      }
    }

    /* 悬停格 */
    if (S.hoverCell) {
      g.strokeStyle = S.sel ? 'rgba(255,220,150,.75)' : 'rgba(150,210,235,.5)';
      g.lineWidth = 2;
      g.strokeRect(x + S.hoverCell.col * CELL + 1, y + S.hoverCell.row * CELL + 1, CELL - 2, CELL - 2);
    }
    g.restore();
  }

  /* 水位罩：让木筏看起来是浮在水里 */
  function drawWaterOverlay(waterY, tide, bob) {
    var bottom = D.RAFT_Y + D.RAFT_H + 22;
    if (waterY >= bottom) return;
    g.save();
    g.globalAlpha = 0.17;
    g.fillStyle = '#12657f';
    g.fillRect(D.RAFT_X - 16, waterY + bob, D.RAFT_W + 32, bottom - waterY);
    g.globalAlpha = 0.55;
    g.strokeStyle = '#a8ecff';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(D.RAFT_X - 16, waterY + bob);
    g.lineTo(D.RAFT_X + D.RAFT_W + 16, waterY + bob);
    g.stroke();
    g.restore();

    /* 进水提示 */
    if (tide >= 1) {
      g.save();
      g.globalAlpha = 0.55 + 0.35 * Math.sin(Date.now() / 180);
      g.font = '700 15px "Microsoft YaHei", sans-serif';
      g.fillStyle = '#ff8b6b';
      g.textAlign = 'center';
      g.fillText('满潮进水！快清场', W / 2, waterY - 16);
      g.restore();
      g.textAlign = 'left';
    }
  }

  /* Boss 血条：带阶段刻度 */
  function drawBossBar(b) {
    var boss = null;
    for (var i = 0; i < b.enemies.length; i++) {
      if (b.enemies[i].def.boss && !b.enemies[i].dead) { boss = b.enemies[i]; break; }
    }
    if (!boss) return;

    var barW = 520, barH = 13;
    var x = (W - barW) / 2, y = H - 52;
    var frac = Math.max(0, boss.hp / boss.maxHp);

    g.save();
    g.fillStyle = 'rgba(4,10,16,.78)';
    rr(g, x - 10, y - 26, barW + 20, 52, 10);
    g.fill();

    g.fillStyle = '#0a1721';
    rr(g, x, y, barW, barH, 6);
    g.fill();

    var grd = g.createLinearGradient(x, 0, x + barW, 0);
    grd.addColorStop(0, boss.def.color);
    grd.addColorStop(1, '#c85fd0');
    g.fillStyle = grd;
    if (frac > 0.001) { rr(g, x, y, Math.max(6, barW * frac), barH, 6); g.fill(); }

    (boss.def.phases || []).forEach(function (ph) {
      var px = x + barW * ph.at;
      g.strokeStyle = 'rgba(255,255,255,.6)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(px, y - 3);
      g.lineTo(px, y + barH + 3);
      g.stroke();
    });

    g.fillStyle = '#ffd9e4';
    g.font = '700 13px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center';
    g.fillText(boss.def.name + '   ' + Math.round(frac * 100) + '%', W / 2, y - 8);
    g.restore();
    g.textAlign = 'left';
  }

  /* 两侧来袭箭头 */
  function drawSideArrows(p, t) {
    if (S.phase !== 'build') return;
    var sides = p.sides || [];
    var pulse = 0.62 + 0.3 * Math.sin(t * 3);

    function arrow(side) {
      var ax = side === 'L' ? 44 : W - 44;
      var dir = side === 'L' ? 1 : -1;
      g.save();
      g.globalAlpha = pulse;
      g.translate(ax, H * 0.52);
      g.fillStyle = '#ff9c6b';
      g.beginPath();
      g.moveTo(22 * dir, 0);
      g.lineTo(-10 * dir, -18);
      g.lineTo(-10 * dir, 18);
      g.closePath();
      g.fill();
      g.restore();
      g.save();
      g.globalAlpha = 0.7;
      g.font = '700 13px "Microsoft YaHei", sans-serif';
      g.fillStyle = '#ff9c6b';
      g.textAlign = 'center';
      g.fillText(side === 'L' ? '左舷' : '右舷', ax, H * 0.52 + 42);
      g.restore();
      g.textAlign = 'left';
    }
    sides.forEach(arrow);
  }

  /* ================= 主绘制 ================= */
  function draw(t) {
    var inBattle = S.battle && S.phase !== 'build';
    var b = inBattle ? S.battle : null;
    var waterY = b ? b.waterY : D.WATER_LOW;

    g.clearRect(0, 0, W, H);
    g.save();
    if (b && b.shake > 0.2) {
      g.translate((Math.random() - 0.5) * b.shake, (Math.random() - 0.5) * b.shake);
    }

    drawSky(t);
    drawRuins(t, waterY);
    drawSea(t, waterY);

    var bob = drawRaft(t, waterY);
    /* 未加固的列在战斗里也要看出是断的 */
    for (var lc2 = 0; lc2 < D.COLS; lc2++) {
      if (C.isUnlocked(S.run, lc2)) continue;
      g.fillStyle = 'rgba(3,8,13,.42)';
      g.fillRect(D.RAFT_X + lc2 * CELL, D.RAFT_Y + bob, CELL, D.RAFT_H);
    }

    if (b) {
      drawModulesBattle(b, bob);
    } else {
      drawModulesBuild(t, bob);
      drawBuildHints(t, waterY);
    }

    if (b) {
      for (var i = 0; i < b.enemies.length; i++) drawEnemy(b.enemies[i], t);
      drawFx(b);
    }

    drawWaterOverlay(waterY, b ? b.tide : 0, bob);
    if (b) drawBossBar(b);

    g.restore();

    /* 暗角 */
    var vg = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);

    /* 建造阶段的来袭方向 */
    if (!b) {
      /* previewOf().sides 是给人看的字符串，箭头要用数组 */
      drawSideArrows({ sides: S.run.plan ? S.run.plan.sides : [] }, t);
    }

    /* 战斗中顶部血迹 */
    if (b) {
      var hpRatio = clamp(b.hp / b.maxHp, 0, 1);
      if (hpRatio < 0.35) {
        var red = g.createLinearGradient(0, 0, 0, H);
        red.addColorStop(0, 'rgba(180,40,30,' + ((0.35 - hpRatio) * 1.3) + ')');
        red.addColorStop(0.5, 'rgba(180,40,30,0)');
        g.fillStyle = red;
        g.fillRect(0, 0, W, H);
      }
    }
  }

  /* ================= UI ================= */
  var CARD_ELS = {};

  function hasFreeSlot(id) {
    var def = D.MODULES[id];
    for (var c = 0; c < D.COLS; c++) {
      if (!C.isUnlocked(S.run, c)) continue;
      if (def.row < 0) {
        for (var r = 0; r < D.ROWS; r++) if (!S.run.grid[C.idx(c, r)]) return true;
      } else if (!S.run.grid[C.idx(c, def.row)]) return true;
    }
    return false;
  }

  function buildPalette() {
    var pal = $('palette');
    pal.innerHTML = '';
    D.ORDER.forEach(function (id) {
      var def = D.MODULES[id];
      var btn = document.createElement('button');
      btn.className = 'card';
      btn.dataset.id = id;
      btn.innerHTML = '<span class="badge"></span>' +
        '<canvas width="34" height="34"></canvas>' +
        '<span class="nm">' + def.name + '</span>' +
        '<span class="cost"></span>';
      pal.appendChild(btn);
      var ic = btn.querySelector('canvas');
      var ictx = ic.getContext('2d');
      drawIcon(ictx, def.icon, 17, 17, 11, def.color);
      CARD_ELS[id] = btn;
      btn.addEventListener('click', function () { pickModule(id); });
    });
  }

  function pickModule(id) {
    if (S.phase !== 'build') return;
    var def = D.MODULES[id];
    if (!hasFreeSlot(id)) { toast(def.name + ' 没有空位了'); return; }
    if (C.costOf(S.run, id) > S.run.wood) { toast('木材不足（需要 ' + def.cost + '）'); return; }
    S.sel = (S.sel === id) ? null : id;
    syncUI();
  }

  function syncUI() {
    var run = S.run;
    var st = C.computeStats(run);
    $('sWave').textContent = Math.min(run.wave, D.MAX_WAVE) + ' / ' + D.MAX_WAVE;
    $('sWood').textContent = run.wood;

    var hp = S.phase === 'battle' && S.battle ? S.battle.hp : run.hp;
    var maxHp = S.phase === 'battle' && S.battle ? S.battle.maxHp : st.maxHp;
    $('sHp').textContent = Math.round(hp) + ' / ' + maxHp;
    var pct = clamp(hp / maxHp, 0, 1) * 100;
    var bar = $('hpBar');
    bar.firstElementChild.style.width = pct + '%';
    bar.classList.toggle('low', pct < 40);

    $('phaseTag').textContent = S.phase === 'battle' ? '迎战' : (S.phase === 'ending' ? '结算' : '建造');

    /* 手牌 */
    D.ORDER.forEach(function (id) {
      var btn = CARD_ELS[id];
      if (!btn) return;
      var def = D.MODULES[id];
      var stock = run.stock[id] || 0;
      var cost = C.costOf(run, id);
      var badge = btn.querySelector('.badge');
      var costEl = btn.querySelector('.cost');
      if (stock > 0) {
        badge.textContent = '×' + stock;
        badge.classList.add('on');
        costEl.textContent = '库存';
        costEl.classList.add('free');
      } else {
        badge.classList.remove('on');
        costEl.textContent = def.cost;
        costEl.classList.remove('free');
      }
      var off = (cost > run.wood) || !hasFreeSlot(id) || S.phase !== 'build';
      btn.classList.toggle('off', off);
      btn.classList.toggle('selected', S.sel === id);
    });

    /* 按钮 */
    $('btnTide').style.display = S.phase === 'build' ? '' : 'none';
    $('btnDive').style.display = S.phase === 'build' ? '' : 'none';
    $('btnSpeed').style.display = S.phase === 'battle' ? '' : 'none';
    $('btnSpeed').textContent = S.speed + '×';
    $('btnDive').disabled = run.dived || S.phase !== 'build';
    $('btnDive').textContent = run.dived ? '已下潜' : '下潜 +25木';
    cv.classList.toggle('placing', !!S.sel && S.phase === 'build');
    var tb = S.battle && S.phase !== 'build' ? S.battle.tide : 0;
    $('tideFill').style.width = Math.round(tb * 100) + '%';
    renderAugbar();
    updatePreview();
  }

  function updatePreview() {
    var el = $('preview');
    if (!S.started) { el.textContent = ''; return; }
    if (S.phase === 'build' && S.run.plan) {
      var pv = D.previewOf(S.run.plan);
      var lanes = { surface: 0, air: 0, under: 0 };
      S.run.plan.spawns.forEach(function (s) { lanes[D.ENEMIES[s.kind].lane]++; });
      var laneTxt = [];
      if (lanes.surface) laneTxt.push('海面 ' + lanes.surface);
      if (lanes.air) laneTxt.push('空中 ' + lanes.air);
      if (lanes.under) laneTxt.push('水下 ' + lanes.under);
      var modLine = pv.mod
        ? '<div class="warn">词条 · ' + pv.mod.name + '：' + pv.mod.desc + '</div>'
        : '<div class="k">本波无词条</div>';
      var rl = S.run.relics || [];
      var relicLine = rl.length
        ? '<div style="color:#f2e06b">遗物：' + rl.map(function (k) { return D.RELICS[k].name; }).join(' · ') + '</div>'
        : '';
      var shipName = D.SHIPS[S.run.ship] ? D.SHIPS[S.run.ship].name : '';
      var stx = C.computeStats(S.run);
      var tagParts = [];
      D.TAG_ORDER.forEach(function (k) {
        var n = stx.tags[k] || 0;
        if (!n) return;
        var t = D.TAGS[k];
        var on = n >= t.t2;
        tagParts.push('<span style="color:' + (on ? t.color : '#4a6a7a') + '">' +
          t.name + ' ' + n + (n >= t.t4 ? '★' : '') + '</span>');
      });
      var bossLine = pv.hint ? '<div class="warn">⚠ ' + pv.hint + '</div>' : '';
      var ctLine = S.run.contract ? '<div style="color:#8ff0c4">契约 · ' + S.run.contract.name + '：' + S.run.contract.desc + '</div>' : '';
      var mutLine = S.run.mut
        ? '<div style="color:#b48ce0">异变 · ' + S.run.mut.name + '：' + S.run.mut.desc + '</div>'
        : '';
      var ascLine = (S.run.asc || 0) > 0
        ? '<div class="warn">潮汐刻度 ' + S.run.asc + ' · ' + D.ASC_NAME[S.run.asc] + '</div>'
        : '';
      el.innerHTML =
        '<div><span class="k">第 ' + S.run.wave + ' 次潮汐</span> · <b>' + pv.sides + '</b>' +
        '<span style="color:#5f8ea4"> 《' + shipName + '》</span></div>' +
        '<div class="k">来袭：' + pv.text + '</div>' +
        '<div class="k">泳道：' + laneTxt.join(' · ') + '</div>' + modLine + relicLine +
        (tagParts.length ? '<div class="k">羁绊：' + tagParts.join(' · ') + '</div>' : '') +
        ascLine + bossLine + ctLine + mutLine;
    } else if (S.battle) {
      var mb = S.battle.mod ? ' · <span class="warn">' + S.battle.mod.name + '</span>' : '';
      el.innerHTML =
        '<div><span class="k">第 ' + S.battle.wave + ' 次潮汐</span> · 剩 ' + S.battle.enemies.length + ' 敌' + mb + '</div>' +
        '<div class="k">击杀 ' + S.battle.killed + ' · 潮位 ' + Math.round(S.battle.tide * 100) + '%</div>';
    } else {
      el.innerHTML = '';
    }
  }

  /* ================= 改装件 ================= */
  function drawAugIcon(ctx, cx, cy, s, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.72, 0, 6.283);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.08, -s * 0.45);
    ctx.lineTo(-s * 0.22, s * 0.08);
    ctx.lineTo(s * 0.12, s * 0.08);
    ctx.lineTo(-s * 0.08, s * 0.5);
    ctx.stroke();
    ctx.restore();
  }

  var augSig = '';
  function renderAugbar() {
    var list = S.run.augments || [];
    var sig = list.join(',') + '|' + (S.selAug || '') + '|' + S.phase;
    if (sig === augSig) return;
    augSig = sig;
    var bar = $('augbar');
    if (!list.length) {
      bar.classList.remove('on');
      bar.innerHTML = '';
      return;
    }
    bar.classList.add('on');
    var html = '<span class="lbl">改装件</span>';
    list.forEach(function (id) {
      var a = D.AUGMENTS[id];
      html += '<button class="augchip' + (S.selAug === id ? ' on' : '') + '" data-aug="' + id + '" title="' +
        a.desc + '">' + '<canvas width="20" height="20"></canvas><span>' + a.name + '</span></button>';
    });
    html += '<span style="font-size:11px;color:#3f6678;margin-left:6px">选中后点一台武器挂上去</span>';
    bar.innerHTML = html;
    Array.prototype.forEach.call(bar.querySelectorAll('.augchip'), function (el) {
      var id = el.dataset.aug;
      drawAugIcon(el.querySelector('canvas').getContext('2d'), 10, 10, 8, D.AUGMENTS[id].color);
      el.addEventListener('click', function () {
        if (S.phase !== 'build') return;
        S.selAug = (S.selAug === id) ? null : id;
        syncUI();
      });
    });
  }

  /* ================= 提示气泡 ================= */
  function updateTip() {
    var tip = $('tip');
    if (S.phase !== 'build' || !S.hoverCell) { tip.classList.remove('on'); return; }
    var cell = S.hoverCell;
    var id = S.run.grid[C.idx(cell.col, cell.row)];
    var html = '';
    if (!C.isUnlocked(S.run, cell.col)) {
      var e = C.expandDef(cell.col);
      var reason = C.canExpand(S.run, cell.col);
      html = '<div class="tn" style="color:#8ff0c4">加固甲板 · 第 ' + (cell.col + 1) + ' 列</div>' +
        '<div class="td">多 3 个格子，耐久上限 +' + (e ? e.hp : 0) + '</div>' +
        '<div class="tc">' + (e ? e.cost + ' 木材' : '') + (reason ? ' · ' + reason : ' · 点击加固') + '</div>';
    } else if (id) {
      var def = D.MODULES[id];
      var augOn = (S.run.moduleAug || {})[cell.col + '_' + cell.row];
      var augTxt = augOn
        ? '<div style="color:' + D.AUGMENTS[augOn].color + '">改装 · ' + D.AUGMENTS[augOn].name +
          '：' + D.AUGMENTS[augOn].desc + '</div>'
        : '';
      html = '<div class="tn" style="color:' + def.color + '">' + def.name + '</div>' +
        '<div class="td">' + def.desc + '</div>' + augTxt +
        '<div class="tc">点击拆除（回收 ' + Math.floor(def.cost * 0.5) + ' 木材，改装件退回）</div>';
    } else if (S.sel) {
      var d2 = D.MODULES[S.sel];
      html = '<div class="tn" style="color:' + d2.color + '">放置：' + d2.name + '</div>' +
        '<div class="td">' + d2.desc + '</div>' +
        '<div class="tc">' + D.ROW_NAME[d2.row >= 0 ? d2.row : cell.row] + ' · 花费 ' +
        (C.costOf(S.run, S.sel) === 0 ? '库存' : C.costOf(S.run, S.sel)) + '</div>';
    }
    if (!html) { tip.classList.remove('on'); return; }
    tip.innerHTML = html;
    tip.classList.add('on');
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var px = clamp(S.mouse.x + 18, 8, window.innerWidth - tw - 8);
    var py = clamp(S.mouse.y - th - 14, 8, window.innerHeight - th - 8);
    tip.style.left = px + 'px';
    tip.style.top = py + 'px';
  }

  /* ================= 画布交互 ================= */
  function toCanvas(ev) {
    var r = cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H };
  }

  function cellAt(px, py) {
    var c = Math.floor((px - D.RAFT_X) / CELL);
    var r = Math.floor((py - D.RAFT_Y) / CELL);
    if (c < 0 || c >= D.COLS || r < 0 || r >= D.ROWS) return null;
    return { col: c, row: r };
  }

  cv.addEventListener('mousemove', function (ev) {
    var p = toCanvas(ev);
    S.mouse.x = ev.clientX;
    S.mouse.y = ev.clientY;
    S.hoverCell = cellAt(p.x, p.y);
    updateTip();
  });

  cv.addEventListener('mouseleave', function () {
    S.hoverCell = null;
    $('tip').classList.remove('on');
  });

  cv.addEventListener('contextmenu', function (ev) {
    ev.preventDefault();
    S.sel = null;
    syncUI();
  });

  cv.addEventListener('click', function (ev) {
    if (S.phase !== 'build') return;
    var p = toCanvas(ev);
    var cell = cellAt(p.x, p.y);
    if (!cell) { S.sel = null; syncUI(); return; }

    if (!C.isUnlocked(S.run, cell.col)) {
      var errE = C.expand(S.run, cell.col);
      if (errE) { toast(errE); return; }
      toast('加固成功：多了 3 个格子');
      syncUI();
      return;
    }

    if (S.selAug) {
      var augId = S.selAug;
      var targetId = S.run.grid[C.idx(cell.col, cell.row)];
      if (!targetId) { toast('点一台武器来挂改装'); return; }
      var aerr = C.applyAug(S.run, augId, cell.col, cell.row);
      if (aerr) { toast(aerr); return; }
      toast('改装完成：' + D.AUGMENTS[augId].name);
      S.selAug = null;
      syncUI();
      return;
    }

    var id = S.run.grid[C.idx(cell.col, cell.row)];

    if (S.sel) {
      if (id) { toast('这一格已经有东西了'); return; }
      var err = C.place(S.run, S.sel, cell.col, cell.row);
      if (err) { toast(err); return; }
      if (C.costOf(S.run, S.sel) > S.run.wood) S.sel = null;
      syncUI();
      return;
    }

    if (id) {
      var refund = C.sell(S.run, cell.col, cell.row);
      toast('拆除 ' + D.MODULES[id].name + '，回收 ' + refund + ' 木材');
      syncUI();
    }
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') { S.sel = null; syncUI(); }
    if (ev.key === ' ') {
      ev.preventDefault();
      if (S.phase === 'build') beginBattle();
    }
  });

  /* ================= 流程 ================= */
  function closeModal() { $('modal').classList.add('hidden'); }
  function openModal(html) {
    $('modalBox').innerHTML = html;
    $('modal').classList.remove('hidden');
  }

  function beginBattle() {
    if (S.phase !== 'build' || !S.started) return;
    var weapons = C.cellsOf(S.run).filter(function (x) { return x.def.kind === 'weapon'; });
    if (weapons.length === 0) { toast('至少放一门武器再开战'); return; }
    S.sel = null;
    S.battle = C.startBattle(S.run);
    S.phase = 'battle';
    S.speed = 1;
    syncUI();
  }

  function resolveBattle() {
    var b = S.battle;
    if (b.result === 'lost') { S.phase = 'gameover'; showGameOver(); return; }

    var cleared = S.run.wave;
    var gain = C.afterWave(S.run, b);
    S.run.kills += b.killed;

    if (cleared >= D.MAX_WAVE) { S.phase = 'victory'; showVictory(); return; }

    S.route = {
      options: D.makeRoute(S.run, Math.random),
      wood: gain.wood,
      heal: gain.heal,
      cleared: cleared,
      kills: b.killed
    };

    /* 第一幕结束：给一次「收手还是下潜」的选择 */
    if (cleared === D.ACT1_END) {
      S.phase = 'act';
      showActChoice();
      return;
    }

    S.phase = 'route';
    showRoute();
  }

  function rewardText(r) {
    if (!r) return '无奖励';
    if (r.type === 'module') return '模块 · ' + D.MODULES[r.id].name;
    if (r.type === 'upgrade') return '改造 · ' + D.UPGRADES[r.id].name;
    if (r.type === 'relic') return '遗物 · ' + D.RELICS[r.id].name;
    if (r.type === 'augment') return '改装 · ' + D.AUGMENTS[r.id].name;
    if (r.type === 'wood') return '木材 +' + r.amt;
    if (r.type === 'repair') return '修复 +' + r.amt;
    return '';
  }

  function routeIconFor(r) {
    if (!r) return 'none';
    if (r.type === 'module') return r.id;
    if (r.type === 'relic') return 'relic';
    if (r.type === 'augment') return 'augment';
    if (r.type === 'upgrade') return 'upgrade';
    return r.type;
  }

  var TONE = { safe: '#86e0b0', mid: '#7fc8e8', risk: '#ffcf8a', elite: '#ff8b6b', event: '#b48ce0' };

  function routeCardHTML(opt, i) {
    var tone = TONE[opt.tone] || '#9dc4d6';
    return '<div class="pick" data-i="' + i + '">' +
      '<span class="pt" style="color:' + tone + ';border-color:' + tone + '">' + opt.tag + '</span>' +
      '<canvas data-icon="' + routeIconFor(opt.reward) + '" width="44" height="44"></canvas>' +
      '<div class="pn" style="color:' + tone + '">' + opt.name + '</div>' +
      '<div class="pd">' + opt.desc + '<br><span style="color:#e8c07a">' + rewardText(opt.reward) + '</span></div>' +
      '</div>';
  }

  function showRoute() {
    var r = S.route;
    var html = '<h2>第 ' + r.cleared + ' 次潮汐 · 退去</h2>' +
      '<div class="sub">击杀 ' + r.kills + ' · 木材 +' + r.wood + ' · 修复 +' + r.heal + '</div>' +
      '<p>下一次潮汐已经在酝酿。<span class="hl">你要迎哪一场？</span></p>' +
      '<div class="picks">' + r.options.map(routeCardHTML).join('') + '</div>' +
      '<p class="hintline">难度越高，奖励越好 —— 但你只能选一场。</p>';
    openModal(html);
    Array.prototype.forEach.call(document.querySelectorAll('.pick'), function (el) {
      el.addEventListener('click', function () { pickRoute(parseInt(el.dataset.i, 10)); });
    });
    paintPickIcons();
  }

  function paintPickIcons() {
    Array.prototype.forEach.call(document.querySelectorAll('.pick canvas'), function (cnv) {
      var key = cnv.dataset.icon;
      var ictx = cnv.getContext('2d');
      var i;
      if (key === 'wood') {
        ictx.fillStyle = '#a97b46';
        rr(ictx, 8, 14, 28, 12, 3); ictx.fill();
        ictx.fillStyle = '#c99a5e';
        rr(ictx, 12, 18, 28, 12, 3); ictx.fill();
      } else if (key === 'repair') {
        ictx.strokeStyle = '#86e0b0';
        ictx.lineWidth = 3;
        ictx.beginPath();
        ictx.moveTo(22, 8); ictx.lineTo(22, 36);
        ictx.moveTo(8, 22); ictx.lineTo(36, 22);
        ictx.stroke();
      } else if (key === 'relic') {
        ictx.fillStyle = '#f2e06b';
        ictx.beginPath();
        ictx.moveTo(22, 6); ictx.lineTo(34, 22); ictx.lineTo(22, 38); ictx.lineTo(10, 22);
        ictx.closePath(); ictx.fill();
        ictx.fillStyle = '#0f1e2a';
        ictx.beginPath();
        ictx.moveTo(22, 14); ictx.lineTo(28, 22); ictx.lineTo(22, 30); ictx.lineTo(16, 22);
        ictx.closePath(); ictx.fill();
      } else if (key === 'upgrade') {
        ictx.strokeStyle = '#f2e06b';
        ictx.lineWidth = 2.4;
        ictx.beginPath();
        ictx.arc(22, 22, 9, 0, Math.PI * 2);
        ictx.stroke();
        for (i = 0; i < 6; i++) {
          var ang = i * Math.PI / 3;
          ictx.beginPath();
          ictx.moveTo(22 + Math.cos(ang) * 10, 22 + Math.sin(ang) * 10);
          ictx.lineTo(22 + Math.cos(ang) * 15, 22 + Math.sin(ang) * 15);
          ictx.stroke();
        }
      } else if (key === 'augment') {
        drawAugIcon(ictx, 22, 22, 13, '#f2e06b');
      } else if (key === 'ship') {
        ictx.strokeStyle = '#9dc4d6';
        ictx.lineWidth = 2.4;
        ictx.beginPath();
        ictx.moveTo(5, 27); ictx.lineTo(39, 27); ictx.lineTo(32, 37); ictx.lineTo(12, 37);
        ictx.closePath(); ictx.stroke();
        ictx.beginPath(); ictx.moveTo(22, 7); ictx.lineTo(22, 27); ictx.stroke();
        ictx.beginPath(); ictx.moveTo(22, 9); ictx.lineTo(34, 23); ictx.lineTo(22, 23);
        ictx.closePath(); ictx.stroke();
      } else if (key === 'oil') {
        ictx.fillStyle = '#b48ce0';
        ictx.beginPath();
        ictx.moveTo(22, 6);
        ictx.bezierCurveTo(33, 20, 32, 34, 22, 36);
        ictx.bezierCurveTo(12, 34, 11, 20, 22, 6);
        ictx.closePath(); ictx.fill();
      } else if (key !== 'none') {
        var d = D.MODULES[key];
        if (d) drawIcon(ictx, d.icon, 22, 22, 14, d.color);
      }
    });
  }

  function showActChoice() {
    var html = '<h2>潮汐巨兽沉了下去</h2>' +
      '<div class="sub">第 ' + S.route.cleared + ' 次潮汐 · ' + runSummary() + '</div>' +
      '<p>水面安静下来。但海沟底下还有别的东西在动——<span class="hl">你可以现在收手，也可以继续下潜。</span></p>' +
      '<div class="infogrid">' +
      '<div class="k">收手</div><div class="v">结算这次航程，拿走残骸</div>' +
      '<div class="k">下潜</div><div class="v">再打 4 次潮汐，最后是「潮汐之眼」，残骸翻倍</div>' +
      '</div>' +
      '<div class="modal-actions"><button class="btn" id="btnDockAct">船坞</button>' +
      '<button class="btn" id="btnBank">收 手</button>' +
      '<button class="btn primary" id="btnDive2">下 潜 ▼</button></div>';
    openModal(html);
    $('btnBank').addEventListener('click', function () { S.phase = 'victory'; showVictory(); });
    $('btnDive2').addEventListener('click', function () { S.phase = 'route'; showRoute(); });
    $('btnDockAct').addEventListener('click', showDock);
  }

  function pickRoute(i) {
    if (!S.route) return;
    var opt = S.route.options[i];
    if (!opt) return;
    if (opt.event) { showEvent(opt.event); return; }
    advanceTo(opt);
  }

  /* 统一推进到下一波：写波次、设难度、重生成敌人 */
  function advanceTo(opt) {
    var cleared = S.route ? S.route.cleared : S.run.wave;
    S.route = null;
    S.event = null;
    closeModal();
    S.run.wave = cleared + 1;
    C.applyRoute(S.run, {
      hpMul: opt.hpMul || 1,
      add: opt.add || 0,
      reward: opt.reward || null
    });
    C.planWave(S.run);
    enterBuild();
  }

  function showEvent(ev) {
    var html = '<h2>' + ev.name + '</h2>' +
      '<div class="sub">遭遇 · 第 ' + (S.route ? S.route.cleared + 1 : S.run.wave) + ' 次潮汐前</div>' +
      '<p>' + ev.text + '</p>' +
      '<div class="picks">' + ev.choices.map(function (c, i) {
        return '<div class="pick" data-i="' + i + '">' +
          '<span class="pt" style="color:#b48ce0;border-color:#b48ce0">选择</span>' +
          '<canvas data-icon="' + (ev.icon || 'none') + '" width="44" height="44"></canvas>' +
          '<div class="pn" style="color:#c9b6e8">' + c.label + '</div>' +
          '<div class="pd">' + c.desc + '</div>' +
          '</div>';
      }).join('') + '</div>' +
      '<p class="hintline">事件不消耗路线，选完直接进入下一次潮汐的建造。</p>';
    openModal(html);
    Array.prototype.forEach.call(document.querySelectorAll('.pick'), function (el) {
      el.addEventListener('click', function () { pickEventChoice(parseInt(el.dataset.i, 10)); });
    });
  }

  function pickEventChoice(i) {
    if (!S.event) return;
    var ev = S.event;
    var choice = ev.choices[i];
    if (!choice) return;
    S.event = null;
    var res = C.applyEvent(S.run, choice);
    toast(res.got.length ? res.got.join(' · ') : '什么也没发生');
    advanceTo({ hpMul: res.hpMul, add: res.add, reward: null });
  }

  function enterBuild() {
    S.phase = 'build';
    S.sel = null;
    S.battle = null;
    S.run.dived = false;
    syncUI();
  }

  function runSummary() {
    var parts = [];
    var ship = D.SHIPS[S.run.ship];
    if (ship) parts.push(ship.name);
    if (S.run.mut) parts.push('异变·' + S.run.mut.name);
    if (S.run.relics && S.run.relics.length) parts.push('遗物 ' + S.run.relics.length + ' 件');
    var ups = Object.keys(S.run.up || {}).filter(function (k) { return S.run.up[k] > 0; });
    if (ups.length) parts.push('改造 ' + ups.length + ' 项');
    var n = C.cellsOf(S.run).length;
    if (n) parts.push('模块 ' + n + ' 台');
    return parts.join(' · ');
  }

  function showGameOver() {
    var b = S.battle;
    var totalLeak = b.leak || 1;
    var laneName = { surface: '海面', air: '空中', under: '水下' };
    var worst = null, worstVal = -1;
    Object.keys(b.leakByLane).forEach(function (k) {
      if (b.leakByLane[k] > worstVal) { worstVal = b.leakByLane[k]; worst = k; }
    });
    var hasLeak = worstVal > 1;
    var share = Math.round((worstVal / totalLeak) * 100);
    var gain = settleRun(false);

    var html = '<h2 style="color:#ff9c86">木筏沉没</h2>' +
      '<div class="sub">第 ' + S.run.wave + ' / ' + D.MAX_WAVE + ' 次潮汐 · ' + runSummary() + '</div>' +
      '<div class="infogrid">' +
      '<div class="k">本波击杀</div><div class="v">' + b.killed + '</div>' +
      '<div class="k">总输出</div><div class="v">' + Math.round(b.dmgDealt) + '</div>' +
      '<div class="k">残骸</div><div class="v ok">+' + gain + '（共 ' + S.meta.wreck + '）</div>' +
      achievementLine() +
      (hasLeak ? '<div class="k">主要失血</div><div class="v bad">' + laneName[worst] + ' · ' + share + '%</div>' : '') +
      (hasLeak ? '<div class="k">诊断</div><div class="v">' +
        (worst === 'surface' ? '对海火力不足或射程没有覆盖到来袭方向'
          : worst === 'air' ? '高空甲板缺少高射炮，潮蝠直接撞上来了'
            : '水下舱缺少鱼叉/深水炸弹，深潜者一路啃到船底') + '</div>' : '') +
      '</div>' +
      '<div class="modal-actions"><button class="btn" id="btnDock2">船坞</button>' +
      '<button class="btn primary" id="btnRetry">再来一次</button></div>';
    openModal(html);
    $('btnRetry').addEventListener('click', function () { showShipSelect(); });
    $('btnDock2').addEventListener('click', function () { showDock(); });
  }

  function showVictory() {
    var full = (S.run.wave || 0) >= D.MAX_WAVE;
    var gain = settleRun(true);

    /* 通关后解锁下一级潮汐刻度 */
    var prevAsc = S.meta.asc || 0;
    var unlocked = false;
    if (full && (S.run.asc || 0) >= prevAsc && prevAsc < D.MAX_ASC) {
      S.meta.asc = Math.min(D.MAX_ASC, (S.run.asc || 0) + 1);
      S.asc = S.meta.asc;
      saveMeta();
      unlocked = true;
    }

    var html = '<h2 style="color:' + (full ? '#8ff0c4' : '#9dc4d6') + '">' +
      (full ? '潮汐平息' : '活着回来') + '</h2>' +
      '<div class="sub">' +
      (full ? '你带着这条船一路下潜到了海沟底部' : '你在第 ' + D.ACT1_END + ' 次潮汐后收手，带着满船的东西回到了水面') +
      ' · ' + runSummary() + '</div>' +
      '<p>深处的巨兽沉回海沟，水面第一次安静下来。' +
      '甲板上还留着这一路捞上来、拼起来的东西——那是你亲手造的船。</p>' +
      '<div class="infogrid">' +
      '<div class="k">总击杀</div><div class="v">' + S.run.kills + '</div>' +
      '<div class="k">剩余耐久</div><div class="v ok">' + Math.round(S.run.hp) + '</div>' +
      '<div class="k">残骸</div><div class="v ok">+' + gain + '（共 ' + S.meta.wreck + '）</div>' +
      achievementLine() +
      (unlocked ? '<div class="k">潮汐刻度</div><div class="v ok">解锁到 ' + S.meta.asc + ' · ' + D.ASC_NAME[S.meta.asc] +
        '（敌人更强，残骸更多）</div>' : '') +
      '</div>' +
      '<div class="modal-actions"><button class="btn" id="btnDock3">船坞</button>' +
      '<button class="btn primary" id="btnAgain">再漂一次</button></div>';
    openModal(html);
    $('btnAgain').addEventListener('click', function () { showShipSelect(); });
    $('btnDock3').addEventListener('click', function () { showDock(); });
  }

  /* ---------- 船坞：用残骸永久解锁 ---------- */
  function showDock() {
    var html = '<h2>船坞</h2>' +
      '<div class="sub">残骸 ' + (S.meta.wreck || 0) + ' · 出航 ' + (S.meta.runs || 0) +
      ' 次 · 通关 ' + (S.meta.wins || 0) + ' 次 · 最远 ' + (S.meta.best || 0) + ' 波 · 累计击杀 ' + (S.meta.kills || 0) + '</div>' +
      '<p>每次沉船都会留下残骸。<span class="hl">残骸不会消失</span>，拿它永久改装你的船队。</p>' +
      '<div class="metalist two">' +
      D.META.map(function (u) {
        var lv = metaLv(u.id);
        var maxed = lv >= u.max;
        var cost = D.metaCost(u, lv);
        var afford = (S.meta.wreck || 0) >= cost;
        return '<div class="meta-row' + (maxed ? ' maxed' : '') + (afford && !maxed ? ' can' : '') +
          '" data-meta="' + u.id + '">' +
          '<div class="mn">' + u.name +
          '<span class="lv">' + (u.max > 1 ? lv + ' / ' + u.max : (maxed ? '已解锁' : '未解锁')) + '</span></div>' +
          '<div class="md">' + u.desc + '</div>' +
          '<div class="mc">' + (maxed ? '—' : cost + ' 残骸') + '</div>' +
          '</div>';
      }).join('') +
      '</div>' +
      '<div class="modal-actions"><button class="btn primary" id="btnSail">出 航</button></div>';
    openModal(html);

    Array.prototype.forEach.call(document.querySelectorAll('.meta-row'), function (el) {
      el.addEventListener('click', function () {
        var id = el.dataset.meta;
        var u = null;
        D.META.forEach(function (x) { if (x.id === id) u = x; });
        if (!u) return;
        var lv = metaLv(id);
        if (lv >= u.max) { toast('已经改装到顶了'); return; }
        var uc = D.metaCost(u, lv);
        if ((S.meta.wreck || 0) < uc) { toast('残骸不够（需要 ' + uc + '）'); return; }
        S.meta.wreck -= uc;
        S.meta[id] = lv + 1;
        saveMeta();
        toast('改装完成：' + u.name);
        showDock();
      });
    });
    $('btnSail').addEventListener('click', function () { showShipSelect(); });
  }

  function showHelp(first) {
    var html = '<h2>' + (first ? '潮汐方舟' : '玩法') + '</h2>' +
      '<div class="sub">TIDE ARK · 横板构筑 · 自动战斗</div>' +
      '<p>你有一条破木筏。每次<span class="hl">退潮</span>时打捞、建造；每次<span class="hl">涨潮</span>时海怪扑上来，' +
      '你的模块自动开火。撑过 <span class="hl">8 次潮汐</span>。</p>' +
      '<div class="infogrid">' +
      '<div class="k">甲板是钱</div><div class="v">一开始只有<b>中间几列</b>。点两侧的暗格花木材<b>加固</b>，每列多 3 个格子</div>' +
      '<div class="k">三层甲板</div><div class="v">高空甲板只打<b>空中</b>，主甲板只打<b>海面</b>，水下舱只打<b>水下</b></div>' +
      '<div class="k">左右舷</div><div class="v">武器<b>打不到对侧</b>。没加固外侧列，就够不着远处的敌人</div>' +
      '<div class="k">射程</div><div class="v">射程按<b>列</b>算。靠边的炮更能覆盖自己这一侧</div>' +
      '<div class="k">潮汐词条</div><div class="v">每波可能带一个词条（<b>浓雾/蜂群/血月</b>…），会直接改这波的打法</div>' +
      '<div class="k">路线</div><div class="v">每波结束<b>二选一/三选一</b>：难度是明牌，奖励也是明牌，但不能都要</div>' +
      '<div class="k">遗物</div><div class="v">精英潮掉落，<b>整局改变规则</b>（探照灯 / 潮汐之子 / 扩建图纸…）</div>' +
      '<div class="k">羁绊</div><div class="v">模块带标签：<b>炮击 / 燃烧 / 机械</b>，同一标签凑到 2 个、4 个触发质变</div>' +
      '<div class="k">事件</div><div class="v">路线里会撞上<a style="color:#b48ce0">遭遇</a>，每个选择都有代价</div>' +
      '<div class="k">残骸</div><div class="v">沉船也有收获，<b>永久</b>改装船队（解锁母舰 / 起始补给 / 祖传遗物）</div>' +
      '<div class="k">异变</div><div class="v">每局开局抽一条<b>全局规则</b>（逆潮 / 丰饶 / 浓雾…），好坏都有，整局生效</div>' +
      '<div class="k">刻度</div><div class="v">通关后解锁更高的<b>潮汐刻度</b>：敌人更强，残骸更多</div>' +
      '<div class="k">满潮</div><div class="v">潮水涨满还没清场，敌人狂暴、船舱进水，基本必死</div>' +
      '</div>' +
      '<p class="hintline">左键选模块 → 点格子放置 · 点暗格加固 · 点已装模块拆除 · 右键/Esc 取消 · 空格开战</p>' +
      '<div class="modal-actions"><button class="btn primary" id="btnStart">' + (first ? '启 航' : '返 回') + '</button></div>';
    openModal(html);
    $('btnStart').addEventListener('click', function () {
      if (first) { closeModal(); S.started = true; showShipSelect(); }
      else closeModal();
    });
  }

  function dailyInfo() {
    var d = new Date();
    var key = '' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
    var seed = 0;
    for (var i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
    var rng = D.mulberry32(seed);
    var shipPool = D.SHIP_ORDER.filter(function (id) { return id !== 'carrier' || metaLv('carrier'); });
    var ship = shipPool[Math.floor(rng() * shipPool.length)];
    var ascMax = Math.min(S.meta.asc || 0, 2);
    var asc = ascMax > 0 ? (1 + Math.floor(rng() * ascMax)) : 0;
    if (asc > ascMax) asc = ascMax;
    var ct = D.CONTRACTS[Math.floor(rng() * D.CONTRACTS.length)];
    return { key: key, seed: seed, ship: ship, asc: asc, contract: ct };
  }

  function showDaily() {
    var d = dailyInfo();
    var rec = (S.meta.daily || {})[d.key] || { best: 0, cleared: false };
    var sp = D.SHIPS[d.ship];
    var ct = d.contract ? d.contract.name + '（' + d.contract.desc + '）' : '无';
    var html = '<h2>今日挑战</h2>' +
      '<div class="sub">' + d.key + ' · 同一个日期 = 同一套牌</div>' +
      '<p>固定的种子、固定的船、固定的刻度与契约。<span class="hl">你只能决定怎么打。</span></p>' +
      '<div class="infogrid">' +
      '<div class="k">船</div><div class="v">' + sp.name + '</div>' +
      '<div class="k">潮汐刻度</div><div class="v">' + d.asc + ' · ' + D.ASC_NAME[d.asc] + '</div>' +
      '<div class="k">契约</div><div class="v">' + ct + '</div>' +
      '<div class="k">今日最好</div><div class="v ok">' +
      (rec.best ? '第 ' + rec.best + ' 波' + (rec.cleared ? ' · 已通关' : '') : '还没打') + '</div>' +
      '</div>' +
      '<div class="modal-actions"><button class="btn primary" id="btnDailyGo">开始挑战</button></div>';
    openModal(html);
    $('btnDailyGo').addEventListener('click', function () {
      newGame(d.ship, { seed: d.seed, asc: d.asc, contract: d.contract, daily: { key: d.key } });
    });
  }

  function showAchievements() {
    var done = 0;
    var rows = D.ACHIEVEMENTS.map(function (a) {
      var got = S.meta.ach && S.meta.ach[a.id];
      if (got) done++;
      return '<div class="achrow' + (got ? ' got' : '') + '">' +
        '<div class="an">' + a.name + '</div>' +
        '<div class="ad">' + a.desc + '</div>' +
        '<div class="ar">' + (got ? '已达成' : '+' + a.reward) + '</div>' +
        '</div>';
    }).join('');
    openModal('<h2>成就</h2><div class="sub">' + done + ' / ' + D.ACHIEVEMENTS.length +
      ' · 达成后立刻发放残骸</div>' +
      '<div class="achlist two">' + rows + '</div>' +
      '<div class="modal-actions"><button class="btn" id="btnAchBack">返 回</button></div>');
    $('btnAchBack').addEventListener('click', function () { showShipSelect(); });
  }

  function showShipSelect() {
    if (!S.contractOffers) rollContractOffers();

    var ctHtml = '<button class="ctchip' + (!S.contract ? ' on' : '') + '" data-ct="">不签</button>';
    S.contractOffers.forEach(function (c) {
      ctHtml += '<button class="ctchip' + (S.contract === c.id ? ' on' : '') +
        '" data-ct="' + c.id + '" title="' + c.desc + '">' + c.name +
        ' <span style="color:#8ff0c4">×' + c.mul + '</span></button>';
    });

    var html = '<h2>选择你的船</h2>' +
      '<div class="sub">残骸 ' + (S.meta.wreck || 0) + ' · 出航 ' + (S.meta.runs || 0) +
      ' 次 · 通关 ' + (S.meta.wins || 0) + ' 次 · 最远 ' + (S.meta.best || 0) + ' 波</div>' +
      '<div class="picks">' + D.SHIP_ORDER.map(function (id) {
        var sp = D.SHIPS[id];
        var locked = id === 'carrier' && !metaLv('carrier');
        return '<div class="pick' + (locked ? ' locked' : '') + '" data-ship="' + id + '">' +
          (locked
            ? '<span class="pt" style="color:#8b7f6a;border-color:#8b7f6a">未解锁</span>'
            : '<span class="pt">起点</span>') +
          '<canvas width="44" height="44"></canvas>' +
          '<div class="pn" style="color:' + (locked ? '#6b6b6b' : sp.color) + '">' + sp.name + '</div>' +
          '<div class="pd">' + (locked ? '在船坞花 120 残骸解锁' : sp.desc) +
          '<br><span style="color:#5f8ea4">甲板 ' + sp.cols.length + ' 列 · 木材 ' + sp.wood + ' · 耐久 ' + sp.hp + '</span></div>' +
          '</div>';
      }).join('') + '</div>' +
      '<div class="ascrow">' +
      '<button class="btn" id="ascDown">−</button>' +
      '<span class="ascval">潮汐刻度 <b>' + (S.asc || 0) + '</b> · ' + D.ASC_NAME[S.asc || 0] +
      '<span class="aschint">已解锁 ' + (S.meta.asc || 0) + ' / ' + D.MAX_ASC + '，通关后 +1</span></span>' +
      '<button class="btn" id="ascUp">+</button>' +
      '</div>' +
      '<div class="ctrow"><span class="lbl">契约</span>' + ctHtml +
      '<span class="cthint">自己加难度，换残骸倍率</span></div>' +
      '<div class="modal-actions"><button class="btn" id="btnAch">成就</button>' +
      '<button class="btn" id="btnDaily">今日挑战</button>' +
      '<button class="btn" id="btnDock">船坞</button></div>';
    openModal(html);
    $('ascDown').addEventListener('click', function () {
      S.asc = Math.max(0, (S.asc || 0) - 1);
      showShipSelect();
    });
    $('ascUp').addEventListener('click', function () {
      S.asc = Math.min(S.meta.asc || 0, (S.asc || 0) + 1);
      showShipSelect();
    });
    Array.prototype.forEach.call(document.querySelectorAll('.ctchip'), function (el) {
      el.addEventListener('click', function () {
        S.contract = el.dataset.ct || null;
        showShipSelect();
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.pick'), function (el) {
      el.addEventListener('click', function () {
        var id = el.dataset.ship;
        if (id === 'carrier' && !metaLv('carrier')) { showDock(); return; }
        newGame(id);
      });
    });
    $('btnDock').addEventListener('click', function () { showDock(); });
    $('btnAch').addEventListener('click', showAchievements);
    $('btnDaily').addEventListener('click', showDaily);
    Array.prototype.forEach.call(document.querySelectorAll('.pick canvas'), function (cnv) {
      var ictx = cnv.getContext('2d');
      ictx.strokeStyle = '#9dc4d6';
      ictx.lineWidth = 2.4;
      ictx.beginPath();
      ictx.moveTo(5, 27); ictx.lineTo(39, 27); ictx.lineTo(32, 37); ictx.lineTo(12, 37);
      ictx.closePath(); ictx.stroke();
      ictx.beginPath(); ictx.moveTo(22, 7); ictx.lineTo(22, 27); ictx.stroke();
      ictx.beginPath(); ictx.moveTo(22, 9); ictx.lineTo(34, 23); ictx.lineTo(22, 23);
      ictx.closePath(); ictx.stroke();
    });
  }

  function newGame(shipId, opts) {
    opts = opts || {};
    var ctSel = null;
    if (opts.contract !== undefined) {
      ctSel = opts.contract;
    } else if (S.contract) {
      (S.contractOffers || []).forEach(function (c) { if (c.id === S.contract) ctSel = c; });
    }
    S.run = C.newRun(opts.seed, shipId || 'barge', {
      wood: metaLv('wood'),
      hp: metaLv('hp'),
      relic: metaLv('relic') > 0
    }, opts.asc != null ? opts.asc : (S.asc || 0), ctSel);
    S.dailyRun = opts.daily || null;
    for (var ai = 0; ai < metaLv('aug'); ai++) {
      C.grantAug(S.run, D.AUG_ORDER[Math.floor(Math.random() * D.AUG_ORDER.length)]);
    }
    for (var mi = 0; mi < metaLv('module'); mi++) {
      var mid = D.ORDER[Math.floor(Math.random() * D.ORDER.length)];
      S.run.stock[mid] = (S.run.stock[mid] || 0) + 1;
    }
    S.run.wood += 2 * metaLv('cache');
    S.battle = null;
    S.phase = 'build';
    S.sel = null;
    S.started = true;
    S.route = null;
    S.event = null;
    closeModal();
    syncUI();
  }

  /* ================= 按钮 ================= */
  $('btnTide').addEventListener('click', beginBattle);
  $('btnSpeed').addEventListener('click', function () {
    S.speed = S.speed === 1 ? 2 : (S.speed === 2 ? 4 : 1);
    syncUI();
  });
  $('btnDive').addEventListener('click', function () {
    if (S.phase !== 'build' || S.run.dived) return;
    var err = C.dive(S.run);
    if (err) { toast(err); return; }
    toast('下潜打捞：+25 木材，但这一波会多来 2 只深潜者');
    syncUI();
  });
  $('btnFast').addEventListener('click', function () {
    if (S.phase !== 'battle' || !S.battle || S.battle.result) return;
    var guard = 0;
    while (!S.battle.result && guard++ < 60 * 200) C.step(S.battle, 1 / 60);
    S.phase = 'ending';
    S.endTimer = 0.45;
    syncUI();
  });
  $('btnHelp').addEventListener('click', function () { showHelp(false); });

  /* ================= 主循环 ================= */
  var last = performance.now();
  var acc = 0;
  var previewAcc = 0;

  function frame(now) {
    var dt = Math.min(0.045, (now - last) / 1000);
    last = now;
    S.t += dt;

    if (S.phase === 'battle' && S.battle) {
      if (!S.battle.result) {
        for (var i = 0; i < S.speed; i++) C.step(S.battle, dt);
        if (S.battle.result) { S.phase = 'ending'; S.endTimer = 1.05; }
      }
    } else if (S.phase === 'ending') {
      S.endTimer -= dt;
      if (S.endTimer <= 0) resolveBattle();
    }

    try {
      draw(S.t);
      syncUIThrottled(dt);
    } catch (err) {
      if (!S.lastError) {
        S.lastError = (err && err.message) ? err.message : String(err);
        console.error('[tide-ark] 渲染异常', err);
      }
      /* 出错时把原因画在画面上，方便截图定位，同时不打断主循环 */
      try {
        g.fillStyle = 'rgba(0,0,0,.72)';
        g.fillRect(0, 0, W, 22);
        g.fillStyle = '#ff8b6b';
        g.font = '12px monospace';
        g.textAlign = 'left';
        g.fillText('ERR: ' + S.lastError, 8, 15);
      } catch (e2) { /* 忽略 */ }
    }
    requestAnimationFrame(frame);
  }

  var uiAcc = 0;
  function syncUIThrottled(dt) {
    uiAcc += dt;
    if (uiAcc > 0.1) {
      uiAcc = 0;
      /* 整块刷新，任何状态变化都不会滞留在界面上 */
      syncUI();
    }
  }

  /* ================= 启动 ================= */
  S.meta = loadMeta();
  if (S.meta.asc === undefined) S.meta.asc = 0;
  S.asc = S.meta.asc;
  buildPalette();
  syncUI();
  if (location.search.indexOf('nointro') >= 0) {
    S.started = true;
    closeModal();
    syncUI();
    /* 调试：预置一套甲板，便于截图检查 */
    if (location.search.indexOf('demo') >= 0) {
      S.run.unlocked = [1, 2, 3, 4];
      var demo = [[1,1,'ballista'],[2,1,'ballista'],[3,1,'ballista'],[4,1,'gen'],[1,2,'harpoon'],[2,2,'armor'],[3,0,'flak'],[4,0,'flak']];
      demo.forEach(function (d) { S.run.grid[C.idx(d[0], d[1])] = d[2]; });
      var mw = location.search.match(/wave=([0-9]+)/);
      if (mw) { S.run.wave = parseInt(mw[1], 10); C.planWave(S.run); }
      if (location.search.indexOf('battle') >= 0) {
        S.battle = C.startBattle(S.run);
        S.phase = 'battle';
        var mSim = location.search.match(/sim=([0-9.]+)/);
        var simT = mSim ? parseFloat(mSim[1]) : 0;
        for (var si = 0; si < simT * 60; si++) C.step(S.battle, 1 / 60);
      }
      if (location.search.indexOf('reward') >= 0) {
        S.battle.result = 'won';
        S.phase = 'ending';
        resolveBattle();
      }
      syncUI();
      if (location.search.indexOf('select') >= 0) showShipSelect();
      if (location.search.indexOf('over=1') >= 0) { S.phase = 'gameover'; showGameOver(); }
      if (location.search.indexOf('win=1') >= 0) { S.phase = 'victory'; showVictory(); }
      if (location.search.indexOf('dock=1') >= 0) showDock();
      if (location.search.indexOf('ach=1') >= 0) showAchievements();
      if (location.search.indexOf('daily=1') >= 0) showDaily();
      if (location.search.indexOf('event=1') >= 0) { S.route = { cleared: 1 }; showEvent(D.EVENTS[0]); }
      if (location.search.indexOf('beast=1') >= 0) {
        S.battle = C.startBattle(S.run);
        S.phase = 'battle';
        S.battle.enemies = [];
        ['eel', 'shade', 'crab', 'eye'].forEach(function (kind, bi) {
          var ed = D.ENEMIES[kind];
          var ey = ed.lane === 'air' ? 226 : (ed.lane === 'under' ? 470 : 374);
          S.battle.enemies.push({
            id: 900 + bi, kind: kind, def: ed, lane: ed.lane, side: 'R',
            x: 180 + bi * 200, y: ey, hp: 9999, maxHp: 9999, r: ed.r,
            latched: false, enraged: false, burnT: 0, burnDps: 0, slowT: 0, slowMul: 1,
            bob: bi, hit: 0, dead: false, biteCd: 0
          });
        });
      }
      if (location.search.indexOf('aug=1') >= 0) {
        S.run.augments = ['pierce', 'burn', 'recharge'];
        C.applyAug(S.run, 'splash', 1, 1);
        syncUI();
      }
      var mShip = location.search.match(/ship=(barge|gunboat|carrier)/);
      if (mShip) newGame(mShip[1]);
    }
  } else {
    showHelp(true);
  }
  requestAnimationFrame(frame);

  /* 调试入口 */
  window.__TA = { S: S, C: C, D: D };
})();
