/* test-ignore-archive.mjs - 27 Nov 2026  (bug 8 - rule R13i: Ignore conversation)
 *
 * Two halves, both tested for real:
 *
 *  A) the APP, in real headless Edge on the built mail-app.html: "Ignore conversation" moves
 *     the conversation to ARCHIVE (not Deleted), tags it, writes "Ignored by <name> - moved to
 *     Archive" in the Activity trail, marks it done so it leaves the work lists, offers Undo
 *     that puts everything back, and "Stop ignoring" takes the tag off.
 *
 *  B) the TRIGGER, against a real Postgres with the real rm_ tables (the staging copy of the
 *     live database on this laptop), inside ONE transaction that is ROLLED BACK at the end, so
 *     the database is left exactly as it was: the new rm_ignore_trg() is installed, a mail
 *     arriving in an ignored conversation puts it back in the INBOX with the tag gone and the
 *     "New mail - back in Inbox" line, our own outgoing reply does NOT, and the one-time move
 *     out of Deleted writes the folder and nothing else.
 *
 * Run:  node server/test-ignore-archive.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(__dirname, "..", ".tmp", "node_modules", "playwright-core"));
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PAGE = "file:///" + path.join(__dirname, "..", "mail-app.html").replace(/\\/g, "/");
const LOCAL = "C:/Users/team3pr1/Claude/rugs-mail-local/server";

let pass = 0, fail = 0;
const ck = (n, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(g) + ", wanted " + JSON.stringify(w) + ")")); ok ? pass++ : fail++; };

/* ======================================================= A · the app ====== */
console.log("=== A · the app: Ignore conversation ===");
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e.message || e)));
await page.addInitScript(() => { try { localStorage.setItem("rugs-maint-ok", "1"); } catch (e) { } });
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

const setup = await page.evaluate(() => {
  if (typeof cmOpen !== "function") return "the right-click menu is not in the app";
  PEOPLE.length = 0;
  PEOPLE.push(
    { id: "imran", name: "Imran Khan", login: "merchandiser4@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: { delete: 1 } },
    { id: "jagjit", name: "Jagjit Singh", login: "merchandiser2@rugscreation.com", dept: "ta", role: "Manager", active: true, perm: { delete: 1 } });
  DEPTS.length = 0; DEPTS.push({ id: "ta", name: "Team Alpha", box: "teamalpha@", color: "#ff5001" });
  const T0 = Date.parse("2026-11-27T10:00:00+05:30");
  S.threads = [{
    id: "ta:1", box: "teamalpha@rugscreation.com", dept: "ta", from: "Noisy Vendor", email: "news@vendor.com",
    sub: "Weekly vendor newsletter", pre: "offers", last: T0, owner: null, status: "open", folder: "inbox",
    unread: true, hist: [], cats: [], flag: 0, pinned: 0, full: true,
    msgs: [{ gid: "n1", from: "Noisy Vendor", email: "news@vendor.com", at: T0, body: "Offers of the week.", to: "teamalpha@rugscreation.com", cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "", html: "" }]
  }];
  S.settings = {}; ME = "imran"; app = "mail"; view = { type: "box", dept: "ta", folder: "inbox" };
  if (typeof filt !== "undefined") filt = "all";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  try { S.threads.forEach(t => { metaSaved[t.id] = JSON.stringify(metaOf(t)); t._hn = t.hist.length; }); } catch (e) { }
  render();
  window.__ignore = () => {                       /* exactly what the menu entry does */
    const t = T_("ta:1");
    cmOpen(t, 10, 10, null);
    const b = document.querySelector('[data-cm="ignore"]');
    if (!b) return "no Ignore entry in the menu";
    const label = b.textContent.replace(/\s+/g, " ").trim();
    b.click();
    return label;
  };
  window.__state = () => {
    const t = T_("ta:1");
    return {
      folder: t.folder, prev: t.prev, cats: t.cats || [], status: t.status,
      done: st(t) === "done", hist: (t.hist || []).map(h => h.txt),
      inInbox: (() => { view = { type: "box", dept: "ta", folder: "inbox" }; return listRows().some(x => x.id === "ta:1"); })(),
      inArchive: (() => { view = { type: "box", dept: "ta", folder: "archive" }; return listRows().some(x => x.id === "ta:1"); })(),
      inDeleted: (() => { view = { type: "box", dept: "ta", folder: "deleted" }; return listRows().some(x => x.id === "ta:1"); })(),
      work: (() => { try { return !!isWork(T_("ta:1")) && st(T_("ta:1")) !== "done"; } catch (e) { return null } })()
    };
  };
  /* undoToast() puts a .undobar at the bottom of the page with an "Undo" button in it */
  window.__undo = () => { const b = document.querySelector(".undobar button"); if (!b) return "no Undo button"; b.click(); return "ok"; };
  window.__bar = () => { const b = document.querySelector(".undobar"); return b ? b.textContent.replace(/\s+/g, " ").trim() : ""; };
  return "ok";
});
ck("the app is set up", setup, "ok");

const label = await page.evaluate(() => window.__ignore());
await page.waitForTimeout(200);
ck("the menu entry says where it goes", label, "\u{1F515} Ignore conversation (to Archive)");
let st1 = await page.evaluate(() => window.__state());
console.log("     " + JSON.stringify(st1));
ck("1 · it is moved to ARCHIVE, not Deleted", st1.folder, "archive");
ck("...it is in the Archive folder", st1.inArchive, true);
ck("...out of the Inbox", st1.inInbox, false);
ck("...and NOT in Deleted", st1.inDeleted, false);
ck('1 · it is tagged "ignored"', st1.cats, ["ignored"]);
ck("1 · the Activity trail says who and where", st1.hist.some(h => /^Ignored by Imran Khan .* moved to Archive$/.test(h)), true);
ck("it is marked done, so it leaves the work lists (as Deleted did)", st1.done, true);
ck("...and it is not counted as work", st1.work, false);
ck("the folder it came from is remembered for Restore", st1.prev, "inbox");

ck("1 · the toast says where it went", await page.evaluate(() => window.__bar()), "Conversation ignored — moved to Archive10s↶ Undo");
ck("the Undo button is offered", await page.evaluate(() => window.__undo()), "ok");
await page.waitForTimeout(200);
const st2 = await page.evaluate(() => window.__state());
ck("Undo puts it back in the Inbox", st2.folder, "inbox");
ck("...takes the tag off", st2.cats, []);
ck("...puts the old status back", st2.status, "open");
ck("...and says so in the Activity trail", st2.hist.some(h => /Ignore undone by Imran Khan/.test(h)), true);

await page.evaluate(() => window.__ignore());
await page.waitForTimeout(150);
const st3 = await page.evaluate(() => { const t = T_("ta:1"); cmOpen(t, 10, 10, null); const b = document.querySelector('[data-cm="ignore"]'); const l = b ? b.textContent.replace(/\s+/g, " ").trim() : ""; if (b) b.click(); return { label: l, after: window.__state() }; });
ck('"Stop ignoring" is what the menu offers next', st3.label, "\u{1F514} Stop ignoring");
ck("...and it takes the tag off", st3.after.cats, []);
ck("no page errors", errs, []);
await browser.close();

/* ================================================== B · the trigger ======= */
console.log("\n=== B · the trigger, on a real Postgres (rolled back at the end) ===");
const pg = require(path.join(LOCAL, "node_modules", "pg"));
const env = {};
for (const l of fs.readFileSync(path.join(LOCAL, ".env"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim();
}
const client = new pg.Client({ connectionString: env.DATABASE_URL });
await client.connect();

/* the new function exactly as the office server will install it (read out of server.mjs, so
   the test can never drift from what is shipped) */
const srv = fs.readFileSync(path.join(__dirname, "local-server", "server.mjs"), "utf8");
const FN = srv.split("const IGN_FN = `")[1].split("`;")[0];
ck("the new trigger function was found in server.mjs", /R13i/.test(FN) && /back in Inbox/.test(FN), true);

const BOX = "teamalpha@rugscreation.com";
const TID = "zz-test-r13i-" + Date.now();
const q = (sql, a) => client.query(sql, a);
try {
  await q("begin");
  await q("set local lock_timeout = '5s'");
  await q(FN);                                     /* install it inside the transaction */
  const trg = (await q("select pg_get_triggerdef(oid) d from pg_trigger where tgname = 'rm_ignore' and tgrelid = 'public.rm_threads'::regclass")).rows[0];
  ck("the trigger itself is untouched (still BEFORE UPDATE on rm_threads)", /BEFORE UPDATE ON public\.rm_threads/.test(trg.d), true);

  /* an ignored conversation, archived, closed - exactly what the app leaves behind */
  const t0 = "2026-11-27 10:00:00+05:30";
  await q(`insert into public.rm_threads (mailbox, gmail_thread_id, subject, folder, cats, status, done_at, unread, owner_id, last_msg_at, msg_count, has_in, updated_at)
           values ($1,$2,'R13i test','archive','["ignored"]'::jsonb,'done',now(),false,null,$3,1,true,now())`, [BOX, TID, t0]);
  await q(`insert into public.rm_messages (mailbox, gmail_id, gmail_thread_id, direction, subject, from_email, from_name, sent_at)
           values ($1,$2,$3,'in','R13i test','news@vendor.com','Noisy Vendor',$4)`, [BOX, TID + "-m1", TID, t0]);

  /* a NEW INCOMING mail arrives: the sync saves the message, then raises last_msg_at */
  const t1 = "2026-11-27 11:00:00+05:30";
  await q(`insert into public.rm_messages (mailbox, gmail_id, gmail_thread_id, direction, subject, from_email, from_name, sent_at)
           values ($1,$2,$3,'in','R13i test','buyer@x.com','A Buyer',$4)`, [BOX, TID + "-m2", TID, t1]);
  await q("update public.rm_threads set last_msg_at = $3, unread = true, msg_count = 2 where mailbox = $1 and gmail_thread_id = $2", [BOX, TID, t1]);
  let r = (await q("select coalesce(folder,'inbox') folder, prev_folder, cats, status, done_at, unread from public.rm_threads where mailbox=$1 and gmail_thread_id=$2", [BOX, TID])).rows[0];
  console.log("     " + JSON.stringify(r));
  ck("2 · a new mail puts it back in the INBOX", r.folder, "inbox");
  ck("2 · the \"ignored\" tag is gone", r.cats, []);
  ck("2 · it is open again, not done", r.status, "new");
  ck("...with done_at cleared", r.done_at, null);
  ck("...and unread, like any new mail", r.unread, true);
  ck("...the folder it was in is remembered", r.prev_folder, "archive");
  const act = (await q("select text from public.rm_activity where mailbox=$1 and gmail_thread_id=$2 order by id", [BOX, TID])).rows.map(x => x.text);
  ck("2 · the Activity trail says why", act, ["New mail - back in Inbox"]);

  /* our OWN reply in an ignored conversation does not un-ignore it */
  const TID2 = TID + "-own";
  await q(`insert into public.rm_threads (mailbox, gmail_thread_id, subject, folder, cats, status, unread, owner_id, last_msg_at, msg_count, has_in, updated_at)
           values ($1,$2,'R13i own reply','archive','["ignored"]'::jsonb,'done',false,null,$3,1,true,now())`, [BOX, TID2, t0]);
  await q(`insert into public.rm_messages (mailbox, gmail_id, gmail_thread_id, direction, subject, from_email, from_name, sent_at, sent_by)
           values ($1,$2,$3,'out','R13i own reply',$4,'Imran Khan',$5,'imran')`, [BOX, TID2 + "-m1", TID2, BOX, t1]);
  await q("update public.rm_threads set last_msg_at = $3 where mailbox = $1 and gmail_thread_id = $2", [BOX, TID2, t1]);
  r = (await q("select coalesce(folder,'inbox') folder, cats from public.rm_threads where mailbox=$1 and gmail_thread_id=$2", [BOX, TID2])).rows[0];
  ck("a mail WE sent leaves it ignored and archived", [r.folder, r.cats], ["archive", ["ignored"]]);

  /* 3 · the one-time move: ignored + in Deleted -> Archive, folder only */
  const TID3 = TID + "-del";
  await q(`insert into public.rm_threads (mailbox, gmail_thread_id, subject, folder, cats, status, done_at, unread, owner_id, last_msg_at, msg_count, has_in, updated_at)
           values ($1,$2,'R13i old ignored','deleted','["ignored"]'::jsonb,'done','2026-11-20 10:00:00+05:30',false,'imran',$3,1,true,'2026-11-20 10:00:00+05:30')`, [BOX, TID3, t0]);
  const TID4 = TID + "-plaindel";
  await q(`insert into public.rm_threads (mailbox, gmail_thread_id, subject, folder, cats, status, unread, owner_id, last_msg_at, msg_count, has_in, updated_at)
           values ($1,$2,'R13i plain deleted','deleted','[]'::jsonb,'done',false,null,$3,1,true,now())`, [BOX, TID4, t0]);
  const before = (await q("select status, done_at, owner_id, unread, last_msg_at, cats from public.rm_threads where mailbox=$1 and gmail_thread_id=$2", [BOX, TID3])).rows[0];
  const found = (await q(`select mailbox, gmail_thread_id as id from public.rm_threads
                           where coalesce(cats,'[]'::jsonb) ? 'ignored' and coalesce(folder,'inbox') = 'deleted'
                             and gmail_thread_id like $1`, [TID + "%"])).rows;
  ck("3 · it finds the ignored conversation sitting in Deleted", found.length, 1);
  for (const f of found) await q("update public.rm_threads set folder = 'archive', updated_at = now() where mailbox = $1 and gmail_thread_id = $2", [f.mailbox, f.id]);
  const after = (await q("select coalesce(folder,'inbox') folder, status, done_at, owner_id, unread, last_msg_at, cats from public.rm_threads where mailbox=$1 and gmail_thread_id=$2", [BOX, TID3])).rows[0];
  ck("3 · it is moved to Archive", after.folder, "archive");
  ck("3 · the tag is kept", after.cats, ["ignored"]);
  ck("3 · nothing else on it changed", {
    status: after.status === before.status, done_at: String(after.done_at) === String(before.done_at),
    owner: after.owner_id === before.owner_id, unread: after.unread === before.unread,
    last: String(after.last_msg_at) === String(before.last_msg_at)
  }, { status: true, done_at: true, owner: true, unread: true, last: true });
  const plain = (await q("select coalesce(folder,'inbox') folder from public.rm_threads where mailbox=$1 and gmail_thread_id=$2", [BOX, TID4])).rows[0];
  ck("3 · an ordinary deleted conversation is left in Deleted", plain.folder, "deleted");
} finally {
  await client.query("rollback");
  const left = (await client.query("select count(*)::int n from public.rm_threads where gmail_thread_id like $1", ["zz-test-r13i-%"])).rows[0].n;
  ck("the staging database was left exactly as it was", left, 0);
  const fnNow = (await client.query("select pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='rm_ignore_trg'")).rows[0];
  ck("...the old trigger function is still the one installed here", /straight to Deleted|folder := 'deleted'/.test(fnNow ? fnNow.def : ""), true);
  await client.end();
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
