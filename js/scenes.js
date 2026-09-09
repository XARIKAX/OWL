/*
 * OWL scenes — the pinned intro.
 * A sticky stage holds five scenes. Scroll progress cross-fades them.
 * Scene art: owl on a branch (SVG), routing network (canvas),
 * the fee clock (SVG, built by site.js), the fee split (canvas),
 * and the close-up owl with the live status.
 */
(function () {
  'use strict';
  var html = document.documentElement;
  var story = document.getElementById('story');
  if (!story) return;
  var stage = story.querySelector('.stage');
  var scenes = Array.prototype.slice.call(stage.querySelectorAll('.scene'));
  var N = scenes.length;
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var dotsEl = document.getElementById('story-dots');
  var dots = dotsEl ? Array.prototype.slice.call(dotsEl.querySelectorAll('button')) : [];
  var AMBER = '#F5B942', MOON = '#E9E5D8';

  /* ---------- scroll engine ---------- */
  var storyTop = 0, travel = 1, current = -1, ticking = false;
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function layout() {
    var r = story.getBoundingClientRect();
    storyTop = r.top + (window.scrollY || 0);
    travel = Math.max(1, story.offsetHeight - stage.offsetHeight);
  }
  function update() {
    ticking = false;
    if (reduced) { scenes.forEach(function (s) { s.classList.add('active'); }); return; }
    var y = window.scrollY || 0;
    var p = Math.min(1, Math.max(0, (y - storyTop) / travel));
    var x = p * (N - 1);
    var nearest = Math.round(x);
    for (var i = 0; i < N; i++) {
      var d = x - i, a = Math.abs(d);
      var o = a <= 0.26 ? 1 : a >= 0.74 ? 0 : 1 - (a - 0.26) / 0.48;
      o = ease(o);
      var sc = scenes[i];
      sc.style.opacity = o.toFixed(3);
      var on = o > 0.01;
      if (on !== sc.classList.contains('active')) sc.classList.toggle('active', on);
      sc.style.visibility = on ? 'visible' : 'hidden';
      var art = sc.querySelector('.scene-art'), txt = sc.querySelector('.scene-text');
      if (art) art.style.transform = 'translate3d(0,' + (d * -48).toFixed(1) + 'px,0) scale(' + (1 - Math.min(a, 1) * 0.05).toFixed(3) + ')';
      if (txt) txt.style.transform = 'translate3d(0,' + (d * -28).toFixed(1) + 'px,0)';
    }
    if (nearest !== current) {
      current = nearest;
      dots.forEach(function (b, i) { b.classList.toggle('on', i === current); b.setAttribute('aria-current', i === current ? 'true' : 'false'); });
      html.setAttribute('data-scene', String(current));
    }
    var inStory = y >= storyTop - 10 && y < storyTop + travel + stage.offsetHeight * 0.5;
    if (dotsEl) dotsEl.classList.toggle('show', inStory);
    html.setAttribute('data-moon', inStory ? 'off' : 'on');
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  dots.forEach(function (b, i) {
    b.addEventListener('click', function () {
      layout();
      window.scrollTo({ top: Math.round(storyTop + travel * (i / (N - 1))), behavior: reduced ? 'auto' : 'smooth' });
    });
  });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { layout(); onScroll(); });
  window.addEventListener('load', function () { layout(); onScroll(); });

  /* ---------- chest feathers for the perched owl ---------- */
  var chest = document.getElementById('chest');
  if (chest) {
    var SVG = 'http://www.w3.org/2000/svg';
    for (var row = 0; row < 6; row++) {
      var y = 470 + row * 38, count = 5 + (row % 2), startX = 520 - (count - 1) * 22;
      for (var c = 0; c < count; c++) {
        var x = startX + c * 44 + (row % 2 ? 0 : 0);
        var p = document.createElementNS(SVG, 'path');
        p.setAttribute('d', 'M' + (x - 14) + ' ' + y + ' q14 18 28 0');
        p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'rgba(233,229,216,.07)'); p.setAttribute('stroke-width', '2.5'); p.setAttribute('stroke-linecap', 'round');
        chest.appendChild(p);
      }
    }
  }

  /* ---------- helpers for canvases ---------- */
  function fitCanvas(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var r = canvas.getBoundingClientRect();
    var w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }
  function sceneActive(el) { var s = el.closest('.scene'); return !s || s.classList.contains('active'); }

  var drawNet = null, drawSplit = null;

  /* ---------- scene 2: routing network ---------- */
  var net = document.getElementById('net');
  if (net) {
    var TICKERS = (window.OwlData && window.OwlData.TICKERS ? window.OwlData.TICKERS : [['AAPL'], ['TSLA'], ['NVDA'], ['SPY'], ['MSFT'], ['AMZN'], ['GOOGL'], ['META'], ['AMD'], ['PLTR'], ['AVGO'], ['TSM'], ['QQQ'], ['COIN']]).slice(0, 14).map(function (t) { return t[0]; });
    var nodes = [], pulses = [], lastSpawn = 0, netW = 0, netH = 0;
    function buildNodes(w, h) {
      nodes = [];
      var cx = w * 0.5, cy = h * 0.5, rx = w * 0.42, ry = h * 0.4;
      for (var i = 0; i < TICKERS.length; i++) {
        var a = -Math.PI / 2 + (i / TICKERS.length) * Math.PI * 2 + ((i % 3) - 1) * 0.08;
        var rr = 0.82 + ((i * 7) % 5) * 0.045;
        var x = cx + Math.cos(a) * rx * rr, y = cy + Math.sin(a) * ry * rr;
        var mx = (x + cx) / 2, my = (y + cy) / 2;
        var nx = -(y - cy), ny = (x - cx); var len = Math.hypot(nx, ny) || 1;
        var bend = (((i * 13) % 7) - 3) * 0.06 * Math.hypot(x - cx, y - cy);
        nodes.push({ t: TICKERS[i], x: x, y: y, ph: i * 1.7, c1x: mx + nx / len * bend, c1y: my + ny / len * bend });
      }
    }
    function qpoint(n, t, cx, cy) { // from node to center
      var x = (1 - t) * (1 - t) * n.x + 2 * (1 - t) * t * n.c1x + t * t * cx;
      var y = (1 - t) * (1 - t) * n.y + 2 * (1 - t) * t * n.c1y + t * t * cy;
      return [x, y];
    }
    drawNet = function (now) {
      if (!sceneActive(net)) return;
      var f = fitCanvas(net), ctx = f.ctx, w = f.w, h = f.h;
      if (w !== netW || h !== netH) { netW = w; netH = h; buildNodes(w, h); }
      var cx = w * 0.5, cy = h * 0.5, t = now / 1000;
      ctx.clearRect(0, 0, w, h);
      // links
      ctx.lineWidth = 1;
      nodes.forEach(function (n, i) {
        var dx = Math.sin(t * 0.5 + n.ph) * 4, dy = Math.cos(t * 0.4 + n.ph) * 3;
        n.dx = dx; n.dy = dy;
        ctx.strokeStyle = 'rgba(245,185,66,.28)';
        ctx.beginPath(); ctx.moveTo(n.x + dx, n.y + dy); ctx.quadraticCurveTo(n.c1x + dx * 0.5, n.c1y + dy * 0.5, cx, cy); ctx.stroke();
      });
      // pulses: ticker -> OWL -> ticker
      if (now - lastSpawn > 420 && pulses.length < 12) {
        lastSpawn = now;
        var a = Math.floor(Math.random() * nodes.length), b = Math.floor(Math.random() * nodes.length);
        if (b === a) b = (a + 1) % nodes.length;
        pulses.push({ a: a, b: b, t0: now, dur: 1500 + Math.random() * 600 });
      }
      ctx.globalCompositeOperation = 'lighter';
      for (var k = pulses.length - 1; k >= 0; k--) {
        var pu = pulses[k]; var u = (now - pu.t0) / pu.dur;
        if (u >= 1) { pulses.splice(k, 1); continue; }
        for (var trail = 0; trail < 7; trail++) {
          var uu = u - trail * 0.018; if (uu < 0) continue;
          var pt;
          if (uu < 0.5) pt = qpoint(nodes[pu.a], uu * 2, cx, cy); else pt = qpoint(nodes[pu.b], 1 - (uu - 0.5) * 2, cx, cy);
          var al = (1 - trail / 7) * 0.9;
          ctx.fillStyle = 'rgba(255,220,140,' + al.toFixed(2) + ')';
          ctx.beginPath(); ctx.arc(pt[0], pt[1], 2.6 - trail * 0.25, 0, 6.283); ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      // ticker nodes
      ctx.font = '500 12px "IBM Plex Mono", Menlo, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      nodes.forEach(function (n) {
        var x = n.x + n.dx, y = n.y + n.dy;
        ctx.shadowColor = AMBER; ctx.shadowBlur = 12;
        ctx.fillStyle = AMBER; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 6.283); ctx.fill();
        ctx.shadowBlur = 0;
        var above = y < cy;
        ctx.fillStyle = 'rgba(233,229,216,.85)';
        ctx.fillText(n.t, x, y + (above ? -14 : 14));
      });
      // OWL node
      ctx.shadowColor = AMBER; ctx.shadowBlur = 24;
      ctx.strokeStyle = AMBER; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx - 15, cy, 11, 0, 6.283); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + 15, cy, 11, 0, 6.283); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = MOON; ctx.font = '500 13px "IBM Plex Mono", Menlo, monospace';
      ctx.fillText('OWL', cx, cy + 30);
    };
  }

  /* ---------- scene 4: fee split ---------- */
  var split = document.getElementById('splitflow');
  if (split) {
    var parts = [], levels = [0, 0, 0], bumps = [0, 0, 0], LANES = [0.7, 0.2, 0.1], LANE_X = [0.2, 0.55, 0.82], COLORS = [AMBER, MOON, '#6E6F73'], lastP = 0;
    drawSplit = function (now) {
      if (!sceneActive(split)) return;
      var f = fitCanvas(split), ctx = f.ctx, w = f.w, h = f.h;
      ctx.clearRect(0, 0, w, h);
      var sx = w * 0.5, sy = h * 0.06, splitY = h * 0.4, binTop = h * 0.66, binH = h * 0.24, binW = w * 0.18;
      // guides
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(233,229,216,.1)';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, splitY); ctx.stroke();
      for (var l = 0; l < 3; l++) {
        var lx = w * LANE_X[l];
        ctx.beginPath(); ctx.moveTo(sx, splitY); ctx.bezierCurveTo(sx, splitY + (binTop - splitY) * 0.6, lx, splitY + (binTop - splitY) * 0.4, lx, binTop); ctx.stroke();
        // bin
        ctx.strokeStyle = 'rgba(233,229,216,.16)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx - binW / 2, binTop, binW, binH, 6) : ctx.rect(lx - binW / 2, binTop, binW, binH); ctx.stroke();
        levels[l] += (LANES[l] - levels[l]) * 0.02;
        bumps[l] *= 0.9;
        var lvl = Math.min(1, levels[l] + bumps[l]);
        ctx.fillStyle = COLORS[l]; ctx.globalAlpha = 0.85;
        var fh = binH * lvl * 0.94;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx - binW / 2 + 3, binTop + binH - 3 - fh, binW - 6, fh, 4) : ctx.rect(lx - binW / 2 + 3, binTop + binH - 3 - fh, binW - 6, fh); ctx.fill();
        ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(233,229,216,.1)';
        ctx.fillStyle = 'rgba(233,229,216,.5)'; ctx.font = '500 11px "IBM Plex Mono", Menlo, monospace'; ctx.textAlign = 'center';
        ctx.fillText(Math.round(LANES[l] * 100) + '%', lx, binTop - 8);
      }
      // spawn
      if (now - lastP > 34 && parts.length < 260) {
        lastP = now;
        var r = Math.random(), lane = r < LANES[0] ? 0 : r < LANES[0] + LANES[1] ? 1 : 2;
        parts.push({ x: sx + (Math.random() - 0.5) * 8, y: sy, lane: lane, t0: now, dur: 1700 + Math.random() * 500 });
      }
      ctx.globalCompositeOperation = 'lighter';
      for (var k = parts.length - 1; k >= 0; k--) {
        var pt = parts[k], u = (now - pt.t0) / pt.dur, x, y;
        if (u >= 1) { bumps[pt.lane] = Math.min(0.04, bumps[pt.lane] + 0.012); parts.splice(k, 1); continue; }
        var lx2 = w * LANE_X[pt.lane];
        if (u < 0.35) { var v = u / 0.35; x = pt.x; y = sy + (splitY - sy) * v * v; }
        else { var v2 = (u - 0.35) / 0.65; var e = v2 * v2 * (3 - 2 * v2);
          // bezier from (sx, splitY) to (lx2, binTop)
          var p0x = pt.x, p0y = splitY, c1x = sx, c1y = splitY + (binTop - splitY) * 0.6, c2x = lx2, c2y = splitY + (binTop - splitY) * 0.4, p3x = lx2, p3y = binTop + binH * (1 - Math.min(1, levels[pt.lane])) * 0.9;
          var mt = 1 - e;
          x = mt * mt * mt * p0x + 3 * mt * mt * e * c1x + 3 * mt * e * e * c2x + e * e * e * p3x;
          y = mt * mt * mt * p0y + 3 * mt * mt * e * c1y + 3 * mt * e * e * c2y + e * e * e * p3y;
        }
        ctx.fillStyle = COLORS[pt.lane]; ctx.globalAlpha = 0.9;
        ctx.shadowColor = COLORS[pt.lane]; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(x, y, 2.8, 0, 6.283); ctx.fill();
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      // source label
      ctx.fillStyle = 'rgba(233,229,216,.55)'; ctx.font = '500 11px "IBM Plex Mono", Menlo, monospace'; ctx.textAlign = 'center';
      ctx.fillText('SWAP FEES', sx, sy - 10);
    };
  }

  function loop(now) {
    if (!document.hidden) {
      if (net) drawNet(now);
      if (split) drawSplit(now);
    }
    if (!reduced) requestAnimationFrame(loop);
  }
  layout(); update();
  if (!reduced) requestAnimationFrame(loop);
  else { if (net) drawNet(0); if (split) drawSplit(0); }
})();
