// 17 Nov 2026 - Admin -> Old mail can choose 365 days (1 year) of mail for everyone.
const fs=require('fs');const P='index.html';
const src=fs.readFileSync(P,'utf8');
const m=src.match(/var EMAIL_HTML_B64 = "([A-Za-z0-9+\/=]+)"/);
const raw=Buffer.from(m[1],'base64');
if(raw.toString('base64')!==m[1])throw new Error('base64 round-trip differs - aborting');
let h=raw.toString('utf8');
const rep=(a,b)=>{const n=h.split(a).length-1;if(n!==1)throw new Error('found '+n+'x: '+a);h=h.replace(a,()=>b)};
rep("${[30,60,90,180].map(n=>`<option value=\"${n}\" ${n===d?'selected':''}>${n} days</option>`)",
    "${[30,60,90,180,365].map(n=>`<option value=\"${n}\" ${n===d?'selected':''}>${n===365?'1 year (365 days)':n+' days'}</option>`)");
const out=Buffer.from(h,'utf8').toString('base64');
const i=src.indexOf(m[1]);
fs.writeFileSync(P,src.slice(0,i)+out+src.slice(i+m[1].length));
console.log('ok');
// Also applied once by hand the same day: the app's starting value before the server answers, let HIST_DAYS=180 -> 365.
