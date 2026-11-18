// patch-admin-dashpick.js - 18 Nov 2026: on Home, an Admin (Priya) can open ANYONE's dashboard.
// The "View dashboard" row already let a Manager pick a teammate (dashAs), but for an Admin the people
// list was filtered out completely, so she only had "All departments". Now an Admin gets a dropdown of
// every active person, grouped by team; picking one shows that person's dashboard (same dashAs view as a
// manager gets), "All departments" brings her back. Read-only view - it does not sign in as them
// (that is still Admin -> Switch ID).
// Run:  node server/mailapp-b64.js decode ; node server/patch-admin-dashpick.js ; node server/mailapp-b64.js encode
const fs = require('fs'); const P = '.tmp/email.html'; let s = fs.readFileSync(P, 'utf8');
if (s.includes('function adminDashPick')) { console.log('Already patched'); process.exit(0); }
function one(a, b, what) { if (s.split(a).length !== 2) throw new Error('anchor not unique: ' + what); s = s.replace(a, () => b); }

one('function pageDash(){const ME0=ME,',
`/* 18 Nov 2026: Admin picks anyone's dashboard (grouped by team) */
function adminDashPick(me0){
 const ok=p=>p.id!==me0&&p.role!=='Admin'&&p.active!==false;
 const opt=p=>\`<option value="\${p.id}" \${dashAs===p.id?'selected':''}>\${esc(p.name)}\${p.role&&p.role!=='Executive'?' · '+esc(p.role):''}\${onLeave(p.id)?' · on leave':''}</option>\`;
 const ids=DEPTS.map(d=>d.id),other=PEOPLE.filter(p=>ok(p)&&!ids.includes(p.dept));
 return \`<select data-dashsel aria-label="Open someone's dashboard" style="width:auto;padding:4px 8px;border-radius:99px;font-size:12.5px;font-weight:600">
  <option value="">\${dashAs?'↩ Back to all departments':'👤 Someone\\'s dashboard…'}</option>
  \${DEPTS.map(d=>{const ps=PEOPLE.filter(p=>ok(p)&&p.dept===d.id);return ps.length?\`<optgroup label="\${esc(d.name)}">\${ps.map(opt).join('')}</optgroup>\`:''}).join('')}
  \${other.length?\`<optgroup label="Other">\${other.map(opt).join('')}</optgroup>\`:''}</select>\`}
document.addEventListener('change',e=>{const s=e.target.closest&&e.target.closest('[data-dashsel]');if(!s)return;dashAs=s.value;app='dash';render()});
function pageDash(){const ME0=ME,`, 'helper');

one('<span>View dashboard</span><button role="tab" class="chip" data-dashas=""',
    '<span>View dashboard</span><button role="tab" class="chip" data-dashas=""', 'chips check');
// put the dropdown right after the "All departments" chip, for Admins only
one(`\${who(ME0).role==='Admin'?'All departments':'My team'}</button>`,
    `\${who(ME0).role==='Admin'?'All departments':'My team'}</button>\${who(ME0).role==='Admin'?adminDashPick(ME0):''}`, 'dropdown');

fs.writeFileSync(P, s); console.log('patched');
