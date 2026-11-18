# patch-dash-upload.py — adds the "File upload" card to the Home dashboard
# of index.html (18 Nov 2026). Three small edits, nothing else touched:
#   1. the card's HTML inside <div id="view-home">
#   2. the card's JavaScript, just above renderHomeExtras()
#   3. one line inside renderHomeExtras() so the card is drawn with Home
# Run again safely: it refuses to patch a file that already has the card.
import io, sys, os

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "index.html")
src = io.open(P, encoding="utf-8", newline="").read()
orig = src

# index.html is CRLF throughout, so every literal below is converted to CRLF.
CR, LF = chr(13), chr(10)
def crlf(t):
    return t.replace(CR + LF, LF).replace(LF, CR + LF)

if "upHomeWidget" in src:
    print("Already patched — nothing to do.")
    sys.exit(0)

# ---------------------------------------------------------------- 1. HTML
anchor_html = """      <div class="card hidden" id="quickLinksHomeWidget" style="padding:18px;margin-bottom:20px">
        <h3 style="margin:0 0 8px">\U0001f517 Quick Links</h3>
        <div id="quickLinksHomeRow" style="display:flex;flex-wrap:wrap;gap:8px"></div>
      </div>
"""
card_html = """      <div class="card hidden" id="upHomeWidget" style="padding:18px;margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <h3 style="margin:0">\U0001f4e4 File upload</h3>
          <span class="sub" style="font-size:12px">Kept on the company server (Z:) \u00b7 admins only</span>
        </div>
        <div id="upHomeDrop" style="margin-top:10px;border:2px dashed var(--line);border-radius:10px;padding:18px;text-align:center;cursor:pointer">
          <div style="font-size:15px;font-weight:600">Choose files, or drop them here</div>
          <div class="sub" style="font-size:12px;margin-top:4px">Any file type, up to 100 MB each</div>
          <input type="file" id="upHomeInput" multiple class="hidden" />
        </div>
        <div id="upHomeProgress" style="margin-top:10px"></div>
        <div id="upHomeList" style="margin-top:12px"></div>
      </div>
"""
assert src.count(crlf(anchor_html)) == 1, "Home Quick Links card not found exactly once"
src = src.replace(crlf(anchor_html), crlf(anchor_html) + crlf(card_html))

# ------------------------------------------------------------------ 2. JS
anchor_js = """  // Called once after login/loadAll, and every time Home is (re)shown.
  function renderHomeExtras() {"""
js = """  // ---------- File upload (Home card, admins only) ----------
  // A browser is not allowed to write into Z:\\ by itself, so the file takes
  // the safe route: it goes from the browser straight into the PRIVATE
  // Supabase bucket "dash-uploads" using a one-time link from the dash-upload
  // function, and the file NAME (with size, who and when) is saved as one row
  // in the table public.dash_uploads. A small script on the company server
  // (server/z-sync.ps1, run every minute by Task Scheduler) then copies each
  // new file into Z:\\RugsUploads and stamps z_copied_at / z_path, which is
  // what the "Company server" column in this card shows.
  var UP_FN_URL = SUPABASE_URL + "/functions/v1/dash-upload";
  var UP_MAX_BYTES = 104857600; // 100 MB, same limit as the bucket
  var upState = { files: [], total: 0, loading: false, err: "", wired: false, askRemove: 0 };
  function upApi(action, payload) {
    // session_token is added automatically by the fetch wrapper above.
    var body = Object.assign({ action: action }, payload || {});
    return fetch(UP_FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + ANON_KEY, "apikey": ANON_KEY },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || !j.ok) throw new Error(j.error || ("HTTP " + r.status));
        return j.data;
      });
    });
  }
  function upCanUse() { return !!(state.doer && (state.doer.is_admin || state.doer.role === "super_admin") && !state.demo); }
  function upSize(n) {
    n = Number(n || 0);
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(0) + " KB";
    if (n < 1073741824) return (n / 1048576).toFixed(1) + " MB";
    return (n / 1073741824).toFixed(2) + " GB";
  }
  function upLoadList() {
    if (!upCanUse()) return;
    upState.loading = true; upState.err = ""; upDrawList();
    upApi("list", { limit: 25 }).then(function (d) {
      upState.files = d.files || []; upState.total = d.total || 0; upState.loading = false; upDrawList();
    }).catch(function (e) {
      upState.loading = false; upState.err = e.message || "Could not load the list"; upDrawList();
    });
  }
  function upDrawList() {
    var box = document.getElementById("upHomeList");
    if (!box) return;
    if (upState.loading && !upState.files.length) { box.innerHTML = '<div class="sub">Loading\\u2026</div>'; return; }
    if (upState.err && !upState.files.length) { box.innerHTML = '<div class="sub" style="color:#b42318">' + esc(upState.err) + "</div>"; return; }
    if (!upState.files.length) { box.innerHTML = '<div class="sub">Nothing uploaded yet.</div>'; return; }
    var th = function (t) { return '<th style="padding:6px 8px;font-weight:600">' + t + "</th>"; };
    var rows = upState.files.map(function (f) {
      var onZ = f.z_copied_at
        ? '<span class="badge" title="' + esc(f.z_path || "") + '">\\u2713 on Z:</span>'
        : (f.z_error
          ? '<span class="badge" style="background:#fee2e2;color:#b42318" title="' + esc(f.z_error) + '">Z: failed</span>'
          : '<span class="badge" style="background:#fff7e6;color:#8a5a00">copying\\u2026</span>');
      var name = f.url
        ? '<a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.file_name) + "</a>"
        : esc(f.file_name);
      return "<tr>" +
        '<td style="padding:6px 8px">' + name + "</td>" +
        '<td style="padding:6px 8px;white-space:nowrap">' + upSize(f.size_bytes) + "</td>" +
        '<td style="padding:6px 8px;white-space:nowrap">' + esc(f.uploaded_by_name || "\\u2014") + "</td>" +
        '<td style="padding:6px 8px;white-space:nowrap">' + esc(fmtDate(f.uploaded_at)) + "</td>" +
        '<td style="padding:6px 8px;white-space:nowrap">' + onZ + "</td>" +
        '<td style="padding:6px 8px;white-space:nowrap"><a class="up-rm" data-id="' + f.id + '" style="cursor:pointer;color:#b42318;font-size:12px">' +
          (upState.askRemove === f.id ? "Really remove?" : "\\u2715") + "</a></td>" +
      "</tr>";
    }).join("");
    box.innerHTML = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">' +
      '<thead><tr style="text-align:left;color:var(--mut)">' + th("File") + th("Size") + th("By") + th("When") + th("Company server") + "<th></th></tr></thead><tbody>" +
      rows + "</tbody></table></div>" +
      (upState.total > upState.files.length
        ? '<div class="sub" style="margin-top:6px;font-size:12px">Newest ' + upState.files.length + " of " + upState.total + "</div>"
        : "");
    box.querySelectorAll(".up-rm").forEach(function (a) {
      a.addEventListener("click", function () {
        var id = Number(a.getAttribute("data-id"));
        // First click asks, second click removes — no pop-up needed.
        if (upState.askRemove !== id) { upState.askRemove = id; upDrawList(); return; }
        upState.askRemove = 0;
        upApi("remove", { id: id }).then(function () { toast("Removed"); upLoadList(); })
          .catch(function (e) { toast(e.message, true); });
      });
    });
  }
  function upSend(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    var box = document.getElementById("upHomeProgress");
    if (!box) return;
    var next = function (i) {
      if (i >= files.length) { upLoadList(); return; }
      var f = files[i];
      var row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:4px;flex-wrap:wrap";
      row.innerHTML = "\\u2b06 " + esc(f.name) + " (" + upSize(f.size) + ') <progress max="100" value="0"></progress> <span></span>';
      box.appendChild(row);
      var bar = row.querySelector("progress"), msg = row.querySelector("span");
      if (f.size > UP_MAX_BYTES) {
        msg.textContent = "\\u2716 over 100 MB \\u2014 skipped";
        if (bar) bar.remove();
        return next(i + 1);
      }
      upApi("start", { name: f.name, size: f.size, mime: f.type }).then(function (u) {
        return new Promise(function (resolve, reject) {
          var fd = new FormData(); fd.append("cacheControl", "3600"); fd.append("", f);
          var xhr = new XMLHttpRequest();
          xhr.open("PUT", u.signed_url);
          xhr.setRequestHeader("apikey", ANON_KEY);
          xhr.setRequestHeader("Authorization", "Bearer " + ANON_KEY);
          xhr.setRequestHeader("x-upsert", "false");
          xhr.upload.onprogress = function (ev) { if (ev.lengthComputable && bar) bar.value = Math.round(ev.loaded / ev.total * 100); };
          xhr.onload = function () { xhr.status >= 200 && xhr.status < 300 ? resolve(u) : reject(new Error("Upload failed (" + xhr.status + ")")); };
          xhr.onerror = function () { reject(new Error("Upload failed \\u2014 check your connection")); };
          xhr.send(fd);
        });
      }).then(function (u) {
        return upApi("done", { path: u.path, name: f.name, size: f.size, mime: f.type });
      }).then(function () {
        if (bar) bar.value = 100;
        msg.textContent = "\\u2713 saved";
        setTimeout(function () { row.remove(); }, 2500);
        next(i + 1);
      }).catch(function (e) {
        if (bar) bar.remove();
        msg.textContent = "\\u2716 " + (e.message || "failed");
        next(i + 1);
      });
    };
    next(0);
  }
  function renderUploadHomeWidget() {
    var w = document.getElementById("upHomeWidget");
    if (!w) return;
    if (!upCanUse()) { w.classList.add("hidden"); return; }
    w.classList.remove("hidden");
    if (!upState.wired) {
      upState.wired = true;
      var drop = document.getElementById("upHomeDrop"), inp = document.getElementById("upHomeInput");
      if (drop && inp) {
        drop.addEventListener("click", function () { inp.click(); });
        inp.addEventListener("change", function () { upSend(inp.files); inp.value = ""; });
        ["dragenter", "dragover"].forEach(function (ev) {
          drop.addEventListener(ev, function (e) { e.preventDefault(); drop.style.borderColor = "#2563eb"; });
        });
        ["dragleave", "drop"].forEach(function (ev) {
          drop.addEventListener(ev, function (e) { e.preventDefault(); drop.style.borderColor = ""; });
        });
        drop.addEventListener("drop", function (e) { if (e.dataTransfer && e.dataTransfer.files) upSend(e.dataTransfer.files); });
      }
      upLoadList();
    }
    upDrawList();
  }

"""
assert src.count(crlf(anchor_js)) == 1, "renderHomeExtras not found exactly once"
src = src.replace(crlf(anchor_js), crlf(js) + crlf(anchor_js))

# ------------------------------------------------------- 3. draw it with Home
anchor_call = """    renderQuickLinksHomeWidget();
    if (typeof renderPollHomeWidget === "function") renderPollHomeWidget();"""
new_call = """    renderQuickLinksHomeWidget();
    renderUploadHomeWidget();
    if (typeof renderPollHomeWidget === "function") renderPollHomeWidget();"""
assert src.count(crlf(anchor_call)) == 1, "renderHomeExtras body not found exactly once"
src = src.replace(crlf(anchor_call), crlf(new_call))

assert src != orig
io.open(P, "w", encoding="utf-8", newline="").write(src)
print("Patched index.html: +%d characters" % (len(src) - len(orig)))
