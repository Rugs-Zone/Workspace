// Courier Team accounts: "Upload courier bill" without Gemini.
// Reads the PDF (pdf.js) or Excel/CSV (SheetJS) text in the browser and finds OUR invoices' tracking numbers in it.
// Source of the new code: server/courier-billread.js. Run from the Workspace folder: node server/patch-courier-bill-noai.js
const fs=require('fs'),path=require('path');
const NEW=fs.readFileSync(path.join(__dirname,'courier-billread.js'),'utf8').trim();
function patch(t,label){
  // replace from the reader's own start marker if it is already in (re-run safe), else from the old billUpload
  const mk=t.indexOf('/* ---- courier bill reader without AI'),a=mk>=0?mk:t.indexOf('async function billUpload(file){'),b=t.indexOf('async function billManual(){');
  if(a<0||b<0||b<a)throw new Error(label+': billUpload / billManual not found');
  if(t.split('async function billUpload(file){').length!==2)throw new Error(label+': billUpload not found exactly once');
  t=t.slice(0,a)+NEW+'\n'+t.slice(b);
  const acc='<input type="file" id="billF" accept="application/pdf,image/png,image/jpeg,image/webp" hidden>';
  if(t.includes(acc))t=t.replace(acc,()=>'<input type="file" id="billF" accept="application/pdf,.pdf,.xlsx,.xls,.csv" hidden>');
  if(!t.includes('accept="application/pdf,.pdf,.xlsx,.xls,.csv"'))throw new Error(label+': file input not found');
  return t;
}
let idx=fs.readFileSync('index.html','utf8');
const re=/(COURIER_HTML_B64\s*=\s*["'`])([A-Za-z0-9+\/=]+)/;const m=idx.match(re);
const live=Buffer.from(m[2],'base64').toString('utf8');
if(Buffer.from(live,'utf8').toString('base64')!==m[2])throw new Error('base64 does not round-trip');
const nl=patch(live,'index.html');fs.writeFileSync('.tmp/courier-patched.html',nl);
fs.writeFileSync('index.html',idx.replace(re,(_,p)=>p+Buffer.from(nl,'utf8').toString('base64')));
fs.writeFileSync('courier_dashboard.html',patch(fs.readFileSync('courier_dashboard.html','utf8'),'courier_dashboard.html'));
console.log('patched both');
