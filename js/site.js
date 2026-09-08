/* OWL site — wires the page to the clock. */
(function () {
  'use strict';
  var C = window.OwlClock;
  if (!C) return;

  var TZ = C.TZ;
  var STATES = C.STATES;
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

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hm(min) { return Math.floor(min / 60) + ':' + pad(min % 60); }
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
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

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
  var tip = $('tip');
  weekEl.addEventListener('mousemove', function (e) {
    var seg = e.target.closest ? e.target.closest('.seg') : null;
    if (!seg) { tip.classList.remove('show'); return; }
    tip.textContent = seg.getAttribute('data-tip');
    tip.style.left = e.clientX + 'px';
    tip.style.top = e.clientY + 'px';
    tip.classList.add('show');
  });
  weekEl.addEventListener('mouseleave', function () { tip.classList.remove('show'); });

  /* render */
  var rows = Array.prototype.slice.call(document.querySelectorAll('#states tr[data-state]'));
  var statusWord = $('status-word');
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
  function eyesOpen() { return html.getAttribute('data-state') !== 'asleep'; }
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

  render();
  setInterval(render, 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
  drift();
  requestAnimationFrame(frame);
  setTimeout(blink, 3000);
})();
