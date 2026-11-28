// 28 Nov 2026 (option 3): a shared mailbox (teampulse@ is used by 6 people) lost mail for the whole team
// whenever somebody binned or archived it directly in Gmail. Gmail's Trash and Archive are no longer copied
// into Rugs Email: the conversation stays where it is, and the trail says what happened in Gmail.
// Restores from Gmail (untrash / back to inbox) still apply. Rugs Email's own Delete is unchanged.
const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
if (s.includes('__gmailtrashkeep')) { console.log('already patched'); process.exit(0); }
const rep = (a, b) => { const c = s.split(a).length - 1; if (c !== 1) throw new Error('expected 1 of ' + a + ' found ' + c); s = s.replace(a, b); };
rep(`      if (e === "TRASH+" && folder2 !== "deleted") {
        prev = folder2;
        folder2 = "deleted";
        note = "moved to Trash in Gmail";
      }`, `      if (e === "TRASH+" && folder2 !== "deleted") {
        /* __gmailtrashkeep 28 Nov 2026: binned in Gmail - kept in Rugs Email for the team */
        note = "binned in Gmail - kept here (delete it in Rugs Email if it should go)";
      }`);
rep(`      } else if (e === "INBOX-" && folder2 === "inbox") {
        prev = "inbox";
        folder2 = "archive";
        note = "archived in Gmail";
      }`, `      } else if (e === "INBOX-" && folder2 === "inbox") {
        note = "archived in Gmail - kept in the Inbox here";
      }`);
// the note is only written when the row changes; log the ignored ones too
rep(`    if (Object.keys(patch).length) {
      patch.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      await sb.from("rm_threads").update(patch).eq("mailbox", box).eq("gmail_thread_id", tid);
      if (note) await log(box, tid, null, "n", "Changed in Gmail: " + note);
      changed++;
    }`, `    if (Object.keys(patch).length) {
      patch.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      await sb.from("rm_threads").update(patch).eq("mailbox", box).eq("gmail_thread_id", tid);
      if (note) await log(box, tid, null, "n", "Changed in Gmail: " + note);
      changed++;
    } else if (note && / - kept /.test(note)) {
      try { await log(box, tid, null, "n", "Changed in Gmail: " + note); } catch (e) { }
    }`);
fs.writeFileSync(f, s);
console.log('server gmail-trash patched');
