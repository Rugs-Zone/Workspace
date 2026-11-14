// Rugs Email 2.0 (Nov 2026) — layout layer used only by mail2.html. Same app, same data, same features;
// the open mail and the list header are laid out like Outlook: less on screen, the mail itself first.
// Loaded after the app (see mail2.html). Classic mail.html does not load this file.
(function () {
  "use strict";
  var CSS = [
    /* ---------- open mail ---------- */
    'body.v2 .rtop{padding-bottom:2px}',
    'body.v2 .rtitle h1{font-size:20px;font-weight:600;line-height:1.3;letter-spacing:0}',
    /* tracking: one thin line instead of a grey box */
    'body.v2 .track{background:transparent!important;border:0!important;box-shadow:none!important;padding:2px 0 8px!important;margin:0!important;gap:6px 8px!important;font-size:12.5px;flex-wrap:wrap;align-items:center}',
    'body.v2 .track .sp{display:none}',
    'body.v2 .track .k{color:var(--muted);font-size:12px}',
    'body.v2 .track select{height:28px;padding:2px 6px;border:1px solid var(--line);background:var(--pane);border-radius:4px;font-size:12.5px}',
    /* toolbar: Reply, Reply all, Forward, Done + More */
    'body.v2 #read .acts:not(.xacts){gap:2px;padding-bottom:8px;border-bottom:1px solid var(--line);margin-bottom:0}',
    'body.v2 #read .xacts{padding:6px 0;border-bottom:1px solid var(--line)}',
    /* things that repeated what is already on screen */
    'body.v2 .convbar,body.v2 .aihint,body.v2 .rawnote{display:none!important}',
    /* conversation: no cards, newest open, older ones one line each */
    'body.v2 .rbody{gap:0!important}',
    'body.v2 article.mail{border:0!important;border-bottom:1px solid var(--line)!important;border-radius:0!important;box-shadow:none!important;background:transparent!important;padding:12px 2px!important;margin:0!important}',
    'body.v2 article.mail.collapsed{padding:9px 2px!important;cursor:pointer}',
    'body.v2 article.mail.collapsed:hover{background:var(--hover)!important}',
    'body.v2 article.mail header time{font-size:12px;color:var(--muted)}',
    'body.v2 .raw{border:0!important;box-shadow:none!important;padding:0!important;margin:6px 0 0!important;background:transparent!important;border-radius:0!important}',
    'body.v2 .promise{border-radius:4px}',
    /* quick reply: a single line until you start writing */
    'body.v2 .inline{border-radius:4px;margin-top:12px}',
    'body.v2 .inline:not(.v2open) footer,body.v2 .inline:not(.v2open) .to{display:none}',
    'body.v2 .inline:not(.v2open) textarea{min-height:40px!important;height:40px!important;resize:none;cursor:text}',
    /* ---------- mail list header ---------- */
    'body.v2 .seg{flex-wrap:nowrap!important;overflow-x:auto;scrollbar-width:none;gap:4px}',
    'body.v2 .seg::-webkit-scrollbar{display:none}',
    'body.v2 .seg .chip{padding:4px 10px;font-size:12.5px;white-space:nowrap;flex:none}',
    'body.v2 .lbrow{display:none!important}',
    'body.v2.v2-topics .lbrow{display:flex!important}',
    'body.v2 .lsync .v2sel{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted);margin-left:8px;cursor:pointer}',
    /* ---------- phone: actions fixed at the bottom of the open mail ---------- */
    '@media (max-width:760px){body.v2 .maxb{display:none!important}body.v2 #read>.acts.v2bottom{position:sticky;bottom:0;z-index:5;background:var(--pane);border-top:1px solid var(--line);border-bottom:0!important;margin:0!important;padding:8px 6px calc(8px + env(safe-area-inset-bottom,0px))!important;justify-content:space-around;flex-wrap:nowrap}',
    'body.v2 #read>.acts.v2bottom .btn{flex-direction:column;gap:2px;font-size:11.5px;padding:4px 6px}}'
  ].join("\n");

  // buttons that stay on the toolbar; everything else moves into "More"
  var KEEP = ["data-reply", "data-fwd", "data-done", "data-reopen", "data-moreacts"];

  function txt(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function v2Read() {
    var R = document.getElementById("read");
    if (!R || typeof openId === "undefined" || !openId) return;
    var acts = R.querySelector(".acts:not(.xacts)"), more = R.querySelector(".xacts");
    if (acts && more) {
      Array.prototype.slice.call(acts.querySelectorAll("button")).forEach(function (b) {
        if (!KEEP.some(function (k) { return b.hasAttribute(k); })) more.appendChild(b);
      });
      var pb = R.querySelector(".rbody > button[data-promise]");   // "Add a promise" lives in More too
      if (pb) { pb.style.width = ""; more.appendChild(pb); }
    }
    // correct wording: Delete now goes to Gmail Trash
    Array.prototype.slice.call(R.querySelectorAll("[data-qdel]")).forEach(function (b) { b.title = "Move to Deleted (and Gmail Trash) — you can restore it"; });
    // quick reply opens up only when you start writing
    var inl = R.querySelector(".inline");
    if (inl) {
      var ta = inl.querySelector("textarea");
      if (ta && ta.value) inl.classList.add("v2open");
    }
    // phone: Reply / Reply all / Forward / Done fixed at the bottom
    if (acts && window.matchMedia("(max-width:760px)").matches) { acts.classList.add("v2bottom"); R.appendChild(acts); }
    // the mail body sizes itself (no second scrollbar) — again once pictures have loaded
    if (typeof fitFrames === "function") { setTimeout(fitFrames, 300); setTimeout(fitFrames, 1200); }
  }

  function v2List() {
    var h = document.querySelector(".list .lhead");
    if (!h) return;
    var on = document.body.classList.contains("v2-topics");
    var tb = h.querySelector("[data-lbtog]");
    if (tb) {
      var cur = (typeof lfilt !== "undefined" && lfilt && typeof LB === "function" && LB(lfilt)) ? LB(lfilt).name : "";
      tb.textContent = (cur ? "Topic: " + cur : "Topics") + (on ? " ▾" : " ▸");
    }
    // "Select all" joins the Sync line instead of a row of its own
    var bk = h.querySelector(".bkbar"), ls = h.querySelector(".lsync");
    if (bk && ls && !bk.classList.contains("on")) {
      var lab = bk.querySelector(".bkall");
      if (lab) { lab.classList.add("v2sel"); ls.insertBefore(lab, tb || null); }
      bk.style.display = "none";
    }
  }

  function start() {
    var st = document.createElement("style"); st.id = "rugs-v2"; st.textContent = CSS; document.head.appendChild(st);
    document.body.classList.add("v2");
    try { if (localStorage.getItem("rm-v2-topics") === "1") document.body.classList.add("v2-topics"); } catch (e) {}

    // 1) never show made-up content: a plain-text mail is shown as plain text
    if (typeof originalHTML === "function") {
      window.originalHTML = function (m) {
        return '<!doctype html><meta charset="utf-8"><body style="margin:0;padding:2px 0;font:14px/1.55 \'Segoe UI\',-apple-system,Roboto,Arial,sans-serif;color:#242424;background:#fff;white-space:pre-wrap;overflow-wrap:anywhere">' + txt(m && m.body) + "</body>";
      };
    }
    // 2) open mail and list header layout
    if (typeof renderRead === "function") { var rr = renderRead; window.renderRead = function () { var r = rr.apply(this, arguments); try { v2Read(); } catch (e) { console.log("v2Read", e); } return r; }; }
    if (typeof renderList === "function") { var rl = renderList; window.renderList = function () { var r = rl.apply(this, arguments); try { v2List(); } catch (e) { console.log("v2List", e); } return r; }; }
    // 3) Topics button: show / hide the topic chips (2.0 starts with them hidden; remembered on this device)
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-lbtog]");
      if (!b) return;
      e.preventDefault(); e.stopImmediatePropagation();
      var on = !document.body.classList.contains("v2-topics");
      document.body.classList.toggle("v2-topics", on);
      try { localStorage.setItem("rm-v2-topics", on ? "1" : ""); } catch (x) {}
      v2List();
    }, true);
    // quick reply box opens when you click, focus or type in it
    ["focusin", "mousedown", "touchstart", "input"].forEach(function (ev) {
      document.addEventListener(ev, function (e) { var i = e.target.closest && e.target.closest("#read .inline"); if (i) i.classList.add("v2open"); }, true);
    });
    try { if (typeof render === "function") render(); } catch (e) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
