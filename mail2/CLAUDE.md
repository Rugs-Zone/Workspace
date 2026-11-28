# Rugs Email v2 (folder `mail2/`) — rules

Plan: `docs/REBUILD-PLAN.md`. Progress: one line per day in root `PROGRESS.md`.

- **One Claude session edits `mail2/` at a time.** If another session is working here, stop and tell the user.
- v2 never touches v1: do not edit `mail.html`, `mail-app.html`, `mail2.html` (old redirect), `mail-v2.js` or any `rm_*` table from here.
- Database = the **office Postgres** (mail-api.rugserp.com), NOT Supabase. v2 writes only `rm2_*` tables; it may READ `rm_messages` / `rm_threads`.
- SQL lives in `mail2/db/` numbered `001_…`. A file is run only after the nightly backup is confirmed green.
- Every rule is a test in `mail2/tests/`. Run: `node --test mail2/tests/`. A push that changes `mail2/` is blocked if any test fails (`mail2/gate.mjs`, installed as `.git/hooks/pre-push`).
- Every real bug gets a test FIRST, then the fix.
- Staging address: `www.rugserp.com/mail2/` (the old `mail2.html` stays a redirect to v1).
- Small files: `src/` = one module per rule; screens in `index.html` + `app.css` + `app.js`.
