// patch-xfer-decider.js - 18 Nov 2026: show WHO decides the owner when mail is transferred to another team.
// A transfer with "Department decides" lands unassigned in the other team; the people who then choose the
// owner are that team's Manager / Lead / CRM plus anyone with the team in perm.crm_depts (e.g. Priya).
// Now named: (1) in the Transfer dialog, (2) in the history line, (3) on the mail row's "Transferred" tag,
// (4) in the open mail's Owner field for people who cannot assign.
// Run:  node server/mailapp-b64.js decode ; node server/patch-xfer-decider.js ; node server/mailapp-b64.js encode
const fs = require('fs'); const P = '.tmp/email.html'; let s = fs.readFileSync(P, 'utf8');
if (s.includes('const deciders=')) { console.log('Already patched'); process.exit(0); }
function one(a, b, what) { if (s.split(a).length !== 2) throw new Error('anchor not unique: ' + what); s = s.replace(a, () => b); }

// 1. helpers
one("const isAssigner=()=>",
"/* 18 Nov 2026: who chooses the owner of a team's unassigned mail (where a transfer with \"Department decides\" lands) */\n" +
"const deciders=d=>PEOPLE.filter(p=>p.active!==false&&((p.dept===d&&['Manager','Lead','CRM'].includes(p.role))||(Array.isArray(p.perm&&p.perm.crm_depts)&&p.perm.crm_depts.includes(d))));\n" +
"const decTxt=d=>{const a=deciders(d);return a.length?a.map(p=>p.name+(onLeave(p.id)?' (on leave)':'')).join(', '):'the admin'};\n" +
"const isAssigner=()=>", 'helpers');

// 2. Transfer dialog: a line under the person picker that names the deciders of the chosen team
one('<div class="fld"><label for="xn">Note for them</label>',
    '<p id="xdec" class="sub" style="margin:-4px 0 0;color:var(--muted);font-size:12.5px"></p>\n <div class="fld"><label for="xn">Note for them</label>', 'dialog line');
one("s.innerHTML='<option value=\"\">Department decides</option>'+",
    "const dz=L.querySelector('#xdec'),dn=decTxt(pick);dz.innerHTML='If you leave it on <b>Department decides</b>, <b>'+esc(dn)+'</b> will choose the owner in '+esc(dept(pick).name)+'.';\n s.innerHTML='<option value=\"\">Department decides ('+esc(dn)+')</option>'+", 'dialog picker');

// 3. the "Transferred ..." history line says who will decide (added to that line, NOT as an 'a' line:
//    'a' lines count as assignments in Home / reports)
one("to ${to.name} by ${who(ME).name}",
    "to ${to.name} by ${who(ME).name}${pid?'':' · owner to be chosen by '+decTxt(pick)}", 'history');

// 4. row tag: "Transferred · Jagjit to assign" while nobody owns it
one("${x?`<span class=\"tag t-xfer\">${ico('fwd')} Transferred</span>`:''}",
    "${x?`<span class=\"tag t-xfer\" title=\"${!t.owner&&s!=='done'?'Owner to be chosen by '+esc(decTxt(t.dept)):''}\">${ico('fwd')} Transferred${!t.owner&&s!=='done'?' · '+esc(deciders(t.dept).map(p=>p.name.split(' ')[0]).join(', ')||'admin')+' to assign':''}</span>`:''}", 'row tag');

// 5. open mail, Owner field for people who cannot assign
one("<b>${esc(who(t.owner)?.name||'Not assigned')}</b>",
    "<b>${esc(who(t.owner)?.name||('Not assigned — '+decTxt(t.dept)+' will choose'))}</b>", 'owner field');

fs.writeFileSync(P, s); console.log('patched');
