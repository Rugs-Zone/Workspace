# 16 Nov 2026 - the buyer saw "Priyanshu Tomar a..." instead of the en-dash in our sender name.
# The display name contains an en-dash (not plain ASCII) and the From header was never RFC-2047
# encoded (only Subject and file names were), so every mail we sent showed a broken sender name.
p='server/rugs-mail.index.ts'
s=open(p,encoding='utf-8',newline='').read()
a = """  const fromName = oneLine(`${u.name} \u2013 Rugs Creation`.replace(/"/g, ""));"""
b = """  const fromName = oneLine(`${u.name} \u2013 Rugs Creation`.replace(/"/g, ""));
  // 16 Nov 2026: the name holds an en-dash, which is not plain ASCII. A raw non-ASCII From header
  // reached buyers as "Priyanshu Tomar a?? Rugs Creation", so encode it the same way as the subject.
  const fromHdr = /[^\x20-\x7e]/.test(fromName)
    ? `=?UTF-8?B?${btoa(unescape(encodeURIComponent(fromName)))}?= <${box}>`
    : `"${fromName}" <${box}>`;"""
assert s.count(a)==1, s.count(a)
s=s.replace(a,b)
a2 = """  const raw = mime({ from: `"${fromName}" <${box}>`,"""
b2 = """  const raw = mime({ from: fromHdr,"""
assert s.count(a2)==1, s.count(a2)
s=s.replace(a2,b2)
open(p,'w',encoding='utf-8',newline='').write(s)
print('patched the From header')
