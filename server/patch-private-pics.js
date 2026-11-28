/* patch-private-pics.js - 28 Nov 2026
 *
 * Console error reported from a staff screen:
 *
 *   GET https://work.fife.usercontent.google.com/rd-mail-sig/AIorK4yu...=s1600
 *   net::ERR_BLOCKED_BY_RESPONSE.NotSameSite 302 (Found)
 *
 * WHAT IT IS. That address is a Gmail SIGNATURE picture (the "rd-mail-sig" path): the logo a
 * colleague has in their Gmail signature. Google keeps it inside that person's own Google
 * account and refuses to let any other website show it - the browser is told, in so many words,
 * "not same site". CHECKED, not assumed: fetching that exact address from this machine with no
 * Google cookies answers 403, so our own server's picture proxy (the 'img' action) cannot get it
 * either - that is what all those "REFUSED img -> 404 Picture not reachable" lines in the office
 * log are. So the picture CANNOT be shown, by us or by anybody else outside Google.
 *
 * WHAT WAS WRONG. The mail's own HTML still carried that address, so every time the mail was
 * drawn the browser asked for it, was refused, wrote a red line in the console, and left a gap
 * where the logo should be. It also told Google, every single time, that this mail had been
 * opened again.
 *
 * THE FIX. The address is taken out before the mail is drawn, so nothing is asked for at all:
 *   - no console error, no request to Google, nothing reported back to the sender
 *   - the mail keeps everything else exactly as received
 *   - the reading pane says once, in plain words, that a signature picture cannot be shown and why
 * It is done in every place a mail's own HTML reaches the screen: the "exactly as received"
 * frame, an internal mail's rich body, the Mail trail, and the quoted trail in the editor.
 *
 * ONLY these addresses, which all need the sender's own Google session:
 *   *.usercontent.google.com      (work.fife... - Gmail signature pictures)
 *   ci*.googleusercontent.com/proxy/   (Gmail's own image proxy)
 *   mail.google.com/mail/...      (a Gmail inline-picture link)
 *   anything with /rd-mail-sig/
 * An ordinary picture on the internet, a Drive picture (lh3.googleusercontent.com/d/...) and an
 * attached picture that comes with the mail (cid:) are NOT touched and keep working as they do.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-private-pics.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");
const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");
if (s.includes("__privpic")) { console.log("already applied - nothing to do"); process.exit(0); }

let done = 0;
function edit(name, from, to) {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(name + ": found " + n + " times, expected 1");
  s = s.replace(from, to);
  console.log("  edit " + (++done) + " ok  " + name);
}

/* 1 - an internal colleague's rich body (drawn in the page, not in the frame) */
edit("rich body",
  '<div class="rich">${m.html}</div>',
  '<div class="rich">${noPriv(m.html)}</div>'
);
/* 2 - say it once, under the mail */
edit("the one-line explanation",
  '${m.saved?\'\':`<span class="rawnote">',
  '${m.privPics?`<span class="rawnote">\\ud83d\\uddbc ${m.privPics>1?m.privPics+\' pictures\':\'A picture\'} in this mail (a Gmail signature logo) cannot be shown \\u2014 Google keeps it inside the sender\\u2019s own account</span>`:\'\'}${m.saved?\'\':`<span class="rawnote">'
);

/* 3 - the block itself */
const BLOCK = [
'<script>/* __privpic:start  28 Nov 2026 - a picture that can never be shown is not asked for.',
'   server/patch-private-pics.js. Reported from a staff screen as',
'   "GET work.fife.usercontent.google.com/rd-mail-sig/... ERR_BLOCKED_BY_RESPONSE.NotSameSite".',
'   Measured: that address answers 403 to our own server too, so it is unreachable, not slow. */',
'(function(){',
' /* every one of these needs the SENDER\'s own Google session, so no other site can show them */',
' var PRIV=/^(?:https?:)?\\/\\/(?:[a-z0-9-]+\\.)*usercontent\\.google\\.com\\/|^(?:https?:)?\\/\\/ci[0-9]*\\.googleusercontent\\.com\\/proxy\\/|^(?:https?:)?\\/\\/mail\\.google\\.com\\/mail\\/|rd-mail-sig\\//i;',
' var DOT="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";',
' var LAST=0;',
' /* Takes the address out of the picture tag and leaves a hidden, empty one in its place, so the',
'    mail\'s own HTML is otherwise untouched and nothing is requested. */',
' window.noPriv=function(h){',
'  LAST=0;',
'  if(!h)return h;',
'  var str=String(h);',
'  if(str.indexOf("google")<0)return h;        /* almost every mail: nothing to do */',
'  return str.replace(/<img\\b[^>]*>/gi,function(tag){',
'   var m=/\\ssrc\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s">]+))/i.exec(tag);',
'   var u=m?(m[1]!==undefined?m[1]:(m[2]!==undefined?m[2]:m[3])):"";',
'   if(!u||!PRIV.test(u))return tag;',
'   LAST++;',
'   return \'<img data-rzpriv="1" alt="" aria-hidden="true" style="display:none" src="\'+DOT+\'">\';',
'  });',
' };',
' window.noPrivN=function(){return LAST};',
'',
' /* the "exactly as received" frame - and it remembers how many were taken out, for the line',
'    the reading pane prints under the mail */',
' try{if(typeof picHTML==="function"){var _ph=picHTML;',
'  picHTML=function(m,h){var fixed=window.noPriv(h),n=window.noPrivN();',
'   try{if(m)m.privPics=n}catch(e){}',
'   return _ph.call(this,m,fixed)}}}catch(e){}',
'',
' /* the Mail trail, and the quoted trail inside the editor */',
' try{if(typeof trailHTML==="function"){var _th=trailHTML;',
'  trailHTML=function(){return window.noPriv(_th.apply(this,arguments))}}}catch(e){}',
' try{if(typeof trailBlock==="function"){var _tb=trailBlock;',
'  trailBlock=function(){return window.noPriv(_tb.apply(this,arguments))}}}catch(e){}',
'',
' /* belt: anything drawn in the page itself (not in a frame) stays hidden */',
' try{var st=document.createElement("style");st.id="privpiccss";',
'  st.textContent="img[data-rzpriv]{display:none!important}";',
'  document.head.appendChild(st)}catch(e){}',
'',
' /* paste  rzPrivPics()  into the console to see what was taken out of the mail on screen */',
' window.rzPrivPics=function(){',
'  try{var t=(typeof openId!=="undefined"&&openId)?T_(openId):null;if(!t)return "no conversation open";',
'   return (t.msgs||[]).map(function(m,i){return {mail:i+1,from:m.from,hidden:m.privPics||0}})',
'    .filter(function(x){return x.hidden})}catch(e){return String(e.message||e)}',
' };',
'})();',
'/* __privpic:end */<' + '/script>',
''
].join('\n');

s = s.replace(/\s*$/, '\n') + BLOCK;
fs.writeFileSync(F, s);
console.log("ok  " + done + " edits + the block (" + s.length + " chars)");
