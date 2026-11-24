/* ===========================================================================
   USD-INR Rates — the Workspace screen (module key "fxrates").
   24 Nov 2026.

   This file is embedded into index.html by server/patch-fx-rates.js, between
   the markers  __fx:start / __fx:end . Edit THIS file, then re-run the patch.

   The backend is live and is not touched from here:
     edge function fx-api  (actions fxState / fxRefresh / fxRecipientSave /
     fxRecipientDelete / fxSettings / fxSendTest), and the two pg_cron jobs
     fx-usd-inr-10am (04:30 UTC = 10:00 IST) and fx-usd-inr-retry.
   fx_rates and fx_recipients are RLS-locked, so every read goes through the
   function with the Workspace session token — never from the browser.

   House style on purpose: ES5 (var / function), the Workspace's own tokens and
   components (.ops-tiles, .tabs, .btn, .empty, .card), and its own helpers
   (esc, toast, opsDay, opsPill). The only new CSS is the fx- block below, put
   in once at first render so index.html's stylesheet is left alone.
   =========================================================================== */

var FX_FN_URL = SUPABASE_URL + "/functions/v1/fx-api";

function fxApi(action, payload) {
  if (state.demo) return Promise.reject(new Error("Not available in demo mode."));
  return fetch(FX_FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + ANON_KEY, "apikey": ANON_KEY },
    body: JSON.stringify(Object.assign({ action: action, session_token: (state.doer || {}).session_token || "" }, payload || {}))
  }).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) {
      if (!r.ok || !j.ok) {
        /* fx-api answers 401 "Not allowed" both for a dead session and for somebody who
           is not on the list, so say what to do rather than repeating the word. */
        var m = j.error || ("HTTP " + r.status);
        if (r.status === 401) m = "This screen isn't switched on for your login yet. Ask an admin to tick “USD–INR Rates” in Manage Visibility.";
        throw new Error(m);
      }
      return j;
    });
  });
}

/* ---------- small helpers ---------- */
var fxMoney = function (v) { return "₹" + (Number(v) || 0).toFixed(2); };
function fxDay(ymd) { if (!ymd) return "—"; try { return new Date(ymd + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }); } catch (e) { return String(ymd); } }
function fxLongDay(ymd) { if (!ymd) return "—"; try { return new Date(ymd + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }); } catch (e) { return String(ymd); } }
function fxRows() { return ((state.fx || {}).rows || []); }
function fxRange() { return state.fxRange || 30; }
function fxWindow() {
  var rows = fxRows(), n = fxRange();
  if (!rows.length) return [];
  var last = rows[rows.length - 1].d;
  var from = new Date(Date.parse(last + "T00:00:00Z") - (n - 1) * 864e5).toISOString().slice(0, 10);
  return rows.filter(function (x) { return x.d >= from; });
}

function fxCss() {
  if (document.getElementById("fx-css")) return;
  var s = document.createElement("style");
  s.id = "fx-css";
  s.textContent = [
    /* hero: the one loud thing on the page */
    ".fx-hero{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 22px;justify-content:space-between}",
    ".fx-rate{font-size:clamp(38px,6vw,52px);font-weight:800;line-height:1;color:var(--ink);font-variant-numeric:tabular-nums;letter-spacing:-.5px}",
    ".fx-chg{font-size:15px;font-weight:700;white-space:nowrap}",
    ".fx-chg.up{color:var(--ok)}.fx-chg.down{color:var(--bad)}.fx-chg.flat{color:var(--sub)}",
    ".fx-when{color:var(--sub);font-size:12.5px;margin-top:6px}",
    /* chart */
    ".fx-chartwrap{position:relative;margin-top:6px}",
    ".fx-chart{display:block;width:100%;height:auto;touch-action:pan-y}",
    ".fx-chart:focus-visible{outline:2px solid var(--brand);outline-offset:2px;border-radius:8px}",
    ".fx-tip{position:absolute;z-index:3;pointer-events:none;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:7px 10px;font-size:12.5px;box-shadow:0 8px 20px rgba(0,0,0,.14);white-space:nowrap;transform:translate(-50%,-100%);opacity:0;transition:opacity .08s}",
    ".fx-tip b{font-variant-numeric:tabular-nums}",
    ".fx-tip .fx-tipsrc{color:var(--sub);display:block;margin-top:2px;font-size:11.5px}",
    /* table */
    ".fx-tablebox{max-height:420px;overflow:auto;border:1px solid var(--line);border-radius:12px}",
    ".fx-tablebox table{width:100%;border-collapse:collapse;font-size:13.5px}",
    ".fx-tablebox th,.fx-tablebox td{padding:8px 12px;border-bottom:1px solid var(--line);text-align:left}",
    ".fx-tablebox th{position:sticky;top:0;background:var(--card);z-index:1;font-size:12px;color:var(--sub);font-weight:700}",
    ".fx-tablebox td.n{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}",
    ".fx-tablebox tr:last-child td{border-bottom:0}",
    /* recipients */
    ".fx-two{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}",
    /* a grid item defaults to min-width:auto, so the day table (long dates + source)
       stretched the column and pushed the whole page sideways on a phone. */
    ".fx-two>*{min-width:0}",
    ".fx-tablebox table{min-width:max-content}",
    ".fx-addrow{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 4px}",
    ".fx-addrow input{flex:1 1 180px;min-width:0}",
    ".fx-rec{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)}",
    ".fx-rec:last-child{border-bottom:0}",
    ".fx-rec .fx-who{min-width:0;flex:1 1 auto}",
    ".fx-rec .fx-nm{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".fx-rec .fx-em{color:var(--sub);font-size:12.5px;overflow-wrap:anywhere;word-break:break-word}",
    ".fx-rec.off .fx-nm,.fx-rec.off .fx-em{opacity:.55}",
    ".fx-rec .fx-acts{display:flex;gap:6px;flex-shrink:0}",
    ".fx-master{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--bg)}",
    ".fx-master input{width:auto;flex-shrink:0}",
    ".fx-soon{opacity:.72}",
    /* the rate riding in the bulletin bar at the top of every page */
    ".ticker-item.tk-fx{cursor:pointer;text-decoration:none;color:var(--sidebar-ink)}",
    ".ticker-item.tk-fx:hover b{text-decoration:underline}",
    ".ticker-item.tk-fx b{font-variant-numeric:tabular-nums}",
    ".ticker-item.tk-fx .tk-up{color:#7ee787}",
    ".ticker-item.tk-fx .tk-down{color:#ffa198}",
    ".ticker-item.tk-fx .tk-flat{color:var(--sidebar-sub)}",
    ".fx-soon .fx-rec,.fx-soon .fx-addrow{pointer-events:none}",
    "@media (max-width:780px){.fx-two{grid-template-columns:1fr}.fx-tablebox{max-height:340px}}"
  ].join("\n");
  document.head.appendChild(s);
}

/* ---------- loading / error / paint ---------- */
function renderFxRates() {
  fxCss();
  var wrap = document.getElementById("fxWrap");
  if (!wrap) return;
  if (!state.fx) wrap.innerHTML = '<div class="empty">Loading today\'s rate…</div>';
  fxApi("fxState").then(function (res) { state.fx = res; paintFxRates(); })
    .catch(function (e) {
      wrap.innerHTML = '<div class="empty"><p>' + esc(e.message) + '</p>' +
        '<button class="btn" data-fx="reload">Try again</button></div>';
    });
}

function paintFxRates() {
  var wrap = document.getElementById("fxWrap");
  if (!wrap) return;
  var fx = state.fx || {}, st = fx.stats;
  if (!st) {
    wrap.innerHTML = '<div class="empty"><p>No rates have been stored yet.</p>' +
      '<p class="sub">Fetch today\'s rate once and the daily history starts from there.</p>' +
      '<button class="btn" data-fx="refresh">Fetch today\'s rate</button></div>';
    return;
  }
  var chg = st.yesterday ? st.today.r - st.yesterday.r : 0;
  var pct = st.yesterday && st.yesterday.r ? (chg / st.yesterday.r) * 100 : 0;
  var dir = chg > 0 ? "up" : chg < 0 ? "down" : "flat";
  var arrow = chg > 0 ? "▲" : chg < 0 ? "▼" : "•";
  var chgText = st.yesterday
    ? arrow + " " + Math.abs(chg).toFixed(2) + " (" + Math.abs(pct).toFixed(2) + "%) " + (chg > 0 ? "up" : chg < 0 ? "down" : "level") + " vs yesterday"
    : "First day of the history";

  var hero = '<section class="card fx-hero" aria-label="Today\'s rate">' +
    '<div><div class="fx-rate">' + esc(fxMoney(st.today.r)) + '</div>' +
    '<div class="fx-chg ' + dir + '">' + esc(chgText) + '</div>' +
    '<div class="fx-when">1 USD in rupees · ' + esc(fxLongDay(st.today.d)) + ' · ' + esc(st.today.s || "market reference") + '</div></div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-fx="refresh">Refresh now</button></div>' +
    '</section>';

  var tile = function (v, l) { return { v: v, l: l }; };
  var kpis = opsTiles([
    tile(st.yesterday ? fxMoney(st.yesterday.r) : "—", st.yesterday ? "Yesterday · " + fxDay(st.yesterday.d) : "Yesterday · no earlier day"),
    tile(fxMoney(st.week.lo.r), "Week low · " + fxDay(st.week.lo.d)),
    tile(fxMoney(st.week.hi.r), "Week high · " + fxDay(st.week.hi.d)),
    tile(fxMoney(st.month.lo.r), "Month low · " + fxDay(st.month.lo.d)),
    tile(fxMoney(st.month.hi.r), "Month high · " + fxDay(st.month.hi.d))
  ]);

  wrap.innerHTML = hero + kpis + fxChartCard() + '<div class="fx-two">' + fxTableCard() + fxMailCard() + '</div>' + fxWaCard();
  fxWireChart();
  /* turning a phone sideways changes the chart's shape, so draw it again - but only then */
  if (!window.__fxResize) {
    window.__fxResize = true;
    var was = fxGeo().W, t = 0;
    window.addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var now = fxGeo().W;
        if (now !== was && document.getElementById("fxWrap") && state.fx) { was = now; paintFxRates(); }
      }, 200);
    });
  }
}

/* the chart's shape: a phone keeps a usable height instead of a 113px squiggle */
function fxGeo() {
  var narrow = (window.innerWidth || 1200) < 640;
  return narrow ? { W: 380, H: 300, L: 44, R: 12, T: 14, B: 26 } : { W: 760, H: 240, L: 54, R: 16, T: 16, B: 26 };
}

/* ---------- the chart ----------
   One series, so no legend box: the card's heading says what is plotted.
   2px non-scaling line, a 12% wash under it, four hairline gridlines, the
   window's low / high / last value labelled and nothing else, crosshair +
   tooltip on hover, and arrow keys for the keyboard. */
function fxChartCard() {
  var win = fxWindow(), n = fxRange();
  var head = '<section class="card"><div class="page-head" style="margin:0 0 4px"><h3 style="margin:0">Rate day by day</h3>' +
    '<div class="tabs" role="tablist" aria-label="How far back">' +
    [[30, "30 days"], [90, "90 days"], [365, "1 year"]].map(function (x) {
      return '<button class="tab' + (x[0] === n ? " active" : "") + '" role="tab" aria-selected="' + (x[0] === n ? "true" : "false") + '" data-fxrange="' + x[0] + '">' + x[1] + "</button>";
    }).join("") + "</div></div>";
  if (win.length < 2) {
    return head + '<div class="empty">Only one day is stored so far — the line starts once there are two.</div></section>';
  }
  var g0 = fxGeo(), W = g0.W, H = g0.H, L = g0.L, R = g0.R, T = g0.T, B = g0.B;
  var lo = win[0], hi = win[0], i;
  for (i = 0; i < win.length; i++) { if (win[i].r < lo.r) lo = win[i]; if (win[i].r > hi.r) hi = win[i]; }
  var pad = Math.max((hi.r - lo.r) * 0.12, 0.05);
  var y0 = lo.r - pad, y1 = hi.r + pad;
  var px = function (ix) { return L + (W - L - R) * (win.length === 1 ? 0.5 : ix / (win.length - 1)); };
  var py = function (v) { return T + (H - T - B) * (1 - (v - y0) / (y1 - y0)); };

  /* y ticks on clean numbers */
  var step = (y1 - y0) / 4, mag = Math.pow(10, Math.floor(Math.log(step) / Math.LN10)), nice = [1, 2, 2.5, 5, 10];
  var tickStep = mag;
  for (i = 0; i < nice.length; i++) { if (nice[i] * mag >= step) { tickStep = nice[i] * mag; break; } }
  var ticks = [], tv = Math.ceil(y0 / tickStep) * tickStep;
  while (tv <= y1 && ticks.length < 6) { ticks.push(tv); tv += tickStep; }

  var line = win.map(function (p, ix) { return (ix ? "L" : "M") + px(ix).toFixed(1) + " " + py(p.r).toFixed(1); }).join(" ");
  var area = line + " L" + px(win.length - 1).toFixed(1) + " " + (H - B) + " L" + px(0).toFixed(1) + " " + (H - B) + " Z";
  var last = win[win.length - 1];

  var g = '<svg class="fx-chart" viewBox="0 0 ' + W + " " + H + '" role="img" tabindex="0" aria-label="' +
    esc("USD to INR, " + win.length + " days to " + fxLongDay(last.d) + ". Low " + fxMoney(lo.r) + " on " + fxDay(lo.d) + ", high " + fxMoney(hi.r) + " on " + fxDay(hi.d) + ", latest " + fxMoney(last.r) + ". The table below has every day.") + '">';
  ticks.forEach(function (t2) {
    g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + py(t2).toFixed(1) + '" y2="' + py(t2).toFixed(1) + '" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"/>' +
      '<text x="' + (L - 8) + '" y="' + (py(t2) + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="var(--sub)">' + t2.toFixed(2) + "</text>";
  });
  /* first and last date under the axis; the rest live in the tooltip and the table */
  g += '<text x="' + L + '" y="' + (H - 6) + '" font-size="11" fill="var(--sub)">' + esc(fxDay(win[0].d)) + "</text>" +
    '<text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end" font-size="11" fill="var(--sub)">' + esc(fxDay(last.d)) + "</text>";
  g += '<path d="' + area + '" fill="color-mix(in srgb, var(--brand) 12%, transparent)"/>';
  g += '<path d="' + line + '" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
  /* the window's low and high, named — not a number on every point */
  [[lo, "low"], [hi, "high"]].forEach(function (pair) {
    var p = pair[0], ix = win.indexOf(p), isLow = pair[1] === "low";
    g += '<circle cx="' + px(ix).toFixed(1) + '" cy="' + py(p.r).toFixed(1) + '" r="3.5" fill="var(--brand)" stroke="var(--card)" stroke-width="2"/>' +
      '<text x="' + px(ix).toFixed(1) + '" y="' + (py(p.r) + (isLow ? 16 : -9)).toFixed(1) + '" text-anchor="middle" font-size="11" fill="var(--sub)">' + esc(fxMoney(p.r)) + "</text>";
  });
  /* the end dot carries a surface ring so it stays legible over the line */
  g += '<circle cx="' + px(win.length - 1).toFixed(1) + '" cy="' + py(last.r).toFixed(1) + '" r="4.5" fill="var(--brand)" stroke="var(--card)" stroke-width="2"/>';
  g += '<line class="fx-cross" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--brand)" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" opacity="0"/>';
  g += '<circle class="fx-dot" r="4.5" fill="var(--brand)" stroke="var(--card)" stroke-width="2" opacity="0"/>';
  g += '<rect class="fx-hit" x="' + L + '" y="' + T + '" width="' + (W - L - R) + '" height="' + (H - T - B) + '" fill="transparent"/>';
  g += "</svg>";

  return head + '<div class="fx-chartwrap">' + g + '<div class="fx-tip" aria-hidden="true"></div></div>' +
    '<p class="sub" style="margin:8px 0 0;font-size:12px">Market reference rate (one point per published day; the market is closed at weekends). Bank rates differ a little.</p></section>';
}

function fxWireChart() {
  var svg = document.querySelector("#fxWrap .fx-chart");
  if (!svg) return;
  var win = fxWindow(), tip = document.querySelector("#fxWrap .fx-tip");
  var cross = svg.querySelector(".fx-cross"), dot = svg.querySelector(".fx-dot"), hit = svg.querySelector(".fx-hit");
  if (!tip || !cross || !dot || !hit || win.length < 2) return;
  var g1 = fxGeo(), W = g1.W, H = g1.H, L = g1.L, R = g1.R, T = g1.T, B = g1.B;
  var lo = win[0].r, hi = win[0].r;
  win.forEach(function (p) { lo = Math.min(lo, p.r); hi = Math.max(hi, p.r); });
  var pad = Math.max((hi - lo) * 0.12, 0.05), y0 = lo - pad, y1 = hi + pad;
  var px = function (ix) { return L + (W - L - R) * (ix / (win.length - 1)); };
  var py = function (v) { return T + (H - T - B) * (1 - (v - y0) / (y1 - y0)); };
  var cur = -1;
  function show(ix) {
    ix = Math.max(0, Math.min(win.length - 1, ix));
    cur = ix;
    var p = win[ix], x = px(ix), y = py(p.r);
    cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.setAttribute("opacity", "1");
    dot.setAttribute("cx", x); dot.setAttribute("cy", y); dot.setAttribute("opacity", "1");
    var box = svg.getBoundingClientRect();
    tip.innerHTML = "<b>" + esc(fxMoney(p.r)) + "</b> · " + esc(fxLongDay(p.d)) +
      '<span class="fx-tipsrc">' + esc(p.s || "market reference") + "</span>";
    tip.style.left = Math.max(60, Math.min(box.width - 60, (x / W) * box.width)) + "px";
    tip.style.top = Math.max(26, (y / H) * box.height - 10) + "px";
    tip.style.opacity = "1";
  }
  function hide() { cross.setAttribute("opacity", "0"); dot.setAttribute("opacity", "0"); tip.style.opacity = "0"; cur = -1; }
  function at(ev) {
    var box = svg.getBoundingClientRect();
    var vx = ((ev.clientX - box.left) / box.width) * W;
    var f = (vx - L) / (W - L - R);
    show(Math.round(f * (win.length - 1)));
  }
  /* the whole plot is the hit area, so a 2px line never has to be hit exactly */
  hit.addEventListener("pointermove", at);
  hit.addEventListener("pointerdown", at);
  svg.addEventListener("pointerleave", hide);
  svg.addEventListener("blur", hide);
  svg.addEventListener("keydown", function (ev) {
    if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
      ev.preventDefault();
      show((cur < 0 ? win.length - 1 : cur) + (ev.key === "ArrowRight" ? 1 : -1));
    } else if (ev.key === "Home") { ev.preventDefault(); show(0); }
    else if (ev.key === "End") { ev.preventDefault(); show(win.length - 1); }
    else if (ev.key === "Escape") hide();
  });
}

/* ---------- every day + CSV ---------- */
function fxTableCard() {
  var win = fxWindow().slice().reverse(), n = fxRange();
  var body = win.length
    ? '<div class="fx-tablebox"><table><thead><tr><th scope="col">Date</th><th scope="col" style="text-align:right">1 USD</th><th scope="col">Where it came from</th></tr></thead><tbody>' +
      win.map(function (p) {
        return "<tr><td>" + esc(fxLongDay(p.d)) + '</td><td class="n">' + esc(fxMoney(p.r)) + "</td><td>" + esc(p.s || "—") + "</td></tr>";
      }).join("") + "</tbody></table></div>"
    : '<div class="empty">Nothing stored for this period yet.</div>';
  return '<section class="card"><div class="page-head" style="margin:0 0 8px"><h3 style="margin:0">Every day</h3>' +
    '<button class="btn secondary" data-fx="csv">Download CSV (' + win.length + " row" + (win.length === 1 ? "" : "s") + ")</button></div>" +
    '<p class="sub" style="margin:0 0 8px;font-size:12px">The last ' + n + " days, newest first. The 30/90/365 buttons above change this too.</p>" + body + "</section>";
}

function fxCsv() {
  var win = fxWindow().slice().reverse();
  if (!win.length) { toast("Nothing to download yet."); return; }
  var rows = [["Date", "USD to INR", "Source"]].concat(win.map(function (p) { return [p.d, p.r.toFixed(4), p.s || ""]; }));
  var csv = rows.map(function (r) {
    return r.map(function (v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(",");
  }).join("\r\n");
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
  a.download = "usd-inr-last-" + fxRange() + "-days-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------- who gets the 10 AM email ---------- */
function fxMailCard() {
  var fx = state.fx || {}, recs = fx.recipients || [];
  var on = !(fx.settings && fx.settings.enabled === false);   /* never set = on */
  var live = recs.filter(function (r) { return r.active !== false; }).length;
  var myEmail = (state.doer || {}).email || "";
  var list = recs.length
    ? recs.map(function (r) {
        var off = r.active === false;
        return '<div class="fx-rec' + (off ? " off" : "") + '">' +
          '<div class="fx-who"><div class="fx-nm">' + esc(r.name || r.email.split("@")[0]) + (off ? " " + opsPill("paused", "grey") : "") + '</div>' +
          '<div class="fx-em">' + esc(r.email) + "</div></div>" +
          '<div class="fx-acts">' +
          '<button class="btn secondary" data-fxrec="' + esc(r.id) + '" data-fxact="' + (off ? "resume" : "pause") + '">' + (off ? "Resume" : "Pause") + "</button>" +
          '<button class="btn secondary" data-fxrec="' + esc(r.id) + '" data-fxact="delete" data-fxemail="' + esc(r.email) + '">Remove</button>' +
          "</div></div>";
      }).join("")
    : '<div class="empty" style="padding:22px">Nobody gets the email yet. Add the first address above.</div>';

  return '<section class="card"><h3 style="margin:0 0 2px">Who gets the 10 AM email</h3>' +
    '<p class="sub" style="margin:0;font-size:12px">Sent every morning at 10:00 IST with today\'s rate, the week\'s low and high and the month\'s low and high.</p>' +
    '<div class="fx-addrow">' +
    '<input type="email" id="fxEmail" placeholder="name@company.com" autocomplete="off" aria-label="Email address">' +
    '<input type="text" id="fxName" placeholder="Name (optional)" autocomplete="off" aria-label="Name">' +
    '<button class="btn" data-fx="add">Add</button></div>' +
    list +
    '<div class="fx-master" style="margin-top:12px">' +
    '<input type="checkbox" id="fxOn"' + (on ? " checked" : "") + ' data-fx="master" aria-label="Send the 10 AM email">' +
    '<label for="fxOn" style="margin:0;cursor:pointer"><b>' + (on ? "The 10 AM email is on" : "The 10 AM email is paused") + "</b>" +
    '<span class="sub" style="display:block;font-size:12px">' +
    (on
      ? (live ? esc(live + " " + (live === 1 ? "person gets" : "people get") + " it each morning.") : "Nobody is on the list, so nothing goes out.")
      : "Nothing goes out until this is switched back on.") +
    "</span></label></div>" +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px">' +
    '<button class="btn secondary" data-fx="test"' + (myEmail ? "" : " disabled title=\"Your login has no email address\"") + ">Send test to me</button>" +
    '<span class="sub" style="font-size:12px">' +
    (myEmail ? "Goes to " + esc(myEmail) + " only." : "Your login has no email address — add one in Admin → Staff first.") +
    "</span></div>" +
    '<p class="sub" style="margin:10px 0 0;font-size:12px">Last sent: <b>' + (fx.last_sent ? esc(fxLongDay(fx.last_sent)) : "not yet") + "</b></p>" +
    "</section>";
}

/* ---------- WhatsApp: deliberately not built yet ---------- */
function fxWaCard() {
  return '<section class="card fx-soon" style="margin-top:14px" aria-label="WhatsApp numbers, coming soon">' +
    '<div class="page-head" style="margin:0 0 4px"><h3 style="margin:0">' + DIR_ICON.wa + " WhatsApp numbers " + opsPill("Coming soon", "grey") + "</h3></div>" +
    '<p class="sub" style="margin:0 0 10px;font-size:12px">The same daily rate on WhatsApp. The sending side is not switched on yet, so this is only a preview.</p>' +
    '<div class="fx-addrow"><input type="tel" placeholder="+91 98xxx xxxxx" disabled aria-label="WhatsApp number (not available yet)">' +
    '<input type="text" placeholder="Name (optional)" disabled aria-label="Name (not available yet)">' +
    '<button class="btn" disabled>Add</button></div>' +
    '<div class="fx-rec off"><div class="fx-who"><div class="fx-nm">Nobody yet</div>' +
    '<div class="fx-em">Numbers can be added once WhatsApp sending is turned on.</div></div></div>' +
    "</section>";
}

/* ---------- the rate in the Bulletin bar at the top of every page ----------
   renderNoticeTicker() asks fxTickerItem() for one line. The rate is fetched once
   and then at most every half hour, and only for people who may see the module —
   fx-api refuses anybody else, so there is no point asking on their behalf.
   A failure is swallowed: the bulletin is not the place to show an error. */
var FX_TICK = { at: 0, busy: false, stats: null };
function fxTickerLoad() {
  if (FX_TICK.busy || state.demo || !state.doer) return;
  if (typeof canSeeFxRates === "function" && !canSeeFxRates()) return;
  if (Date.now() - FX_TICK.at < 30 * 60000) return;
  FX_TICK.busy = true;
  fxApi("fxState").then(function (res) {
    FX_TICK.busy = false; FX_TICK.at = Date.now(); FX_TICK.stats = res.stats || null;
    if (!state.fx) state.fx = res;                       /* the module opens instantly later */
    if (typeof renderNoticeTicker === "function") renderNoticeTicker();
  }).catch(function () { FX_TICK.busy = false; FX_TICK.at = Date.now(); });
}
function fxTickerItem() {
  fxTickerLoad();
  var st = FX_TICK.stats;
  if (!st || !st.today) return "";
  fxCss();
  var chg = st.yesterday ? st.today.r - st.yesterday.r : 0;
  var pct = st.yesterday && st.yesterday.r ? (chg / st.yesterday.r) * 100 : 0;
  var cls = chg > 0 ? "tk-up" : chg < 0 ? "tk-down" : "tk-flat";
  var move = st.yesterday
    ? '<span class="' + cls + '">' + (chg > 0 ? "▲" : chg < 0 ? "▼" : "•") + " " + Math.abs(chg).toFixed(2) + " (" + Math.abs(pct).toFixed(2) + "%)</span>"
    : '<span class="tk-flat">first day</span>';
  return '<a class="ticker-item tk-fx" data-fxgoto="1" role="button" tabindex="0" title="Open USD–INR Rates">' +
    '<span class="tk-emoji">💵</span>1 USD = <b>' + esc(fxMoney(st.today.r)) + "</b> " + move +
    " · " + esc(fxDay(st.today.d)) + "</a>";
}
document.addEventListener("click", function (ev) {
  if (ev.target.closest && ev.target.closest("[data-fxgoto]") && typeof goToView === "function") goToView("fxrates");
});
document.addEventListener("keydown", function (ev) {
  if ((ev.key === "Enter" || ev.key === " ") && ev.target.closest && ev.target.closest("[data-fxgoto]") && typeof goToView === "function") {
    ev.preventDefault(); goToView("fxrates");
  }
});

/* ---------- clicks ---------- */
function fxBusy(btn, label) {
  if (!btn) return function () {};
  var old = btn.textContent;
  btn.disabled = true; btn.textContent = label;
  return function () { btn.disabled = false; btn.textContent = old; };
}
function fxReload(msg) {
  if (msg) toast(msg);
  return fxApi("fxState").then(function (res) {
    state.fx = res;
    FX_TICK.stats = res.stats || null; FX_TICK.at = Date.now();      /* the bulletin shows the new rate at once */
    paintFxRates();
    if (typeof renderNoticeTicker === "function") renderNoticeTicker();
  })
    .catch(function (e) { toast(e.message); });
}
document.addEventListener("click", function (ev) {
  var b = ev.target.closest ? ev.target.closest("[data-fx],[data-fxrange],[data-fxrec]") : null;
  if (!b || !document.getElementById("fxWrap") || !document.getElementById("fxWrap").contains(b)) return;

  var range = b.getAttribute("data-fxrange");
  if (range) { state.fxRange = Number(range); paintFxRates(); return; }

  var recId = b.getAttribute("data-fxrec");
  if (recId) {
    var act = b.getAttribute("data-fxact");
    if (act === "delete") {
      if (!confirm("Remove " + (b.getAttribute("data-fxemail") || "this address") + " from the 10 AM email?")) return;
      var undel = fxBusy(b, "Removing…");
      fxApi("fxRecipientDelete", { id: recId }).then(function () { return fxReload("Removed."); }).catch(function (e) { undel(); toast(e.message); });
      return;
    }
    var rec = ((state.fx || {}).recipients || []).find(function (r) { return String(r.id) === String(recId); });
    if (!rec) return;
    var unp = fxBusy(b, "Saving…");
    fxApi("fxRecipientSave", { email: rec.email, name: rec.name, active: act === "resume" })
      .then(function () { return fxReload(act === "resume" ? "Resumed." : "Paused — they stop getting it."); })
      .catch(function (e) { unp(); toast(e.message); });
    return;
  }

  var what = b.getAttribute("data-fx");
  if (what === "reload") { state.fx = null; renderFxRates(); return; }
  if (what === "refresh") {
    var und = fxBusy(b, "Fetching…");
    fxApi("fxRefresh").then(function () { return fxReload("Rate updated."); }).catch(function (e) { und(); toast(e.message); });
    return;
  }
  if (what === "csv") { fxCsv(); return; }
  if (what === "add") {
    var em = (document.getElementById("fxEmail") || {}).value || "";
    var nm = (document.getElementById("fxName") || {}).value || "";
    em = em.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { toast("That doesn't look like an email address."); (document.getElementById("fxEmail") || {}).focus && document.getElementById("fxEmail").focus(); return; }
    var una = fxBusy(b, "Adding…");
    fxApi("fxRecipientSave", { email: em, name: nm.trim(), active: true })
      .then(function () { return fxReload(em + " added — they get it from tomorrow 10 AM."); })
      .catch(function (e) { una(); toast(e.message); });
    return;
  }
  if (what === "test") {
    var unt = fxBusy(b, "Sending…");
    fxApi("fxSendTest").then(function (r) {
      unt();
      toast(r.queued ? "Test queued for you — it arrives in a minute or two." : "Nothing was sent: your login has no email address.");
    }).catch(function (e) { unt(); toast(e.message); });
    return;
  }
});
document.addEventListener("change", function (ev) {
  var c = ev.target;
  if (!c || c.id !== "fxOn") return;
  var want = !!c.checked;
  c.disabled = true;
  fxApi("fxSettings", { enabled: want })
    .then(function () { return fxReload(want ? "The 10 AM email is on." : "The 10 AM email is paused."); })
    .catch(function (e) { c.checked = !want; c.disabled = false; toast(e.message); });
});
document.addEventListener("keydown", function (ev) {
  if (ev.key !== "Enter") return;
  var t = ev.target;
  if (!t || (t.id !== "fxEmail" && t.id !== "fxName")) return;
  var add = document.querySelector('#fxWrap [data-fx="add"]');
  if (add) { ev.preventDefault(); add.click(); }
});

/* Admins always see the tile; everybody else needs it ticked in Manage
   Visibility (visible_modules), which is exactly what fx-api checks. */
function canSeeFxRates() {
  if (!state.doer) return false;
  if (state.doer.is_admin) return true;
  var vis = deskVisibleModules();   /* the same list the module grid uses (null = every module) */
  return !Array.isArray(vis) || vis.indexOf("fxrates") !== -1;
}
