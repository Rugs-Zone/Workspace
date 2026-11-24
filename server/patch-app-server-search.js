/* 24 Nov 2026 - Rugs Email: the search box asks the SERVER as well.
 *
 * Reported: Jagjit could not find "MAX ZIPPER // IO 4813 // 5 NO ZIPPER" at all. The search
 * box only ever filtered what the browser had loaded (listRows -> S.threads), and the browser
 * is sent the ~1,500 newest conversations; 4,015 conversations were newer than that one, so it
 * was simply not there to be found. The old "Also search inside attachments & all of Gmail"
 * button even said so out loud ("N more are older than what is loaded here") and then did
 * nothing about it.
 *
 * Now, three letters or more and a short pause (450 ms) also asks the server's new "find"
 * action: rm_threads and rm_messages, every mailbox the person may see, Done included, any
 * age, matching sender name, address, subject, preview and the mail text, 200 at most. The
 * answers are merged with mergeList - the same code the "more" pages use - so they open, reply
 * and behave like any other conversation. The instant local search is untouched: it still
 * shows what is already on the device while the server is being asked.
 *
 * A line under the search tells the person what is happening ("Looking through all the mail on
 * the server...", "+12 older conversations found", "nothing older found", or the error with a
 * Try again button). It also says when the mail text is not being searched, which is the case
 * until the server's one-time job has built the text index.
 *
 * Run from the repo root:
 *   node server/mailapp-b64.js decode
 *   node server/patch-app-server-search.js
 *   node server/mailapp-b64.js encode
 */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
let n = 0;
function one(find, repl, what) {
  const c = s.split(find).length - 1;
  if (c !== 1) throw new Error('expected 1 match for ' + what + ', found ' + c);
  s = s.replace(find, repl);
  n++;
}

/* 1. "find" goes to the list function, like list / img / more ---------------- */
one(
  "r=await fetch(action==='list'||action==='img'||action==='more'?API+'-list'",
  "r=await fetch(action==='list'||action==='img'||action==='more'||action==='find'?API+'-list'",
  'api() routing'
);

/* 2. the search state, the asking, and the line that reports it -------------- */
const FIND = [
"",
"/* ---------- 24 Nov 2026: search also asks the server ---------- */",
"let FND={q:'',ids:new Set(),busy:false,err:'',text:true,at:0,n:0,ms:0},fndT=0;",
"function fndClear(){FND={q:'',ids:new Set(),busy:false,err:'',text:true,at:0,n:0,ms:0}}",
"function serverFind(raw,again){const q=String(raw||'').trim();",
" if(q.length<3){if(FND.q)fndClear();return}",
" if(!again&&FND.q===q&&(FND.busy||FND.at))return;                 /* already asked for this */",
" FND={q,ids:FND.q===q?FND.ids:new Set(),busy:true,err:'',text:FND.text,at:0,n:0,ms:0};",
" try{renderListKeep()}catch(e){}",
" api('find',{q,limit:200}).then(r=>{",
"  if(($('#q')?.value||'').trim()!==q)return;                      /* they typed on */",
"  if(!Array.isArray(r.words)){FND={q,ids:new Set(),busy:false,err:'',text:true,at:0,n:0,ms:0};return}   /* 24 Nov 2026: an office server that has not updated yet answers with the ordinary list - never treat that as a search */",
"  const before=new Set(S.threads.map(t=>t.id)),bd=boxDept(),ids=new Set();",
"  mergeList(r);",
"  (r.threads||[]).forEach(row=>{const home=bd[String(row.mailbox).toLowerCase()];if(home)ids.add(home+':'+row.gmail_thread_id)});",
"  FND={q,ids,busy:false,err:'',text:r.text!==false,at:Date.now(),n:[...ids].filter(i=>!before.has(i)).length,ms:r.ms||0};",
"  render();",
" }).catch(e=>{if(($('#q')?.value||'').trim()!==q)return;",
"  FND={q,ids:new Set(),busy:false,err:e.message||'Search failed',text:true,at:Date.now(),n:0,ms:0};",
"  try{renderListKeep()}catch(e2){}});",
"}",
"/* the line under the search box */",
"const _rlFND=renderList;renderList=function(){_rlFND();",
" const raw=($('#q')?.value||'').trim(),h=document.querySelector('.list .lhead');if(!h||!raw)return;",
" let txt='',btn='';",
" if(raw.length<3)txt='Type three letters or more to search all the mail on the server';",
" else if(FND.busy&&FND.q===raw)txt='Looking through all the mail on the server\\u2026';",
" else if(FND.err&&FND.q===raw){txt='Could not search the server: '+FND.err;btn='<button class=\"btn\" data-fndgo>Try again</button>'}",
" else if(FND.q===raw&&FND.at){txt=(FND.n?'+'+FND.n+' older conversation'+(FND.n===1?'':'s')+' found on the server':'Nothing older found on the server')+(FND.text?'':' \\u00b7 the mail text is not searched yet (the server is still building its search index)');}",
" if(txt)h.insertAdjacentHTML('beforeend','<div class=\"shelp\"><span>\\ud83d\\udd0e '+esc(txt)+'</span>'+btn+'</div>')};",
"document.addEventListener('click',e=>{if(e.target.closest('[data-fndgo]'))serverFind(($('#q')?.value||''),true)});",
""].join('\n');
one(
  "function gSearch(){",
  FIND + "function gSearch(){",
  'serverFind + status line'
);

/* 3. typing in the search box asks the server after a short pause ------------ */
one(
  "let qt;$('#q').addEventListener('input',()=>{clearTimeout(qt);qt=setTimeout(()=>{if(app!=='mail'){app='mail'}render()},150)});",
  "let qt;$('#q').addEventListener('input',()=>{clearTimeout(qt);qt=setTimeout(()=>{if(app!=='mail'){app='mail'}render()},150);" +
  "clearTimeout(fndT);fndT=setTimeout(()=>serverFind($('#q').value),450)});   /* 24 Nov 2026: and ask the server */\n" +
  "$('#q').addEventListener('keydown',e=>{if(e.key==='Enter'){clearTimeout(fndT);serverFind($('#q').value,true)}});",
  'search input hook'
);

/* 4. the result list keeps the conversations the server found ---------------- */
one(
  " if(raw){const o=parseQ(raw);r=S.threads.filter(t=>qMatch(t,o));if(SEARCH_HITS&&SEARCH_Q===raw){",
  " if(raw){const o=parseQ(raw);r=S.threads.filter(t=>qMatch(t,o));" +
  "if(FND.q===raw&&FND.ids.size){const fh=new Set(r.map(t=>t.id));S.threads.forEach(t=>{if(!fh.has(t.id)&&FND.ids.has(t.id))r.push(t)})}   /* 24 Nov 2026: what the server found, even when the words are only inside the mail */" +
  "if(SEARCH_HITS&&SEARCH_Q===raw){",
  'listRows includes server hits'
);

/* 5. the Gmail / attachment search can now SHOW what it finds --------------- */
one(
  "toast(`🔎 ${n} conversation${n===1?'':'s'} found in mail and attachments`+((r.hits||[]).length>n?` · ${(r.hits||[]).length-n} more are older than what is loaded here`:''));renderList()})",
  "const miss=(r.hits||[]).map(x=>x.mailbox+'|'+x.threadId).filter(k=>!S.threads.some(t=>t.box+'|'+gidOf(t)===k));" +
  "toast(`🔎 ${n} conversation${n===1?'':'s'} found in mail and attachments`+(miss.length?` · fetching ${miss.length} older one${miss.length===1?'':'s'}…`:''));renderList();" +
  "if(miss.length)api('find',{ids:miss.slice(0,400)}).then(r2=>{mergeList(r2);toast(`🔎 ${S.threads.filter(t=>SEARCH_HITS.has(t.box+'|'+gidOf(t))).length} found—older mail included`);render()}).catch(e=>toast('Could not load the older ones: '+e.message))})",
  'load the Gmail hits that are not here yet'
);

fs.writeFileSync(F, s);
console.log('patch-app-server-search: ' + n + ' edits applied');
