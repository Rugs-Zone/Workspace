# Builds server/rugs-mail.index.ts (rugs-mail v37) from the live v36 source saved in .tmp/rugs-mail_index.ts
import re
src = open('C:/Users/team3pr1/Desktop/Workspace/.tmp/rugs-mail_index.ts', encoding='utf-8').read()
n = 0

def rep(a, b, cnt=1):
    global src, n
    assert src.count(a) == cnt, (a[:70], src.count(a))
    src = src.replace(a, b)
    n += 1

# header note
rep('// 14 Nov 2026: thread pictures limit 40 MB per conversation',
    '// 15 Nov 2026 (v37): one sync at a time (sync_lock), 25-second runs, a window Gmail fails to list is retried instead of skipped,\n'
    '// Gmail errors say what was answered, and a switched (Switch ID) session is not blocked by "set your own password first".\n'
    '// 14 Nov 2026: thread pictures limit 40 MB per conversation')

# (a) shorter run so one cron call (every 30 s) finishes before the next starts
rep('const DEADLINE_MS = 45000, WINDOW = 1 * 86400, FIRST_DAYS = 30;',
    'const DEADLINE_MS = 25000, WINDOW = 1 * 86400, FIRST_DAYS = 30;   // 15 Nov 2026: 25 s (was 45) so one 30-second cron run never overlaps the next')

# (b) gmail(): fewer, shorter retries; say WHAT Gmail answered when it is not JSON; free the body on 429/5xx
old_gmail = '''async function gmail(tok: string, path: string, init?: RequestInit) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + path, { ...init, headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json", ...(init?.headers || {}) } });
    if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 1200 * (i + 1))); continue; }
    const txt = await r.text();
    if (!r.ok) throw new E("Gmail " + r.status + ": " + txt.slice(0, 200), r.status === 404 ? 404 : 502);
    try { return JSON.parse(txt); } catch { if (i < 3 && (!init?.method || init.method === "GET")) { await new Promise((s) => setTimeout(s, 800 * (i + 1))); continue; } throw new E("Gmail sent an incomplete reply", 502); }   // never repeat a send
  }
  throw new E("Gmail is busy, try again", 503);
}'''
new_gmail = '''async function gmail(tok: string, path: string, init?: RequestInit) {
  // 15 Nov 2026: 3 tries (was 4) with shorter waits, and the error says what Gmail actually answered
  // (status, type, length, first characters) so a bad reply can be understood from the log.
  let last = "";
  for (let i = 0; i < 3; i++) {
    const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + path, { ...init, headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json", ...(init?.headers || {}) } });
    if (r.status === 429 || r.status >= 500) { last = "Gmail " + r.status; try { await r.body?.cancel(); } catch { /* ignore */ } await new Promise((s) => setTimeout(s, 1000 * (i + 1))); continue; }
    const txt = await r.text();
    if (!r.ok) throw new E("Gmail " + r.status + ": " + txt.slice(0, 200), r.status === 404 ? 404 : 502);
    try { return JSON.parse(txt); }
    catch {
      last = `Gmail sent an incomplete reply (status ${r.status}, type ${r.headers.get("content-type") || "?"}, ${txt.length} chars: ${txt.slice(0, 120).replace(/\\s+/g, " ")})`;
      if (i < 2 && (!init?.method || init.method === "GET")) { await new Promise((s) => setTimeout(s, 600 * (i + 1))); continue; }   // never repeat a send
      throw new E(last, 502);
    }
  }
  throw new E(last || "Gmail is busy, try again", 503);
}'''
rep(old_gmail, new_gmail)

# (c) a window Gmail could not list is NOT skipped any more: keep the cursor, so the same window is listed again 30 s later
old_skip = '''  let saved = 0, scanned = 0, live = true, skipped = 0;
  while (Date.now() - t0 < DEADLINE_MS) {
    const from = cursor - 3600, to = Math.min(nowS + 60, cursor + WINDOW);
    let r: any;
    try { r = await syncWindow(box, tok, from, to, budget - saved, t0); }
    catch (e) {   // a Gmail hiccup on one day: retry in small pages, else skip that day so the mailbox keeps moving
      try { r = await syncWindow(box, tok, from, to, budget - saved, t0, 50); }
      catch (e2) { console.log("skip window", box, from, to, String((e2 as Error).message)); r = { saved: 0, scanned: 0, complete: true }; skipped++; }
    }'''
new_skip = '''  let saved = 0, scanned = 0, live = true, skipped = 0, stalled = false;
  while (Date.now() - t0 < DEADLINE_MS) {
    const from = cursor - 3600, to = Math.min(nowS + 60, cursor + WINDOW);
    let r: any;
    try { r = await syncWindow(box, tok, from, to, budget - saved, t0); }
    catch (e) {   // a Gmail hiccup: retry in small pages; if that fails too, keep the cursor where it is
      try { r = await syncWindow(box, tok, from, to, budget - saved, t0, 50); }
      catch (e2) {
        console.log("skip window", box, from, to, String((e2 as Error).message));
        skipped++;
        // 15 Nov 2026: the window used to be marked done and the cursor moved on, so mail that arrived in a
        // window Gmail failed to list was never fetched. Now the cursor stays and the same window is listed
        // again on the next run (30 s later). Only a window older than 6 hours is given up, so a mailbox can't stall for ever.
        if (nowS - cursor < 6 * 3600) { stalled = true; break; }
        r = { saved: 0, scanned: 0, complete: true };
      }
    }'''
rep(old_skip, new_skip)

old_note = '''${skipped ? `, skipped ${skipped} day(s) Gmail could not list` : ""}'''
new_note = '''${skipped ? (stalled ? `, Gmail could not list the latest mail (${skipped}x) - retrying` : `, skipped ${skipped} day(s) Gmail could not list`) : ""}'''
rep(old_note, new_note)

# (d) one sync at a time: move the cron body into cronRun(t0) and guard it with a lock row in rm_settings
cron_head = '''  if (a === "cron") {
    const { data: k } = await sb.from("rm_settings").select("value").eq("key", "cron_key").single();
    if (!p.cron_key || p.cron_key !== k.value) throw new E("forbidden", 403);
    const out = [];'''
cron_tail = '''    await sb.from("rm_sessions").delete().lt("expires_at", new Date().toISOString());
    return out;
  }
  const u = await me(p.token);'''
assert src.count(cron_head) == 1 and src.count(cron_tail) == 1
i0 = src.index(cron_head)
i1 = src.index(cron_tail) + len(cron_tail)
body_start = i0 + len(cron_head)                       # right after "const out = [];"
body_end = src.index(cron_tail) + len('''    await sb.from("rm_sessions").delete().lt("expires_at", new Date().toISOString());
    return out;''')
cron_body = src[body_start:body_end]                   # the statements between "const out = [];" and "return out;"
new_block = '''  if (a === "cron") {
    const { data: k } = await sb.from("rm_settings").select("value").eq("key", "cron_key").single();
    if (!p.cron_key || p.cron_key !== k.value) throw new E("forbidden", 403);
    // 15 Nov 2026: only one sync runs at a time. The 30-second timer, Gmail push and the app's Sync used to start
    // 3-4 copies at once (each 45-55 s long); Gmail then answered with broken replies and the server ran out of resources (546).
    if (!(await takeLock())) return [{ skipped: "another sync is still running" }];
    try { return await cronRun(t0); } finally { await freeLock(); }
  }
  const u = await me(p.token);'''
src = src[:i0] + new_block + src[i1:]
n += 1
cron_fn = '''/* the 30-second sync run (timer, Gmail push, Sync button) — always under the sync_lock */
async function cronRun(t0: number) {
    const out = [];''' + cron_body + '''
}
/* sync_lock: one row in rm_settings; updated_at = when the lock was taken, year 2000 = free. A lock older than 65 s is stale (crashed run). */
async function takeLock(): Promise<boolean> {
  await sb.from("rm_settings").upsert({ key: "sync_lock", value: {}, updated_at: "2000-01-01T00:00:00Z" }, { onConflict: "key", ignoreDuplicates: true });
  const { data } = await sb.from("rm_settings").update({ updated_at: new Date().toISOString() }).eq("key", "sync_lock").lt("updated_at", new Date(Date.now() - 65000).toISOString()).select("key");
  return !!(data && data.length);
}
async function freeLock() { try { await sb.from("rm_settings").update({ updated_at: "2000-01-01T00:00:00Z" }).eq("key", "sync_lock"); } catch { /* ignore */ } }

'''
rep('/* ---------------- actions ---------------- */', cron_fn + '/* ---------------- actions ---------------- */')

# (e) Switch ID: a switched session is the admin acting for that person, so "set your own password first" must not block it
rep('''  const { data: s } = await sb.from("rm_sessions").select("user_id,expires_at").eq("token_hash", await tokHash(token)).maybeSingle();
  if (!s || new Date(s.expires_at) < new Date()) throw new E("Your session ended. Please sign in again.", 401);
  const { data: u } = await sb.from("rm_users").select("*").eq("id", s.user_id).maybeSingle();
  if (!u || !u.active) throw new E("This user is deactivated. Ask the admin.", 403);
  return u;''',
    '''  const { data: s } = await sb.from("rm_sessions").select("user_id,expires_at,switched_by").eq("token_hash", await tokHash(token)).maybeSingle();
  if (!s || new Date(s.expires_at) < new Date()) throw new E("Your session ended. Please sign in again.", 401);
  const { data: u } = await sb.from("rm_users").select("*").eq("id", s.user_id).maybeSingle();
  if (!u || !u.active) throw new E("This user is deactivated. Ask the admin.", 403);
  u._switched = !!s.switched_by;   // 15 Nov 2026: Switch ID session (admin acting for this person)
  return u;''')
rep('''  if (u.must_change && !["boot", "logout", "changePassword", "list", "thread", "sync"].includes(a)) throw new E("Please set your own password first", 428);''',
    '''  if (u.must_change && !u._switched && !["boot", "logout", "changePassword", "list", "thread", "sync"].includes(a)) throw new E("Please set your own password first", 428);''')

open('C:/Users/team3pr1/Desktop/Workspace/.claude/worktrees/rugs-email-fix/server/rugs-mail.index.ts', 'w', encoding='utf-8').write(src)
print('patched', n, 'len', len(src))
