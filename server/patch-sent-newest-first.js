// 28 Nov 2026: "Arun's Sent does not show the mail he sent today". Mail he sent from a mailbox he cannot open (R36) was
// always drawn in a group at the BOTTOM of Sent (after hundreds of rows), and only looked for again every 10 minutes, so
// today's mail was nowhere near the top. Now: R36 mail NEWER than the newest row in the list is drawn at the TOP
// under its own heading ("New - sent by you in a mailbox you cannot open"), older ones stay in the group at the bottom,
// and the lookup is repeated every 3 minutes instead of 10.  Usage: node server/patch-sent-newest-first.js .tmp/email.html
const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b, n) => { const c = s.split(a).length - 1; if (c !== n) throw new Error('expected ' + n + ' of: ' + a.slice(0, 90) + ' found ' + c); s = s.split(a).join(b); };

// 1. look again every 3 minutes (was 10)
rep("if(!force&&FS36!==null&&Date.now()-FS36at<6e5)return;", "if(!force&&FS36!==null&&Date.now()-FS36at<18e4)return;", 1);

// 2. newest mail goes to the top
rep(" const h=[head('📤 Also sent by you · in mailboxes you cannot open · '+rows.length)];\n rows.forEach(function(m){const i=FS36.indexOf(m),at=Date.parse(m.sent_at)||0;\n  h.push('<div class=\"m\" data-fs36=\"'+i+'\" role=\"button\" tabindex=\"0\" style=\"cursor:pointer\">'",
    " /* 28 Nov 2026: what is NEWER than the newest row already in the list goes to the TOP, the rest stays below */\n let topAt=0;try{listRows().forEach(function(t){if((t.last||0)>topAt)topAt=t.last||0})}catch(e){}\n const newer=rows.filter(function(m){return (Date.parse(m.sent_at)||0)>topAt}),older=rows.filter(function(m){return (Date.parse(m.sent_at)||0)<=topAt});\n const one=function(m){const i=FS36.indexOf(m),at=Date.parse(m.sent_at)||0,h=[];\n  h.push('<div class=\"m\" data-fs36=\"'+i+'\" role=\"button\" tabindex=\"0\" style=\"cursor:pointer\">'", 1);
rep("  +'</div></div></div>')});\n box.insertAdjacentHTML('beforeend',h.join(''))}",
    "  +'</div></div></div>');return h.join('')};\n if(newer.length)box.insertAdjacentHTML('afterbegin',head('📤 New · sent by you in a mailbox you cannot open · '+newer.length)+newer.map(one).join(''));\n if(older.length)box.insertAdjacentHTML('beforeend',head('📤 Also sent by you · in mailboxes you cannot open · '+older.length)+older.map(one).join(''))}", 1);
// the group heading must exist once per group: both use [data-fs36group] and are removed together (already so)
// 3. fingerprint knows where the top is, so an unchanged list is left alone but a new mail redraws
rep("const sig=JSON.stringify([FS36===null?'?':rows.length,FS36err,q0,FS36at,ME,", "const sig=JSON.stringify([FS36===null?'?':rows.length,FS36err,q0,FS36at,ME,(function(){try{return listRows().reduce(function(a,t){return Math.max(a,t.last||0)},0)}catch(e){return 0}})(),", 1);

const m = s.match(/APP_BUILD='(\d{4}-\d{2}-\d{2})-(\d+)'/);
const nb = '2026-11-28-' + (+m[2] + 1);
s = s.replace(m[0], "APP_BUILD='" + nb + "'");
fs.writeFileSync(f, s);
console.log('patched, build', nb);
