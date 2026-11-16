# modules — where to drop a new Rugs Zone module

**Put the file here:** `C:\Users\team3pr1\Desktop\Workspace\modules\<name>.html`
(or anywhere else on the PC and just tell me the path — I can pick it up from any folder.
This folder is simply the tidy place, and it travels with the repo.)

Then tell me **four things** and I do the rest:

1. **Tile name** — what it says on the Workspace home screen (e.g. "Store Issue").
2. **Who may open it** — everyone / one department / managers / admins only.
3. **Does it need to know who is signed in?** (name, department, admin or not)
4. **Does it need to save data?** If yes, say what — I add a Supabase table + function.

## What I do with it

Every module in Rugs Zone is **one HTML file stored inside `index.html`** as base64:

    <script>var PPC_HTML_B64 = "PCFET0NUWVBF…";</script>

When you open the tile, the Workspace decodes that text and runs it in an iframe, after
injecting who you are (`window.__RC_SSO__`).

So for a new module I: base64 the file into `index.html` as `<NAME>_HTML_B64`, add the tile,
the iframe and the loader, wire the sign-in details and the permissions, test it, and push —
after which it is live at https://rugs-zone.github.io/Workspace/ .

There are 18 modules in there today: ATTCAL, CBM, CHECKLIST, COSTING, COUNTERROOM, COURIER,
EMAIL, MERCHANT_DASH, MERCHANT_EDITOR, MESSAGING, MGMT, MKTPORTAL, MYDAY, PASSING, PPC,
QUALITY, SAMPLINGFMS, SCORING.

## How to write the file

* **One single file.** Put the CSS and JavaScript inside the same `.html` — that is how every
  other module is built. No separate .css/.js files, no local images (use a data: URL).
* **Outside files:** only cdnjs / jsDelivr (that is what the other modules use).
* **It must work inside an iframe** — no `window.top` tricks, no pop-ups.
* **Who is signed in** arrives as `window.__RC_SSO__` (name, department, admin flag). Do not
  build your own login.
* **Saving data:** do not call Google Sheets directly. Tell me what to store and I add a
  Supabase edge function, the same way the other modules work.
* A rough draft is fine — AI-generated, half-finished, whatever. I clean it up and wire it in.

## Two rules

1. **Do not paste the file into `index.html` yourself.** The base64 is one 500 KB line; a single
   wrong character breaks the whole Workspace. Drop the file here and tell me.
2. **Do not run `build.bat`.** It rebuilds `index.html` from old copies of the modules and would
   undo live work. (See the warning at the top of `PROGRESS.md`.)
