# 15 Nov 2026 — Rugs Email: the MANAGER of each team delegates that team's unassigned mail
# (Priya stays CRM for the whole company through perm.crm_depts, but it is no longer only her job).
# Edits the mail app inside index.html (stored there as base64 in EMAIL_HTML_B64).
import base64, re, sys

P = 'index.html'
src = open(P, encoding='utf-8', newline='').read()
m = re.search(r'var EMAIL_HTML_B64 = "([A-Za-z0-9+/=]+)"', src)
assert m, 'EMAIL_HTML_B64 not found'
b64 = m.group(1)
raw = base64.b64decode(b64)
# safety: our encode must reproduce the file's own base64 exactly, or we must not touch it
assert base64.b64encode(raw).decode() == b64, 'base64 round-trip differs - aborting'
html = raw.decode('utf-8')
before = html
n = 0


def rep(a, b):
    global html, n
    assert html.count(a) == 1, (html.count(a), a[:80])
    html = html.replace(a, b)
    n += 1


# 1) who is the assigner: the team's manager for his own team; Priya keeps every team via perm.crm_depts
rep("""const crmDepts=()=>{const p=who(ME),d=p&&p.perm&&p.perm.crm_depts;return Array.isArray(d)&&d.length?d:null};
const isAssigner=()=>who(ME)?.role==='CRM'||!!crmDepts();""",
    """/* Who delegates unassigned mail (15 Nov 2026): the MANAGER of each team does it for his own team.
   Priya is CRM for the whole company (perm.crm_depts lists the teams), so she still sees every team and
   can help, but assigning is no longer only her job. A manager with no crm_depts gets his own team. */
const crmDepts=()=>{const p=who(ME),d=p&&p.perm&&p.perm.crm_depts;if(Array.isArray(d)&&d.length)return d;
 return p&&['Manager','Lead'].includes(p.role)&&p.dept?[p.dept]:null};
const isAssigner=()=>['CRM','Manager','Lead'].includes(who(ME)?.role)||!!crmDepts();""")

# 2) team member's Home tile: it is the team's mail, so let them open it and take one
rep("""T_('cool',needs.length,'Waiting for CRM','not yet delegated')""",
    """T_('cool',needs.length,'Not assigned yet',needs.length?'<span style="color:var(--blue)">Take one →</span>':'','data-fav="needs"')""")

# 3) manager's / admin's Home tile: say whose job it is and what to do
rep("""T_('cool',needs.length,'Needs owner','<span style="color:var(--blue)">With CRM →</span>','data-fav="needs"')""",
    """T_('cool',needs.length,lead?'To assign':'Needs owner',needs.length?'<span style="color:var(--blue)">'+(lead?'Give it to someone →':'Assign →')+'</span>':'All assigned ✓','data-fav="needs"')""")

assert html != before and n == 3
out = base64.b64encode(html.encode('utf-8')).decode()
src = src[:m.start(1)] + out + src[m.end(1):]
open(P, 'w', encoding='utf-8', newline='').write(src)
print('patched', n, 'edits; app', len(before), '->', len(html), 'chars; base64', len(b64), '->', len(out))
