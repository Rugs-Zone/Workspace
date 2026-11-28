// 28 Nov 2026: the finalised company signature (Heimtextil 2027 design) for everyone.
// Replaces whatever design a person picked: name, orange rule, ROLE — TEAM, T / E / W, logo + tagline,
// Heimtextil Hall 11.0 / Stand B79 strip (auto-hidden after 15 Jan 2027), confidentiality line.
// Pictures are hosted on www.rugserp.com (data: images are stripped by Gmail/Outlook).
// Safe to run twice: the block between the __sigfinal markers is replaced.
const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const BLOCK = `<script>/* __sigfinal:start 28 Nov 2026 - finalised signature, see server/patch-sig-final.js */
(function(){
var IMG='https://www.rugserp.com/icons/signature/';
var OR='#ef5a1e',INK='#1f1f1f',GR='#6b6b6b',LG='#9a9a9a',F='font-family:Arial,Helvetica,sans-serif;';
var FAIR_END=Date.UTC(2027,0,15,23,0,0);           /* the Heimtextil strip stops after the fair */
function x(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function sigFinal(pid){
 var p=(typeof who==='function'&&who(pid))||{};
 var pr=(S&&S.profiles&&S.profiles[pid])||{};
 var d=(typeof dept==='function'&&p.dept)?dept(p.dept):null;
 var box='';try{box=(typeof noteBox==='function'&&noteBox())||''}catch(e){}
 if(!box&&d&&typeof mailOf==='function')box=mailOf(d);
 var team=d&&d.name?String(d.name).replace('Merch \\u00b7 ',''):'';
 var role=String(pr.title||p.role||'').toUpperCase(),tm=team.toUpperCase();
 var line=role+(role&&tm?' &nbsp;\\u2014&nbsp; ':'')+tm;
 var ph=pr.phone||'';
 var L=function(k,v,c){return '<tr><td style="'+F+'font-size:13px;color:'+(c||INK)+';padding:2px 0;white-space:nowrap"><span style="display:inline-block;width:18px">'+k+'</span>'+v+'</td></tr>'};
 var h='<table cellpadding="0" cellspacing="0" border="0" width="560" style="'+F+'border-collapse:collapse;width:560px;max-width:100%">'
 +'<tr><td style="vertical-align:top;padding:0 0 14px">'
 +'<div style="'+F+'font-size:34px;line-height:40px;font-weight:300;color:'+INK+'">'+x(p.name||'')+'</div>'
 +'<div style="width:42px;height:3px;background:'+OR+';font-size:0;line-height:0;margin:6px 0 10px">&nbsp;</div>'
 +'<div style="'+F+'font-size:11px;letter-spacing:.6px;color:'+GR+';padding-bottom:8px">'+line+'</div>'
 +'<table cellpadding="0" cellspacing="0" border="0">'
 +(ph?L('T',x(ph)):'')
 +L('E','<a href="mailto:'+x(box)+'" style="color:'+INK+';text-decoration:none">'+x(box)+'</a>')
 +L('W','<a href="https://www.rugscreation.com" style="color:'+OR+';text-decoration:none">www.rugscreation.com</a>',OR)
 +'</table></td>'
 +'<td style="vertical-align:top;text-align:right;padding:0 0 14px">'
 +'<img src="'+IMG+'logo_light.png" alt="Rugs Creation" width="148" height="55" style="display:inline-block;border:0;width:148px;height:55px">'
 +'<div style="'+F+'font-size:11px;color:'+LG+';padding-top:4px">Young &amp; Creative \\u00b7 since 2008</div></td></tr>';
 if(Date.now()<FAIR_END)h+='<tr><td colspan="2" style="border-top:1px solid '+INK+';padding:12px 0">'
 +'<table cellpadding="0" cellspacing="0" border="0"><tr>'
 +'<td style="vertical-align:middle;padding-right:16px"><img src="'+IMG+'heimtextil-badge.png" alt="Heimtextil" width="90" height="60" style="display:block;border:0;width:90px;height:60px"></td>'
 +'<td style="vertical-align:middle;padding-right:22px"><div style="'+F+'font-size:10px;color:'+GR+'">HALL</div><div style="'+F+'font-size:24px;line-height:28px;font-weight:bold;color:'+INK+'">11.0</div></td>'
 +'<td style="vertical-align:middle;padding-right:22px"><div style="'+F+'font-size:10px;color:'+GR+'">STAND</div><div style="'+F+'font-size:24px;line-height:28px;font-weight:bold;color:'+OR+'">B79</div></td>'
 +'<td style="vertical-align:middle"><div style="'+F+'font-size:14px;font-weight:bold;color:'+INK+'">Heimtextil 2027, Frankfurt</div>'
 +'<div style="'+F+'font-size:12px;color:'+GR+';padding-top:3px">12 \\u2013 15 January 2027 &nbsp;\\u00b7&nbsp; Come and see the new collection</div></td>'
 +'</tr></table></td></tr>';
 h+='<tr><td colspan="2" style="border-top:1px solid #e3e3e3;padding-top:8px;'+F+'font-size:10.5px;line-height:15px;color:'+LG+'">'
 +'Confidential: this email and any attachments are meant only for the named recipient. If you got it by mistake, tell the sender and delete it. Rugs Creation is not liable for viruses or for changes made after sending.'
 +'</td></tr></table>';
 return h}
try{window.sigFinal=sigFinal;sigOf=function(pid){return sigFinal(pid)}}catch(e){}
})();
/* __sigfinal:end */</script>`;
const a = s.indexOf('<script>/* __sigfinal:start'), b = s.indexOf('/* __sigfinal:end */</script>');
if (a >= 0 && b > a) s = s.slice(0, a) + BLOCK + s.slice(b + '/* __sigfinal:end */</script>'.length);
else s = s + '\n' + BLOCK + '\n';
const m = s.match(/APP_BUILD='(\d{4}-\d{2}-\d{2})-(\d+)'/);
const nb = m[1] === '2026-11-28' ? '2026-11-28-' + (+m[2] + 1) : '2026-11-28-1';
s = s.replace(m[0], "APP_BUILD='" + nb + "'");
fs.writeFileSync(f, s);
console.log('patched, build', nb);
