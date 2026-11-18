# patch-fullmail.py — STEP 1: "full mail not showing" in Rugs Email (18 Nov 2026)
#
# Works on the decoded Email module (.tmp/email.html). Seven targeted edits:
#   1. fitFrames: drop the 6000px iframe cap that cut long mails off
#   2. reading pane: a "Loading the full mail..." bar, and on failure a
#      PERMANENT bar with Retry (a toast used to vanish after 3.5 s)
#   3. the delegated click handler learns [data-fullretry]
#   4. that Retry button's handler
#   5. Reply / Reply all / Forward / Forward-as-attachment wait for the full
#      mail, so they never quote the 1500-character preview
#   6. liveOpen rewritten: one load at a time, 45-second limit, one automatic
#      retry, t.full only when every message really arrived, session cache
#   7. mapRow falls back to that session cache, so a list refresh can never
#      drop a loaded mail back to the preview
# Nothing is deployed and no server file is touched.
import io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(HERE, "..", ".tmp", "email.html")
src = io.open(P, encoding="utf-8", newline="").read()
orig = src

if "data-fullretry" in src:
    print("Already patched — nothing to do.")
    sys.exit(0)

def one(anchor, new, what):
    global src
    assert src.count(anchor) == 1, "anchor not unique: " + what
    src = src.replace(anchor, new)

# ---------------------------------------------------------------- 1. 6000px cap
one("f.style.height=Math.min(Math.max(h+2,40),6000)+'px';",
    "f.style.height=Math.max(h+2,40)+'px';",   # no cap: a long mail is shown whole
    "fitFrames cap")

# ------------------------------------------------- 2. loading / failure bar
bar = """
 ${(()=>{const L=LD[t.id]||{};if(t._local||t.full)return '';
  return L.err
   ?`<div class="promise late"><span>${ico('clock')}</span><b>Only the short preview is shown<br><span class="sub">${esc(L.err)}</span></b><button class="btn" data-fullretry="${t.id}">\\u21bb Retry</button></div>`
   :`<div class="promise"><span>${ico('clock')}</span><b>Loading the full mail\\u2026<br><span class="sub">The short preview is shown until the original arrives from Gmail.</span></b></div>`})()}"""
one('\n <div class="rbody">\n',
    '\n <div class="rbody">' + bar + '\n',
    "rbody open")

# --------------------------------------------- 3. click handler knows the button
one("#bell,#meBtn');if(!b)return;const d=b.dataset;",
    "#bell,#meBtn,[data-fullretry]');if(!b)return;const d=b.dataset;",
    "click selector")

# ------------------------------------- 4+5. Retry, and reply/forward wait
old_rf = (" if(d.reply){compose({t:T_(d.reply),all:'all'in d});return}\n"
          " if(d.fwd){compose({t:T_(d.fwd),fwd:true});return}\n"
          " if(d.fwdatt){fwdAsAtt(T_(d.fwdatt));return}")
new_rf = (" if(d.fullretry){const _t=T_(d.fullretry);if(_t){const L=ld(_t);L.err='';L.gave=false;liveOpen(_t,{force:true})}return}\n"
          " if(d.reply){const _t=T_(d.reply),_all=('all'in d);withFull(_t,()=>compose({t:_t,all:_all}));return}\n"
          " if(d.fwd){const _t=T_(d.fwd);withFull(_t,()=>compose({t:_t,fwd:true}));return}\n"
          " if(d.fwdatt){const _t=T_(d.fwdatt);withFull(_t,()=>fwdAsAtt(_t));return}")
one(old_rf, new_rf, "reply/forward handlers")

# ----------------------------------------------------------- 6. liveOpen
old_live = """async function liveOpen(t){if(t.full||t._local)return;try{const r=await api('thread',{mailbox:t.box,threadId:gidOf(t)});
 r.messages.forEach(m=>{const x=t.msgs.find(y=>y.gid===m.gmail_id);if(!x)return;x.raw=fixMailImgs(m.body_html||'');x.body=(m.body_text||x.body||'').trim();x.full=true;if(!x.ours)x.sig=sigFromText(m.body_text)});
 t.full=true;if(openId===t.id&&!(document.activeElement&&document.activeElement.id==='qr'))renderRead()}catch(e){toast('Could not open: '+e.message)}}"""

new_live = """/* ---------- opening a mail: the full original comes live from Gmail ----------
   The mail list only carries a 1500-character preview (the server trims
   body_text in its list query), so the whole mail is fetched by api('thread')
   the moment a conversation is opened. What used to leave a mail stuck on that
   preview, and what is done about it now:
     - the error was swallowed into a toast that disappeared after 3.5 seconds
       -> a PERMANENT bar in the reading pane with a Retry button
     - api() has no timeout, so a hung request waited for ever with nothing on
       screen -> 45-second limit, plus ONE automatic retry
     - nothing said the mail was still loading -> "Loading the full mail..." bar
     - t.full was set even when Gmail had not returned every message, and the
       guard at the top then blocked any further attempt -> t.full is set only
       when every message really arrived
     - the redraw was SKIPPED while the quick reply box had focus, so the full
       mail never appeared while typing -> redrawRead() keeps the typed text
       and the caret instead
     - a list refresh could drop the loaded mail back to the preview -> what
       loaded is kept for the whole session in RAWC, keyed by Gmail message id
   Loading state lives in LD (keyed by thread id), never on the thread object,
   so it is never written into the device copy or the browser cache. */
const RAWC={},LD={};
const ld=t=>LD[t.id]||(LD[t.id]={});
const _tmo=(p,ms,msg)=>Promise.race([p,new Promise((_,rj)=>setTimeout(()=>rj(new Error(msg)),ms))]);
function redrawRead(t){
 if(!t||openId!==t.id)return;
 const q=document.activeElement&&document.activeElement.id==='qr'?document.activeElement:null;
 const v=q?q.value:null,ss=q?q.selectionStart:0,se=q?q.selectionEnd:0;
 renderRead();
 if(v!=null){const n=$('#qr');if(n){n.value=v;n.focus();try{n.setSelectionRange(ss,se)}catch(e){}}}
}
function liveOpen(t,o){
 o=o||{};
 if(!t||t._local||t.full)return Promise.resolve(true);
 const L=ld(t);
 if(L.p)return L.p;                      // one load per conversation at a time
 if(L.gave&&!o.force)return Promise.resolve(false);
 L.err='';L.busy=true;
 redrawRead(t);
 const run=async()=>{
  let last='';
  for(let i=0;i<2;i++){                  // first go, then one automatic retry
   try{
    const r=await _tmo(api('thread',{mailbox:t.box,threadId:gidOf(t)}),45000,'Gmail took too long to send the mail');
    (r.messages||[]).forEach(m=>{const x=t.msgs.find(y=>y.gid===m.gmail_id);if(!x)return;
     x.raw=fixMailImgs(m.body_html||'');x.body=(m.body_text||x.body||'').trim();x.full=true;
     if(!x.ours)x.sig=sigFromText(m.body_text);
     RAWC[m.gmail_id]={raw:x.raw,body:x.body,full:true}});
    const all=t.msgs.every(x=>x.full);
    t.full=all;
    L.err=all?'':'Gmail did not send back every mail in this conversation.';
    return all;
   }catch(e){last=e.message||'Could not load the mail';if(i===0)await new Promise(z=>setTimeout(z,1200))}
  }
  L.err=last;return false;
 };
 L.p=run().then(ok=>{L.busy=false;L.p=null;if(!ok)L.gave=true;redrawRead(t);return ok})
  .catch(e=>{L.busy=false;L.p=null;L.gave=true;L.err=e.message||'Could not load the mail';redrawRead(t);return false});
 return L.p;
}
/* Reply, Reply all, Forward and Forward-as-attachment quote the mail itself, so
   they wait for the full original instead of quoting the short preview. */
function withFull(t,fn){
 if(!t||t.full||t._local)return fn();
 toast('Getting the full mail first\\u2026');
 liveOpen(t,{force:true}).then(ok=>{if(ok)fn();
  else toast('The full mail has not arrived yet \\u2014 press Retry at the top of the mail',true)})
}"""
one(old_live, new_live, "liveOpen")

# ------------------------------------------------- 7. session cache in mapRow
one("prev=old?.msgs.find(x=>x.gid===m.gmail_id);",
    "prev=old?.msgs.find(x=>x.gid===m.gmail_id)||RAWC[m.gmail_id];",
    "mapRow prev lookup")

assert src != orig
io.open(P, "w", encoding="utf-8", newline="").write(src)
print("Patched .tmp/email.html: %+d characters" % (len(src) - len(orig)))
