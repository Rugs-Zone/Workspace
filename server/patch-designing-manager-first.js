/* 20 Nov 2026 - "in Team Designing all mail shows to the manager, and a member sees a mail only when
   the manager gives it to him - this rule for Team Designing only."

   Everywhere else the rule stays as it is (16 Nov): mail nobody has taken is shown to the WHOLE team so
   anyone can pick it up, and once it has an owner only the owner (plus manager / CRM / admin) sees it.
   Team Designing now works the other way round - the manager hands the work out:
     - mail nobody has taken  -> only Anamika (Manager), the CRM and the admin see it;
     - the moment she assigns it, it appears for that person, with the whole conversation and every
       later mail in it, in his Inbox, his My work and his counts;
     - a member still keeps a conversation he has replied in, so work he has already done never
       disappears from under him.
   Written as a list of mailboxes (MGR_FIRST), so another team can be added later by putting its
   address in that list - and renaming the team changes nothing.
   Run:  node server/mailapp-b64.js decode  &&  node server/patch-designing-manager-first.js  &&  node server/mailapp-b64.js encode
*/
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8'), n = 0;
function edit(name, old, nw) {
  const c = s.split(old).length - 1;
  if (c !== 1) { console.error('FAILED: ' + name + ' found ' + c + ' times'); process.exit(1); }
  s = s.replace(old, () => nw); n++; console.log('ok  ' + name);
}

edit('Team Designing: the manager hands the work out',
  "function seeMine(t){const p=who(ME);\n"
+ " if(!p||!t)return true;\n"
+ " if(p.role==='Admin'||['Manager','Lead','CRM'].includes(p.role))return true;   /* manager / CRM / admin: the whole team */\n"
+ " if(!t.owner)return true;                                                      /* nobody has taken it yet */",

  "/* 20 Nov 2026: a \"manager first\" team - mail nobody has taken is the manager's to hand out, and a\n"
+ "   member sees it only once it is his. Listed by mailbox so renaming the team changes nothing; put\n"
+ "   another address in here to do the same for another team. */\n"
+ "const MGR_FIRST=['designer@rugscreation.com'];\n"
+ "function mgrFirst(d){try{const x=dept(d);return !!x&&MGR_FIRST.indexOf(String(mailOf(x)||'').toLowerCase())>=0}catch(e){return false}}\n"
+ "function seeMine(t){const p=who(ME);\n"
+ " if(!p||!t)return true;\n"
+ " if(p.role==='Admin'||['Manager','Lead','CRM'].includes(p.role))return true;   /* manager / CRM / admin: the whole team */\n"
+ " if(!t.owner)return !mgrFirst(t.dept);                                         /* nobody has taken it yet: anyone may pick it up, except in a manager-first team */");

edit('APP_BUILD', "const APP_BUILD='2026-11-20-2';", "const APP_BUILD='2026-11-20-3';");

fs.writeFileSync(F, s);
console.log(n + ' edits done');
