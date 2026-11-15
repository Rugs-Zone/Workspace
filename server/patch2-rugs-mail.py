# second patch: the app's Sync action uses the same single-run lock as the timer
p = 'C:/Users/team3pr1/Desktop/Workspace/.claude/worktrees/rugs-email-fix/server/rugs-mail.index.ts'
src = open(p, encoding='utf-8').read()
old = '''    case "sync": {
      const ds = (await depts()).filter((d: any) => access(u, d.id));
      const out = [];
      for (const d of ds) { try { out.push(await syncBox(d.mailbox, t0, !!p.force)); } catch (e) { out.push({ mailbox: d.mailbox, error: (e as Error).message }); } }
      // topic tagging runs only from the 1-minute timer (cron), not on every Sync press
      return out;
    }'''
new = '''    case "sync": {
      const ds = (await depts()).filter((d: any) => access(u, d.id));
      // 15 Nov 2026: the Sync button / sign-in never runs beside the timer's sync (same lock); the timer catches up within 30 s anyway
      if (!(await takeLock())) return ds.map((d: any) => ({ mailbox: d.mailbox, skipped: "a sync is already running" }));
      const out = [];
      try { for (const d of ds) { try { out.push(await syncBox(d.mailbox, t0, !!p.force)); } catch (e) { out.push({ mailbox: d.mailbox, error: (e as Error).message }); } } }
      finally { await freeLock(); }
      // topic tagging runs only from the 1-minute timer (cron), not on every Sync press
      return out;
    }'''
assert src.count(old) == 1
open(p, 'w', encoding='utf-8').write(src.replace(old, new))
print('ok')
