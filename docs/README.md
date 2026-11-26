# docs — the written record

Moved here on 27 Nov 2026 to keep the top of the repo clean. **`CLAUDE.md` and `PROGRESS.md`
stay in the root folder on purpose**: Claude Code reads CLAUDE.md from the root, and CLAUDE.md
loads PROGRESS.md with `@PROGRESS.md`, so moving either of them would quietly break both.

| File | What it is |
|---|---|
| **MAIL-RULES-LIVE.md** | **Start here.** The rules that are LIVE in Rugs Email right now, read out of the shipped code — file a bug against this, and quote the rule number. |
| MAIL-RULES.md | The long version: every rule, plus the 25 other things that can hide a mail without being a rule (H1–H25, L1–L5). |
| MAIL-RULES-LOCKED.md | The decisions the owner settled, and the ones still open. |
| MAIL-RULES-ANSWERS.md | Plain-English answers to the rules he marked "did not understand", and the changes he asked for. |
| BUGS-TONIGHT.md | The bug log for the night of 26/27 Nov, with what the tester still has to click through. |
| TONIGHT-PLAN-26-NOV.md | The plan for that night — roles, phases, checklists. |
| EMAIL-AUDIT-2026-11-18.md | The 18 Nov audit of Rugs Email. |
| schema.md | The shape of the mail tables. |
| chat-14-nov-2026.md | Notes kept from the 14 Nov session. |

The rules are also **inside the app**: Admin → 📜 Mail rules (with the switches), and the menu
under your own name → 📜 Mail rules (read-only, for everybody).
