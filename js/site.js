/* OWL site — wires the clock and the data to the page. */
(function () {
  'use strict';
  var C = window.OwlClock, D = window.OwlData;
  if (!C) return;

  var TZ = C.TZ;
  var STATES = C.STATES;
  var ORDER = ['asleep', 'stirring', 'awake', 'hunting'];
  var COLORS = { asleep: '#24262B', stirring: '#5A4621', awake: '#AD8433', hunting: '#F5B942' };
  var html = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /* URL controls
   *   ?state=hunting                 preview a state (page shows it, clock keeps running)
   *   ?at=2026-09-11T20:00:00-04:00  run the live clock from that moment
   */
  var params = new URLSearchParams(location.search);
  var offset = 0;
  var atParam = params.get('at');
  if (atParam) { var t = Date.parse(atParam); if (!isNaN(t)) offset = t - Date.now(); }
  var preview = null;
  var stateParam = params.get('state');
  if (stateParam && STATES[stateParam]) preview = stateParam;
  function now() { return new Date(Date.now() + offset); }

  /* formatters */
  var fTime = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' });
  var fDay = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' });
  var fDate = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
  var fClock = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  var fRange = new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric' });
  var fLog = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hm(min) { return Math.floor(min / 60) + ':' + pad(min % 60); }
  function fmtUsd(n, dec) { return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }); }
  function fmtNum(n) { return Number(n).toLocaleString('en-US'); }
  function fmtSpan(ms) {
    if (ms < 60000) return 'under a minute';
    var m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
    m %= 60; h %= 24;
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + pad(m) + 'm';
    return m + 'm';
  }
  // "at 16:00 ET" when today, otherwise "Mon 9:30 ET"
  function whenText(date, et, prefix) {
    var p = C.parts(date);
    var same = p.dayNum === et.dayNum;
    var pre = prefix === undefined ? 'at ' : (prefix ? prefix + ' ' : '');
    return (same ? pre : fDay.format(date) + ' ') + fTime.format(date).replace(/^0/, '') + ' ET';
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  /* copy */
  var PREVIEW_LEDE = {
    asleep: 'The NYSE is open. The anchor is deep. OWL wins routing on price.',
    stirring: 'Extended hours. The anchor is thinning. The fee climbs.',
    awake: 'No anchor. OWL pools are the price.',
    hunting: 'Weekend. 48+ hours of pure onchain discovery. OWL pools are the price.'
  };
  function huntHoliday(info) {
    if (!info.since || !info.until) return info.holiday;
    var a = C.parts(info.since).dayNum, b = C.parts(info.until).dayNum;
    for (var n = a; n <= b; n++) { var h = C.dayInfo(n).holiday; if (h) return h; }
    return null;
  }
  function ledeFor(info) {
    switch (info.state.key) {
      case 'asleep': return 'The NYSE is open. The anchor is deep. OWL wins routing on price.';
      case 'stirring': return info.phase === 'premarket'
        ? 'Before the bell. The anchor is thin. The fee climbs.'
        : 'After the bell. Extended hours. The anchor is thinning.';
      case 'awake': return 'No anchor until 4:00. OWL pools are the price.';
      default: {
        var hol = huntHoliday(info);
        var hours = info.since && info.until ? Math.round((info.until - info.since) / 3600000) : 0;
        return (hol ? 'The NYSE is closed for ' + hol + '.' : 'It is the weekend.')
          + (hours ? ' The exchange dreams for ' + hours + ' hours.' : '')
          + ' OWL pools are the price.';
      }
    }
  }

  /* tooltip */
  var tip = $('tip');
  function showTip(text, x, y) { tip.textContent = text; tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.classList.add('show'); }
  function hideTip() { tip.classList.remove('show'); }

  /* week strip */
  var weekEl = $('week');
  var weekMonday = null;
  function buildWeek(wk) {
    weekEl.innerHTML = '';
    var axis = el('div', 'week-axis');
    [[0, '0:00'], [240, '4:00'], [570, '9:30'], [960, '16:00'], [1200, '20:00'], [1440, '24:00']].forEach(function (tk) {
      var sp = el('span'); sp.style.left = (tk[0] / 1440 * 100) + '%'; sp.textContent = tk[1]; axis.appendChild(sp);
    });
    weekEl.appendChild(axis);
    wk.days.forEach(function (day) {
      var lab = el('div', 'week-day' + (day.today ? ' today' : ''));
      lab.appendChild(document.createTextNode(DAYS[day.info.wd]));
      var sm = el('small'); sm.textContent = day.info.d; lab.appendChild(sm);
      var bar = el('div', 'week-bar' + (day.today ? ' today' : ''));
      day.segments.forEach(function (sg) {
        var i = el('i', 'seg seg-' + sg.state.key);
        i.style.left = 'calc(' + (sg.from / 1440 * 100) + '% + 1px)';
        i.style.width = 'calc(' + ((sg.to - sg.from) / 1440 * 100) + '% - 2px)';
        var note = day.info.holiday ? ' · ' + day.info.holiday : (day.info.early ? ' · 13:00 early close' : '');
        i.setAttribute('data-tip', DAYS[day.info.wd] + ' ' + hm(sg.from) + '–' + hm(sg.to) + ' · ' + sg.state.label + ' · ' + sg.state.feeText + note);
        bar.appendChild(i);
      });
      weekEl.appendChild(lab);
      weekEl.appendChild(bar);
    });
    var line = el('div', 'week-now'); line.id = 'week-now'; weekEl.appendChild(line);
    $('week-range').textContent = fRange.format(C.wallToDate(wk.monday, 720)) + ' – ' + fRange.format(C.wallToDate(wk.monday + 6, 720)) + ' · ET';
  }
  function updateNow(wk) {
    var line = $('week-now');
    if (!line) return;
    line.style.setProperty('--now', (wk.nowMinute / 1440).toFixed(4));
    line.style.setProperty('--now-top', (wk.todayIndex * 31 + 12) + 'px');
  }
  weekEl.addEventListener('mousemove', function (e) {
    var seg = e.target.closest ? e.target.closest('.seg') : null;
    if (!seg) { hideTip(); return; }
    showTip(seg.getAttribute('data-tip'), e.clientX, e.clientY);
  });
  weekEl.addEventListener('mouseleave', hideTip);

  /* dial: today's 24 hours as a ring */
  var dial = $('dial');
  var dialDay = null;
  var SVG = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) { var e = document.createElementNS(SVG, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function polar(min, r) { var a = (min / 1440) * Math.PI * 2 - Math.PI / 2; return [60 + r * Math.cos(a), 60 + r * Math.sin(a)]; }
  function arcPath(from, to, r) {
    var a = polar(from, r), b = polar(to - 0.001, r);
    var large = (to - from) > 720 ? 1 : 0;
    return 'M' + a[0].toFixed(2) + ' ' + a[1].toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + b[0].toFixed(2) + ' ' + b[1].toFixed(2);
  }
  function buildDial(wk) {
    dial.innerHTML = '';
    dial.appendChild(svgEl('circle', { class: 'track', cx: 60, cy: 60, r: 46 }));
    var day = wk.days[wk.todayIndex];
    day.segments.forEach(function (sg) {
      var p = svgEl('path', { class: 'arc ' + sg.state.key, d: arcPath(sg.from, sg.to, 46) });
      p.setAttribute('data-tip', hm(sg.from) + '–' + hm(sg.to) + ' · ' + sg.state.label + ' · ' + sg.state.feeText);
      p.setAttribute('data-state', sg.state.key);
      dial.appendChild(p);
    });
    [[240, '4'], [570, '9:30'], [960, '16'], [1200, '20'], [0, '0']].forEach(function (lb) {
      var pt = polar(lb[0], 58);
      var t = svgEl('text', { x: pt[0].toFixed(1), y: (pt[1] + 2.5).toFixed(1) });
      t.textContent = lb[1];
      dial.appendChild(t);
    });
    dial.appendChild(svgEl('line', { class: 'hand', id: 'dial-hand', x1: 60, y1: 60, x2: 60, y2: 8 }));
    dial.appendChild(svgEl('circle', { class: 'hub', cx: 60, cy: 60, r: 3 }));
  }
  function updateDial(wk, shownKey) {
    var hand = $('dial-hand');
    if (!hand) return;
    var p = polar(wk.nowMinute, 52);
    hand.setAttribute('x2', p[0].toFixed(2)); hand.setAttribute('y2', p[1].toFixed(2));
    var arcs = dial.querySelectorAll('.arc');
    for (var i = 0; i < arcs.length; i++) arcs[i].classList.toggle('dim', preview ? arcs[i].getAttribute('data-state') !== shownKey : false);
  }
  dial.addEventListener('mousemove', function (e) {
    var a = e.target.closest ? e.target.closest('.arc') : null;
    if (!a) { hideTip(); return; }
    showTip(a.getAttribute('data-tip'), e.clientX, e.clientY);
  });
  dial.addEventListener('mouseleave', hideTip);

  /* render */
  var rows = Array.prototype.slice.call(document.querySelectorAll('#states tr[data-state]'));
  var statusWord = $('status-word');
  var lastLive = null;
  function render() {
    var d = now();
    var live = C.at(d);
    var s = preview ? STATES[preview] : live.state;

    html.setAttribute('data-state', s.key);
    html.setAttribute('data-live', preview ? 'false' : 'true');

    var upper = s.label.toUpperCase();
    if (statusWord.textContent !== upper) {
      statusWord.textContent = upper;
      if (!reduced) { statusWord.classList.remove('swap'); void statusWord.offsetWidth; statusWord.classList.add('swap'); }
    }
    $('lede').textContent = preview ? PREVIEW_LEDE[s.key] : ledeFor(live);
    $('fee').textContent = s.feeText;
    $('nav-state').textContent = preview ? s.label + ' · preview' : s.label;
    $('nav-fee').textContent = s.feeText;
    $('eyebrow').textContent = preview ? 'Preview · not live · ' + s.hours : (offset ? 'Simulated clock · Eastern time' : 'Live · NYSE clock · Eastern time');

    $('clock').textContent = fDate.format(d) + ' · ' + fClock.format(d) + ' ET';
    $('nav-time').textContent = fClock.format(d).slice(0, 5) + ' ET';

    if (preview) {
      $('next').textContent = s.hours;
      $('next-in').textContent = '';
      $('since').textContent = 'Preview';
    } else {
      if (live.until && live.nextState) {
        $('next').textContent = live.nextState.verb + ' ' + whenText(live.until, live.et);
        $('next-in').textContent = 'in ' + fmtSpan(live.until - d);
      }
      $('since').textContent = live.since ? whenText(live.since, live.et, '') + ' · ' + fmtSpan(d - live.since) : '—';
    }

    rows.forEach(function (tr) {
      tr.classList.toggle('is-now', tr.getAttribute('data-state') === live.state.key);
      tr.classList.toggle('is-preview', !!preview && tr.getAttribute('data-state') === preview && preview !== live.state.key);
    });

    // Hunt window: buybacks run whenever the NYSE is closed. Always live.
    var open = live.state.key !== 'asleep';
    $('hunt-state').textContent = open ? 'Open' : 'Closed';
    var nx = C.nextWhere(d, open
      ? function (st) { return st.key === 'asleep'; }
      : function (st) { return st.key !== 'asleep'; });
    $('hunt-next').textContent = nx ? (open ? 'Closes ' : 'Opens ') + whenText(nx.date, live.et) + ' · in ' + fmtSpan(nx.date - d) : '';

    var wk = C.week(d);
    if (wk.monday !== weekMonday) { buildWeek(wk); weekMonday = wk.monday; }
    updateNow(wk);
    if (dialDay !== wk.todayIndex + wk.monday) { buildDial(wk); dialDay = wk.todayIndex + wk.monday; }
    updateDial(wk, s.key);

    if (!lastLive || lastLive.state !== live.state) { lastLive = live; renderDetailFees(live); renderQuote(live); }
    else { lastLive = live; renderQuoteNext(live); }
  }

  /* preview controls */
  function setPreview(key) {
    var live = C.at(now()).state.key;
    preview = key === live ? null : key;
    render();
  }
  function goLive() { preview = null; render(); }
  rows.forEach(function (tr) {
    tr.addEventListener('click', function () { setPreview(tr.getAttribute('data-state')); });
    tr.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPreview(tr.getAttribute('data-state')); }
    });
  });
  $('backlive').addEventListener('click', goLive);
  $('backlive-hero').addEventListener('click', goLive);

  /* the owl watches */
  var owl = $('owl');
  var tracks = owl.querySelectorAll('.pupil-track');
  var target = { x: 0, y: 0 }, cur = { x: 0, y: 0 }, hasPointer = false;
  function eyesOpen() { return html.getAttribute('data-state') !== 'asleep' && !html.classList.contains('pre'); }
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    hasPointer = true;
    var r = owl.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height * 0.47;
    var dx = e.clientX - cx, dy = e.clientY - cy;
    var dist = Math.hypot(dx, dy) || 1;
    var k = Math.min(1, dist / 260);
    target = { x: dx / dist * 13 * k, y: dy / dist * 11 * k };
  }, { passive: true });
  function drift() {
    if (!hasPointer && !reduced && eyesOpen()) target = { x: (Math.random() * 2 - 1) * 10, y: (Math.random() * 2 - 1) * 6 };
    setTimeout(drift, 1800 + Math.random() * 2600);
  }
  function frame() {
    var tx = eyesOpen() ? target.x : 0, ty = eyesOpen() ? target.y : 0;
    cur.x += (tx - cur.x) * 0.1;
    cur.y += (ty - cur.y) * 0.1;
    var tf = 'translate(' + cur.x.toFixed(2) + ' ' + cur.y.toFixed(2) + ')';
    for (var i = 0; i < tracks.length; i++) tracks[i].setAttribute('transform', tf);
    requestAnimationFrame(frame);
  }
  function blink() {
    if (!reduced && eyesOpen()) {
      owl.classList.add('blink');
      setTimeout(function () { owl.classList.remove('blink'); }, 300);
    }
    setTimeout(blink, 4500 + Math.random() * 5000);
  }

  /* ---------- data: nests, stats, hunt log, quote ---------- */

  var data = null;
  var sortKey = 'tvl', sortDir = 'desc', query = '', showAll = false, openTicker = null;
  var nestsBody = $('nests-body');

  function visibleNests() {
    var q = query.trim().toUpperCase();
    var list = data.nests.filter(function (n) { return !q || n.ticker.indexOf(q) === 0 || n.name.toUpperCase().indexOf(q) >= 0; });
    list.sort(function (a, b) {
      var va = a[sortKey], vb = b[sortKey];
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return list;
  }

  function sparkline(nest) {
    var svg = svgEl('svg', { class: 'spark', viewBox: '0 0 240 72', preserveAspectRatio: 'none' });
    var max = 1; nest.hourly.forEach(function (h) { if (h.volume > max) max = h.volume; });
    nest.hourly.forEach(function (h, i) {
      var v = h.volume / max * 64;
      var r = svgEl('rect', { x: (i * 10 + 1).toFixed(1), y: (70 - v).toFixed(1), width: 8, height: v.toFixed(1), rx: 1.5, fill: COLORS[h.state] });
      var title = svgEl('title', {}); title.textContent = hm(h.hour) + ' · ' + STATES[h.state].label + ' · ' + fmtUsd(h.volume);
      r.appendChild(title);
      svg.appendChild(r);
    });
    return svg;
  }

  function detailFor(nest, live) {
    var wrap = el('div', 'detail');
    // fee + share by state
    var c1 = el('div');
    c1.appendChild(el('h4', null, 'Fee in this nest'));
    var fn = el('div', 'fee-now'); fn.setAttribute('data-role', 'fee-now'); c1.appendChild(fn);
    var stats = el('div', 'detail-stats');
    [['Lifetime fees', fmtUsd(nest.feesLifetime)], ['To the parliament · 7d', fmtUsd(Math.round(nest.fees7d * 0.7))]].forEach(function (p) {
      var dv = el('div'); dv.appendChild(document.createTextNode(p[0])); dv.appendChild(el('b', null, p[1])); stats.appendChild(dv);
    });
    c1.appendChild(stats);
    c1.appendChild(el('h4', null, 'Where its fees come from · this week'));
    var ul = el('ul', 'by-state-mini');
    var prof = D.weekProfile(now());
    ORDER.forEach(function (k) {
      var li = el('li');
      var lab = el('span'); lab.appendChild(el('i', 'sw sw-' + k)); lab.appendChild(document.createTextNode(' ' + STATES[k].label)); lab.style.display = 'inline-flex'; lab.style.gap = '.45rem'; lab.style.alignItems = 'center';
      var bar = el('div', 'bar'); var fill = el('i'); fill.style.width = (prof.byState[k] * 100).toFixed(1) + '%'; fill.style.background = COLORS[k]; bar.appendChild(fill);
      li.appendChild(lab); li.appendChild(bar); li.appendChild(el('span', 'pct', (prof.byState[k] * 100).toFixed(0) + '%'));
      ul.appendChild(li);
    });
    c1.appendChild(ul);
    // sparkline
    var c2 = el('div');
    c2.appendChild(el('h4', null, 'Volume · last 24 hours'));
    c2.appendChild(sparkline(nest));
    var cap = el('div', 'spark-cap'); cap.appendChild(el('span', null, hm(nest.hourly[0].hour))); cap.appendChild(el('span', null, 'now')); c2.appendChild(cap);
    // actions
    var c3 = el('div', 'detail-actions');
    var b1 = el('button', 'btn btn-primary btn-sm', 'Fee quote'); b1.type = 'button'; b1.setAttribute('data-open-drawer', 'swap'); b1.setAttribute('data-route', nest.ticker);
    var b2 = el('button', 'btn btn-ghost btn-sm', 'Provide liquidity'); b2.type = 'button'; b2.setAttribute('data-open-drawer', 'lp'); b2.setAttribute('data-route', nest.ticker);
    c3.appendChild(b1); c3.appendChild(b2);
    wrap.appendChild(c1); wrap.appendChild(c2); wrap.appendChild(c3);
    return wrap;
  }

  function renderDetailFees(live) {
    var s = preview ? STATES[preview] : live.state;
    var els = document.querySelectorAll('[data-role="fee-now"]');
    for (var i = 0; i < els.length; i++) { els[i].textContent = s.feeText; var sm = el('small', null, s.label); els[i].appendChild(sm); }
  }

  function renderNests() {
    if (!data) return;
    var list = visibleNests();
    var shown = showAll || query ? list : list.slice(0, 12);
    nestsBody.innerHTML = '';
    if (!shown.length) {
      var tr0 = el('tr', 'empty'); var td0 = el('td', null, 'No nest matches "' + query + '".'); td0.colSpan = 6; tr0.appendChild(td0); nestsBody.appendChild(tr0);
    }
    var live = C.at(now());
    shown.forEach(function (n) {
      var tr = el('tr', 'nest' + (openTicker === n.ticker ? ' open' : ''));
      tr.setAttribute('data-ticker', n.ticker); tr.tabIndex = 0; tr.setAttribute('role', 'button'); tr.setAttribute('aria-expanded', openTicker === n.ticker ? 'true' : 'false');
      var td = el('td'); var pair = el('span', 'n-pair'); pair.appendChild(el('span', 'tk', n.ticker)); pair.appendChild(document.createTextNode(n.pair + ' ')); pair.appendChild(el('small', null, n.name)); td.appendChild(pair); tr.appendChild(td);
      [['TVL', fmtUsd(n.tvl), ''], ['24h volume', fmtUsd(n.vol24h), ''], ['24h fees', fmtUsd(n.fees24h), 'fees'], ['7d fees', fmtUsd(n.fees7d), 'fees'], ['Parliament', fmtNum(n.lps), '']].forEach(function (c) {
        var t = el('td', 'num' + (c[2] ? ' ' + c[2] : ''), c[1]); t.setAttribute('data-label', c[0]); tr.appendChild(t);
      });
      nestsBody.appendChild(tr);
      var dr = el('tr', 'nest-detail' + (openTicker === n.ticker ? ' open' : '')); dr.setAttribute('data-ticker', n.ticker);
      var dtd = el('td'); dtd.colSpan = 6;
      var wrap = el('div', 'detail-wrap'); var inner = el('div', 'detail-inner'); inner.appendChild(detailFor(n, live)); wrap.appendChild(inner); dtd.appendChild(wrap); dr.appendChild(dtd);
      nestsBody.appendChild(dr);
    });
    renderDetailFees(live);
    var more = $('nests-more');
    more.hidden = !!query || list.length <= 12;
    more.textContent = showAll ? 'Show fewer' : 'Show all ' + list.length + ' nests';
    $('nests-total').textContent = list.length + ' nests · TVL ' + fmtUsd(data.totals.tvl) + ' · 24h volume ' + fmtUsd(data.totals.vol24h);
  }

  function toggleNest(ticker) {
    openTicker = openTicker === ticker ? null : ticker;
    var trs = nestsBody.querySelectorAll('tr[data-ticker]');
    for (var i = 0; i < trs.length; i++) {
      var on = trs[i].getAttribute('data-ticker') === openTicker;
      trs[i].classList.toggle('open', on);
      if (trs[i].classList.contains('nest')) trs[i].setAttribute('aria-expanded', on ? 'true' : 'false');
    }
  }
  nestsBody.addEventListener('click', function (e) {
    if (e.target.closest('[data-open-drawer]')) return;
    var tr = e.target.closest('tr.nest');
    if (tr) toggleNest(tr.getAttribute('data-ticker'));
  });
  nestsBody.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var tr = e.target.closest('tr.nest');
    if (tr) { e.preventDefault(); toggleNest(tr.getAttribute('data-ticker')); }
  });
  Array.prototype.forEach.call(document.querySelectorAll('#nests-table th[data-sort]'), function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-sort');
      if (sortKey === k) sortDir = sortDir === 'desc' ? 'asc' : 'desc';
      else { sortKey = k; sortDir = k === 'ticker' ? 'asc' : 'desc'; }
      Array.prototype.forEach.call(document.querySelectorAll('#nests-table th[data-sort]'), function (o) { o.removeAttribute('data-dir'); });
      th.setAttribute('data-dir', sortDir);
      renderNests();
    });
  });
  $('nest-search').addEventListener('input', function (e) { query = e.target.value; renderNests(); });
  $('nests-more').addEventListener('click', function () { showAll = !showAll; renderNests(); if (!showAll) $('nests').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); });

  /* stats */
  function countUp(elm, target, fmt) {
    var start = null, from = target * 0.6, dur = 1100;
    if (reduced) { elm.textContent = fmt(target); return; }
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min(1, (ts - start) / dur); p = 1 - Math.pow(1 - p, 3);
      elm.textContent = fmt(Math.round(from + (target - from) * p));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function renderStats() {
    var t = data.totals;
    var tiles = [
      ['t-tvl', t.tvl, fmtUsd], ['t-fees7d', Math.round(t.fees7d * 0.7), fmtUsd], ['t-vol', t.vol24h, fmtUsd],
      ['t-fees24h', t.fees24h, fmtUsd], ['t-bought', data.hunt.boughtOwl, function (n) { return fmtNum(n) + ' OWL'; }], ['t-lps', t.lps, fmtNum]
    ];
    tiles.forEach(function (x) { $(x[0]).textContent = x[2](x[1]); });
    $('t-bought-note').textContent = fmtUsd(data.hunt.boughtUsd) + ' across ' + fmtNum(data.hunt.count) + ' buys. All while the NYSE was closed.';
    $('t-nests-note').textContent = 'LP positions across ' + data.nests.length + ' nests.';
    $('stats-updated').textContent = 'Updated ' + fLog.format(new Date(data.updated)) + ' ET';
    if ('IntersectionObserver' in window) {
      var seen = false;
      var io = new IntersectionObserver(function (entries) {
        if (seen || !entries[0].isIntersecting) return;
        seen = true; io.disconnect();
        tiles.forEach(function (x) { countUp($(x[0]), x[1], x[2]); });
      }, { threshold: 0.3 });
      io.observe($('tiles'));
    }
  }

  /* fee chart: 168 bars */
  var chart = $('fee-chart');
  var chartData = null;
  function buildChartData() {
    var prof = D.weekProfile(now());
    var total = data.totals.fees7d;
    chartData = { hours: prof.hours.map(function (h) { return { day: h.dayIndex, wd: h.wd, hour: h.hour, state: h.state.key, usd: h.feeShare * total }; }), byState: prof.byState, total: total, week: prof.week };
    var ul = $('by-state'); ul.innerHTML = '';
    ORDER.forEach(function (k) {
      var li = el('li');
      var lab = el('span'); lab.appendChild(el('i', 'sw sw-' + k)); lab.appendChild(document.createTextNode(STATES[k].label + ' · ' + STATES[k].feeText));
      var b = el('b', null, fmtUsd(Math.round(prof.byState[k] * total)));
      var bar = el('div', 'bar'); var fill = el('i'); fill.style.width = (prof.byState[k] * 100).toFixed(1) + '%'; fill.style.background = COLORS[k]; bar.appendChild(fill);
      li.appendChild(lab); li.appendChild(b); li.appendChild(bar);
      li.appendChild(el('span', 'muted', ' ' + (prof.byState[k] * 100).toFixed(0) + '% of the week'));
      ul.appendChild(li);
    });
    $('chart-range').textContent = fRange.format(C.wallToDate(prof.week.monday, 720)) + ' – ' + fRange.format(C.wallToDate(prof.week.monday + 6, 720)) + ' · by hour · ET';
  }
  var chartGeom = null, chartHover = -1;
  function drawChart() {
    if (!chartData) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = chart.getBoundingClientRect();
    var W = Math.max(300, rect.width), H = rect.height || 260;
    chart.width = Math.round(W * dpr); chart.height = Math.round(H * dpr);
    var ctx = chart.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var padL = 6, padR = 6, padT = 26, padB = 26;
    var innerW = W - padL - padR, innerH = H - padT - padB;
    var n = chartData.hours.length, dayGap = 8;
    var barW = (innerW - dayGap * 6) / n;
    var max = 0; chartData.hours.forEach(function (h) { if (h.usd > max) max = h.usd; });
    var dayTotals = [0, 0, 0, 0, 0, 0, 0];
    chartData.hours.forEach(function (h) { dayTotals[h.day] += h.usd; });
    chartGeom = [];
    var nowP = C.parts(now());
    var todayIdx = chartData.week.todayIndex, nowHour = Math.floor(nowP.minute / 60);
    ctx.font = '500 10px "IBM Plex Mono", Menlo, monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // baseline
    ctx.strokeStyle = 'rgba(233,229,216,.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT + innerH + .5); ctx.lineTo(W - padR, padT + innerH + .5); ctx.stroke();
    chartData.hours.forEach(function (h, i) {
      var x = padL + i * barW + h.day * dayGap;
      var bh = Math.max(1.5, h.usd / max * innerH);
      var y = padT + innerH - bh;
      var future = (h.day > todayIdx) || (h.day === todayIdx && h.hour > nowHour);
      ctx.globalAlpha = future ? 0.42 : 1;
      ctx.fillStyle = COLORS[h.state];
      if (i === chartHover) ctx.fillStyle = '#E9E5D8';
      var w = Math.max(1, barW - 1.2);
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, w, bh, [2, 2, 0, 0]) : ctx.rect(x, y, w, bh);
      ctx.fill();
      chartGeom.push({ x: x, w: w, i: i });
      if (h.day === todayIdx && h.hour === nowHour) {
        ctx.globalAlpha = 1; ctx.fillStyle = '#E9E5D8';
        ctx.beginPath(); ctx.arc(x + w / 2, y - 6, 2.5, 0, 6.283); ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
    // day labels + totals
    for (var d = 0; d < 7; d++) {
      var x0 = padL + d * 24 * barW + d * dayGap, x1 = x0 + 24 * barW - 1.2;
      var info = chartData.week.days[d].info;
      ctx.fillStyle = d === todayIdx ? '#E9E5D8' : 'rgba(233,229,216,.55)';
      ctx.textAlign = 'left';
      ctx.fillText(DAYS[info.wd] + (info.holiday ? ' · ' + info.holiday : ''), x0, H - 8);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(233,229,216,.75)';
      ctx.fillText(fmtUsd(Math.round(dayTotals[d])), x1, padT - 10);
    }
  }
  chart.addEventListener('mousemove', function (e) {
    if (!chartGeom) return;
    var r = chart.getBoundingClientRect(), x = e.clientX - r.left, hit = -1;
    for (var i = 0; i < chartGeom.length; i++) if (x >= chartGeom[i].x - .6 && x <= chartGeom[i].x + chartGeom[i].w + .6) { hit = i; break; }
    if (hit !== chartHover) { chartHover = hit; drawChart(); }
    if (hit >= 0) { var h = chartData.hours[hit]; showTip(DAYS[h.wd] + ' ' + hm(h.hour * 60) + '–' + hm(h.hour * 60 + 60) + ' · ' + STATES[h.state].label + ' · ' + fmtUsd(h.usd, 2), e.clientX, e.clientY); }
    else hideTip();
  });
  chart.addEventListener('mouseleave', function () { chartHover = -1; drawChart(); hideTip(); });
  window.addEventListener('resize', function () { drawChart(); });

  /* hunt log */
  function renderHuntLog() {
    var tb = $('hunt-log').querySelector('tbody'); tb.innerHTML = '';
    data.buybacks.forEach(function (b) {
      var tr = el('tr');
      tr.appendChild(el('td', null, fLog.format(new Date(b.time))));
      var st = el('td'); var sp = el('span', 'st'); sp.appendChild(el('i', 'sw sw-' + b.state)); sp.appendChild(document.createTextNode(STATES[b.state].label)); st.appendChild(sp); tr.appendChild(st);
      tr.appendChild(el('td', 'num owl', fmtNum(b.owl) + ' OWL'));
      tr.appendChild(el('td', 'num', fmtUsd(b.usd)));
      tr.appendChild(el('td', 'tx', b.tx ? b.tx : 'at launch'));
      tb.appendChild(tr);
    });
  }

  /* quote drawer */
  var drawer = $('drawer'), lastFocus = null;
  function openDrawer(tab, route) {
    setTab(tab || 'swap');
    if (route) { $('q-route').value = route + '>OWL'; $('lp-nest').value = route; }
    html.classList.add('drawer-open'); drawer.setAttribute('aria-hidden', 'false');
    lastFocus = document.activeElement;
    setTimeout(function () { var f = drawer.querySelector('.tab-panel.active input, .tab-panel.active select'); if (f) f.focus(); }, 350);
    renderQuote(C.at(now())); renderLp();
  }
  function closeDrawer() {
    html.classList.remove('drawer-open'); drawer.setAttribute('aria-hidden', 'true');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function setTab(tab) {
    Array.prototype.forEach.call(drawer.querySelectorAll('.tab'), function (t) { t.setAttribute('aria-selected', t.getAttribute('data-tab') === tab ? 'true' : 'false'); });
    Array.prototype.forEach.call(drawer.querySelectorAll('.tab-panel'), function (p) { p.classList.toggle('active', p.id === 'tab-' + tab); });
  }
  document.addEventListener('click', function (e) {
    var o = e.target.closest('[data-open-drawer]');
    if (o) { e.preventDefault(); openDrawer(o.getAttribute('data-open-drawer'), o.getAttribute('data-route')); return; }
    if (e.target.closest('[data-close-drawer]')) { closeDrawer(); return; }
    var t = e.target.closest('.tab');
    if (t) setTab(t.getAttribute('data-tab'));
  });
  $('drawer-close').addEventListener('click', closeDrawer);
  $('scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (html.classList.contains('drawer-open')) closeDrawer(); if (html.classList.contains('menu-open')) toggleMenu(false); }
  });

  function fillSelects() {
    var route = $('q-route'); route.innerHTML = '';
    var opts = [['USDC>OWL', 'USDC → OWL']];
    data.nests.forEach(function (n) { opts.push([n.ticker + '>OWL', n.ticker + ' → OWL']); });
    data.nests.slice(0, 8).forEach(function (n) { opts.push(['OWL>' + n.ticker, 'OWL → ' + n.ticker]); });
    opts.forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; route.appendChild(op); });
    var lp = $('lp-nest'); lp.innerHTML = '';
    data.nests.forEach(function (n) { var op = el('option', null, n.pair + ' · TVL ' + fmtUsd(n.tvl)); op.value = n.ticker; lp.appendChild(op); });
  }
  function amountOf(id, dflt) { var v = parseFloat($(id).value); return isNaN(v) || v < 0 ? dflt : v; }
  function renderQuote(live) {
    var s = preview ? STATES[preview] : live.state;
    var amt = amountOf('q-amount', 0);
    $('q-state').textContent = s.label + ' · ' + s.feeText;
    $('q-fee').textContent = fmtUsd(amt * s.fee / 100, 2);
    $('q-fee-note').textContent = 'of ' + fmtUsd(amt);
    Array.prototype.forEach.call($('q-states').querySelectorAll('tr'), function (tr) {
      var k = tr.getAttribute('data-state');
      tr.querySelector('.num').textContent = fmtUsd(amt * STATES[k].fee / 100, 2);
      tr.classList.toggle('is-now', k === s.key);
    });
    renderQuoteNext(live);
  }
  function renderQuoteNext(live) {
    if (!html.classList.contains('drawer-open')) return;
    var amt = amountOf('q-amount', 0);
    var q = $('q-next');
    if (preview) { q.textContent = 'Previewing ' + STATES[preview].label + '. The live fee is ' + live.state.feeText + '.'; return; }
    if (!live.until || !live.nextState) { q.textContent = ''; return; }
    q.innerHTML = '';
    q.appendChild(document.createTextNode(live.nextState.verb + ' ' + whenText(live.until, live.et) + ' · in ' + fmtSpan(live.until - now()) + '. The same swap then pays '));
    q.appendChild(el('b', null, fmtUsd(amt * live.nextState.fee / 100, 2)));
    q.appendChild(document.createTextNode('.'));
  }
  function renderLp() {
    if (!data) return;
    var tk = $('lp-nest').value; var n = null;
    for (var i = 0; i < data.nests.length; i++) if (data.nests[i].ticker === tk) n = data.nests[i];
    if (!n) return;
    var dep = amountOf('lp-amount', 0);
    var share = dep > 0 ? dep / (n.tvl + dep) : 0;
    $('lp-share').textContent = (share * 100).toFixed(share < 0.1 ? 2 : 1) + '%';
    $('lp-fees').textContent = fmtUsd(share * n.fees7d * 0.7, 2);
    $('lp-note').textContent = n.pair + ' holds ' + fmtUsd(n.tvl) + ' and earned ' + fmtUsd(n.fees7d) + ' in fees over the last 7 days. ' + fmtNum(n.lps) + ' owls in this parliament.';
  }
  $('q-amount').addEventListener('input', function () { renderQuote(C.at(now())); });
  $('q-route').addEventListener('change', function () { renderQuote(C.at(now())); });
  $('lp-amount').addEventListener('input', renderLp);
  $('lp-nest').addEventListener('change', renderLp);

  /* mobile menu */
  function toggleMenu(force) {
    var on = typeof force === 'boolean' ? force : !html.classList.contains('menu-open');
    html.classList.toggle('menu-open', on);
    $('burger').setAttribute('aria-expanded', on ? 'true' : 'false');
  }
  $('burger').addEventListener('click', function () { toggleMenu(); });
  $('menu').addEventListener('click', function (e) { if (e.target.closest('a')) toggleMenu(false); });

  /* boot */
  html.classList.add('pre');
  render();
  setInterval(render, 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
  setTimeout(function () { html.classList.remove('pre'); }, reduced ? 0 : 420);
  drift();
  requestAnimationFrame(frame);
  setTimeout(blink, 3000);

  if (D) {
    D.load().then(function (d) {
      data = d;
      html.setAttribute('data-sample', d.sample ? 'true' : 'false');
      fillSelects();
      renderNests();
      renderStats();
      buildChartData();
      drawChart();
      renderHuntLog();
      renderLp();
      renderQuote(C.at(now()));
    });
  }
})();
