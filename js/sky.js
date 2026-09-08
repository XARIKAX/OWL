/*
 * OWL sky — the night behind the page.
 * Stars, fireflies, a pine horizon, and a moon, on one fixed canvas.
 * Reads html[data-state]: the darker the market, the more alive the sky.
 */
(function () {
  'use strict';
  var canvas = document.getElementById('sky');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var html = document.documentElement;
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  var NIGHT = { asleep: 0.22, stirring: 0.55, awake: 0.85, hunting: 1 };
  var FLIES = { asleep: 6, stirring: 22, awake: 48, hunting: 84 };

  var W = 0, H = 0, DPR = 1;
  var stars = [], flies = [], horizon = null, sprite = null;
  var night = 0.85, targetNight = 0.85, flyTarget = 48;
  var mouse = { x: 0.5, y: 0.4 }, eye = { x: 0.5, y: 0.4 };
  var scrollY = 0, t0 = performance.now(), running = true;

  function rand(seed) { var a = seed >>> 0; return function () { a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildStars(); buildHorizon(); buildSprite();
  }

  function buildStars() {
    var r = rand(7); stars = [];
    var n = Math.round((W * H) / 6500);
    for (var i = 0; i < n; i++) {
      stars.push({ x: r() * W, y: r() * H * 0.9, z: 0.3 + r() * 0.7, s: 0.5 + r() * 1.3, p: r() * 6.28, f: 0.4 + r() * 1.2 });
    }
  }

  function buildSprite() {
    sprite = document.createElement('canvas'); var s = 64; sprite.width = s; sprite.height = s;
    var c = sprite.getContext('2d');
    var g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,225,150,1)'); g.addColorStop(0.18, 'rgba(245,185,66,0.85)');
    g.addColorStop(0.45, 'rgba(245,185,66,0.18)'); g.addColorStop(1, 'rgba(245,185,66,0)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
  }

  // Two silhouettes drawn once: far hills and a near pine line.
  function buildHorizon() {
    horizon = document.createElement('canvas');
    horizon.width = Math.round((W + 80) * DPR); horizon.height = Math.round(H * 0.34 * DPR);
    var c = horizon.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0);
    var w = W + 80, h = H * 0.34, r = rand(11);
    // far hills
    c.fillStyle = '#090C16';
    c.beginPath(); c.moveTo(0, h);
    var x = 0; var y = h * 0.62;
    c.lineTo(0, y);
    while (x < w) { x += 60 + r() * 120; y = h * (0.5 + r() * 0.2); c.quadraticCurveTo(x - 40, y - 20 - r() * 40, x, y); }
    c.lineTo(w, h); c.closePath(); c.fill();
    // near pines
    c.fillStyle = '#05070D';
    c.beginPath(); c.moveTo(0, h);
    x = 0;
    while (x < w) {
      var base = h * (0.78 + r() * 0.1), ph = 40 + r() * 110, pw = 14 + r() * 26;
      c.lineTo(x, base);
      var tiers = 3 + Math.floor(r() * 3);
      for (var t = 0; t < tiers; t++) {
        var ty = base - ph * (t + 1) / tiers, half = pw * (1 - t / tiers) * 0.5 + 3;
        c.lineTo(x + pw / 2 - half, ty + ph / tiers * 0.35);
        c.lineTo(x + pw / 2, ty);
        c.lineTo(x + pw / 2 + half, ty + ph / tiers * 0.35);
      }
      c.lineTo(x + pw, base);
      x += pw + r() * 6;
    }
    c.lineTo(w, h); c.closePath(); c.fill();
    // ground
    c.fillStyle = '#04060B'; c.fillRect(0, h * 0.9, w, h * 0.1);
  }

  function spawnFly(r) {
    return { x: Math.random() * W, y: H * (0.35 + Math.random() * 0.6), s: 1.2 + Math.random() * 2.2, a: Math.random() * 6.28, sp: 0.12 + Math.random() * 0.25, ph: Math.random() * 6.28, bl: 1.5 + Math.random() * 3, life: 0 };
  }

  function readState() {
    var s = html.getAttribute('data-state') || 'awake';
    targetNight = NIGHT[s] != null ? NIGHT[s] : 0.85;
    flyTarget = FLIES[s] != null ? FLIES[s] : 48;
    if (coarse || W < 720) flyTarget = Math.round(flyTarget * 0.5);
    if (reduced) flyTarget = 0;
  }

  function draw(now) {
    var t = (now - t0) / 1000;
    night += (targetNight - night) * 0.02;
    eye.x += (mouse.x - eye.x) * 0.04; eye.y += (mouse.y - eye.y) * 0.04;
    var px = (eye.x - 0.5), py = (eye.y - 0.5);

    // sky
    var g = ctx.createLinearGradient(0, 0, 0, H);
    var dawn = 1 - night;
    g.addColorStop(0, 'rgb(' + Math.round(6 + dawn * 6) + ',' + Math.round(8 + dawn * 10) + ',' + Math.round(15 + dawn * 22) + ')');
    g.addColorStop(0.75, 'rgb(' + Math.round(6 + dawn * 9) + ',' + Math.round(8 + dawn * 13) + ',' + Math.round(15 + dawn * 28) + ')');
    g.addColorStop(1, '#04060B');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // moon
    var mx = W * 0.82 + px * -18, my = H * 0.16 + py * -10 - scrollY * 0.03, mr = Math.min(W, H) * 0.06;
    var mo = 0.05 + night * 0.5;
    var halo = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 6);
    halo.addColorStop(0, 'rgba(233,229,216,' + (0.10 * mo).toFixed(3) + ')'); halo.addColorStop(1, 'rgba(233,229,216,0)');
    ctx.fillStyle = halo; ctx.fillRect(mx - mr * 6, my - mr * 6, mr * 12, mr * 12);
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, 6.283); ctx.fillStyle = 'rgba(233,229,216,' + (0.16 * mo).toFixed(3) + ')'; ctx.fill();

    // stars
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var tw = reduced ? 0.8 : 0.55 + 0.45 * Math.sin(t * s.f + s.p);
      var a = tw * night * (0.35 + s.z * 0.55);
      if (a < 0.02) continue;
      var sx = s.x + px * -30 * s.z, sy = s.y + py * -18 * s.z - scrollY * 0.08 * s.z;
      sy = ((sy % H) + H) % H;
      ctx.fillStyle = 'rgba(233,229,216,' + a.toFixed(3) + ')';
      ctx.fillRect(sx, sy, s.s, s.s);
    }

    // horizon
    var hh = H * 0.34;
    ctx.drawImage(horizon, -40 + px * -14, H - hh + 10 + Math.min(scrollY * 0.06, 80), W + 80, hh);

    // fireflies
    while (flies.length < flyTarget) flies.push(spawnFly());
    if (flies.length > flyTarget && Math.random() < 0.05) flies.pop();
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < flies.length; i++) {
      var f = flies[i];
      f.a += (Math.sin(t * 0.7 + f.ph) * 0.02);
      f.x += Math.cos(f.a) * f.sp; f.y += Math.sin(f.a) * f.sp * 0.6 - 0.05;
      if (f.x < -20) f.x = W + 20; if (f.x > W + 20) f.x = -20;
      if (f.y < H * 0.25) f.y = H * 0.95; if (f.y > H) f.y = H * 0.3;
      var bl = 0.5 + 0.5 * Math.sin(t * (6.28 / f.bl) + f.ph);
      bl = Math.pow(bl, 3) * (0.5 + night * 0.5);
      if (bl < 0.03) continue;
      var sz = f.s * 10 * (0.7 + bl * 0.5);
      ctx.globalAlpha = bl;
      ctx.drawImage(sprite, f.x - sz / 2, f.y - sz / 2 + py * -6, sz, sz);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function loop(now) {
    if (!running) return;
    draw(now);
    if (!reduced) requestAnimationFrame(loop);
  }

  window.addEventListener('resize', function () { resize(); if (reduced) draw(performance.now()); });
  window.addEventListener('scroll', function () { scrollY = window.scrollY || 0; }, { passive: true });
  document.addEventListener('pointermove', function (e) { if (e.pointerType === 'touch') return; mouse.x = e.clientX / W; mouse.y = e.clientY / H; }, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) running = false;
    else if (!running) { running = true; t0 = performance.now() - 1000; requestAnimationFrame(loop); }
  });
  new MutationObserver(readState).observe(html, { attributes: true, attributeFilter: ['data-state'] });

  resize(); readState(); night = targetNight;
  requestAnimationFrame(loop);
})();
