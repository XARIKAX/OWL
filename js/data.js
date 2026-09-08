/*
 * OWL data — nests, stats, and the hunt log.
 *
 * Live data arrives at launch. Until then this module generates a
 * deterministic SAMPLE dataset from the fee model so the utilities UI
 * shows how the mechanism behaves. Every surface that renders it shows a
 * "Sample data" badge while `sample` is true.
 *
 * To go live: publish data/nests.json in the shape of data/nests.example.json
 * with "sample": false. The loader prefers that file when present.
 *
 * Volume model (relative volume per hour, by state):
 *   asleep 1.00 · stirring 0.55 · awake 0.35 · hunting 0.25
 * Fees = volume x fee rate of the hour.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./owl-clock.js'));
  else root.OwlData = factory(root.OwlClock);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  var VOLUME_WEIGHT = { asleep: 1.0, stirring: 0.55, awake: 0.35, hunting: 0.25 };
  var SAMPLE_PRICE_USD = 0.0031;

  var TICKERS = [
    ['AAPL', 'Apple'], ['TSLA', 'Tesla'], ['NVDA', 'NVIDIA'], ['SPY', 'S&P 500'], ['MSFT', 'Microsoft'],
    ['AMZN', 'Amazon'], ['GOOGL', 'Alphabet'], ['META', 'Meta'], ['AMD', 'AMD'], ['PLTR', 'Palantir'],
    ['AVGO', 'Broadcom'], ['TSM', 'TSMC'], ['ASML', 'ASML'], ['NFLX', 'Netflix'], ['COIN', 'Coinbase'],
    ['HOOD', 'Robinhood'], ['MSTR', 'Strategy'], ['QQQ', 'Nasdaq 100'], ['IBM', 'IBM'], ['INTC', 'Intel'],
    ['NET', 'Cloudflare'], ['SOXX', 'Semiconductors'], ['CRWD', 'CrowdStrike'], ['ORCL', 'Oracle'], ['UBER', 'Uber'],
    ['SHOP', 'Shopify'], ['ARM', 'Arm'], ['MU', 'Micron'], ['LLY', 'Eli Lilly'], ['JPM', 'JPMorgan']
  ];

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Fee-weighted hourly profile over the ET week containing `date`.
  // Returns { hours: [{dayIndex, hour, state, weight, feeShare}], byState: {key: share}, blended }
  function weekProfile(date) {
    var wk = C.week(date);
    var hours = [], total = 0, vol = 0, byState = { asleep: 0, stirring: 0, awake: 0, hunting: 0 };
    for (var di = 0; di < 7; di++) {
      var day = wk.days[di];
      for (var h = 0; h < 24; h++) {
        var st = C.stateAtWall(day.info.dayNum, h * 60 + 30).state;
        var w = VOLUME_WEIGHT[st.key];
        var f = w * st.fee / 100;
        hours.push({ dayIndex: di, dayNum: day.info.dayNum, wd: day.info.wd, hour: h, state: st, weight: w, fee: f });
        total += f; vol += w; byState[st.key] += f;
      }
    }
    for (var i = 0; i < hours.length; i++) hours[i].feeShare = hours[i].fee / total;
    for (var k in byState) byState[k] = byState[k] / total;
    return { hours: hours, byState: byState, blended: total / vol, week: wk };
  }

  // A typical trading day's blended fee rate (volume-weighted).
  var DAY_BLENDED = (6.5 * 1.0 * 0.0005 + 9.5 * 0.55 * 0.003 + 8 * 0.35 * 0.006) / (6.5 * 1.0 + 9.5 * 0.55 + 8 * 0.35);

  function generate(seed, now) {
    now = now || new Date();
    var rnd = mulberry32(seed || 20260908);
    var nests = [];
    for (var i = 0; i < TICKERS.length; i++) {
      var tvl = Math.round(52000 * Math.exp(-i * 0.105) * (0.8 + rnd() * 0.4));
      var vol24h = Math.round(tvl * (0.35 + rnd() * 1.6));
      var fees24h = Math.round(vol24h * DAY_BLENDED * (0.85 + rnd() * 0.3));
      var fees7d = Math.round(fees24h * (6.2 + rnd() * 1.4));
      var lifetime = Math.round(fees7d * (3.5 + rnd() * 4));
      var lps = Math.round(3 + tvl / 900 * (0.6 + rnd() * 0.8));
      // 24 hourly volumes for the last day, shaped by the model with noise
      var hourly = [];
      var et = C.parts(now);
      for (var h = 23; h >= 0; h--) {
        var m = et.dayNum * 1440 + et.minute - h * 60;
        var dn = Math.floor(m / 1440), mi = ((m % 1440) + 1440) % 1440;
        var st = C.stateAtWall(dn, mi).state;
        hourly.push({ hour: mi, state: st.key, volume: VOLUME_WEIGHT[st.key] * (0.6 + rnd() * 0.8) });
      }
      var sum = 0; for (var j = 0; j < hourly.length; j++) sum += hourly[j].volume;
      for (j = 0; j < hourly.length; j++) hourly[j].volume = Math.round(hourly[j].volume / sum * vol24h);
      nests.push({
        ticker: TICKERS[i][0], name: TICKERS[i][1], pair: TICKERS[i][0] + ' / OWL',
        tvl: tvl, vol24h: vol24h, fees24h: fees24h, fees7d: fees7d, feesLifetime: lifetime, lps: lps, hourly: hourly
      });
    }
    // Buybacks: the last 7 days, only while the NYSE was closed.
    var buybacks = [];
    var t0 = now.getTime();
    var tries = 0;
    while (buybacks.length < 14 && tries < 400) {
      tries++;
      var t = new Date(t0 - rnd() * 7 * 86400000);
      var info = C.at(t);
      if (info.state.key === 'asleep') continue;
      var usd = Math.round((90 + rnd() * 720) * (info.state.key === 'hunting' ? 1.5 : 1));
      buybacks.push({ time: t.toISOString(), state: info.state.key, usd: usd, owl: Math.round(usd / SAMPLE_PRICE_USD) });
    }
    buybacks.sort(function (a, b) { return a.time < b.time ? 1 : -1; });
    var totals = { tvl: 0, vol24h: 0, fees24h: 0, fees7d: 0, feesLifetime: 0, lps: 0 };
    for (i = 0; i < nests.length; i++) for (var k in totals) totals[k] += nests[i][k];
    var boughtUsd = Math.round(totals.feesLifetime * 0.2);
    return {
      sample: true,
      updated: now.toISOString(),
      priceUsd: SAMPLE_PRICE_USD,
      nests: nests,
      buybacks: buybacks,
      totals: totals,
      hunt: { boughtUsd: boughtUsd, boughtOwl: Math.round(boughtUsd / SAMPLE_PRICE_USD), count: Math.round(totals.feesLifetime / 420) }
    };
  }

  function load(url) {
    var fallback = function () { return generate(); };
    if (typeof fetch !== 'function' || typeof location === 'undefined' || location.protocol === 'file:') return Promise.resolve(fallback());
    return fetch(url || 'data/nests.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('no data file'); return r.json(); })
      .then(function (d) { if (!d || !d.nests) throw new Error('bad data'); return d; })
      .catch(fallback);
  }

  return { load: load, generate: generate, weekProfile: weekProfile, VOLUME_WEIGHT: VOLUME_WEIGHT, DAY_BLENDED: DAY_BLENDED, TICKERS: TICKERS };
});
