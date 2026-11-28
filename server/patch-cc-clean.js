// 28 Nov 2026: Ashish's reply to Robin (Loods 5) failed 10 times: Gmail 400 "Invalid Cc header".
// Reply all builds Cc from every address seen in the conversation's To/Cc text, and Loods 5 headers carry
// junk such as [cid:image001.jpg@01DD4CD7.8B8AEC40] - which looks like an address. Now an address must have
// a real letters-only top-level domain, picture ids are dropped, and the list is capped.
const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const BLOCK = `<script>/* __ccclean:start 28 Nov 2026 - see server/patch-cc-clean.js */
(function(){
var _n=normRcpt;
function good(x){x=String(x||'').trim();var at=x.lastIndexOf('@');if(at<1)return false;
 var loc=x.slice(0,at),dom=x.slice(at+1).toLowerCase();
 if(/^image\\d*\\.(png|jpe?g|gif|bmp)$/i.test(loc)||/\\.(png|jpe?g|gif|bmp)$/i.test(loc))return false;   /* [cid:image001.jpg@01DD...] */
 if(!/^[a-z0-9-]+(\\.[a-z0-9-]+)*\\.[a-z]{2,24}$/.test(dom))return false;                                  /* real domain, letters-only ending */
 if(/^[0-9a-f]{6,}$/i.test(dom.split('.')[0]))return false;                                                /* 01DD4CD7.xxx ids */
 return loc.length<=64&&dom.length<=190}
normRcpt=function(v){var out=String(_n(v)||'').split(/,\\s*/).filter(good);return out.slice(0,40).join(', ')};
})();
/* __ccclean:end */</script>`;
const a = s.indexOf('<script>/* __ccclean:start'), b = s.indexOf('/* __ccclean:end */</script>');
if (a >= 0 && b > a) s = s.slice(0, a) + BLOCK + s.slice(b + '/* __ccclean:end */</script>'.length);
else s = s + '\n' + BLOCK + '\n';
const m = s.match(/APP_BUILD='(\d{4}-\d{2}-\d{2})-(\d+)'/);
const nb = m[1] === '2026-11-28' ? '2026-11-28-' + (+m[2] + 1) : '2026-11-28-1';
s = s.replace(m[0], "APP_BUILD='" + nb + "'");
fs.writeFileSync(f, s);
console.log('patched, build', nb);
