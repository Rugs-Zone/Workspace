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
    /* tidy list header: one title row + one filter row */
    'body.v2 .lsync.v2hide{display:none!important}',
    'body.v2 .v2top{display:flex;align-items:center;gap:10px;margin:0 0 8px;min-height:32px}',
    'body.v2 .v2top h2{margin:0;font-size:20px;font-weight:600;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}',
    'body.v2 .v2top .v2sp{flex:1}',
    'body.v2 .v2top .v2sel{font-size:0;margin:0;display:inline-flex;align-items:center;cursor:pointer;flex:none}',
    'body.v2 .v2top .v2sel input{width:16px;height:16px;margin:0;cursor:pointer}',
    'body.v2 .v2top .lbtog,body.v2 .v2top .vmbtn{flex:none;margin:0!important;padding:5px 10px;min-height:30px;font-size:12.5px;font-weight:600;border:1px solid var(--line);border-radius:4px;background:var(--pane);color:var(--fg);cursor:pointer}',
    'body.v2 .v2top .lbtog:hover,body.v2 .v2top .vmbtn:hover{background:var(--hover)}',
    'body.v2 .lhead .seg{margin:0}',
    /* ---------- Outlook: attachment cards ---------- */
    'body.v2 .v2atts{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 2px}',
    'body.v2 .v2att{display:flex;align-items:center;gap:10px;width:240px;max-width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:4px;background:var(--pane);text-align:left;cursor:pointer;min-height:44px}',
    'body.v2 .v2att:hover{background:var(--hover);border-color:#c7c7c7}',
    'body.v2 .v2badge{flex:none;display:grid;place-items:center;min-width:32px;height:32px;padding:0 4px;border-radius:3px;color:#fff;font:700 11px/1 "Segoe UI",Arial,sans-serif}',
    'body.v2 .v2an{min-width:0;display:flex;flex-direction:column}',
    'body.v2 .v2an b{font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    'body.v2 .v2an small{font-size:12px;color:var(--muted)}',
    /* ---------- Outlook: trail ---------- */
    'body.v2 .v2to{display:block;font-size:12px;color:var(--muted);overflow-wrap:anywhere}',
    'body.v2 .v2ma{display:flex;gap:2px;flex:none}',
    'body.v2 .v2mb{width:32px;height:32px;border-radius:4px;color:var(--brand);font-size:15px}',
    'body.v2 .v2mb:hover{background:var(--hover)}',
    /* ---------- Outlook: full-screen attachment viewer ---------- */
    'body.v2 .v2vw{position:fixed;inset:0;z-index:9999;background:rgba(20,20,20,.92);display:flex;flex-direction:column;color:#fff}',
    'body.v2 .v2vbar{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#1f1f1f;border-bottom:1px solid #333;flex-wrap:wrap}',
    'body.v2 .v2vt{flex:1;min-width:120px;display:flex;flex-direction:column}',
    'body.v2 .v2vt b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    'body.v2 .v2vt small{color:#adadad;font-size:12px}',
    'body.v2 .v2vb{display:inline-flex;align-items:center;gap:4px;min-height:32px;padding:4px 12px;border-radius:4px;background:#333;color:#fff;border:1px solid #474747;font-size:13px;text-decoration:none}',
    'body.v2 .v2vb:hover{background:#3d3d3d}',
    'body.v2 .v2vx{min-width:36px;justify-content:center}',
    'body.v2 .v2vmain{flex:1;min-height:0;display:flex;align-items:stretch;position:relative}',
    'body.v2 .v2vbody{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:auto;padding:12px}',
    'body.v2 .v2vframe{flex:1;width:100%;max-width:1100px;border:0;background:#fff;border-radius:2px}',
    'body.v2 .v2voffice{flex:1;width:100%;max-width:1100px;background:#fff;color:#242424;overflow:auto;border-radius:2px;display:flex;flex-direction:column}',
    'body.v2 .v2vnote{font-size:12px;color:#adadad;margin:6px 0 0}',
    'body.v2 .v2vimgwrap{overflow:auto;max-width:100%;max-height:100%;display:flex;align-items:center;justify-content:center}',
    'body.v2 .v2vimg{max-width:100%;max-height:calc(100vh - 90px);transform-origin:center;transition:transform .12s ease-out;background:#fff}',
    'body.v2 .v2vimg.zoomed{max-width:none;max-height:none}',
    'body.v2 .v2vtext{white-space:pre-wrap;background:#fff;color:#242424;padding:16px;border-radius:2px;max-width:1000px;width:100%;margin:0;font:13px/1.5 Consolas,monospace;overflow:auto}',
    'body.v2 .v2vmsg{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;max-width:420px;color:#e0e0e0}',
    'body.v2 .v2vacts{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}',
    'body.v2 .v2vnav{align-self:center;width:44px;height:64px;margin:0 6px;border-radius:4px;background:rgba(255,255,255,.08);color:#fff;font-size:30px;flex:none}',
    'body.v2 .v2vnav:hover{background:rgba(255,255,255,.18)}',
    'body.v2 .v2spin{width:28px;height:28px;border-radius:50%;border:3px solid rgba(255,255,255,.25);border-top-color:#fff;animation:v2r .8s linear infinite}',
    '@keyframes v2r{to{transform:rotate(360deg)}}',
    '@media (prefers-reduced-motion:reduce){body.v2 .v2spin{animation-duration:2.4s}body.v2 .v2vimg{transition:none}}',
    'body.v2 .v2veml{background:#fff;color:#201f1e;padding:14px 16px;max-width:980px;margin:0 auto;width:100%;overflow:auto}',
    'body.v2 .v2veml .emlh{background:#f5f5f5;border-color:#e1dfdd}',
    '@media (max-width:760px){body.v2 .v2vnav{position:absolute;top:50%;transform:translateY(-50%);z-index:2;width:40px;height:56px}body.v2 .v2vnav.prev{left:0}body.v2 .v2vnav.next{right:0}body.v2 .v2att{width:100%}}',
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
    try { v2Trail(R); } catch (e) { console.log("v2Trail", e); }
    // the mail body sizes itself (no second scrollbar) — again once pictures have loaded
    if (typeof fitFrames === "function") { setTimeout(fitFrames, 300); setTimeout(fitFrames, 1200); }
  }

  /* ================= Outlook features: attachment cards + viewer, conversation trail ================= */
  var KIND = [   // file type → badge colour / label / how it is shown
    { re: /\.pdf$/i, c: "#c50f1f", l: "PDF", v: "pdf" },
    { re: /\.(docx?|rtf|odt)$/i, c: "#185abd", l: "W", v: "office" },
    { re: /\.(xlsx?|xlsm|csv|ods)$/i, c: "#107c41", l: "X", v: "office" },
    { re: /\.(pptx?|pps|ppsx|odp)$/i, c: "#c43e1c", l: "P", v: "office" },
    { re: /\.(png|jpe?g|gif|webp|bmp|heic|svg)$/i, c: "#8764b8", l: "IMG", v: "img" },
    { re: /\.(txt|log|json|xml)$/i, c: "#616161", l: "TXT", v: "text" },
    { re: /\.(zip|rar|7z)$/i, c: "#986f0b", l: "ZIP", v: "none" },
    /* 24 Nov 2026: a mail sent as a file - drawn by the app's own .eml reader (window.rzEmlMount) */
    { re: /\.eml$/i, c: "#0f6cbd", l: "MAIL", v: "eml" },
    { re: /\.msg$/i, c: "#0f6cbd", l: "MAIL", v: "msg" }
  ];
  function kindOf(name, mime) {
    for (var i = 0; i < KIND.length; i++) if (KIND[i].re.test(name || "")) return KIND[i];
    if (/message\/rfc822/i.test(mime || "")) return { c: "#0f6cbd", l: "MAIL", v: "eml" };
    if (/^image\//i.test(mime || "")) return KIND[4];
    if (/pdf/i.test(mime || "")) return KIND[0];
    return { c: "#616161", l: "FILE", v: "none" };
  }
  function driveId(link) { var m = String(link || "").match(/\/d\/([\w-]{20,})/) || String(link || "").match(/[?&]id=([\w-]{20,})/); return m ? m[1] : ""; }
  function sizeTxt(b) { return typeof fsize === "function" ? fsize(b) : (b ? Math.round(b / 1024) + " KB" : ""); }

  // the attachments of one mail as Outlook-style cards (replaces the plain chips)
  function attCards(m, t) {
    /* 24 Nov 2026: the app decides which of these are real files (window.rzAttSplit); the
       pictures the mail draws in its own text get a link under the cards instead. */
    var split = typeof window.rzAttSplit === "function" ? window.rzAttSplit(m) : null;
    var open = !!(window.rzShowInl && window.rzShowInl[m.gid || ""]);
    var src = split ? (open ? split.show.concat(split.hide) : split.show) : null;
    var hid = split ? split.hide.length : 0;
    var list = [];
    if (src) src.forEach(function (x) {
      var meta = ((m.atts || []).filter(function (y) { return y && y.name === x.name; })[0]) || {};
      list.push({ name: x.name, size: x.size, mime: x.mime || meta.mime, link: x.link || "", big: !!x.big, saving: !x.link && !(m.files || []).length });
    });
    else {
      (m.files || []).forEach(function (x) { if (x && x.name) list.push({ name: x.name, size: x.size, link: x.link || "", big: !!x.big }); });
      if (!list.length) (m.atts || []).forEach(function (x) { if (x && x.name && !(/^image\//i.test(x.mime || "") && (x.size || 0) < 40000)) list.push({ name: x.name, size: x.size, mime: x.mime, link: "", saving: true }); });
    }
    var inlLink = hid ? '<div class="attinl"><button type="button" class="lnk" data-' + (open ? "atthide" : "attshow") + '="' + txt(m.gid || "") + '">' +
      (open ? "Hide the " + hid + " inline picture" + (hid > 1 ? "s" : "") : "\u{1f5bc} Show hidden inline images (" + hid + ")") +
      '</button><small>pictures the mail already shows in its text (signature logos and icons)</small></div>' : "";
    if (!list.length) return inlLink;
    var box = t ? t.box : "";
    return '<div class="v2atts" role="list">' + list.map(function (a) {
      var k = kindOf(a.name, a.mime);
      return '<button type="button" role="listitem" class="v2att" data-v2att data-box="' + txt(box) + '" data-gid="' + txt(m.gid || "") + '" data-name="' + txt(a.name) + '" data-size="' + (a.size || 0) + '" data-mime="' + txt(a.mime || "") + '" data-link="' + txt(a.link) + '" title="Open ' + txt(a.name) + '">' +
        '<span class="v2badge" style="background:' + k.c + '" aria-hidden="true">' + k.l + '</span><span class="v2an"><b>' + txt(a.name) + '</b><small>' + txt(sizeTxt(a.size)) + (a.big ? " · over 20 MB, open in Gmail" : a.saving ? " · copying to Drive…" : "") + '</small></span></button>';
    }).join("") + '</div>' + inlLink;
  }

  // full-screen viewer: pictures (zoom, next / previous), PDF, Word / Excel / PowerPoint (Google Drive preview), text
  var VW = null;
  function vwClose() {
    if (!VW) return;
    if (VW.url) URL.revokeObjectURL(VW.url);
    VW.el.remove(); document.removeEventListener("keydown", vwKey, true);
    var back = VW.opener; VW = null;
    if (back && back.isConnected) back.focus();
  }
  function vwKey(e) {
    if (!VW) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); vwClose(); }
    else if (e.key === "ArrowRight" && !/INPUT|TEXTAREA/.test((e.target && e.target.tagName) || "")) { e.preventDefault(); vwGo(1); }
    else if (e.key === "ArrowLeft" && !/INPUT|TEXTAREA/.test((e.target && e.target.tagName) || "")) { e.preventDefault(); vwGo(-1); }
    else if ((e.key === "+" || e.key === "=") && VW.kind === "img") vwZoom(1.25);
    else if (e.key === "-" && VW.kind === "img") vwZoom(0.8);
  }
  function vwGo(d) { if (!VW || VW.items.length < 2) return; var i = (VW.i + d + VW.items.length) % VW.items.length; vwShow(VW.items, i, VW.opener); }
  function vwZoom(f) { if (!VW) return; var img = VW.el.querySelector(".v2vimg"); if (!img) return; VW.z = f === 0 ? 1 : Math.min(8, Math.max(0.1, (VW.z || 1) * f)); img.style.transform = "scale(" + VW.z + ")"; img.classList.toggle("zoomed", VW.z !== 1); }
  function bytes(a) {
    // 20 Nov 2026: the mail app keeps one copy of each attachment for the session (rzAttBytes) and
    // quietly brings the small ones in when a mail is opened, so this usually returns without a trip
    // to Gmail. The old way is kept for a page where the app has not provided it.
    if (typeof window.rzAttBytes === "function") return window.rzAttBytes(a.box, a.gid, a.name);
    return api("attachment", { mailbox: a.box, gmailId: a.gid, name: a.name }).then(function (r) {
      var bin = atob(r.b64 || ""), u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return { u8: u8, mime: r.mime || a.mime || "application/octet-stream" };
    });
  }
  function vwDownload(a) {
    // 18 Nov 2026: saved through the mail app's one saveFile() (original name + extension, type from the
    // extension when Gmail sent none); the plain link below is only for a page without the app loaded.
    var save = function (data, mime) {
      if (typeof window.rzSaveFile === "function") return window.rzSaveFile(data, a.name, mime);
      var u = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: mime })), l = document.createElement("a");
      l.href = u; l.download = a.name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
    };
    if (VW && VW.url && VW.cur === a) return fetch(VW.url).then(function (r) { return r.blob(); }).then(function (bl) { save(bl, bl.type); });
    if (typeof toast === "function") toast("Downloading " + a.name + "…");
    bytes(a).then(function (b) { save(b.u8, b.mime); })
      .catch(function (e) { if (typeof toast === "function") toast("Could not download: " + e.message + (a.link ? " — use Open in Drive" : "")); });
  }
  function vwShow(items, i, opener) {
    if (VW && VW.url) { URL.revokeObjectURL(VW.url); }
    var a = items[i], k = kindOf(a.name, a.mime), phone = window.matchMedia("(max-width:760px)").matches, did = driveId(a.link);
    if (!VW) {
      var el = document.createElement("div");
      el.className = "v2vw"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
      document.body.appendChild(el); document.addEventListener("keydown", vwKey, true);
      VW = { el: el };
      el.addEventListener("click", function (e) {
        var b = e.target.closest("[data-vw]"); if (!b) { if (e.target === el.querySelector(".v2vmain")) vwClose(); return; }
        var act = b.getAttribute("data-vw");
        if (act === "close") vwClose(); else if (act === "prev") vwGo(-1); else if (act === "next") vwGo(1);
        else if (act === "dl") vwDownload(VW.cur); else if (act === "zin") vwZoom(1.25); else if (act === "zout") vwZoom(0.8); else if (act === "zfit") vwZoom(0);
        else if (act === "retry") vwShow(VW.items, VW.i, VW.opener);
      });
    }
    VW.items = items; VW.i = i; VW.cur = a; VW.opener = opener || VW.opener; VW.url = ""; VW.z = 1; VW.kind = k.v;
    VW.el.setAttribute("aria-label", "Preview of " + a.name);
    var many = items.length > 1;
    VW.el.innerHTML =
      '<div class="v2vbar"><span class="v2badge" style="background:' + k.c + '" aria-hidden="true">' + k.l + '</span>' +
      '<div class="v2vt"><b>' + txt(a.name) + '</b><small>' + txt(sizeTxt(a.size)) + (many ? " · " + (i + 1) + " of " + items.length : "") + '</small></div>' +
      (k.v === "img" ? '<button type="button" class="v2vb" data-vw="zout" aria-label="Zoom out">−</button><button type="button" class="v2vb" data-vw="zfit">Fit</button><button type="button" class="v2vb" data-vw="zin" aria-label="Zoom in">+</button>' : '') +
      '<button type="button" class="v2vb" data-vw="dl">⬇ Download</button>' +
      (a.link ? '<a class="v2vb" href="' + txt(a.link) + '" target="_blank" rel="noopener">Open in Drive ↗</a>' : '') +
      '<button type="button" class="v2vb v2vx" data-vw="close" aria-label="Close preview (Esc)">✕</button></div>' +
      '<div class="v2vmain">' + (many ? '<button type="button" class="v2vnav prev" data-vw="prev" aria-label="Previous attachment">‹</button>' : '') +
      '<div class="v2vbody" aria-live="polite"><div class="v2vmsg"><div class="v2spin" aria-hidden="true"></div>Opening ' + txt(a.name) + '…</div></div>' +
      (many ? '<button type="button" class="v2vnav next" data-vw="next" aria-label="Next attachment">›</button>' : '') + '</div>';
    var body = VW.el.querySelector(".v2vbody");
    var x = VW.el.querySelector('[data-vw="close"]'); if (x) x.focus();
    var me = VW;
    var fail = function (msg) {
      if (VW !== me || VW.cur !== a) return;
      body.innerHTML = '<div class="v2vmsg"><b>' + txt(a.name) + ' could not be shown here</b><span>' + txt(msg) + '</span><div class="v2vacts">' +
        '<button type="button" class="v2vb" data-vw="retry">Try again</button><button type="button" class="v2vb" data-vw="dl">⬇ Download</button>' +
        (a.link ? '<a class="v2vb" href="' + txt(a.link) + '" target="_blank" rel="noopener">Open in Drive ↗</a>' : '') + '</div></div>';
    };
    var drivePreview = function (note) {
      body.innerHTML = '<iframe class="v2vframe" title="' + txt(a.name) + '" src="https://drive.google.com/file/d/' + did + '/preview" allow="autoplay"></iframe>' +
        '<p class="v2vnote">' + (note || "Shown with Google Drive. Sign in to Google with your @rugscreation.com account if it asks.") + '</p>';
    };
    // Excel / Word / PowerPoint: drawn right here in Rugs Email from the original file — no Google sign-in needed
    // (Google Drive's viewer is only the backup, e.g. for very big files or old .doc / .ppt)
    if (k.v === "office" && a.gid && typeof window.officeRender === "function" && window.ofxCan && window.ofxCan(a.name)) {
      body.innerHTML = '<div class="v2voffice"><div class="v2vmsg" style="color:#424242;margin:auto">Opening ' + txt(a.name) + '…</div></div>';
      var box = body.firstChild;
      bytes(a).then(function (b) { if (VW !== me || VW.cur !== a) return; return window.officeRender(b.u8.buffer, a.name, box); })
        .catch(function (e) { if (VW !== me || VW.cur !== a) return; if (did) drivePreview("Could not draw it here (" + (e && e.message ? e.message : "error") + ") — shown with Google Drive instead. Sign in to Google with your @rugscreation.com account if it asks."); else fail(e && e.message ? e.message : "Could not open the file."); });
      return;
    }
    // other Office files (old .doc / .ppt) and PDF on phones: Google Drive's viewer, from the copy in the team's Drive
    // 18 Nov 2026: PDFs are drawn by the app's PDF.js viewer on phones too; Google Drive only when it is missing
    if (did && (k.v === "office" || (k.v === "pdf" && phone && typeof window.rzPdfMount !== "function"))) { drivePreview(); return; }
    if (k.v === "office") {
      body.innerHTML ='<div class="v2vmsg"><b>' + txt(a.name) + '</b><span>' + (a.saving ? "This file is being copied to Google Drive — the preview works within a minute or two. You can download it now." : "This file has no Google Drive copy, so it can't be previewed here. Download it to open it.") + '</span><div class="v2vacts"><button type="button" class="v2vb" data-vw="dl">⬇ Download</button>' + (a.saving ? '<button type="button" class="v2vb" data-vw="retry">Try again</button>' : '') + '</div></div>';
      return;
    }
    if (k.v === "msg") {
      body.innerHTML = '<div class="v2vmsg"><b>' + txt(a.name) + '</b><span>This is an Outlook .msg file. It cannot be opened here \u2014 download it and open it in Outlook.</span><div class="v2vacts"><button type="button" class="v2vb" data-vw="dl">\u2b07 Download</button></div></div>';
      return;
    }
    /* 24 Nov 2026: a mail sent as a file, read in the browser and drawn like a received mail
       (header, body in the same sandboxed frame, pictures from the internet blocked, its own
       files openable) - Google Drive has no viewer for message/rfc822 at all. */
    if (k.v === "eml") {
      if (typeof window.rzEmlMount !== "function") { fail("This mail file cannot be shown on this page. Download it to open it."); return; }
      if (!a.gid) { fail("The original mail is not available."); return; }
      bytes(a).then(function (b) {
        if (VW !== me || VW.cur !== a) return;
        body.innerHTML = '<div class="v2veml"></div>';
        window.rzEmlMount(body.firstChild, b.u8, a.name);
      }).catch(function (e) { if (VW !== me || VW.cur !== a) return; fail(e && e.message ? e.message : "Could not open the mail file."); });
      return;
    }
    if (k.v === "none") { fail("This kind of file can't be previewed. Download it to open it."); return; }
    if (!a.gid) { fail("The original mail is not available."); return; }
    bytes(a).then(function (b) {
      if (VW !== me || VW.cur !== a) return;
      var url = URL.createObjectURL(new Blob([b.u8], { type: b.mime })); VW.url = url;
      if (k.v === "img" || /^image\//i.test(b.mime)) { VW.kind = "img"; body.innerHTML = '<div class="v2vimgwrap"><img class="v2vimg" src="' + url + '" alt="' + txt(a.name) + '"></div>'; }
      // 18 Nov 2026: PDF.js (canvas per page) instead of the browser's own PDF viewer in an iframe, which
      // showed blank here and in Edge offered a Save that lost the file name; ⬇ Download keeps the name
      else if (k.v === "pdf" || /pdf/i.test(b.mime)) {
        if (typeof window.rzPdfMount === "function") { VW.kind = "pdf"; window.rzPdfMount(body, b.u8, a.name); }
        else body.innerHTML = '<iframe class="v2vframe" title="' + txt(a.name) + '" src="' + url + '"></iframe>';
      }
      else body.innerHTML = '<pre class="v2vtext">' + txt(new TextDecoder().decode(b.u8).slice(0, 300000)) + '</pre>';
    }).catch(function (e) { fail(e && e.message ? e.message : "Could not load the file."); });
  }
  document.addEventListener("click", function (e) {
    var c = e.target.closest && e.target.closest("[data-v2att]"); if (!c) return;
    e.preventDefault(); e.stopPropagation();   // handled here first, so the mail does not fold/redraw under the click
    var all = Array.prototype.slice.call(document.querySelectorAll("#read [data-v2att]"));
    var items = all.map(function (b) { return { box: b.getAttribute("data-box"), gid: b.getAttribute("data-gid"), name: b.getAttribute("data-name"), size: +b.getAttribute("data-size") || 0, mime: b.getAttribute("data-mime"), link: b.getAttribute("data-link"), saving: /copying/.test(b.textContent) }; });
    if (!items.length) return;
    vwShow(items, Math.max(0, all.indexOf(c)), c);
  }, true);

  // conversation trail like Outlook: To / Cc on every mail, quoted older text folded behind "···"
  var QUOTE_SEL = ".gmail_quote,blockquote[type=cite],#divRplyFwdMsg,div[id^=divRplyFwdMsg],#appendonsend,.yahoo_quoted,.moz-cite-prefix";
  function foldQuotes(f) {
    var d; try { d = f.contentDocument; } catch (e) { return; }
    if (!d || !d.body || d.body.getAttribute("data-v2q")) return;
    d.body.setAttribute("data-v2q", "1");
    d.addEventListener("toggle", function () { if (typeof fitFrames === "function") fitFrames(); }, true);   // plain-text folds too
    // a mail that sets no font of its own shows in Outlook's font (not the browser's Times)
    try { if (/times/i.test(d.defaultView.getComputedStyle(d.body).fontFamily)) d.body.style.font = "14px/1.5 'Segoe UI',-apple-system,Roboto,Arial,sans-serif"; } catch (e) {}
    var q = d.querySelector(QUOTE_SEL);
    if (!q || !q.parentNode) return;
    var start = q, prev = q.previousElementSibling;
    if (prev && prev.tagName === "HR") start = prev;          // Outlook puts a line above "From: … Sent: …"
    // only fold when something new was written above the quote
    var r = d.createRange(); r.setStart(d.body, 0); r.setEndBefore(start);
    if (String(r.toString()).replace(/\s+/g, "").length < 15) return;
    var det = d.createElement("details"); det.className = "v2q";
    var sum = d.createElement("summary"); sum.textContent = "··· Show earlier messages"; sum.setAttribute("style", "cursor:pointer;color:#0f6cbd;font:13px 'Segoe UI',Arial,sans-serif;margin:8px 0;list-style:none");
    det.appendChild(sum);
    start.parentNode.insertBefore(det, start);
    var n = start; while (n) { var nx = n.nextSibling; det.appendChild(n); n = nx; }
    det.addEventListener("toggle", function () { sum.textContent = det.open ? "··· Hide earlier messages" : "··· Show earlier messages"; if (typeof fitFrames === "function") fitFrames(); });
    if (typeof fitFrames === "function") fitFrames();
  }
  function v2Trail(R) {
    var t = typeof T_ === "function" ? T_(openId) : null; if (!t) return;
    Array.prototype.slice.call(R.querySelectorAll("article.mail")).forEach(function (art) {
      var mi = +String(art.id).split("-").pop(), m = t.msgs[mi]; if (!m || art.querySelector(".v2to")) return;
      var hd = art.querySelector("header .w span");
      var to = String(m.to || "").trim(), cc = String(m.cc || "").trim();
      if (hd && (to || cc)) { var s = document.createElement("span"); s.className = "v2to"; s.textContent = (to ? "To: " + to : "") + (cc ? (to ? "   Cc: " : "Cc: ") + cc : ""); hd.replaceWith(s); }
      // Reply / Reply all / Forward on each mail, like Outlook
      var h = art.querySelector("header");
      if (h && !h.querySelector(".v2ma") && !art.classList.contains("collapsed")) {
        var g = document.createElement("span"); g.className = "v2ma";
        g.innerHTML = '<button type="button" class="v2mb" data-reply="' + txt(t.id) + '" title="Reply" aria-label="Reply">↩</button><button type="button" class="v2mb" data-reply="' + txt(t.id) + '" data-all title="Reply all" aria-label="Reply all">↩↩</button><button type="button" class="v2mb" data-fwd="' + txt(t.id) + '" title="Forward" aria-label="Forward">↪</button>';
        h.appendChild(g);
      }
    });
    Array.prototype.slice.call(R.querySelectorAll(".raw iframe")).forEach(function (f) {
      var go = function () { foldQuotes(f); };
      if (f.contentDocument && f.contentDocument.readyState === "complete") go();
      f.addEventListener("load", go);
    });
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
    // Tidy header (Outlook): row 1 = [select all] Inbox 5 ……… Topics ▾  View ▾ ; row 2 = filter chips.
    // The Sync button / "Synced …" text are dropped here — Sync is already in the top bar (its tooltip shows the time).
    var h2 = h.querySelector(":scope > h2");
    if (h2 && !h.querySelector(".v2top")) {
      var top = document.createElement("div"); top.className = "v2top";
      var sel = h.querySelector(".v2sel"), vb = h.querySelector("[data-vmbtn]");
      if (sel) { sel.title = "Select all"; sel.setAttribute("aria-label", "Select all"); top.appendChild(sel); }
      h2.parentNode.insertBefore(top, h2); top.appendChild(h2);
      var sp = document.createElement("span"); sp.className = "v2sp"; top.appendChild(sp);
      if (tb) top.appendChild(tb);
      if (vb) top.appendChild(vb);
      if (ls) ls.classList.add("v2hide");
    }
    var sb = document.getElementById("syncBtn");
    if (sb && typeof S !== "undefined" && S.lastSync) sb.title = "Sync · last synced " + new Date(S.lastSync).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
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
    // plain-text mail: older quoted text ("On … wrote:", "From: … Sent:", "-----Original Message-----") folded like Outlook
    var plain = window.originalHTML;
    window.originalHTML = function (m) {
      var b = String((m && m.body) || ""), cut = b.search(/\n[ \t]*(On .{4,220}wrote:|-{2,}\s*Original Message\s*-{2,}|-{2,}\s*Forwarded message\s*-{2,}|From:[^\n]{3,200}\n\s*(Sent|Date):)/i);
      if (cut < 15) return plain(m);
      var head = plain({ body: b.slice(0, cut) });
      return head.replace(/<\/body>$/, "") + '<details><summary style="cursor:pointer;color:#0f6cbd;font:13px \'Segoe UI\',Arial,sans-serif;margin:8px 0;list-style:none">··· Show earlier messages</summary><div style="color:#616161;border-left:2px solid #e0e0e0;padding-left:10px">' + txt(b.slice(cut).replace(/^\n+/, "")) + "</div></details></body>";
    };
    // attachments as Outlook cards with a full-screen viewer
    if (typeof attHTML === "function") window.attHTML = function (m, t) { try { return attCards(m, t || (typeof T_ === "function" ? T_(openId) : null)); } catch (e) { return ""; } };
    // quoted text folded/unfolded → resize the mail body
    document.addEventListener("toggle", function () { if (typeof fitFrames === "function") fitFrames(); }, true);
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
