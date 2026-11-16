# Rugs Mail: PROGRESS (handoff for a fresh chat)

Owner: Priyanshu Tomar, Marketing Executive, Rugs Creation (beginner: explain steps simply).

## Goal
Outlook-style web mail for ~36 staff after Google Workspace mailboxes closed. Priyanshu's team has a PST for every person and will do the import themselves.

## Built (published artifact da17a5f2-9c8e-4d2a-ad5d-1052d5ee8949, version 1794768775-7b73)
URL: https://claude.ai/artifact/TvzofCacszHnzeruhh3efi (files: index.html, pst.js)
- Atelier style: black header, orange underline, no "Mail" word, tabs Home / Folder / Help (no View).
- Resizable panes (folders, list, reading) and From column; double-click resets.
- New mail = full Outlook-style window (Send left of To/Cc/Bcc/Subject; Message, Insert, Options, Format Text tabs).
- Reply / Reply all / Forward open inline in reading pane with Pop out.
- Folders, custom folders, drag and drop, rules, snooze, scheduled send, undo send, categories, flags, pin, templates, signatures per account, out-of-office, print, shortcuts, search operators, conversation view, Focused/Other.
- Import old mail: Home > Import mail. Reads .pst in the browser (pst.js = pst-extractor bundle), plus .eml/.mbox. Tested headless on a public sample PST only, not on a real Rugs Creation PST.
- Storage: IndexedDB in the browser (fallback localStorage).
- Source files: /home/claude/rugs-mail/src (style.css, body.html, js1..js5, js4a, js4b); build = concat js1 js2 js3 js5 js4a js4b into app.js, then inline into index.html. (Workspace may be reset: if src is gone, the published artifact is the source of truth.)
- Design canvas with 3 earlier options: https://claude.ai/artifact/T85BQNzn4i49Yq2kCt7mSM (Atelier was chosen).

## Latest round (per-person mailboxes)
- Each message/folder has an owner (account id); People and signatures tab in Settings adds people (bulk add too).
- Import dialog: tab "Many PST files (one per person)" auto-matches file name to person, imports one by one with attachments kept (IndexedDB), then "Save backup for each person". Tab "One file" lets you pick the mailbox.
- Backup per person: rugsmail-<name>.json (exportAcct); each person restores via Import backup (restoreBackup). Downloads use the `downloads` artifact capability.
- Tested headless: bulk import + backup/restore round trip on enron.pst. NOT yet tested with a real Rugs Creation PST or the live downloads dialog.
- Build: cd src; cat js1.js js2.js js3.js js5.js js4a.js js4b.js > app.js; node --check; inline into ../index.html; publish index.html + pst.js.

## Known gaps / next steps
1. Download buttons (attachments, Save copy, Export backup) do nothing in the artifact viewer. Fix: declare the `downloads` capability and save through window.claude.downloads.save.
2. All mail is one shared mailbox in one browser: messages are NOT owned per person. For 36 people need per-account mailboxes (add owner field to messages, filter by current account) or a real backend.
3. Decision needed: how each person gets their mail after the team imports their PST:
   a) Team imports into this app per person, exports a backup file, person restores it; or
   b) Server-side: parse PST (readpst) and push into each person's Gmail via IMAP/Gmail API, app signs in with Google. Needs Google Cloud project + OAuth (unverified apps: 100 test users) + hosting.
4. PST limits: .ost cannot be read (export .pst from Outlook first); files over about 1.6 GB too big for the browser; attachments kept only up to 5 MB each and only for the session.
5. Test with one real small PST from the team before bulk import.
6. Logo: text wordmark only. Waiting for logo files / PSD (Drive "1.psd").

## Brand
Logo orange #FF5001 (bars/accents only), text-safe orange #b93c00, ink #2b2b2b, muted #595959, header black #0a0a0a. Font IBM Plex Sans.

## Rules from Priyanshu
- One short status line (under 15 words) after file/database work. No pasted code/SQL/diffs unless asked. Long outputs go to a file.
- Grep then Edit; never read/rewrite a whole file over 150 lines.
- Load UI skills (frontend-design, dataink, ui-consistency, break-ui) only for new screens.
- No subagents, screenshots, or extended web search unless asked.
- Weekly usage limit: do not cross by 40%. Tasks pause at 5:00 AM.
- Never ask for or enter passwords in chat. Only process PST files he owns.
- After about 25 turns in a chat, tell him to start fresh from this file.
