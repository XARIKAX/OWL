/*
 * OWL clock — the same clock the hook reads.
 *
 * Four states, decided entirely by the NYSE calendar in Eastern Time:
 *
 *   asleep    Mon–Fri 09:30–16:00          NYSE open. Fee 0.05%.
 *   stirring  04:00–09:30, 16:00–20:00     Extended hours. Fee 0.30%.
 *   awake     20:00–04:00 between two trading days. Fee 0.60%.
 *   hunting   weekends + NYSE holidays (from the last after-hours close
 *             to the next pre-market open). Fee 1.00%.
 *
 * Early-close days (13:00) shorten the asleep window and end after-hours
 * at 17:00. Holidays follow the NYSE rules, computed for any year.
 *
 * No dependencies. Works in the browser (window.OwlClock) and in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OwlClock = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TZ = 'America/New_York';
  var DAY = 86400000;

  var STATES = {
    asleep:   { key: 'asleep',   label: 'Asleep',   verb: 'Sleeps', fee: 0.05, feeText: '0.05%', hours: 'Mon–Fri 9:30–16:00 ET' },
    stirring: { key: 'stirring', label: 'Stirring', verb: 'Stirs',  fee: 0.30, feeText: '0.30%', hours: '4:00–9:30 and 16:00–20:00 ET' },
    awake:    { key: 'awake',    label: 'Awake',    verb: 'Wakes',  fee: 0.60, feeText: '0.60%', hours: 'Overnight 20:00–4:00 ET' },
    hunting:  { key: 'hunting',  label: 'Hunting',  verb: 'Hunts',  fee: 1.00, feeText: '1.00%', hours: 'Weekends and NYSE holidays' }
  };

  // Minutes since ET midnight.
  var PRE_OPEN = 4 * 60;
  var OPEN = 9 * 60 + 30;
  var CLOSE = 16 * 60;
  var EARLY_CLOSE = 13 * 60;
  var AFTER_HOURS_END = 20 * 60;
  var EARLY_AFTER_HOURS_END = 17 * 60;

  // Unscheduled full-day closures (national days of mourning, emergencies).
  // Add 'YYYY-MM-DD': 'Reason' entries here when the NYSE announces one.
  var EXTRA_CLOSURES = {};

  /* ---------- calendar helpers (pure UTC arithmetic on calendar days) ---------- */

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function dayNumOf(y, m, d) { return Math.round(Date.UTC(y, m - 1, d) / DAY); }
  function dateOfDayNum(n) {
    var t = new Date(n * DAY);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay() };
  }
  function weekdayOf(y, m, d) { return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }

  function nthWeekday(y, m, weekday, n) {
    var first = weekdayOf(y, m, 1);
    return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  }
  function lastWeekday(y, m, weekday) {
    var lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var wd = weekdayOf(y, m, lastDay);
    return lastDay - ((wd - weekday + 7) % 7);
  }
  // Gregorian Easter (anonymous algorithm).
  function easter(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
        f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
        h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
        l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
        month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return { m: month, d: day };
  }
  // Saturday holidays are observed Friday, Sunday holidays Monday.
  function observed(y, m, d) {
    var wd = weekdayOf(y, m, d);
    var n = dayNumOf(y, m, d) + (wd === 6 ? -1 : wd === 0 ? 1 : 0);
    var t = dateOfDayNum(n);
    return { y: t.y, m: t.m, d: t.d };
  }

  var holidayCache = {};
  function holidaysForYear(y) {
    if (holidayCache[y]) return holidayCache[y];
    var h = {};
    function add(o, name) { h[ymd(o.y, o.m, o.d)] = name; }

    // New Year's Day: not observed when Jan 1 falls on a Saturday (NYSE rule).
    var ny = weekdayOf(y, 1, 1);
    if (ny === 0) add({ y: y, m: 1, d: 2 }, "New Year's Day");
    else if (ny !== 6) add({ y: y, m: 1, d: 1 }, "New Year's Day");
    // Jan 1 of next year on a Sunday is observed Monday Jan 2 of next year — handled in that year.

    add({ y: y, m: 1, d: nthWeekday(y, 1, 1, 3) }, 'Martin Luther King Jr. Day');
    add({ y: y, m: 2, d: nthWeekday(y, 2, 1, 3) }, "Washington's Birthday");
    var e = easter(y);
    var gf = dateOfDayNum(dayNumOf(y, e.m, e.d) - 2);
    add({ y: gf.y, m: gf.m, d: gf.d }, 'Good Friday');
    add({ y: y, m: 5, d: lastWeekday(y, 5, 1) }, 'Memorial Day');
    if (y >= 2022) add(observed(y, 6, 19), 'Juneteenth');
    add(observed(y, 7, 4), 'Independence Day');
    add({ y: y, m: 9, d: nthWeekday(y, 9, 1, 1) }, 'Labor Day');
    add({ y: y, m: 11, d: nthWeekday(y, 11, 4, 4) }, 'Thanksgiving Day');
    add(observed(y, 12, 25), 'Christmas Day');

    for (var k in EXTRA_CLOSURES) if (k.slice(0, 4) === String(y)) h[k] = EXTRA_CLOSURES[k];
    holidayCache[y] = h;
    return h;
  }

  var earlyCache = {};
  function earlyClosesForYear(y) {
    if (earlyCache[y]) return earlyCache[y];
    var h = holidaysForYear(y);
    var e = {};
    function weekdayNotHoliday(m, d) {
      var wd = weekdayOf(y, m, d);
      return wd >= 1 && wd <= 5 && !h[ymd(y, m, d)];
    }
    if (weekdayNotHoliday(7, 3)) e[ymd(y, 7, 3)] = 'Day before Independence Day';
    e[ymd(y, 11, nthWeekday(y, 11, 4, 4) + 1)] = 'Day after Thanksgiving';
    if (weekdayNotHoliday(12, 24)) e[ymd(y, 12, 24)] = 'Christmas Eve';
    earlyCache[y] = e;
    return e;
  }

  var dayCache = {};
  function dayInfo(n) {
    if (dayCache[n]) return dayCache[n];
    var t = dateOfDayNum(n);
    var key = ymd(t.y, t.m, t.d);
    var holiday = holidaysForYear(t.y)[key] || null;
    var weekend = t.wd === 0 || t.wd === 6;
    var early = earlyClosesForYear(t.y)[key] || null;
    var info = {
      dayNum: n, y: t.y, m: t.m, d: t.d, wd: t.wd, ymd: key,
      weekend: weekend, holiday: holiday, trading: !weekend && !holiday,
      early: early,
      close: early ? EARLY_CLOSE : CLOSE,
      afterHoursEnd: early ? EARLY_AFTER_HOURS_END : AFTER_HOURS_END
    };
    dayCache[n] = info;
    return info;
  }

  function closedReason(info) {
    return { reason: info.holiday ? 'holiday' : 'weekend', holiday: info.holiday };
  }

  /* ---------- state by wall-clock ---------- */

  // State at a given ET calendar day and minute of that day.
  function stateAtWall(n, minute) {
    var di = dayInfo(n);
    var r;
    if (!di.trading) { r = closedReason(di); return { state: STATES.hunting, reason: r.reason, holiday: r.holiday }; }
    if (minute < PRE_OPEN) {
      var prev = dayInfo(n - 1);
      if (prev.trading) return { state: STATES.awake };
      r = closedReason(prev);
      return { state: STATES.hunting, reason: r.reason, holiday: r.holiday };
    }
    if (minute < OPEN) return { state: STATES.stirring, phase: 'premarket' };
    if (minute < di.close) return { state: STATES.asleep };
    if (minute < di.afterHoursEnd) return { state: STATES.stirring, phase: 'afterhours' };
    var next = dayInfo(n + 1);
    if (next.trading) return { state: STATES.awake };
    r = closedReason(next);
    return { state: STATES.hunting, reason: r.reason, holiday: r.holiday };
  }

  // Transitions inside one ET day, in order: [{minute, state}]
  function transitionsForDay(n) {
    var di = dayInfo(n);
    if (!di.trading) return [];
    return [
      { minute: PRE_OPEN, state: STATES.stirring },
      { minute: OPEN, state: STATES.asleep },
      { minute: di.close, state: STATES.stirring },
      { minute: di.afterHoursEnd, state: stateAtWall(n, di.afterHoursEnd).state }
    ];
  }

  function nextTransition(n, minute, pred) {
    for (var d = 0; d < 21; d++) {
      var ts = transitionsForDay(n + d);
      for (var i = 0; i < ts.length; i++) {
        if (d === 0 && ts[i].minute <= minute) continue;
        if (!pred || pred(ts[i].state)) return { dayNum: n + d, minute: ts[i].minute, state: ts[i].state };
      }
    }
    return null;
  }

  function prevTransition(n, minute) {
    for (var d = 0; d < 21; d++) {
      var ts = transitionsForDay(n - d);
      for (var i = ts.length - 1; i >= 0; i--) {
        if (d === 0 && ts[i].minute > minute) continue;
        return { dayNum: n - d, minute: ts[i].minute, state: ts[i].state };
      }
    }
    return null;
  }

  /* ---------- instants <-> Eastern wall clock ---------- */

  var partsFmt = null;
  function parts(date) {
    if (!partsFmt) {
      partsFmt = new Intl.DateTimeFormat('en-US', {
        timeZone: TZ, hourCycle: 'h23',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric'
      });
    }
    var o = {};
    var ps = partsFmt.formatToParts(date);
    for (var i = 0; i < ps.length; i++) if (ps[i].type !== 'literal') o[ps[i].type] = parseInt(ps[i].value, 10);
    var h = o.hour === 24 ? 0 : o.hour;
    var n = dayNumOf(o.year, o.month, o.day);
    return { y: o.year, m: o.month, d: o.day, h: h, mi: o.minute, s: o.second,
             wd: dateOfDayNum(n).wd, dayNum: n, minute: h * 60 + o.minute };
  }

  // ET offset from UTC at an instant, in minutes (EDT = -240, EST = -300).
  function offsetAt(date) {
    var p = parts(date);
    var asUTC = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
    return Math.round((asUTC - (date.getTime() - date.getMilliseconds())) / 60000);
  }

  // Instant for an ET calendar day + minute of day.
  function wallToDate(n, minute) {
    var t = dateOfDayNum(n);
    var naive = Date.UTC(t.y, t.m - 1, t.d, Math.floor(minute / 60), minute % 60);
    var guess = naive;
    for (var i = 0; i < 2; i++) guess = naive - offsetAt(new Date(guess)) * 60000;
    return new Date(guess);
  }

  /* ---------- public ---------- */

  function at(date) {
    date = date || new Date();
    var et = parts(date);
    var cur = stateAtWall(et.dayNum, et.minute);
    var next = nextTransition(et.dayNum, et.minute, function (s) { return s !== cur.state; });
    var prev = prevTransition(et.dayNum, et.minute);
    return {
      state: cur.state,
      reason: cur.reason || null,
      holiday: cur.holiday || null,
      phase: cur.phase || null,
      et: et,
      day: dayInfo(et.dayNum),
      since: prev ? wallToDate(prev.dayNum, prev.minute) : null,
      until: next ? wallToDate(next.dayNum, next.minute) : null,
      nextState: next ? next.state : null,
      nextDayNum: next ? next.dayNum : null
    };
  }

  // First future transition into a state matching pred.
  function nextWhere(date, pred) {
    var et = parts(date || new Date());
    var t = nextTransition(et.dayNum, et.minute, pred);
    return t ? { date: wallToDate(t.dayNum, t.minute), state: t.state, dayNum: t.dayNum } : null;
  }

  // Segments for each day of the ET week (Mon..Sun) containing date.
  function week(date) {
    var et = parts(date || new Date());
    var monday = et.dayNum - ((et.wd + 6) % 7);
    var days = [];
    for (var i = 0; i < 7; i++) {
      var n = monday + i;
      var segs = [];
      var start = 0;
      var state = stateAtWall(n, 0).state;
      var ts = transitionsForDay(n);
      for (var j = 0; j < ts.length; j++) {
        segs.push({ from: start, to: ts[j].minute, state: state });
        start = ts[j].minute;
        state = ts[j].state;
      }
      segs.push({ from: start, to: 1440, state: state });
      days.push({ info: dayInfo(n), segments: segs, today: n === et.dayNum });
    }
    return { days: days, monday: monday, nowMinute: et.minute + et.s / 60, todayIndex: et.dayNum - monday };
  }

  return {
    TZ: TZ,
    STATES: STATES,
    at: at,
    nextWhere: nextWhere,
    week: week,
    parts: parts,
    dayInfo: dayInfo,
    wallToDate: wallToDate,
    holidaysForYear: holidaysForYear,
    earlyClosesForYear: earlyClosesForYear,
    stateAtWall: stateAtWall
  };
});
