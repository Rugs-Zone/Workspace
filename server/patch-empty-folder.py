# patch-empty-folder.py — STEP 6: "Empty Junk" / "Empty Deleted" (18 Nov 2026).
# Works on the decoded Email module (.tmp/email.html).
#
# Checked first:
#  - patch-forward-keeps-files.py IS already applied (origAtts, the "Files on
#    the original mail" box, the data-oatt tickboxes and pull() -> addFiles()
#    are all in the module), so forwarding does carry the original files.
#    Nothing to do there.
#  - "Empty Junk" / "Empty Deleted" was missing everywhere: not in the module,
#    not in server/rugs-email-outlook-pack.js, not in mail-v2.js. Added here.
#
# How it behaves (no server change, using only mechanics the app already has):
#   Empty Junk    -> every conversation in that mailbox's Junk goes to Deleted,
#                    which is exactly what the per-mail Delete does.
#   Empty Deleted -> they leave Rugs Email's folders (folder 'purged') and are
#                    marked done + read. The Gmail copies are untouched: Delete
#                    already put them in Gmail Trash, which Google clears after
#                    30 days. The meta save keeps any folder string, so this
#                    needs nothing new on the server.
#   Both ask first, show the count, and offer 10 seconds of Undo.
#   Only someone with the delete right sees the buttons.
import io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(HERE, "..", ".tmp", "email.html")
src = io.open(P, encoding="utf-8", newline="").read()
orig = src

if "function emptyFolder(" in src:
    print("Already patched — nothing to do.")
    sys.exit(0)

anchor = "const _rrE=renderRead;renderRead=function(){const r=_rrE.apply(this,arguments);try{olkExtras()}catch(e){console.log('olkExtras',e)}return r};"
assert src.count(anchor) == 1, "STEP 4 wrapper not found"

block = r"""
/* ---------- STEP 6 (18 Nov 2026): Empty Junk / Empty Deleted ----------
   Outlook has it on the folder itself, so the button sits on the Junk and
   Deleted rows of the folder pane (same look as the delete button on a
   personal folder). Only someone allowed to delete mail sees it.
     Junk    -> everything moves to Deleted, exactly like the per-mail Delete.
     Deleted -> everything leaves Rugs Email's folders (folder 'purged') and is
                marked done and read. The mail itself is NOT destroyed: Delete
                already moved the Gmail copy to Gmail Trash and Google clears
                that after 30 days, so this empties our view, not the mailbox.
   Both ask first and give 10 seconds of Undo. */
function emptyFolder(boxId,f){
 const list=S.threads.filter(t=>t.dept===boxId&&t.folder===f);
 if(!list.length){toast(f==='junk'?'Junk is already empty':'Deleted is already empty');return}
 const name=f==='junk'?'Junk':'Deleted';
 const n=list.length;
 const what=f==='junk'
  ? '<p style="margin:0 0 8px">Move <b>'+n+' conversation'+(n>1?'s':'')+'</b> out of '+name+' into Deleted?</p>'
    +'<p class="lead" style="margin:0">That is the same as pressing Delete on each one. The originals stay in the company mailbox.</p>'
  : '<p style="margin:0 0 8px">Empty <b>'+name+'</b> — '+n+' conversation'+(n>1?'s':'')+'?</p>'
    +'<p class="lead" style="margin:0">They leave Rugs Email and stop counting as work. The mail itself is already in Gmail Trash, which Google clears after 30 days, so nothing is destroyed here.</p>';
 const L=dlg('\u{1f5d1} Empty '+name,what,
  '<button class="btn" data-c>Cancel</button><button class="btn pri" data-ok>Empty '+name+'</button>');
 L.querySelector('[data-c]').onclick=()=>{L.innerHTML=''};
 L.querySelector('[data-ok]').onclick=()=>{
  L.innerHTML='';
  const back=list.map(t=>({t,folder:t.folder,prev:t.prev,status:t.status,unread:t.unread}));
  list.forEach(t=>{
   t.prev=t.folder;
   if(f==='junk'){t.folder='deleted'}
   else{t.folder='purged';t.status='done';t.unread=false}
   hist(t,'n',(f==='junk'?'Moved to Deleted by ':'Removed from Rugs Email by ')+who(ME).name+' (emptied '+name+')')});
  if(openId&&list.some(t=>t.id===openId))openId=null;
  save();render();
  undoToast(name+' emptied · '+n+' conversation'+(n>1?'s':''),()=>{
   back.forEach(b=>{b.t.folder=b.folder;b.t.prev=b.prev;b.t.status=b.status;b.t.unread=b.unread});
   save();render()})}}
/* the button on the Junk and Deleted rows, added after the pane is drawn */
function emptyBtns(){
 if(!can('delete'))return;
 document.querySelectorAll('#folders .fi[data-f="junk"],#folders .fi[data-f="deleted"]').forEach(row=>{
  if(row.dataset.emptyOn)return;
  const boxId=row.dataset.box,f=row.dataset.f;
  if(!boxId)return;
  const n=S.threads.filter(t=>t.dept===boxId&&t.folder===f).length;
  row.dataset.emptyOn='1';
  if(!n)return;
  const name=f==='junk'?'Junk':'Deleted';
  let w=row.parentElement;
  if(!w||!w.classList.contains('fiw')){
   w=document.createElement('div');w.className='fiw';
   row.parentNode.insertBefore(w,row);w.appendChild(row)}
  w.insertAdjacentHTML('beforeend','<button class="fdel" data-empty="'+f+'" data-ebox="'+esc(boxId)+'" title="Empty '+name+' ('+n+')" aria-label="Empty '+name+', '+n+' conversations">\u{1f5d1}</button>')})}
const _rfE=renderFolders;renderFolders=function(){const r=_rfE.apply(this,arguments);try{emptyBtns()}catch(e){console.log('emptyBtns',e)}return r};
document.addEventListener('click',e=>{const b=e.target.closest('[data-empty]');if(!b)return;
 e.preventDefault();e.stopPropagation();emptyFolder(b.dataset.ebox,b.dataset.empty)},true);"""

src = src.replace(anchor, anchor + block)
assert src != orig
io.open(P, "w", encoding="utf-8", newline="").write(src)
print("Patched .tmp/email.html: %+d characters" % (len(src) - len(orig)))
