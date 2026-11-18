# patch-pictures.py — STEP 2: who may show pictures straight from the internet
# (18 Nov 2026). Works on the decoded Email module (.tmp/email.html).
#
# 1. picsOk is rewritten: pictures show by themselves for our own mail and
#    colleagues (isInternal / m.by), for senders in picSenders ("always show
#    from this sender"), and for ANY address we have replied to or written to
#    (new knownTo()). Everyone else keeps the "Show pictures" bar. Junk and
#    spoof-flagged mail always keep the bar; pressing "Show pictures" on a
#    mail always wins.
# 2. My profile gets an admin-only switch "Show pictures from every sender"
#    (prefs.picsAll), and the older "ask me first" note is reworded to match
#    the new default.
# 3. fixImg clears display:none when it recovers a picture — without this a
#    logo or signature banner was fetched successfully and then stayed
#    invisible, because fixMailImgs injects onerror="this.style.display='none'"
#    into every <img> of the full mail.
# Nothing is deployed and no server file is touched.
import io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(HERE, "..", ".tmp", "email.html")
src = io.open(P, encoding="utf-8", newline="").read()
orig = src

if "prPicsAll" in src:
    print("Already patched — nothing to do.")
    sys.exit(0)

# ------------------------------------------------- 1. the picture rule itself
start = "const askPics=()=>!!(S.prefs&&S.prefs.askPics);"
endmark = "// everyone else: shown, unless the person asked to be asked"
i = src.find(start)
j = src.find(endmark)
assert i != -1 and j > i, "picsOk override block not found"
j = src.index("\n", j)                      # end of that comment line
old_block = src[i:j]
assert old_block.count("picsOk=function") == 1, "unexpected picsOk override"

new_block = """const askPics=()=>!!(S.prefs&&S.prefs.askPics);
const picsAll=()=>!!(S.prefs&&S.prefs.picsAll);          // "show pictures from every sender" switch
/* Every address WE have written to: the other side of any conversation we
   replied in, plus the To and Cc of our own mails. Built at most once a
   minute, because it walks every loaded conversation. */
let _kt=null,_ktAt=0;
function knownTo(){
 if(_kt&&Date.now()-_ktAt<6e4)return _kt;
 const s=new Set();
 (S.threads||[]).forEach(t=>{
  if(!(t.msgs||[]).some(m=>m.by||m.ours))return;          // we never wrote in this conversation
  if(t.email)s.add(String(t.email).toLowerCase());
  (t.msgs||[]).forEach(m=>{if(!(m.by||m.ours))return;
   const hit=(String(m.to||'')+','+String(m.cc||'')).toLowerCase().match(/[\\w.+-]+@[\\w.-]+\\.\\w{2,}/g);
   if(hit)hit.forEach(a=>s.add(a))})});
 _kt=s;_ktAt=Date.now();return _kt}
/* Who may show pictures straight from the internet:
     - "Show pictures" pressed on this mail                  -> always
     - Junk, or a spoof / phishing warning                   -> never, bar stays
     - our own mail, a colleague, or a sender you allowed     -> yes (_pkB)
     - this person ticked "ask me first"                      -> bar for outsiders
     - anyone we have replied to or written to                -> yes
     - everyone else -> the bar, unless "show pictures from every sender" is on
   Pasted cid: pictures (a logo inside a signature) are turned into data: URLs
   by the server and PIC_CSP allows data:, so those show either way. */
const _pkB=picsOk;picsOk=function(m){
 if(m&&m.showPics)return true;
 const t=typeof openId!=='undefined'&&openId?T_(openId):null;
 if(t&&t.folder==='junk')return false;
 try{if(spoofCheck(m).length)return false}catch(e){}
 if(_pkB(m))return true;
 if(askPics())return false;
 if(knownTo().has(String((m&&m.email)||'').toLowerCase()))return true;
 return picsAll()}"""
src = src[:i] + new_block + src[j:]

# --------------------------------------- 2a. reword the existing "ask" note
old_note = ("Off: every mail shows exactly as received, with logos and pictures. "
            "On: pictures from outside senders wait until you press ")
new_note = ("Pictures already show from colleagues, from anyone we have written to, and from "
            "senders you allowed. On: even those wait until you press ")
assert src.count(old_note) == 1, "profile picture note not found"
src = src.replace(old_note, new_note)

# ------------------------------- 2b. admin-only "every sender" switch below it
tail = "if(openId)renderRead()}}}catch(e){}return r};"
assert src.count(tail) == 1, "profileDlg tail not unique"
admin_sw = (
 "if(openId)renderRead()}}\n"
 " if(b&&who(ME)?.role==='Admin'&&!b.querySelector('#prPicsAll')){"
 "b.insertAdjacentHTML('beforeend','<div class=\"fld\"><label class=\"chk\" style=\"display:flex;gap:8px;"
 "align-items:flex-start;cursor:pointer;font-weight:400\"><input type=\"checkbox\" id=\"prPicsAll\" '"
 "+(picsAll()?'checked':'')+' style=\"margin-top:3px\"><span><b style=\"font-weight:600\">Show pictures from "
 "every sender</b><br><small style=\"color:var(--muted)\">Pictures normally show from colleagues and from "
 "anyone we have written to; a brand-new outside sender gets the \\u201cShow pictures\\u201d bar instead. "
 "Switch this on to show pictures from all senders. Junk and suspicious mail still ask. This applies to "
 "your own screen.</small></span></label></div>');"
 "b.querySelector('#prPicsAll').onchange=e=>{const v=e.target.checked;S.prefs={...S.prefs,picsAll:v};"
 "api('savePrefs',{prefs:{picsAll:v}}).then(()=>toast(v?'Pictures will show from every sender'"
 ":'Pictures show from colleagues and people we write to')).catch(x=>toast('Not saved: '+x.message));"
 "if(openId){renderRead();fitFrames()}}}\n"
 "}catch(e){}return r};")
src = src.replace(tail, admin_sw)

# ------------------------- 3. a recovered picture must become visible again
old_fix = ".then(d=>{if(!d)throw 0;i.src=d;i.removeAttribute('srcset')})"
new_fix = ".then(d=>{if(!d)throw 0;i.src=d;i.removeAttribute('srcset');i.style.removeProperty('display')})"
assert src.count(old_fix) == 1, "fixImg success branch not found"
src = src.replace(old_fix, new_fix)

assert src != orig
io.open(P, "w", encoding="utf-8", newline="").write(src)
print("Patched .tmp/email.html: %+d characters" % (len(src) - len(orig)))
