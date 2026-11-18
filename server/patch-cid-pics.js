// patch-cid-pics.js - 18 Nov 2026: "Critical issues mail shows only the short preview - 546".
// rugs-mail used to paste every picture of a conversation into every mail as base64, so long claim
// trails (many replies quoting the same photos) ran the server out of memory/CPU (546) and the full
// mail never came. Now the server sends rmcid:<gmail id>/<cid> links and the app fetches each picture
// with action inlineImg, two at a time, then puts them into the mail (data: URLs, as before).
// Run on the decoded app:  node server/mailapp-b64.js decode ; node server/patch-cid-pics.js ; node server/mailapp-b64.js encode
const fs = require('fs'); const P = '.tmp/email.html'; let s = fs.readFileSync(P, 'utf8');
if (s.includes('function loadCidPics')) { console.log('Already patched'); process.exit(0); }
function one(a, b, what) { if (s.split(a).length !== 2) throw new Error('anchor not unique: ' + what); s = s.replace(a, () => b); }
// 1. liveOpen: an already-full mail still gets its pictures; after the text arrives, fetch the pictures
one("if(!t||t._local||t.full)return Promise.resolve(true);\n const L=ld(t);",
    "if(!t||t._local)return Promise.resolve(true);\n if(t.full){loadCidPics(t);return Promise.resolve(true)}\n const L=ld(t);", 'liveOpen guard');
one("L.p=run().then(ok=>{L.busy=false;L.p=null;if(!ok)L.gave=true;redrawRead(t);return ok})",
    "L.p=run().then(ok=>{L.busy=false;L.p=null;if(!ok)L.gave=true;redrawRead(t);loadCidPics(t);return ok})", 'liveOpen then');
// 2. the picture loader, right after liveOpen
one("/* Reply, Reply all, Forward and Forward-as-attachment quote the mail itself, so",
`/* 18 Nov 2026: pasted (cid:) pictures arrive as rmcid:<gmail id>/<cid> links - the server no longer pastes
   them into every mail of the trail (that ran it out of memory: 546). Fetched here two at a time, once per
   picture for the whole session, then written into the mail as data: URLs exactly as before. */
const CIDP={},CID_RX=/rmcid:[A-Za-z0-9]+\\/[^"'\\s)>]+/g;
function loadCidPics(t){
 if(!t)return Promise.resolve();const L=ld(t);if(L.pics)return L.pics;
 const ms=t.msgs.filter(x=>/rmcid:/.test(x.raw||''));if(!ms.length)return Promise.resolve();
 const keys=[...new Set(ms.flatMap(x=>x.raw.match(CID_RX)||[]))];
 const get=k=>CIDP[k]||(CIDP[k]=(()=>{const m=k.match(/^rmcid:([^/]+)\\/(.+)$/);let cid='';try{cid=decodeURIComponent(m[2])}catch(e){cid=m[2]}
  return _tmo(api('inlineImg',{mailbox:t.box,gmailId:m[1],cid}),30000,'timeout').then(r=>r&&r.data||'')})().catch(()=>{delete CIDP[k];return ''}));
 let i=0;const work=async()=>{while(i<keys.length)await get(keys[i++])};
 L.pics=Promise.all([work(),work()]).then(async()=>{
  const map={};let miss=0;for(const k of keys){map[k]=await get(k);if(!map[k])miss++}
  ms.forEach(x=>{x.raw=x.raw.replace(CID_RX,k=>map[k]||k);if(x.gid&&RAWC[x.gid])RAWC[x.gid].raw=x.raw;try{QC.delete(x)}catch(e){}});
  if(miss)setTimeout(()=>{L.pics=null},0);       // a picture that failed is tried again the next time the mail is opened
  redrawRead(t)});
 return L.pics}
/* Reply, Reply all, Forward and Forward-as-attachment quote the mail itself, so`, 'loader');
// 3. replies / forwards also wait for the pictures, so they quote the real pictures
one("if(!t||t.full||t._local)return fn();\n toast('Getting the full mail first",
    "if(!t||t._local)return fn();\n if(t.full){if(!t.msgs.some(x=>/rmcid:/.test(x.raw||'')))return fn();loadCidPics(t).then(()=>fn());return}\n toast('Getting the full mail first", 'withFull');
// 4. a picture still loading is not a broken picture (no "picture not available" box), and never goes out in a quote
one("function fixImg(i,fit){if(i._fix)return;", "function fixImg(i,fit){if(i._fix||/^rmcid:/i.test(i.getAttribute('src')||''))return;", 'fixImg');
one(`doc.querySelectorAll('img[src^="cid:"]')`, `doc.querySelectorAll('img[src^="cid:"],img[src^="rmcid:"]')`, 'qBuild');
fs.writeFileSync(P, s); console.log('patched');
