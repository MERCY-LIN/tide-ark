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
    reward: null,
    started: false,
    log: []
  };

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
    if (opt.unpowered) {
      ctx.beginPath();
      ctx.arc(cx + half - 6, cy - half + 6, 3, 0, 6.283);
      ctx.fillStyle = '#d1553f';
      ctx.fill();
    }
  }

  function drawModulesBuild(t, bob) {
    for (var r = 0; r < D.ROWS; r++) {
      for (var c = 0; c < D.COLS; c++) {
        var id = S.run.grid[C.idx(c, r)];
        if (!id) continue;
        var def = D.MODULES[id];
        moduleVisual(g, def, D.RAFT_X + c * CELL + CELL / 2, D.RAFT_Y + r * CELL + CELL / 2 + bob, CELL - 10, {});
      }
    }
  }

  function drawModulesBattle(b, bob) {
    for (var i = 0; i < b.modules.length; i++) {
      var m = b.modules[i];
      moduleVisual(g, m.def, m.x, m.y + bob, CELL - 10, {
        flash: m.flash,
        flooded: m.flooded,
        unpowered: !m.powered && m.def.kind === 'weapon'
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
    } else if (e.kind === 'boss') {
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
        var reach = (def.range || 0) * CELL;
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
    g.globalAlpha = 0.26;
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

    g.restore();

    /* 暗角 */
    var vg = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);

    /* 建造阶段的来袭方向 */
    if (!b) {
      var preview = D.wavePreview(S.run.wave, S.run.extraDivers);
      drawSideArrows(preview, t);
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
    $('sWave').textContent = (S.phase === 'build' && S.started ? run.wave : Math.min(run.wave, D.MAX_WAVE)) + ' / ' + D.MAX_WAVE;
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
    updatePreview();
  }

  function updatePreview() {
    var el = $('preview');
    if (!S.started) { el.textContent = ''; return; }
    if (S.phase === 'build') {
      var pv = D.wavePreview(S.run.wave, S.run.extraDivers);
      var extra = S.run.extraDivers ? ' <span class="warn">(下潜引来 ' + S.run.extraDivers + ' 只深潜者)</span>' : '';
      el.innerHTML =
        '<div><span class="k">第 ' + S.run.wave + ' 次潮汐</span> · <b>' + pv.sides + '</b></div>' +
        '<div class="k">来袭：' + pv.text + '</div>' + extra;
    } else if (S.battle) {
      el.innerHTML =
        '<div><span class="k">第 ' + S.battle.wave + ' 次潮汐</span> · 剩 ' + S.battle.enemies.length + ' 敌</div>' +
        '<div class="k">击杀 ' + S.battle.killed + ' · 潮位 ' + Math.round(S.battle.tide * 100) + '%</div>';
    } else {
      el.innerHTML = '';
    }
  }

  /* ================= 提示气泡 ================= */
  function updateTip() {
    var tip = $('tip');
    if (S.phase !== 'build' || !S.hoverCell) { tip.classList.remove('on'); return; }
    var cell = S.hoverCell;
    var id = S.run.grid[C.idx(cell.col, cell.row)];
    var html = '';
    if (id) {
      var def = D.MODULES[id];
      html = '<div class="tn" style="color:' + def.color + '">' + def.name + '</div>' +
        '<div class="td">' + def.desc + '</div>' +
        '<div class="tc">点击拆除（回收 ' + Math.floor(def.cost * 0.5) + ' 木材）</div>';
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

    S.reward = {
      cards: C.rollCards(S.run),
      wood: gain.wood,
      heal: gain.heal,
      cleared: cleared,
      kills: b.killed
    };
    S.run.wave = cleared + 1;
    S.phase = 'reward';
    showReward();
  }

  function cardHTML(card, i) {
    if (card.type === 'module') {
      var def = D.MODULES[card.id];
      return '<div class="pick" data-i="' + i + '">' +
        '<span class="pt">模块</span>' +
        '<canvas data-icon="' + card.id + '" width="44" height="44"></canvas>' +
        '<div class="pn" style="color:' + def.color + '">' + def.name + '</div>' +
        '<div class="pd">' + def.desc + '</div>' +
        '</div>';
    }
    if (card.type === 'wood') {
      return '<div class="pick big" data-i="' + i + '">' +
        '<span class="pt">补给</span>' +
        '<canvas data-icon="wood" width="44" height="44"></canvas>' +
        '<div class="pn" style="color:#e8c07a">木材 +' + card.amt + '</div>' +
        '<div class="pd">从漂浮的残骸里拖回来的建材</div>' +
        '</div>';
    }
    return '<div class="pick big" data-i="' + i + '">' +
      '<span class="pt">修整</span>' +
      '<canvas data-icon="repair" width="44" height="44"></canvas>' +
      '<div class="pn" style="color:#86e0b0">修复 +' + card.amt + '</div>' +
      '<div class="pd">把漏水的舱室补一补</div>' +
      '</div>';
  }

  function showReward() {
    var r = S.reward;
    var html = '<h2>第 ' + r.cleared + ' 次潮汐 · 退去</h2>' +
      '<div class="sub">击杀 ' + r.kills + ' · 木材 +' + r.wood + ' · 修复 +' + r.heal + '</div>' +
      '<p>潮水退去，海面上浮起一些东西。<span class="hl">挑一件带走。</span></p>' +
      '<div class="picks">' + r.cards.map(cardHTML).join('') + '</div>';
    openModal(html);

    Array.prototype.forEach.call(document.querySelectorAll('.pick'), function (el) {
      el.addEventListener('click', function () {
        var i = parseInt(el.dataset.i, 10);
        pickCard(i);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.pick canvas'), function (cnv) {
      var key = cnv.dataset.icon;
      var ictx = cnv.getContext('2d');
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
      } else {
        var d = D.MODULES[key];
        drawIcon(ictx, d.icon, 22, 22, 14, d.color);
      }
    });
  }

  function pickCard(i) {
    if (!S.reward) return;
    C.applyCard(S.run, S.reward.cards[i]);
    S.reward = null;
    closeModal();
    enterBuild();
  }

  function enterBuild() {
    S.phase = 'build';
    S.sel = null;
    S.battle = null;
    S.run.dived = false;
    syncUI();
  }

  function showGameOver() {
    var b = S.battle;
    var totalLeak = b.leak || 1;
    var laneName = { surface: '海面', air: '空中', under: '水下' };
    var worst = null, worstVal = -1;
    Object.keys(b.leakByLane).forEach(function (k) {
      if (b.leakByLane[k] > worstVal) { worstVal = b.leakByLane[k]; worst = k; }
    });
    var share = Math.round((worstVal / totalLeak) * 100);

    var html = '<h2 style="color:#ff9c86">木筏沉没</h2>' +
      '<div class="sub">第 ' + S.run.wave + ' 次潮汐 · 共击杀 ' + (S.run.kills + b.killed) + '</div>' +
      '<div class="infogrid">' +
      '<div class="k">止步于</div><div class="v">第 ' + S.run.wave + ' / ' + D.MAX_WAVE + ' 次潮汐</div>' +
      '<div class="k">本波击杀</div><div class="v">' + b.killed + '</div>' +
      '<div class="k">总输出</div><div class="v">' + Math.round(b.dmgDealt) + '</div>' +
      (worst ? '<div class="k">主要失血</div><div class="v bad">' + laneName[worst] + ' · ' + share + '%</div>' : '') +
      (worst ? '<div class="k">诊断</div><div class="v">' +
        (worst === 'surface' ? '对海火力不足或射程没有覆盖到来袭方向'
          : worst === 'air' ? '高空甲板缺少高射炮，潮蝠直接撞上来了'
            : '水下舱缺少鱼叉/深水炸弹，深潜者一路啃到船底') + '</div>' : '') +
      '</div>' +
      '<div class="modal-actions"><button class="btn primary" id="btnRetry">再来一次</button></div>';
    openModal(html);
    $('btnRetry').addEventListener('click', function () { newGame(); });
  }

  function showVictory() {
    var html = '<h2 style="color:#8ff0c4">潮汐平息</h2>' +
      '<div class="sub">你带着这条船活过了 8 次潮汐</div>' +
      '<p>深处的巨兽沉回海沟，水面第一次安静下来。' +
      '甲板上还留着这一路捞上来、拼起来的东西——那是你亲手造的船。</p>' +
      '<div class="infogrid">' +
      '<div class="k">总击杀</div><div class="v">' + S.run.kills + '</div>' +
      '<div class="k">剩余耐久</div><div class="v ok">' + Math.round(S.run.hp) + '</div>' +
      '</div>' +
      '<div class="modal-actions"><button class="btn primary" id="btnAgain">再漂一次</button></div>';
    openModal(html);
    $('btnAgain').addEventListener('click', function () { newGame(); });
  }

  function showHelp(first) {
    var html = '<h2>' + (first ? '潮汐方舟' : '玩法') + '</h2>' +
      '<div class="sub">TIDE ARK · 横板构筑 · 自动战斗</div>' +
      '<p>你有一条破木筏。每次<span class="hl">退潮</span>时打捞、建造；每次<span class="hl">涨潮</span>时海怪扑上来，' +
      '你的模块自动开火。撑过 <span class="hl">8 次潮汐</span>。</p>' +
      '<div class="infogrid">' +
      '<div class="k">三层甲板</div><div class="v">高空甲板只打<b>空中</b>，主甲板只打<b>海面</b>，水下舱只打<b>水下</b></div>' +
      '<div class="k">左右舷</div><div class="v">武器<b>打不到对侧</b>。来袭方向会提前标在画面上（← 左舷 / 右舷 →）</div>' +
      '<div class="k">射程</div><div class="v">射程按<b>列</b>算。靠边的炮更能覆盖自己这一侧</div>' +
      '<div class="k">供电</div><div class="v">每层放一台<b>发电机</b>，否则这层武器射速 -28%</div>' +
      '<div class="k">满潮</div><div class="v">潮水涨满还没清场，敌人狂暴、船舱进水，必死</div>' +
      '</div>' +
      '<p class="hintline">左键选中模块 → 点格子放置 · 点已有模块可拆除（回收一半） · 右键/Esc 取消 · 空格开战</p>' +
      '<div class="modal-actions"><button class="btn primary" id="btnStart">' + (first ? '启 航' : '返 回') + '</button></div>';
    openModal(html);
    $('btnStart').addEventListener('click', function () {
      if (first) { closeModal(); S.started = true; newGame(); }
      else closeModal();
    });
  }

  function newGame() {
    S.run = C.newRun();
    S.battle = null;
    S.phase = 'build';
    S.sel = null;
    S.started = true;
    S.reward = null;
    closeModal();
    syncUI();
  }

  /* ================= 按钮 ================= */
  $('btnTide').addEventListener('click', beginBattle);
  $('btnSpeed').addEventListener('click', function () {
    S.speed = S.speed === 1 ? 2 : 1;
    syncUI();
  });
  $('btnDive').addEventListener('click', function () {
    if (S.phase !== 'build' || S.run.dived) return;
    S.run.dived = true;
    S.run.wood += 25;
    S.run.extraDivers += 2;
    toast('下潜打捞：+25 木材，但下一次涨潮会多来 2 只深潜者');
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

    draw(S.t);

    syncUIThrottled(dt);
    requestAnimationFrame(frame);
  }

  var uiAcc = 0;
  function syncUIThrottled(dt) {
    uiAcc += dt;
    if (uiAcc > 0.1) {
      uiAcc = 0;
      updatePreview();
      if (S.battle) {
        /* 战斗中只更新血量/潮位，不重建手牌 */
        var b = S.battle;
        if (b) {
          $('sHp').textContent = Math.round(b.hp) + ' / ' + b.maxHp;
          var pct = clamp(b.hp / b.maxHp, 0, 1) * 100;
          $('hpBar').firstElementChild.style.width = pct + '%';
          $('hpBar').classList.toggle('low', pct < 40);
          $('tideFill').style.width = Math.round(b.tide * 100) + '%';
        }
      } else {
        $('tideFill').style.width = '0%';
      }
    }
  }

  /* ================= 启动 ================= */
  buildPalette();
  syncUI();
  if (location.search.indexOf('nointro') >= 0) {
    S.started = true;
    closeModal();
    /* 调试：预置一套甲板，便于截图检查 */
    if (location.search.indexOf('demo') >= 0) {
      var demo = [[1,1,'ballista'],[2,1,'ballista'],[3,1,'gen'],[0,0,'flak'],[4,0,'flak'],[1,2,'harpoon'],[2,2,'harpoon'],[4,2,'gen']];
      demo.forEach(function (d) { S.run.grid[C.idx(d[0], d[1])] = d[2]; });
      var mw = location.search.match(/wave=([0-9]+)/);
      if (mw) S.run.wave = parseInt(mw[1], 10);
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
    }
  } else {
    showHelp(true);
  }
  requestAnimationFrame(frame);

  /* 调试入口 */
  window.__TA = { S: S, C: C, D: D };
})();
