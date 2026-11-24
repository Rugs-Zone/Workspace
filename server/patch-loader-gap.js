/* 24 Nov 2026 - FIX "Team Alpha mail from 3 Nov to 15 Nov is not in the Inbox".
 *
 * Nothing was deleted and nothing was hidden: those conversations were never FETCHED by the
 * browser. Two faults in loadMoreBox, the loader that walks a mailbox backwards:
 *
 *   const mine = S.threads.filter(t => t.dept === deptId && ...);
 *   const oldest = mine.length ? Math.min(...mine.map(t => t.last)) : Date.now();
 *   if (oldest <= lim) { ...; break }                      // (1)
 *   const r = await api('more', { box, before: oldest, limit: 500 });
 *   if ((r.threads || []).length < 500 || !n) { st.done = true; break }   // (2)
 *
 * (1) "How far back have I got?" was answered with the oldest conversation IN MEMORY. The
 *     device copy (IndexedDB, a year of mail) and earlier sessions leave old conversations
 *     lying about, so one mail from September makes `oldest` September - the loader decides it
 *     already has the last 30 days, stops at once, and the weeks in between are never asked
 *     for. It also meant every page was requested from the oldest thread known, skipping the
 *     gap instead of filling it.
 * (2) A page of 500 that happened to bring nothing new (`!n`) was treated as the end of the
 *     mailbox, so the walk stopped there for good.
 *
 * At sign-in the server sends the 1,500 newest conversations ACROSS ALL MAILBOXES - on the
 * live data that is back to 17 Nov, and Team Alpha's share of it is 155 conversations - so
 * everything older depends entirely on this loader. That is why the hole started mid-November.
 *
 * Now the walk follows a cursor that the SERVER's own answers move: start at now, ask for the
 * 500 conversations before the cursor, then put the cursor on the oldest one that came back,
 * and stop only when a page comes back short (the real end) or the cursor passes the period
 * being loaded. What is already in memory makes no difference any more, so a gap is filled
 * rather than jumped over. The cursor is kept per mailbox, so the quiet "rest of the year"
 * phase carries on from where the sign-in phase stopped instead of starting again.
 *
 * Run from the repo root:
 *   node server/mailapp-b64.js decode
 *   node server/patch-loader-gap.js
 *   node server/mailapp-b64.js encode
 */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');

const FIND =
" try{for(let page=0;page<80;page++){const mine=S.threads.filter(t=>t.dept===deptId&&!t._cache&&t.msgs.some(m=>!m.ours&&!m.by));const oldest=mine.length?Math.min(...mine.map(t=>t.last)):Date.now();\n" +
"   DLS.oldest=oldest;DLS.n=mine.length;try{stbarPaint()}catch(e){}\n" +
"   if(oldest<=lim){if(all)st.done=true;st.recent=true;break}\n" +
"   if(!all&&MORE_DL&&Date.now()>MORE_DL)break;   // sign-in has waited long enough: the rest goes on quietly\n" +
"   const r=await api('more',{box,before:oldest,limit:500});if(r.history_days)HIST_DAYS=r.history_days;const n=mergeList(r);\n" +
"   if(app==='mail')renderListKeep();renderFolders();if(MORE_PAGE)try{MORE_PAGE(deptId)}catch(e){}\n" +
"   if((r.threads||[]).length<500||!n){st.done=true;st.recent=true;break}\n" +
"   if(all)await new Promise(go=>setTimeout(go,window.SLOW_PC?900:250))}}   // gentle on a small server and an old PC";

const REPL =
" /* 24 Nov 2026: walk backwards on a cursor the SERVER's answers move, NOT on the oldest\n" +
"    conversation in memory - one stray old mail in the device copy used to make this loader\n" +
"    think the mailbox was finished, which is how 3-15 Nov went missing from Team Alpha's\n" +
"    Inbox. See server/patch-loader-gap.js. */\n" +
" if(!st.cur)st.cur=Date.now();\n" +
" try{for(let page=0;page<80;page++){\n" +
"   DLS.oldest=st.cur;DLS.n=S.threads.filter(t=>t.dept===deptId&&!t._cache&&t.msgs.some(m=>!m.ours&&!m.by)).length;try{stbarPaint()}catch(e){}\n" +
"   if(st.cur<=lim){if(all)st.done=true;st.recent=true;break}\n" +
"   if(!all&&MORE_DL&&Date.now()>MORE_DL)break;   // sign-in has waited long enough: the rest goes on quietly\n" +
"   const r=await api('more',{box,before:st.cur,limit:500});if(r.history_days)HIST_DAYS=r.history_days;mergeList(r);\n" +
"   const got=r.threads||[];\n" +
"   if(got.length){const back=Math.min(...got.map(x=>Date.parse(x.last_msg_at)||Date.now()));st.cur=back<st.cur?back:st.cur-D}   /* never stand still */\n" +
"   if(app==='mail')renderListKeep();renderFolders();if(MORE_PAGE)try{MORE_PAGE(deptId)}catch(e){}\n" +
"   if(got.length<500){st.done=true;st.recent=true;break}   /* a short page is the real end of the mailbox */\n" +
"   if(all)await new Promise(go=>setTimeout(go,window.SLOW_PC?900:250))}}   // gentle on a small server and an old PC";

const c = s.split(FIND).length - 1;
if (c !== 1) throw new Error('expected 1 match for the loader loop, found ' + c);
fs.writeFileSync(F, s.replace(FIND, REPL));
console.log('patch-loader-gap: 1 edit applied');
