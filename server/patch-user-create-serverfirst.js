/* 23 Nov 2026 — Rugs Email, Admin → Users & passwords: "+ Create user" says it
 * created the person but they do not appear.
 *
 * PROVED against the live server (throwaway 20-minute admin session, deleted
 * afterwards): the server creates the user perfectly well. Sending the real
 * 83-person list plus one new person returned HTTP 200 and the row was there in
 * rm_users. So nothing is wrong with saveOrg.
 *
 * The fault is in the browser, and the measurement shows why: that saveOrg call
 * takes 10.6 SECONDS (the server upserts all 84 people one after another), and
 * the old create flow was:
 *
 *   PEOPLE.push(newRow); saveOrg(true); toast('Creating…');
 *   window._orgP.then(b => b && api('setPassword', …)).then(r => { if (r) { toast('created'); render() } })
 *                                                     .catch(e => toast(e.message));
 *
 * Three things go wrong in those 10 seconds:
 *   1. saveOrg(true) is SILENT — it does not redraw — so the new row is in the
 *      list in memory but never put on screen;
 *   2. anything that calls boot in the meantime (the Users tab's own refresh,
 *      the 15-second poll) runs applyBoot, which REPLACES the people list with
 *      the server's copy — and the server has not finished writing the new
 *      person yet, so the row is wiped off the screen again;
 *   3. if the save or the password call fails, liveSaveOrg's own .catch(()=>null)
 *      swallows it: `b` is null, setPassword is skipped, `r` is false, and
 *      nothing is drawn and nothing is said — the admin is left with the
 *      "Creating…" toast and an unchanged list.
 *
 * FIX — the server becomes the source of truth for this one action, and the
 * result is checked and reported:
 *   save → set the password → fetch the list back from the server (applyBoot)
 *   → clear the form and the search box → redraw → then say plainly whether the
 *   person is now in the list, or exactly what the server refused.
 * The button shows "Creating…" and is disabled while it runs, so the ten
 * seconds look like work rather than a dead screen.
 *
 * Run from the repo root:
 *   node server/mailapp-b64.js decode
 *   node server/patch-user-create-serverfirst.js
 *   node server/mailapp-b64.js encode
 */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
let n = 0;

function one(find, repl, what) {
  const c = s.split(find).length - 1;
  if (c !== 1) { console.error('STOP: "' + what + '" matched ' + c + ' times, expected 1'); process.exit(1); }
  s = s.replace(find, repl);
  n++;
  console.log('  ok  ' + what);
}

/* ---- the whole create-user click handler, replaced ---- */
const OLD =
  "const nid='u'+Date.now().toString(36);PEOPLE.push(mkPeople([P(nid,n,$('#nuDept').value,$('#nuRole').value,lg,pw)])[0]);saveOrg(true);toast('Creating…');window._orgP.then(b=>b&&api('setPassword',{id:nid,password:pw})).then(r=>{if(r){toast(`${n} created — they can sign in now`);render()}}).catch(e=>toast(e.message));return}";

const NEW =
  "const nid='u'+Date.now().toString(36);" +
  "PEOPLE.push(mkPeople([P(nid,n,$('#nuDept').value,$('#nuRole').value,lg,pw)])[0]);" +
  "saveOrg(true);" +
  "const _ub=document.querySelector('[data-uadd]');if(_ub){_ub.disabled=true;_ub.textContent='Creating…'}" +
  "toast('Creating '+n+'… this can take a few seconds');" +
  "(async()=>{try{" +
    /* 1. the save the app has already started — null means it was refused */
    "const _sv=await window._orgP;" +
    "if(!_sv)throw new Error('the server did not save it. Press ↻ Refresh and try again');" +
    /* 2. their starting password */
    "await api('setPassword',{id:nid,password:pw});" +
    /* 3. take the list back from the server, so what is on screen is the truth */
    "try{applyBoot(await api('boot'))}catch(e){}" +
    /* 4. clear the form and the search box, so a leftover filter cannot hide the new row */
    "USRQ='';['#nuName','#nuLogin','#nuPass'].forEach(function(q){const el=$(q);if(el)el.value=''});" +
    "render();" +
    /* 5. say what really happened */
    "const made=(PEOPLE||[]).some(function(z){return z.id===nid||String(z.login||'').toLowerCase()===lg});" +
    "toast(made?n+' created — they can sign in now':n+' was saved but is not in the list yet. Press ↻ Refresh in a moment.');" +
  "}catch(e){" +
    "try{applyBoot(await api('boot'))}catch(x){}" +
    "render();" +
    "toast('Could not create '+n+': '+((e&&e.message)||'the server refused it'));" +
  "}finally{" +
    "const bt=document.querySelector('[data-uadd]');if(bt){bt.disabled=false;bt.textContent='+ Create user'}" +
  "}})();return}";

one(OLD, NEW, 'create-user: save on the server, read the list back, then report');

fs.writeFileSync(F, s);
console.log(n + ' edit(s) applied to ' + F);
