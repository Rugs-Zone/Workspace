# patch-conv-no-boxes.py — STEP 5: conversation view without boxes (18 Nov 2026).
# Works on the decoded Email module (.tmp/email.html).
#
# Grepped first. The LIVE Email Tracker (mail.html -> mail-v2.js) ALREADY does
# all of STEP 5 with !important overrides (mail-v2.js lines 19-26):
#   article.mail -> no border, no radius, no shadow, transparent, only a faint
#   border-bottom; collapsed mails one line; .raw iframe borderless; the
#   "shown exactly as received" note and the Expand/Collapse bar hidden.
# The module's OWN base CSS still drew the old cards, which is what the
# in-Workspace fallback (the Email tile opening inside index.html) shows, so
# the two looked different. These five rules bring the base in line, which
# also means 2.0's overrides are no longer load-bearing.
#
# Only CSS is touched: the collapse toggle (data-mtog), reply, forward, flag
# and the keyboard shortcuts are all untouched and keep working.
# Nothing is deployed and no server file is touched.
import io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(HERE, "..", ".tmp", "email.html")
src = io.open(P, encoding="utf-8", newline="").read()
orig = src

if "/* STEP 5: no cards" in src:
    print("Already patched — nothing to do.")
    sys.exit(0)

def one(anchor, new, what):
    global src
    assert src.count(anchor) == 1, "anchor not unique: " + what
    src = src.replace(anchor, new)

# 1. each message: no card, just a faint divider under it
one(".mail{border:1px solid var(--line);border-radius:var(--r);padding:14px 16px;display:flex;flex-direction:column;gap:10px}",
    "/* STEP 5: no cards - a thin header, a flowing body, a faint divider */\n"
    ".mail{border:0;border-bottom:1px solid var(--line);border-radius:0;padding:12px 2px;display:flex;flex-direction:column;gap:10px;background:transparent}",
    "mail card")

# 2. the messages sit directly under each other, the divider does the separating
one(".rbody{position:relative;flex:1;overflow-y:auto;padding:16px 22px 24px;display:flex;flex-direction:column;gap:14px}",
    ".rbody{position:relative;flex:1;overflow-y:auto;padding:16px 22px 24px;display:flex;flex-direction:column;gap:0}",
    "rbody gap")

# 3. an older message is one line, and shows it can be opened
one(".mail.collapsed{padding:10px 14px;gap:0;cursor:pointer}",
    ".mail.collapsed{padding:9px 2px;gap:0;cursor:pointer}\n.mail.collapsed:hover{background:var(--hover)}",
    "collapsed padding")

# 4. the mail itself flows on the page instead of sitting in a white panel
one(".raw{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}",
    ".raw{border:0;border-radius:0;overflow:hidden;background:transparent;margin:6px 0 0}",
    "raw frame")

# 5. the "shown exactly as received" line only made sense around a box
one(".rawnote{font-size:11px;color:var(--muted);display:flex;gap:6px;align-items:center}",
    ".rawnote{display:none}",
    "rawnote")

assert src != orig
io.open(P, "w", encoding="utf-8", newline="").write(src)
print("Patched .tmp/email.html: %+d characters" % (len(src) - len(orig)))
