/* 26 Nov 2026 - the team rules, as instructed.

   1  Every person with access to a mailbox sees every received conversation in that
      mailbox's Inbox, whoever owns it or replied. OWNERSHIP NEVER HIDES ANYTHING.
      Only Archive, Deleted and Junk - chosen by a person - stay out.
   2  Ownership still drives My work, the owner tag, assign/transfer and the counts.
      "My work" means the OWNER *or* anyone who replied: if two people answered, both
      see it in My work. Participants are the people who replied, forwarded or were
      assigned, kept per conversation (`t.parts`, filled by the server; the app also
      counts anyone whose reply it can see).
   3  Manager-first is now a per-department setting, default OFF for everybody, and it
      is read from the server (`rm_settings.mgr_first_boxes`) instead of a list baked
      into the app. designer@ is switched off by the matching one-time job.
   4  The third chip is "Unassigned" so the team can pick mail up.

   This reverses the 16 Nov "a mail with an owner is that person's mail" rule, which is
   what hid a colleague's conversation from the rest of the team and caused four
   "missing mail" reports this week.

   Run:  node server/patch-team-visibility.js
   then: node server/mailapp-b64.js encode
*/
const fs = require("fs");
const file = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__teamsee:start")) { console.log("already there - nothing changed"); process.exit(0); }
const done = [];

/* ---- 1. ownership never hides ---- */
const seeOld = "function seeMine(t){const p=who(ME);\n if(!p||!t)return true;\n if(p.role==='Admin'||['Manager','Lead','CRM'].includes(p.role))return true;   /* manager / CRM / admin: the whole team */\n if(!t.owner)return !mgrFirst(t.dept);                                         /* nobody has taken it yet: anyone may pick it up, except in a manager-first team */\n if(t.owner===ME)return true;                                                  /* mine */\n return (t.msgs||[]).some(m=>msgMine(m,t))}                                        /* I replied in it — keep it */";
if (!s.includes(seeOld)) throw new Error("seeMine was not found");
s = s.replace(seeOld,
  "/* __teamsee:start 26 Nov 2026: OWNERSHIP NEVER HIDES A CONVERSATION. Everybody who can open a\n" +
  "   mailbox sees every received conversation in it, whoever owns it or replied; only Archive,\n" +
  "   Deleted and Junk take mail out, and those are a person's choice. The single exception is a\n" +
  "   department deliberately set to manager-first, where mail nobody has taken is the manager's\n" +
  "   to hand out - that is off for everyone by default now. __teamsee:end */\n" +
  "function seeMine(t){const p=who(ME);\n" +
  " if(!p||!t)return true;\n" +
  " if(p.role==='Admin'||['Manager','Lead','CRM'].includes(p.role))return true;\n" +
  " if(!t.owner&&mgrFirst(t.dept))return false;   /* manager-first department: unclaimed mail waits for the manager */\n" +
  " return true}");
done.push("ownership never hides a conversation");

/* ---- 3. manager-first comes from the server, default off ---- */
const mgrOld = "const MGR_FIRST=['designer@rugscreation.com'];";
if (!s.includes(mgrOld)) throw new Error("the MGR_FIRST list was not found");
s = s.replace(mgrOld,
  "/* 26 Nov 2026: a per-department setting now, default OFF for everyone. The server keeps the\n" +
  "   list in rm_settings.mgr_first_boxes; if it sends none, nobody is manager-first. */\n" +
  "const MGR_FIRST=[];\n" +
  "function mgrFirstBoxes(){try{const v=S.settings&&S.settings.mgr_first_boxes;\n" +
  "  return Array.isArray(v)?v.map(x=>String(x).toLowerCase()):MGR_FIRST}catch(e){return MGR_FIRST}}");
const mgrFnOld = "function mgrFirst(d){try{const x=dept(d);return !!x&&MGR_FIRST.indexOf(String(mailOf(x)||'').toLowerCase())>=0}catch(e){return false}}";
if (!s.includes(mgrFnOld)) throw new Error("mgrFirst was not found");
s = s.replace(mgrFnOld,
  "function mgrFirst(d){try{const x=dept(d);return !!x&&mgrFirstBoxes().indexOf(String(mailOf(x)||'').toLowerCase())>=0}catch(e){return false}}");
done.push("manager-first is a per-department setting, default off");

/* ---- 4. the chip ---- */
if (s.includes("['needs','Needs owner']")) {
  s = s.replace("['needs','Needs owner']", "['needs','Unassigned']");
  done.push("the third chip reads \"Unassigned\"");
}

/* ---- 2. My work = owner OR anyone who replied ---- */
const block = String.raw`
<script>/* __mywork:start  26 Nov 2026: My work = the owner AND everyone who replied */
/* The people who have worked a conversation: whoever the server recorded (t.parts - repliers,
   forwarders and anyone it was assigned to) plus anyone whose reply is in the mail we hold. */
function partsOf(t) {
 const out = [];
 try {
  (t && t.parts || []).forEach(function (x) { if (x && out.indexOf(x) < 0) out.push(x); });
  (t && t.msgs || []).forEach(function (m) {
   const who_ = m && (m.by || (typeof sentWho === 'function' ? sentWho(m, t) : ''));
   if (who_ && out.indexOf(who_) < 0) out.push(who_);
  });
  if (t && t.owner && out.indexOf(t.owner) < 0) out.push(t.owner);
 } catch (e) {}
 return out;
}
function isMyWork(t) { try { return !!t && (t.owner === ME || partsOf(t).indexOf(ME) >= 0); } catch (e) { return false; } }
/* the My work view, its count and the Mine filter all follow the same rule */
const _ivWork = inView;
inView = function (t) {
 try {
  if (t && view && view.type === 'fav' && view.id === 'mine')
   return isMyWork(t) && st(t) !== 'done' && hasRecv(t);
 } catch (e) {}
 return _ivWork.apply(this, arguments);
};
const _lrWork = listRows;
listRows = function () {
 const r = _lrWork.apply(this, arguments);
 try { if (filt === 'mine') return r.filter(isMyWork); } catch (e) {}
 return r;
};
const _rfWork = renderFolders;
renderFolders = function () {
 const r = _rfWork.apply(this, arguments);
 try {
  const b = document.querySelector('#folders [data-fav="mine"] .c');
  const n = S.threads.filter(function (t) { return isMyWork(t) && st(t) !== 'done' && hasRecv(t); }).length;
  if (b) b.textContent = n; else {
   const row = document.querySelector('#folders [data-fav="mine"]');
   if (row && n) row.insertAdjacentHTML('beforeend', '<span class="c">' + n + '</span>');
  }
 } catch (e) {}
 return r;
};
/* __mywork:end */</script>`;
s = s.replace(/\s*$/, "") + "\n" + block + "\n";
done.push("My work counts the owner and everyone who replied");

/* mapRow must carry the server's participants list through */
const mapOld = "forOwner:r.for_owner||''};";
if (s.includes(mapOld)) {
  s = s.replace(mapOld, "forOwner:r.for_owner||'',parts:Array.isArray(r.participants)?r.participants:[]};");
  done.push("the server's participants list is carried into the app");
}

fs.writeFileSync(file, s);
console.log("patched .tmp/email.html");
done.forEach((d) => console.log("  - " + d));
