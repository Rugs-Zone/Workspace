/* 19 Nov 2026 - "on a bigger trail, Reply (or anything else) does not react fast".
   MEASURED FIRST, in a real browser on real conversations (77, 21 and 5 mails): building the quoted
   trail and drawing it in the editor costs 376 ms / 82 ms / 28 ms - that is NOT the problem. The wait
   is the app holding the window back: withFull asked for the pictures of the whole trail first and
   waited for them (up to the 8-second limit added this morning), so the click did nothing visible for
   several seconds.

   NOW the compose window opens AT ONCE and the pictures fill themselves in afterwards:
     - a picture that has not arrived yet is quoted as a blank space that remembers its name
       (data-rmcid), exactly like the reading pane, so cidLive() drops the real picture into the
       editor the moment it arrives - no waiting, no flicker, and the quote is never a broken icon;
     - anything already fetched appears immediately (cidLive runs as the window opens);
     - a picture that never arrives is REMOVED from the mail when it is sent, so a blank placeholder
       can never go out to a buyer (one clean-up in outgoingHTML, which both send paths use).
   Only the case where the mail itself has not been read from Gmail yet still waits - there the quote
   would otherwise be the 1,500-character preview.

   Run:  node server/mailapp-b64.js decode  &&  node server/patch-reply-instant.js  &&  node server/mailapp-b64.js encode
*/
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8'), n = 0;
function edit(name, old, nw) {
  const c = s.split(old).length - 1;
  if (c !== 1) { console.error('FAILED: ' + name + ' found ' + c + ' times'); process.exit(1); }
  s = s.replace(old, () => nw); n++; console.log('ok  ' + name);
}

/* ---------- 1. the window opens at once ---------- */
edit('Reply and Forward no longer wait for pictures',
  " if(t.full){if(!t.msgs.some(x=>/rmcid:/.test(x.raw||'')))return fn();\n"
+ "  /* 19 Nov 2026: wait for the pictures of the trail, but at most 8 seconds - a long trail has dozens\n"
+ "     of them and the compose window used to sit closed for a minute. The rest keep arriving. */\n"
+ "  let went=false;const go=()=>{if(went)return;went=true;fn()};\n"
+ "  loadCidPics(t,{all:true}).then(go);setTimeout(go,8000);return}",

  " if(t.full){\n"
+ "  /* 19 Nov 2026: do not hold the window back. It opens now; a picture that is still coming is quoted\n"
+ "     as a blank space that knows its own name, and cidLive() drops the real one in when it lands.\n"
+ "     One that never lands is taken out of the mail when it is sent (see outgoingHTML). */\n"
+ "  fn();\n"
+ "  if(t.msgs.some(x=>/rmcid:/.test(x.raw||''))){try{loadCidPics(t,{all:true})}catch(e){}}\n"
+ "  setTimeout(()=>{try{cidLive()}catch(e){}},0);\n"
+ "  return}");

/* ---------- 2. a quoted picture that is still coming is a blank that knows its name ---------- */
edit('quoted pictures wait the same way as in the reading pane',
  "/* Reply, Reply all, Forward and Forward-as-attachment quote the mail itself, so",

  "/* 19 Nov 2026: the same treatment as the reading pane for a quoted mail - a picture that has not\n"
+ "   arrived yet becomes a blank space carrying its name, so it is never a broken icon in the editor\n"
+ "   and cidLive() can fill it in where it stands. */\n"
+ "const _qbCid=qBody;qBody=function(m){let h=_qbCid.apply(this,arguments);\n"
+ " if(h&&h.indexOf('rmcid:')>=0){h=h.replace(CID_SRC,(m0,a,k,b)=>CIDD[k]?a+CIDD[k]+b:a+PIXEL+b+' data-rmcid=\"'+k+'\"')\n"
+ "  .replace(CID_TXT,(m0,pre,k)=>CIDD[k]?pre+'<img src=\"'+CIDD[k]+'\" alt=\"\" style=\"max-width:100%;height:auto\">'\n"
+ "   :pre+'<span data-rmcid=\"'+k+'\" style=\"color:#9c948e;font-size:12px\">\\u23f3 picture loading\\u2026</span>')}\n"
+ " return h};\n"
+ "/* Reply, Reply all, Forward and Forward-as-attachment quote the mail itself, so");

/* ---------- 3. a picture that never arrived never goes out ---------- */
edit('take unfinished pictures out of the mail that is sent',
  "function liveSend(t,m,fwd,isNew){",

  "/* 19 Nov 2026: whatever is still waiting for a picture when the mail is sent is taken out, so a buyer\n"
+ "   never receives a blank placeholder. Both ways of sending build their HTML with outgoingHTML. */\n"
+ "const _ogCid=outgoingHTML;outgoingHTML=function(m){let h=_ogCid.apply(this,arguments);\n"
+ " if(h&&h.indexOf('data-rmcid')>=0)h=h.replace(/<img\\b[^>]*\\bdata-rmcid=\"[^\"]*\"[^>]*>/gi,'')\n"
+ "  .replace(/<span\\b[^>]*\\bdata-rmcid=\"[^\"]*\"[^>]*>[\\s\\S]*?<\\/span>/gi,'');\n"
+ " return h};\n"
+ "function liveSend(t,m,fwd,isNew){");

/* ---------- new build ---------- */
edit('APP_BUILD', "const APP_BUILD='2026-11-19-7';", "const APP_BUILD='2026-11-19-8';");

fs.writeFileSync(F, s);
console.log(n + ' edits done');

/* ---------- follow-up, same change: the quote must KEEP the picture's place ----------
   Measured after the first version: the quoted mails still had no pictures, because qBuild deletes
   every <img src="rmcid:..."> ("a pasted picture whose bytes never came would only be a broken icon").
   With the window now opening before the pictures arrive, that threw them all away. Two more edits
   (scratchpad/keepquote.js, applied):
     - qBuild: a cid: picture is still removed, but one of OURS still on its way keeps its place as a
       blank carrying its name (data-rmcid + PIXEL), and one already fetched is put straight in;
     - trailBlock gets the same treatment for a picture written in the text of a quoted mail.
   outgoingHTML then takes out anything still blank when the mail is actually sent.
*/
