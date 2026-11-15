# 16 Nov 2026 — keep the Home numbers equal to what the person can actually open.
# Home counted every mail in the team; with the new rule a member can only open their own and the
# unassigned ones, so their tiles would show a bigger number than the list behind it.
# seeMine() always returns true for a manager / CRM / admin, so their Home does not change.
import base64, re

P = 'index.html'
src = open(P, encoding='utf-8', newline='').read()
m = re.search(r'var EMAIL_HTML_B64 = "([A-Za-z0-9+/=]+)"', src)
b64 = m.group(1)
raw = base64.b64decode(b64)
assert base64.b64encode(raw).decode() == b64, 'base64 round-trip differs - aborting'
html = raw.decode('utf-8')

a = """ const scope=admin?DEPTS.map(d=>d.id):[me.dept],inS=t=>scope.includes(t.dept),D0=dept(me.dept);"""
b = """ const scope=admin?DEPTS.map(d=>d.id):[me.dept],inS=t=>scope.includes(t.dept)&&seeMine(t),D0=dept(me.dept);"""
assert html.count(a) == 1, html.count(a)
html = html.replace(a, b)

out = base64.b64encode(html.encode('utf-8')).decode()
open(P, 'w', encoding='utf-8', newline='').write(src[:m.start(1)] + out + src[m.end(1):])
print('ok')
