/* Test the 21 Nov size gate with the code exactly as it ships in mail-app.html.
   The real block is cut out of the built file and run in a real browser against the same markup
   compose() builds (#cb editor holding a [data-trail] of quoted mails with data: pictures, #cat
   holding attachments, a footer with the Send button), with only the app's helpers stubbed.
   Checks: an oversized mail is NOT sent, the strip says what is big, the "leave the quoted mails
   out" button clears it, and the next click really sends.                                        */
const { chromium } = require('C:/Users/team3pr1/Desktop/Workspace/.tmp/node_modules/playwright-core');
const fs = require('fs');
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = fs.readFileSync('C:/Users/team3pr1/Desktop/Workspace/mail-app.html', 'utf8');

/* the shipped block, verbatim */
const a = APP.indexOf('const WIRE_MAX=21*1024*1024;');
const b = APP.indexOf('opts({});origSend();if(L.innerHTML)NEXT_OPTS=null};', a);
if (a < 0 || b < 0) { console.error('FAILED: the size-gate block was not found in mail-app.html'); process.exit(1); }
const BLOCK = APP.slice(a, b + 'opts({});origSend();if(L.innerHTML)NEXT_OPTS=null};'.length);
console.log('block taken from mail-app.html: ' + BLOCK.length + ' chars');

const PAGE = `<!doctype html><meta charset="utf-8">
<style>
.olwarn{margin:0 14px 10px;padding:8px 10px;border:1px solid #d33;border-radius:8px;font-size:12.5px}
.olwarn ul{margin:4px 0 6px;padding-left:18px}
.olwarn .act{display:flex;gap:8px;flex-wrap:wrap}
.olwarn.bigmail{border-width:2px}
.olwarn .olnote{display:block;margin-top:6px;opacity:.75}
</style>
<div id="layer">
  <div id="cb" contenteditable="true"><div>Dear buyer,</div><div>Please see below.</div>
    <div data-sig="1">Regards</div>
    <div data-trail="1"><div data-qm="1">__Q1__</div><div data-qm="0">__Q0__</div></div>
  </div>
  <label><input type="checkbox" id="ctr" checked> Include trail</label>
  <input type="file" id="cat">
  <footer><button data-dr>Save draft</button><button data-send>Send</button></footer>
</div>
<script>
window.TOASTS = []; window.SENT = 0;
function toast(x){ TOASTS.push(String(x)) }
function fsize(n){ return n < 1024 ? n+' B' : n < 1048576 ? (n/1024).toFixed(1)+' KB' : (n/1048576).toFixed(1)+' MB' }
function esc(x){ return String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;') }
const L = document.getElementById('layer');
const q = x => L.querySelector(x);
const ed = q('#cb');
const send = q('[data-send]'), foot = send.parentNode;
const MAIL_MAX = 15*1024*1024;
function opts(){}
function origSend(){ window.SENT++ }
let NEXT_OPTS = null;
/* ---- the shipped block ---- */
__BLOCK__
/* ---- /shipped block ---- */
/* the "Include trail" tickbox behaves as it does in the app: unticking lifts the block out */
let trailKeep = '';
document.getElementById('ctr').onchange = function(){
  const box = ed.querySelector('[data-trail]');
  if (this.checked) { if (!box && trailKeep) { ed.insertAdjacentHTML('beforeend', trailKeep); trailKeep=''; } }
  else if (box) { trailKeep = box.outerHTML; box.remove(); }
};
</script>`;

/* a data: picture of roughly the asked-for size, as a pasted screenshot becomes in the body */
function pic(mb) { return 'data:image/png;base64,' + 'A'.repeat(Math.round(mb * 1024 * 1024)); }

(async () => {
  const br = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await br.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });

  const html = PAGE.replace('__BLOCK__', BLOCK)
    .replace('__Q1__', 'On 19 Nov the buyer wrote:<br><img src="' + pic(26) + '"><img src="' + pic(26) + '">')
    .replace('__Q0__', 'On 18 Nov the buyer wrote:<br><img src="' + pic(26) + '">');
  await page.setContent(html, { waitUntil: 'load' });

  const checks = [];
  const ok = (name, cond, got) => checks.push({ name, pass: !!cond, got });

  /* ---------- 1. the mail as it stands is 78 MB: the click must not send ---------- */
  const r1 = await page.evaluate(() => {
    document.querySelector('[data-send]').click();
    const d = document.querySelector('.olwarn.bigmail');
    return { sent: window.SENT, strip: !!d, text: d ? d.innerText : '',
             hasDrop: !!(d && d.querySelector('[data-bigq]')),
             hasFix: !!(d && d.querySelector('[data-bigfix]')),
             bodyStillThere: document.querySelector('#cb').innerText.indexOf('Dear buyer') >= 0 };
  });
  ok('an oversized mail is not sent', r1.sent === 0, 'origSend called ' + r1.sent + ' time(s)');
  ok('a red strip appears in the compose window', r1.strip);
  ok('the strip says the mail is too big', /too big/i.test(r1.text), r1.text.split('\n')[0]);
  ok('it gives the size of the whole mail', /\d+\.\d MB\. One mail can carry/.test(r1.text));
  ok('it names the quoted mails as the weight', /quoted mails under your reply/.test(r1.text));
  ok('it offers to leave the quoted mails out', r1.hasDrop);
  ok('it offers "Let me fix it"', r1.hasFix);
  ok('what was written is still there', r1.bodyStillThere);

  /* ---------- 2. the one-click way out ---------- */
  const r2 = await page.evaluate(() => {
    document.querySelector('[data-bigq]').click();
    return { strip: !!document.querySelector('.olwarn.bigmail'),
             trail: !!document.querySelector('#cb [data-trail]'),
             ticked: document.querySelector('#ctr').checked,
             toast: window.TOASTS[window.TOASTS.length - 1] || '',
             body: document.querySelector('#cb').innerText.indexOf('Dear buyer') >= 0 };
  });
  ok('the strip closes after the one click', !r2.strip);
  ok('the quoted mails are gone from the body', !r2.trail);
  ok('the "Include trail" box is unticked, so it can be put back', r2.ticked === false);
  ok('it says what happened', /quoted mails were left out/i.test(r2.toast), r2.toast);
  ok('your own words are untouched', r2.body);

  /* ---------- 3. now it really sends ---------- */
  const r3 = await page.evaluate(() => { document.querySelector('[data-send]').click(); return window.SENT; });
  ok('the next click sends', r3 === 1, 'origSend called ' + r3 + ' time(s)');

  /* ---------- 4. a normal mail is never in the way ---------- */
  const r4 = await page.evaluate(() => {
    window.SENT = 0;
    document.querySelector('#cb').innerHTML = '<div>Short reply, thank you.</div>';
    document.querySelector('[data-send]').click();
    return { sent: window.SENT, strip: !!document.querySelector('.olwarn.bigmail') };
  });
  ok('an ordinary mail goes straight out', r4.sent === 1 && !r4.strip);

  /* ---------- 5. oversize from pasted pictures, with no trail to drop ---------- */
  const r5 = await page.evaluate(big => {
    window.SENT = 0;
    document.querySelector('#cb').innerHTML = '<div>See the photos</div><img src="' + big + '">';
    document.querySelector('[data-send]').click();
    const d = document.querySelector('.olwarn.bigmail');
    return { sent: window.SENT, strip: !!d, drop: !!(d && d.querySelector('[data-bigq]')), text: d ? d.innerText : '' };
  }, pic(30));
  ok('pasted pictures are caught too', r5.sent === 0 && r5.strip);
  ok('no pointless "drop the quote" button when there is no quote', !r5.drop);
  ok('it says the pictures in your text are the weight', /pasted into your text/.test(r5.text));

  /* ---------- 6. attachments still counted, grown by a third as they really are ---------- */
  const r6 = await page.evaluate(() => {
    window.SENT = 0;
    document.querySelector('#cb').innerHTML = '<div>File attached</div>';
    const inp = document.querySelector('#cat');
    inp._olk = [{ name: 'big.pdf', size: 17 * 1024 * 1024, type: 'application/pdf' }];
    document.querySelector('[data-send]').click();
    const d = document.querySelector('.olwarn.bigmail');
    return { sent: window.SENT, text: d ? d.innerText : '', toast: window.TOASTS[window.TOASTS.length-1] || '' };
  });
  ok('a 17 MB file is refused (it is 22.7 MB on the wire)', r6.sent === 0,
     'toast: ' + r6.toast.slice(0, 80));

  /* ---------- 7. the allowance people already have must still work ---------- */
  const r7 = await page.evaluate(() => {
    const out = {};
    const inp = document.querySelector('#cat');
    for (const mb of [1, 8, 14, 15]) {
      window.SENT = 0;
      const old = document.querySelector('.olwarn.bigmail'); if (old) old.remove();
      document.querySelector('#cb').innerHTML = '<div>Please find the file attached, thank you.</div>';
      inp._olk = [{ name: 'quote.pdf', size: Math.round(mb * 1024 * 1024), type: 'application/pdf' }];
      document.querySelector('[data-send]').click();
      out[mb + ' MB'] = window.SENT === 1 && !document.querySelector('.olwarn.bigmail');
    }
    inp._olk = [];
    return out;
  });
  for (const k of Object.keys(r7)) ok('a ' + k + ' attachment still goes out', r7[k]);

  await br.close();

  let bad = 0;
  for (const c of checks) { if (!c.pass) bad++; console.log((c.pass ? 'ok   ' : 'FAIL ') + c.name + (c.got ? '  [' + c.got + ']' : '')); }
  console.log('\npage errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  console.log(checks.length - bad + ' of ' + checks.length + ' checks passed');
  process.exit(bad || errs.length ? 1 : 0);
})().catch(e => { console.error('FAILED ' + String(e.message).split('\n')[0]); process.exit(1); });
