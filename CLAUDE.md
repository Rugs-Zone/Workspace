# Project notes

- `index.html` is huge (modules are stored as base64). Never open it whole. Use grep to find what you need and edit only the needed lines.
- Ignore old copies such as `index (1).html`.
- After every finished task, update `PROGRESS.md` with a short line about what changed.
- Changes upload to GitHub automatically (a Stop hook in `.claude/settings.json` commits and pushes after every reply). Never tell the user to upload index.html or any file by hand; just say it is live after this reply.
- Rugs Email app: edit it only with `node server/mailapp-b64.js decode` → patch `.tmp/email.html` → `node server/mailapp-b64.js encode`. Encode also writes `mail-app.html` (the small copy `mail.html` opens). Bump APP_BUILD and `mail-version.txt` together.
- If the hook says "UPLOAD FAILED", run `git status` and fix it before doing anything else (on 18 Nov a stuck rebase silently kept updates off GitHub for a day).

@PROGRESS.md
