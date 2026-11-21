/* 21 Nov 2026 - design-desk: stop it running the server out of memory (the other half of
   "the mail server is busy").
   ---------------------------------------------------------------------------------------------
   WHAT WAS HAPPENING (measured on the live project, 21 Nov)
     - two crons (jobs 20 and 22) call design-desk about once a minute each;
     - of its 1,433 runs in the log window, 578 died with "Memory limit exceeded" - 576 of the
       whole project's 589 memory kills - on the same shared compute as Rugs Email, which is why
       Rugs Email kept answering "the server was busy";
     - dd_files holds 89,427 indexed attachments (131 GB). Exactly 180 had been copied to Drive,
       89,247 were still waiting, and **not one had recorded a failure** - the giveaway: a memory
       kill never reaches a catch block, so the same five files were picked again by the very next
       tick, for ever. Seven days of this copied 26 files a day.

   THE TWO CAUSES
     1. fileBytes() decoded the attachment like this:
            const j = await api(...);                                  // whole JSON parsed
            return Uint8Array.from(atob(pad64(String(j.data))), c => c.charCodeAt(0));
        For a 25 MB file (FILE_BACKUP_MAX) that is ~33 MB of base64 as a raw body, the same again
        as a parsed JS string at 2 bytes a character (66 MB), a 25 MB binary string from atob at
        2 bytes a character (50 MB) and the output array - over 130 MB live at once, on a runtime
        that has nothing like that to give.
     2. The copy loop took five rows at a time and ran until its time budget, so one tick could
        line up several of those downloads back to back.

   THE FIX
     1. The attachment is read straight off the response body as it arrives and decoded a group at
        a time (new attBytes), so the only big thing in memory is the file itself. Tested on every
        length modulo 4 against six chunk sizes, real random binary, pretty-printed JSON, a wrong
        size field, base64url - and _, and a 25 MB file: byte for byte correct, heap flat.
     2. The attempt is written down BEFORE the file is fetched (new column dd_files.backup_tries),
        so a file that still kills the run is set aside after 3 goes instead of blocking the queue
        for ever. This is the part that breaks the crash loop.
     3. A tick handles at most TICK_BYTES of file, so many small .tif files still go per run but
        one large file ends the run.
   Nothing about what the module does changes: the same files go to the same Drive folders.
   ---------------------------------------------------------------------------------------------
   Usage: node server/patch-design-desk-memory.js   (reads .tmp/design-desk.ts, writes
          server/design-desk.index.ts ready to deploy)                                           */
const fs = require('fs');
const IN = '.tmp/design-desk.ts', OUT = 'server/design-desk.index.ts';
let s = fs.readFileSync(IN, 'utf8');
const n0 = s.length;
let done = 0;

function one(find, repl, label) {
  const i = s.indexOf(find);
  if (i < 0) {
    if (s.indexOf(repl) >= 0) { console.log('--  ' + label + ' (already there)'); return; }
    throw new Error('NOT FOUND: ' + label);
  }
  if (s.indexOf(find, i + 1) >= 0) throw new Error('NOT UNIQUE: ' + label);
  s = s.slice(0, i) + repl + s.slice(i + find.length);
  done++; console.log('ok  ' + label);
}

/* ---------------- 1. the streaming reader, and fileBytes rewritten to use it ---------------- */
const OLD_FB = `async function fileBytes(f: any) {
  const tok = await gToken(f.mailbox, READ);
  const m = await api(tok, GM + "messages/" + f.message_id + "?format=full&fields=payload(partId,filename,body(attachmentId),parts(partId,filename,body(attachmentId),parts(partId,filename,body(attachmentId),parts(partId,filename,body(attachmentId),parts(partId,filename,body(attachmentId))))))");
  let found: any = null;
  const look = (p: any) => { if (!p || found) return; if ((String(p.partId) === f.part_id || p.filename === f.name) && p.body?.attachmentId) { found = p; return; } (p.parts || []).forEach(look); };
  look(m.payload);
  if (!found) throw new E("This file is no longer in Gmail", 404);
  const j = await api(tok, GM + "messages/" + f.message_id + "/attachments/" + encodeURIComponent(found.body.attachmentId));
  return Uint8Array.from(atob(pad64(String(j.data || ""))), (c) => c.charCodeAt(0));
}`;

const NEW_FB = `// 21 Nov 2026: read an attachment off the response body as it arrives.
// It used to be  Uint8Array.from(atob(pad64(String(j.data))), c => c.charCodeAt(0))  on the result
// of res.json(). For a 25 MB file that keeps the raw body (~33 MB of base64), the parsed JS string
// (33 MB at 2 bytes a character = 66 MB) and atob's binary string (50 MB) alive at the same time -
// over 130 MB, and "Memory limit exceeded" killed the whole function, Rugs Email's requests with
// it. Decoding each whole 4-character group as it arrives means the only big thing in memory is
// the file. A base64 tail split across two network chunks is carried over, so nothing is lost.
async function attBytes(res: Response, size: number) {
  if (!res.ok) throw new E("Gmail " + res.status + " while reading the file", res.status === 404 ? 404 : 502);
  let out = new Uint8Array(Math.ceil((size || 0) * 1.05) + 1024), o = 0;
  const grow = (need: number) => {
    if (o + need <= out.length) return;
    const n = new Uint8Array(Math.max(out.length * 2, o + need));
    n.set(out.subarray(0, o)); out = n;
  };
  const put = (b64: string) => {
    const n = b64.length - (b64.length % 4);
    if (!n) return b64;
    const s2 = atob(b64.slice(0, n).replace(/-/g, "+").replace(/_/g, "/"));
    grow(s2.length);
    for (let k = 0; k < s2.length; k++) out[o++] = s2.charCodeAt(k);
    return b64.slice(n);
  };
  const td = new TextDecoder();
  let head = "", tail = "", inData = false, ended = false;
  for await (const c of (res.body as any)) {
    if (ended) continue;
    let t = td.decode(c, { stream: true });
    if (!inData) {
      head += t;
      const i = head.indexOf('"data"');
      const c2 = i < 0 ? -1 : head.indexOf(":", i);
      const q2 = c2 < 0 ? -1 : head.indexOf('"', c2);
      if (q2 < 0) { if (head.length > 8192) head = head.slice(-8192); continue; }
      t = head.slice(q2 + 1); head = ""; inData = true;
    }
    const q = t.indexOf('"');
    if (q >= 0) { t = t.slice(0, q); ended = true; }
    tail = put(tail + t);
  }
  if (!inData) throw new E("Gmail sent no file data", 502);
  if (tail) { let p = tail; while (p.length % 4) p += "="; put(p); }
  return out.subarray(0, o);
}
async function fileBytes(f: any) {
  const tok = await gToken(f.mailbox, READ);
  const m = await api(tok, GM + "messages/" + f.message_id + "?format=full&fields=payload(partId,filename,body(attachmentId),parts(partId,filename,body(attachmentId),parts(partId,filename,body(attachmentId),parts(partId,filename,body(attachmentId),parts(partId,filename,body(attachmentId))))))");
  let found: any = null;
  const look = (p: any) => { if (!p || found) return; if ((String(p.partId) === f.part_id || p.filename === f.name) && p.body?.attachmentId) { found = p; return; } (p.parts || []).forEach(look); };
  look(m.payload);
  if (!found) throw new E("This file is no longer in Gmail", 404);
  const url = GM + "messages/" + f.message_id + "/attachments/" + encodeURIComponent(found.body.attachmentId);
  const res = await fetch(url, { headers: { Authorization: "Bearer " + tok } });
  return await attBytes(res, f.size || 0);
}`;
one(OLD_FB, NEW_FB, 'attachment read as a stream instead of three copies in memory');

/* ------------------------------- 2. one file at a time, and count the try ------------------- */
const OLD_LOOP = `  while (Date.now() < endAt) {
    const { data } = await sb.from("dd_files").select("*").is("drive_id", null).is("backup_error", null).order("sent_at", { ascending: false }).limit(5);
    if (!data || !data.length) break;
    for (const f of data) {
      if (Date.now() >= endAt) break;
      if ((f.size || 0) > FILE_BACKUP_MAX) { await sb.from("dd_files").update({ backup_error: "too big for backup (kept in Gmail)" }).eq("id", f.id); continue; }
      try {
        const bytes = await fileBytes(f);
        const trF = await trailFolder(tok, root, f);
        const up = await driveUpload(tok, trF, f.name, f.mime || "application/octet-stream", bytes, "From: " + (f.from_addr || "") + "\\nSubject: " + (f.subject || "") + "\\nDate: " + (f.sent_at || ""));
        await sb.from("dd_files").update({ drive_id: up.id, drive_link: up.link, trail_ok: true }).eq("id", f.id);
        n++;
      } catch (e) {
        await sb.from("dd_files").update({ backup_error: clean((e as Error).message, 200) || "failed" }).eq("id", f.id);
      }
    }
  }`;

const NEW_LOOP = `  // 21 Nov 2026: one file at a time, and the try is written down BEFORE the file is fetched.
  // This used to take five rows at a time and keep going until the time budget, so one tick could
  // line up several 10-25 MB downloads. When a tick was killed for memory, nothing was recorded
  // (a kill never reaches a catch), so the very next tick picked the same files - for ever.
  // That is why 578 of 1,433 runs died and only 180 of 89,247 files had ever been copied, with
  // zero recorded failures. Counting the try first means a file that cannot be copied is set
  // aside after BACKUP_TRIES goes instead of blocking the queue and knocking over the server that
  // Rugs Email is also using.
  let spent = 0;
  while (Date.now() < endAt && spent < TICK_BYTES) {
    const { data } = await sb.from("dd_files").select("*")
      .is("drive_id", null).is("backup_error", null).lt("backup_tries", BACKUP_TRIES)
      .order("sent_at", { ascending: false }).limit(1);
    const f = data && data[0];
    if (!f) break;
    if ((f.size || 0) > FILE_BACKUP_MAX) { await sb.from("dd_files").update({ backup_error: "too big for backup (kept in Gmail)" }).eq("id", f.id); continue; }
    const tries = (f.backup_tries || 0) + 1;
    await sb.from("dd_files").update({ backup_tries: tries }).eq("id", f.id);
    spent += f.size || 0;
    try {
      const bytes = await fileBytes(f);
      const trF = await trailFolder(tok, root, f);
      const up = await driveUpload(tok, trF, f.name, f.mime || "application/octet-stream", bytes, "From: " + (f.from_addr || "") + "\\nSubject: " + (f.subject || "") + "\\nDate: " + (f.sent_at || ""));
      await sb.from("dd_files").update({ drive_id: up.id, drive_link: up.link, trail_ok: true }).eq("id", f.id);
      n++;
    } catch (e) {
      const why = clean((e as Error).message, 200) || "failed";
      if (tries >= BACKUP_TRIES) await sb.from("dd_files").update({ backup_error: why + " (gave up after " + tries + " goes)" }).eq("id", f.id);
      else console.error("backup try " + tries + " failed for file " + f.id + ": " + why);
    }
  }`;
one(OLD_LOOP, NEW_LOOP, 'one file a tick, the try recorded before the download');

/* ----------------------------------- 3. the two new settings ------------------------------- */
one(`const FILE_BACKUP_MAX = 25 * 1048576;`,
  `const FILE_BACKUP_MAX = 25 * 1048576;
// 21 Nov 2026: how much file one cron tick may handle, and how many goes a single file gets
// before it is set aside. Both exist to keep a tick inside the runtime's memory, so a big design
// file can never kill the function (and with it whatever else that worker was serving).
const TICK_BYTES = 24 * 1048576;
const BACKUP_TRIES = 3;`,
  'TICK_BYTES and BACKUP_TRIES');

/* getAtt (a designer pressing Download on one attachment) is deliberately NOT changed: it hands
   the base64 straight back to the browser and needs j.data, so asking Gmail for the size only
   would have broken every download. It is capped at CFG.MAX_FILE_MB (10 MB) already, and it runs
   when a person clicks - not once a minute - so it is not what was killing the function. */

fs.writeFileSync(OUT, s);
console.log(done + ' edits, ' + n0 + ' -> ' + s.length + ' chars -> ' + OUT);
