/* 26 Nov 2026 - the mail list: three chips instead of seven, and darker text.

   Asked for: "here show only inbox, unread, need owners" and "unread email more darker and
   increase the colour of black more in email".

   WHAT CHANGES

   1  The chip row becomes exactly three: **Inbox | Unread | Needs owner**.
      Gone: Focused, Other, Mine, Open, Alias.
      "Needs owner" is a new filter (`filt='needs'`) - conversations nobody has taken.

      IMPORTANT CONSEQUENCE, said plainly rather than hidden: Focused/Other was the split
      that kept automatic mail (no-reply senders, newsletters, notifications) out of the
      Inbox. With the Other tab gone there is nowhere to put it, so that mail now appears
      in the Inbox with everything else. The split is one line to restore.

   2  Text is darker. In light mode the two text colours go from #191513 to #0b0a09 and
      from #6b645e to #45403b, the subject and sender of every row use the full text
      colour, an unread row is heavier AND carries a faint brand tint so it stands out,
      and the preview line is darkened. Dark mode keeps its own colours untouched.

   Run:  node server/patch-chips-and-contrast.js
   then: node server/mailapp-b64.js encode
*/
const fs = require("fs");
const file = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__chips3:start")) { console.log("already there - nothing changed"); process.exit(0); }
const done = [];

/* ---- 1. the chip row ---- */
const chipOld = "${isInbox?`<button class=\"chip\" data-tab=\"focused\" aria-pressed=\"${tab==='focused'}\">Focused</button><button class=\"chip\" data-tab=\"other\" aria-pressed=\"${tab==='other'}\">Other</button><span style=\"width:1px;background:var(--line)\"></span>`:''}${[['all','All'],['unread','Unread'],['mine','Mine'],['open','Open'],['alias','Alias']].map(([k,l])=>`<button class=\"chip\" data-filt=\"${k}\" aria-pressed=\"${filt===k}\">${l}</button>`).join('')}";
if (!s.includes(chipOld)) throw new Error("the chip row was not found");
s = s.replace(chipOld,
  "${[['all','Inbox'],['unread','Unread'],['needs','Needs owner']].map(([k,l])=>`<button class=\"chip\" data-filt=\"${k}\" aria-pressed=\"${filt===k}\">${l}</button>`).join('')}");
done.push("the chip row is Inbox | Unread | Needs owner");

/* ---- 2. the new "Needs owner" filter, everywhere the chips are applied ---- */
const fOld = "filt==='alias'?!!viaOf(t):true";
const n = (s.match(new RegExp(fOld.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
if (!n) throw new Error("the filter logic was not found");
s = s.split(fOld).join("filt==='alias'?!!viaOf(t):filt==='needs'?!t.owner:true");
done.push("\"Needs owner\" works (" + n + " place" + (n > 1 ? "s" : "") + ")");

/* ---- 3. nothing may be hidden by a tab that no longer has buttons ---- */
const block = String.raw`
<script>/* __chips3:start  26 Nov 2026: three chips, darker text */
/* The Focused/Other buttons are gone, so nothing may be filtered out by the tab any more -
   otherwise automatic mail would be invisible instead of merely on another tab. */
if (typeof othTab === 'function') { const _ot = othTab; othTab = function () { return false; }; }
tab = 'focused';
(function () {
 /* mail-v2.js and the Outlook pack inject their styles AFTER this one, so these need
    !important and a second pass once everything else has loaded. */
 const CSS3 =
  /* darker text in light mode; dark mode keeps exactly what it had */
  ':root{--fg:#0b0a09!important;--muted:#45403b!important}' +
  '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--fg:#f2eeeb;--muted:#9c948e}}' +
  ':root[data-theme="dark"]{--fg:#f2eeeb;--muted:#9c948e}' +
  /* every row: the name and the subject in full strength */
  '.m .who,.m .sub{color:var(--fg)!important}' +
  '.m .pre{color:color-mix(in srgb,var(--fg) 74%,transparent)!important}' +
  /* unread: heavier, blacker, and a faint tint so the eye finds it */
  '.m.unread{background:color-mix(in srgb,var(--brand) 10%,transparent)!important}' +
  '.m.unread .who,.m.unread .sub{font-weight:800!important;color:var(--fg)!important}' +
  '.m.unread .pre{color:color-mix(in srgb,var(--fg) 88%,transparent)!important}' +
  '.m.unread{border-left-width:4px!important}' +
  /* the open mail itself, a shade blacker */
  '.mail .mbody,.mail .msnip{color:var(--fg)!important}';
 const put = function () { const st = document.createElement('style'); st.id = 'chips3css'; st.textContent = CSS3; document.head.appendChild(st); };
 put(); setTimeout(put, 1500); setTimeout(put, 5000);
})();
/* __chips3:end */</script>`;
s = s.replace(/\s*$/, "") + "\n" + block + "\n";
done.push("darker text and a tinted unread row");

fs.writeFileSync(file, s);
console.log("patched .tmp/email.html");
done.forEach((d) => console.log("  - " + d));
