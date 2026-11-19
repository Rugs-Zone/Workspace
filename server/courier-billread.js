/* ---- courier bill reader without AI: reads the PDF / Excel text in the browser and finds OUR tracking numbers in it ---- */
const loadLib=(src,glob)=>new Promise((res,rej)=>{if(window[glob])return res(window[glob]);const s=document.createElement('script');s.src=src;s.onload=()=>window[glob]?res(window[glob]):rej(new Error('The file reader did not start.'));s.onerror=()=>rej(new Error('The file reader could not be loaded. Check the internet connection.'));document.head.appendChild(s)});
async function billLines(file){const nmf=(file.name||'').toLowerCase();
  if(/\.(xlsx|xls|csv)$/.test(nmf)||/spreadsheet|excel|csv/.test(file.type||'')){const X=await loadLib('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js','XLSX');
    const wb=X.read(await file.arrayBuffer(),{type:'array'}),out=[];wb.SheetNames.forEach(n=>X.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:false,defval:''}).forEach(r=>{const c=r.map(v=>String(v).trim());if(c.some(Boolean))out.push({cells:c,text:c.join('  ')})}));return {kind:'sheet',lines:out}}
  if(file.type==='application/pdf'||/\.pdf$/.test(nmf)){const P='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';const L=await loadLib(P+'pdf.min.js','pdfjsLib');L.GlobalWorkerOptions.workerSrc=P+'pdf.worker.min.js';
    const pdf=await L.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,out=[];
    for(let p=1;p<=pdf.numPages;p++){const tc=await (await pdf.getPage(p)).getTextContent(),rows={};
      tc.items.forEach(it=>{const s=(it.str||'').trim();if(!s)return;const y=Math.round(it.transform[5]/4);(rows[y]=rows[y]||[]).push({x:it.transform[4],s})});
      Object.keys(rows).map(Number).sort((a,b)=>b-a).forEach(y=>{const c=rows[y].sort((a,b)=>a.x-b.x).map(i=>i.s);out.push({cells:c,text:c.join('  ')})})}
    return {kind:'pdf',lines:out}}
  return null}
/* a tracking no. counts only as a whole word; spaces/dashes inside it are joined within one column, or across a few number-only columns */
const hasAwb=(l,key)=>{const b=s=>('|'+String(s).toUpperCase().replace(/[^A-Z0-9]+/g,'|')+'|').includes('|'+key+'|'),j=s=>String(s).replace(/(\d)[\s-]+(?=\d)/g,'$1'),c=l.cells||[];
  if(b(l.text)||c.some(x=>b(j(x))))return true;
  for(let i=0;i<c.length;i++){let s='';for(let k=i;k<Math.min(c.length,i+4)&&/^[\d\s-]+$/.test(c[k]);k++){s+=c[k].replace(/[\s-]/g,'');if(s===key)return true}}return false};
const numsIn=s=>(String(s).match(/\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)||[]).map(v=>+v.replace(/,/g,''));
function billPick(lines,kind){
  let H=null;if(kind==='sheet'){const hi=lines.findIndex(l=>l.cells.some(c=>/weight|\bwt\b|\bkg/i.test(c))&&l.cells.some(c=>/amount|total|charge|freight|value/i.test(c)));
    if(hi>=0){const h=lines[hi].cells,f=re=>h.findIndex(c=>re.test(c));const pre=f(/before\s*(gst|tax)|taxable|net\s*amount|sub\s*total/i);H={w:f(/charge?able\s*w|billed\s*w|weight|\bwt\b|\bkg/i),a:pre>=0?pre:f(/total|amount|charge|freight|value/i),d:f(/dim|size|l\s*x\s*w/i),p:f(/pcs|pieces|packages|no\.?\s*of\s*(box|pk)/i)}}}
  const keys=ACC.inv.filter(i=>i.tracking_no&&awbKey(i.tracking_no).length>=6).map(i=>({inv:i,key:awbKey(i.tracking_no)})),found=[];
  keys.forEach(k=>{const ls=lines.filter(l=>hasAwb(l,k.key));if(!ls.length)return;
    const rows=ls.map(l=>{const c=l.cells;let w=null,a=null,d='',p=null;
      if(H){const g=i=>i>=0?c[i]:'';w=numsIn(g(H.w))[0]??null;a=numsIn(g(H.a))[0]??null;d=g(H.d)||'';p=numsIn(g(H.p))[0]??null}
      const txt=l.text.replace(new RegExp(k.key.split('').join('[\\s-]*'),'i'),' ');
      if(w==null){const m=txt.match(/(\d+(?:\.\d+)?)\s*kgs?\b/i);if(m)w=+m[1]}
      if(!d){const m=txt.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/i);if(m)d=m[1]+'x'+m[2]+'x'+m[3]}
      if(a==null){const n=(txt.match(/\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+\.\d{2}\b/g)||[]).map(v=>+v.replace(/,/g,''));if(n.length)a=n[n.length-1]}
      return {w,a,d,p,text:l.text,duty:/duty|disburse|import\s*tax|customs/i.test(l.text)}});
    const best=rows.find(r=>r.a!=null)||rows[0];found.push(Object.assign({inv:k.inv,key:k.key},best))});
  return found}
async function billUpload(file){
  if(file.size>6*1024*1024){toast('File is larger than 6 MB');return}
  $('aiOut').innerHTML='<p class="note">Reading the bill and looking for our tracking numbers...</p>';
  let rd;try{rd=await billLines(file)}catch(e){$('aiOut').innerHTML=fail('Could not read this file: '+((e&&e.message)||e));return}
  if(!rd){$('aiOut').innerHTML=fail('A photo of a bill cannot be read without AI. Upload the courier\'s PDF or Excel bill, or use "Add bill line by hand".');return}
  if(!rd.lines.length){$('aiOut').innerHTML=fail('This file has no readable text (it may be a scanned picture). Upload the courier\'s PDF or Excel bill, or use "Add bill line by hand".');return}
  const all=rd.lines.map(l=>l.text).join('\n'),sh=billPick(rd.lines,rd.kind);
  if(!sh.length){$('aiOut').innerHTML=fail('None of our invoice tracking numbers was found in this bill. Check that the tracking numbers are entered on the invoices, or use "Add bill line by hand".');return}
  const cr=(all.match(/fedex|dhl|apex|anjani|shivay|aramex|blue\s*dart|dtdc/i)||[''])[0],bn=((all.match(/(?:invoice|bill)\s*(?:no|number|#)\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\/-]{3,})/i)||[])[1])||'';
  $('aiOut').innerHTML='';
  const kgCell=(s,bk)=>{const c=compare(s.inv),ok=c.dc.rw&&bk?up05(bk)<=c.dc.rw:null;return {html:(ok===false?'&#10007; ':ok?'&#10003; ':'')+(c.dc.rw||'-')+' kg'+(ok===false?' (bill '+up05(bk)+' kg)':''),st:ok===false?'background:#FDECEC;color:#B42318;font-weight:700':ok?'background:#ECFDF3;color:#0B6B3A;font-weight:700':''}};
  setTimeout(()=>document.querySelectorAll('[data-buw]').forEach(el=>el.oninput=()=>{const i=+el.dataset.buw,k=kgCell(sh[i],nm(el.value)),td=document.querySelector('[data-buk="'+i+'"]');if(td){td.style.cssText=k.st;td.innerHTML=k.html}}),50);
  const okd=await ask('Check the bill lines',`<p class="note" style="margin:0 0 8px">Found <b>${sh.length}</b> of our tracking number(s) in this bill. Weight, size and amount were picked from the same line - check them and correct any that are wrong before saving.</p>
   <div class="grid" style="margin-bottom:8px"><div><label class="lbl">Courier</label><input id="bu_c" value="${esc(cr)}" placeholder="FedEx / Apex"></div><div><label class="lbl">Bill no.</label><input id="bu_n" value="${esc(bn)}"></div><div><label class="lbl">Bill date</label><input id="bu_d" type="date"></div></div>
   <div class="tbl" style="max-height:340px;overflow:auto"><table><thead><tr><th></th><th>Tracking</th><th>Matching invoice</th><th>Billed kg</th><th>Invoice kg</th><th>Size cm</th><th>Amount before GST</th><th>Type</th></tr></thead><tbody>${sh.map((s,i)=>{const k=kgCell(s,s.w);return `<tr><td><input type="checkbox" data-bu="${i}" checked></td><td>${esc(s.inv.tracking_no)}<br><span class="note" title="${esc(s.text)}">${esc(s.text.slice(0,70))}${s.text.length>70?'…':''}</span></td><td style="background:#ECFDF3;color:#0B6B3A;font-weight:700">&#10003; ${esc(s.inv.inv_no)}<br><span class="note">${esc(buyerName(s.inv))}</span></td><td><input data-buw="${i}" value="${s.w??''}" inputmode="decimal" style="width:70px"></td><td data-buk="${i}" style="${k.st}">${k.html}</td><td><input data-bud="${i}" value="${esc(s.d||'')}" style="width:100px" placeholder="60x40x40"></td><td><input data-bua="${i}" value="${s.a??''}" inputmode="decimal" style="width:90px"></td><td><select data-but="${i}"><option value="freight">Freight</option><option value="duty" ${s.duty?'selected':''}>Duty &amp; taxes</option></select></td></tr>`}).join('')}</tbody></table></div>`,'Save these');
  if(!okd)return;
  const q=(a,i)=>{const el=document.querySelector('['+a+'="'+i+'"]');return el?el.value:''};
  const rows=sh.map((s,i)=>{const cb=document.querySelector('[data-bu="'+i+'"]');if(cb&&!cb.checked)return null;return {awb:s.inv.tracking_no,courier:($('bu_c')||{}).value||'',bill_no:($('bu_n')||{}).value||'',bill_date:($('bu_d')||{}).value||null,billed_weight:q('data-buw',i),billed_dims:q('data-bud',i),pieces:s.p,amount:q('data-bua',i),currency:'INR',destination:'',ai:false,kind:q('data-but',i)||'freight'}}).filter(Boolean);
  if(!rows.length){toast('Nothing ticked to save');return}
  const r=await api('cd_bill_save',{p_rows:rows,p_file:{name:file.name,mime:file.type||'application/octet-stream',data:await fileB64(file)}});
  if(r.ok){toast(r.saved+' bill line(s) saved');AFTER.acct()}else toast(r.error)}
