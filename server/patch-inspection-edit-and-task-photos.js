/* 21 Nov 2026 — two things asked for together:
     1. INSPECTION: "give person to edit the details or the date".
        Only an Admin had the ✏️ Edit button (renderInspections rendered admBtns() behind
        state.doer.is_admin), so the merchant who logged an inspection could not fix his own
        typo or a changed date — he had to ask an admin. Chosen: ANYONE WHO CAN OPEN THE
        INSPECTION PAGE may edit any inspection; DELETE stays with admins only.
        Because the edit right is now shared by the whole team, who last changed it is recorded
        and shown in the list — otherwise a wrong correction would be untraceable.
        Server: new small function `insp-edit` (server/insp-edit.index.ts), action
        "inspectionUpdate". deleg-admin is untouched, so admin Edit/Delete everywhere else and
        the buyer portal inside that file carry no risk from this.
     2. DELEGATION: "give right to delete the photo or add up to 3 photos".
        The Assign New Task form already took up to 3 images, but there was no way to take one
        off, and picking again THREW AWAY whatever was already chosen (the handler replaced the
        whole list). Now each thumbnail has a ✕, and picking again ADDS up to the three.
        Chosen: only while the form is open — once a task is saved its photos stay as a record,
        so no server change was needed for this half.
   Both edits are in index.html's own scripts (the Workspace app is plain there, not base64).
   Usage: node server/patch-inspection-edit-and-task-photos.js                                  */
const fs = require('fs');
const F = 'index.html';
let s = fs.readFileSync(F, 'utf8');
const n0 = s.length;
let done = 0;

/* index.html is saved with Windows line endings (CRLF), but the anchors below are written with
   plain \n for readability — so both sides are converted before matching, and the replacement is
   put back in the file's own ending. Without this every multi-line anchor silently misses. */
const EOL = s.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const toEol = (t) => t.replace(/\r\n/g, '\n').split('\n').join(EOL);

function one(find0, repl0, label) {
  const find = toEol(find0), repl = toEol(repl0);
  const i = s.indexOf(find);
  if (i < 0) {
    if (s.indexOf(repl) >= 0) { console.log('--  ' + label + ' (already there)'); return; }
    throw new Error('NOT FOUND: ' + label);
  }
  if (s.indexOf(find, i + 1) >= 0) throw new Error('NOT UNIQUE: ' + label);
  s = s.slice(0, i) + repl + s.slice(i + find.length);
  done++; console.log('ok  ' + label);
}

/* ============================ 1. styles for the removable photo ============================ */
one(`  .task-att-row img{width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid var(--line);display:block}`,
  `  .task-att-row img{width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid var(--line);display:block}
  /* 21 Nov 2026: a photo picked for a new task can be taken off again before it is assigned */
  .nt-img{position:relative;display:inline-block;line-height:0}
  .nt-img-x{position:absolute;top:-7px;right:-7px;width:20px;height:20px;padding:0;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--sub);font:inherit;font-size:11px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}
  .nt-img-x:hover{background:var(--danger);border-color:var(--danger);color:#fff}
  .nt-img-note{align-self:center;font-size:11.5px;color:var(--sub)}
  .insp-edited{display:block;font-size:11px;color:var(--sub)}`,
  'styles for the ✕ on a picked photo');

/* ====================== 2. Edit and Delete can be granted separately ====================== */
one(`  function admBtns(kind, row) {
    if (!state.doer || !state.doer.is_admin || !row || !ADM_DEFS[kind]) return "";
    var id = admIdOf(kind, row);
    ADM_ROWS[kind + "::" + id] = row;
    return '<span class="adm-actions"><button type="button" class="adm-btn adm-edit" data-kind="' + kind + '" data-id="' + esc(id) + '" title="Edit (admin)">✏️ Edit</button>' +
      '<button type="button" class="adm-btn adm-del" data-kind="' + kind + '" data-id="' + esc(id) + '" title="Delete (admin)">🗑️ Delete</button></span>';
  }`,
  `  // 21 Nov 2026: Edit and Delete are granted separately now, because Inspection lets anyone who
  // can open the page correct a wrong date while DELETING an inspection stays with admins.
  // admBtns keeps its old meaning (an admin gets both); admBtnsFor spells out who gets what.
  function admBtnsFor(kind, row, canEdit, canDelete) {
    if (!state.doer || !row || !ADM_DEFS[kind] || (!canEdit && !canDelete)) return "";
    var id = admIdOf(kind, row);
    ADM_ROWS[kind + "::" + id] = row;
    var isAdm = !!state.doer.is_admin;
    return '<span class="adm-actions">' +
      (canEdit ? '<button type="button" class="adm-btn adm-edit" data-kind="' + kind + '" data-id="' + esc(id) + '" title="' + (isAdm ? "Edit (admin)" : "Fix the details or the date") + '">✏️ Edit</button>' : "") +
      (canDelete ? '<button type="button" class="adm-btn adm-del" data-kind="' + kind + '" data-id="' + esc(id) + '" title="Delete (admin)">🗑️ Delete</button>' : "") +
      "</span>";
  }
  function admBtns(kind, row) {
    var isAdm = !!(state.doer && state.doer.is_admin);
    return admBtnsFor(kind, row, isAdm, isAdm);
  }`,
  'admBtnsFor — Edit without Delete');

/* ================= 3. Inspection list: Edit for everyone, Delete for admins ================= */
one(`        '<td><span class="badge ' + bvSt[1] + '">' + bvSt[2] + "</span></td>" + (state.doer.is_admin ? "<td>" + admBtns("inspection", v) + "</td>" : "") + "</tr>";`,
  `        '<td><span class="badge ' + bvSt[1] + '">' + bvSt[2] + "</span></td>" +
        // 21 Nov 2026: everyone who can open this page may fix the details or the date;
        // Delete is still only for admins.
        "<td>" + admBtnsFor("inspection", v, true, !!state.doer.is_admin) + "</td></tr>";`,
  'inspection row: Edit for everyone');

one(`    wrap.innerHTML = "<table><thead><tr><th>Person</th><th>Buyer</th><th>When</th><th>Reason</th><th>Logged by</th><th>Status</th>" + (state.doer.is_admin ? "<th></th>" : "") + "</tr></thead><tbody>" + rows + "</tbody></table>";`,
  `    wrap.innerHTML = "<table><thead><tr><th>Person</th><th>Buyer</th><th>When</th><th>Reason</th><th>Logged by</th><th>Status</th><th></th></tr></thead><tbody>" + rows + "</tbody></table>";`,
  'inspection header: the button column always shows');

/* who last corrected it — shown under "Logged by", since the whole team can edit now */
one(`        "<td>" + esc(v.created_by || "—") + "</td>" +
        '<td><span class="badge ' + bvSt[1] + '">' + bvSt[2] + "</span></td>" +`,
  `        "<td>" + esc(v.created_by || "—") +
          (v.edited_by ? '<span class="insp-edited">edited by ' + esc(v.edited_by) + (v.edited_at ? " · " + new Date(v.edited_at).toLocaleDateString(undefined, { day: "2-digit", month: "short" }) : "") + "</span>" : "") +
        "</td>" +
        '<td><span class="badge ' + bvSt[1] + '">' + bvSt[2] + "</span></td>" +`,
  'inspection row: "edited by" note');

/* ===================== 4. the edit modal: wording + where it saves to ===================== */
one(`    var html = "<h3>Edit " + esc(def.label) + '</h3><div class="sub" style="margin:-4px 0 10px">Admin edit — changes save straight away, no approval emails are sent.</div>';`,
  `    var html = "<h3>Edit " + esc(def.label) + '</h3><div class="sub" style="margin:-4px 0 10px">' +
      (state.doer && state.doer.is_admin
        ? "Admin edit — changes save straight away, no approval emails are sent."
        : "Changes save straight away and no e-mails are sent. Your name is shown against the correction.") + "</div>";`,
  'edit modal wording for a non-admin');

one(`      api("adminRecordUpdate", { requester_doc_id: state.doer.doc_id, kind: kind, id: id, patch: patch }).then(function () {`,
  `      // 21 Nov 2026: an inspection goes through its own small function, which allows anyone who
      // can open the Inspection page (deleg-admin's adminRecordUpdate is admin-only, and is left
      // that way for every other module).
      api(kind === "inspection" ? "inspectionUpdate" : "adminRecordUpdate", { requester_doc_id: state.doer.doc_id, kind: kind, id: id, patch: patch }).then(function () {`,
  'inspection edit calls insp-edit');

/* ============================= 5. route the new action ============================= */
one(`  var ADMIN_FN_URL = SUPABASE_URL + "/functions/v1/deleg-admin";`,
  `  var ADMIN_FN_URL = SUPABASE_URL + "/functions/v1/deleg-admin";
  // 21 Nov 2026: Inspection edits only. Its own function so that opening this right to the whole
  // team did not mean redeploying deleg-admin, which also holds Press & Blogs, the buyer portal
  // and in-app notifications.
  var INSP_FN_URL = SUPABASE_URL + "/functions/v1/insp-edit";`,
  'insp-edit URL');

one(`    var url = ADMIN_FN_ACTIONS.indexOf(action) !== -1 ? ADMIN_FN_URL : FN_URL;`,
  `    var url = action === "inspectionUpdate" ? INSP_FN_URL
      : ADMIN_FN_ACTIONS.indexOf(action) !== -1 ? ADMIN_FN_URL : FN_URL;`,
  'api() routes inspectionUpdate');

one(`          case "adminRecordUpdate": case "adminRecordDelete": resolve({ id: p.id }); break;`,
  `          case "adminRecordUpdate": case "adminRecordDelete": case "inspectionUpdate": resolve({ id: p.id }); break;`,
  'demo mode knows inspectionUpdate');

/* ================= 6. Assign New Task: ✕ on each photo, picking again adds ================= */
one(`      '<div class="field"><label>📎 Attach images / photos (optional, up to 3)</label><input type="file" id="ntFiles" accept="image/*" multiple /><div id="ntFilePrev" class="task-att-row"></div></div>' +`,
  `      '<div class="field"><label>📎 Attach images / photos (optional, up to 3 — ✕ takes one off)</label><input type="file" id="ntFiles" accept="image/*" multiple /><div id="ntFilePrev" class="task-att-row"></div></div>' +`,
  'label mentions ✕');

one(`    var ntImages = [];
    document.getElementById("ntFiles").addEventListener("change", function () {
      var files = Array.prototype.slice.call(this.files || [], 0, 3);
      Promise.all(files.map(opsCompressImage)).then(function (imgs) {
        ntImages = imgs.map(function (x) { return x.data; });
        document.getElementById("ntFilePrev").innerHTML = ntImages.map(function (u) { return '<img src="' + u + '" alt="">'; }).join("");
      }).catch(function () { toast("Couldn't read that image", true); });
    });`,
  `    var ntImages = [];
    var NT_MAX_IMGS = 3;
    // 21 Nov 2026: each picked photo gets a ✕ so a wrong one can be taken off, and picking again
    // ADDS to the three instead of replacing them — the old handler overwrote the whole list, so
    // choosing a second photo silently threw the first one away.
    function ntDrawImgs() {
      var prev = document.getElementById("ntFilePrev");
      if (!prev) return;
      prev.innerHTML = ntImages.map(function (u, i) {
        return '<span class="nt-img"><img src="' + u + '" alt="Photo ' + (i + 1) + '">' +
          '<button type="button" class="nt-img-x" data-ntimg="' + i + '" title="Take this photo off" aria-label="Take photo ' + (i + 1) + ' off">✕</button></span>';
      }).join("") +
        (ntImages.length ? '<span class="nt-img-note">' + ntImages.length + " of " + NT_MAX_IMGS +
          (ntImages.length < NT_MAX_IMGS ? " — pick again to add another" : " — that is the most") + "</span>" : "");
      // Each cross remembers the PHOTO it belongs to, not its position in the row: the row is
      // redrawn after every removal, so a position captured when it was drawn can point at a
      // different photo by the time it is clicked. If that photo has already gone, do nothing.
      Array.prototype.forEach.call(prev.querySelectorAll("[data-ntimg]"), function (b) {
        var mine = ntImages[Number(b.dataset.ntimg)];
        b.addEventListener("click", function () {
          var at = ntImages.indexOf(mine);
          if (at === -1) return;
          ntImages.splice(at, 1);
          ntDrawImgs();
        });
      });
    }
    document.getElementById("ntFiles").addEventListener("change", function () {
      var picked = Array.prototype.slice.call(this.files || []);
      this.value = "";                      // so picking the same file again still fires change
      var room = NT_MAX_IMGS - ntImages.length;
      if (room <= 0) { toast("Three photos is the most one task can carry — take one off first", true); return; }
      var files = picked.slice(0, room), left = picked.length - files.length;
      Promise.all(files.map(opsCompressImage)).then(function (imgs) {
        imgs.forEach(function (x) { if (ntImages.length < NT_MAX_IMGS) ntImages.push(x.data); });
        ntDrawImgs();
        if (left > 0) toast(left + (left === 1 ? " photo was" : " photos were") + " left out — three is the most", true);
      }).catch(function () { toast("Couldn't read that image", true); });
    });`,
  'photos: add up to 3, ✕ removes one');

fs.writeFileSync(F, s);
console.log(done + ' edits, ' + n0 + ' -> ' + s.length + ' chars in ' + F);
