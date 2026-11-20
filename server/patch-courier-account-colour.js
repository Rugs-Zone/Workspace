/* 20 Nov 2026 — Courier tracker: say clearly whose account a shipment is on, and give every
   courier its own colour.
   Before: the only sign that a shipment was on the buyer's own courier account was a small
   "Duty paid : Buyer (A/c no. ...)" line in the corner of the printed invoice, and the courier was
   plain grey text ("Shipped by: FedEx") in the app, on the invoice, in the shipments list and in
   Team accounts - so Apex and Anjani looked the same, and nobody noticed the buyer-account line.
   After: one pair of helpers (crChip / acctChip + acctBand) used in every one of those places.
     · FedEx and ADL FedEx = FedEx purple with its orange edge, DHL = DHL yellow/red,
       Apex = teal, Anjani = amber, anything else = grey.
     · A local invoice with no courier chosen says so and names the Apex / Anjani cheapest rule,
       instead of pretending a courier was picked.
     · Every invoice, courier copy and gate pass carries a coloured band: either
       "COURIER & DUTY ON THE BUYER'S ACCOUNT - A/c No. ..." (red) or "ON OUR ACCOUNT (SELF)" (green).
   Applies to index.html (COURIER_HTML_B64) and the courier_dashboard.html copy.                  */
const fs = require('fs');

/* ---------- the helpers that get inserted into the module ---------- */
const HELPERS = `
/* ---- 20 Nov 2026: courier colours + whose account the shipment is on ---- */
/* Each courier keeps its own colour everywhere it is named, and every invoice says in plain words
   whether the courier bill and the duty are on the BUYER'S courier account or on OURS. A local
   invoice with no courier chosen is priced on the cheaper of Apex / Anjani by the accounts pages,
   so the chip says exactly that instead of naming a courier nobody picked. */
const CRCOL={fdx:['#4D148C','#ffffff','FedEx','#FF6600'],adl:['#4D148C','#ffffff','ADL FedEx','#FF6600'],
 asl:['#5B21B6','#ffffff','ASL (Europe)','#7C3AED'],dhl:['#FFCC00','#C8102E','DHL','#C8102E'],
 apex:['#0E7490','#ffffff','Apex','#0E7490'],anjani:['#B45309','#ffffff','Anjani','#B45309'],
 other:['#EEF0F3','#374151','','#9AA3AF']};
const crCol=k=>CRCOL[k]||CRCOL.other;
/* never trust a row to be complete - one bad invoice must not stop the page (19 Nov lesson) */
const crName=r=>((((r&&r.d)||{}).courier)||{}).name||'';
function crKeyOf(r){try{return courierKey(r)||''}catch(e){return ''}}
function crChip(r,o){o=o||{};const k=o.key!=null?o.key:crKeyOf(r),C=crCol(k);
 const nm0=o.label!=null?o.label:(crName(r)||CRCOL[k]&&CRCOL[k][2]||'');
 const intl=r&&r.ship_type==='International';
 const lbl=nm0||(intl?'Courier not chosen':'Apex / Anjani (cheapest)');
 const sv=((((r&&r.d)||{}).courier)||{}).service||'';
 const sub=o.note!=null?o.note:((!crName(r)&&!intl)?'courier not chosen on the invoice - priced on the cheaper of Apex / Anjani':'');
 return '<span style="display:inline-block;background:'+C[0]+';color:'+C[1]+';border:1.5px solid '+C[3]+';border-radius:4px;padding:2px 8px;font-weight:800;font-size:'+(o.big?'13px':'11.5px')+';letter-spacing:.02em;-webkit-print-color-adjust:exact;print-color-adjust:exact">'+esc(lbl)+'</span>'
  +(o.svc&&sv?' <span class="note">'+esc(sv)+'</span>':'')+(sub?'<br><span class="note">'+esc(sub)+'</span>':'');}
function acctOf(r){const d=(r&&r.d)||{},intl=r&&r.ship_type==='International';
 return {intl:!!intl,onBuyer:!!intl&&d.duty==='Buyer',acct:d.duty_acct||'',expBy:d.expense_by||''}}
function acctChip(r,big){const a=acctOf(r);
 const bg=a.onBuyer?'#FDECEC':'#E8F6EE',fg=a.onBuyer?'#B42318':'#05603A',bd=a.onBuyer?'#D92D20':'#12B76A';
 const t=a.onBuyer?('BUYER&#39;S ACCOUNT'+(a.acct?' &middot; A/c '+esc(a.acct):'')):'OUR ACCOUNT (SELF)';
 const tip=a.onBuyer?'The courier bill and the duty go to the buyer own courier account':'We pay the courier - this is not on the buyer account';
 return '<span title="'+tip+'" style="display:inline-block;background:'+bg+';color:'+fg+';border:1.5px solid '+bd+';border-radius:4px;padding:2px 8px;font-weight:800;font-size:'+(big?'13px':'11.5px')+';-webkit-print-color-adjust:exact;print-color-adjust:exact">'+t+'</span>'}
/* the band printed on the invoice, on every courier copy and on the gate pass */
function acctBand(r){const d=(r&&r.d)||{},a=acctOf(r),k=(d.courier||{}).name?'':'';
 const showCr=FMT.show_courier!==false&&d.courier&&d.courier.name;
 const bg=a.onBuyer?'#FDECEC':'#F1FAF4',fg=a.onBuyer?'#B42318':'#05603A',bd=a.onBuyer?'#D92D20':'#12B76A';
 const say=a.onBuyer?('COURIER &amp; DUTY ON THE BUYER&#39;S ACCOUNT'+(a.acct?' &mdash; A/c No. '+esc(a.acct):''))
                    :('ON OUR ACCOUNT (SELF)'+(a.intl?' &mdash; duty paid by us':''));
 const extra=a.intl&&a.expBy?'<div style="font-size:10px;color:#444">Expense borne by: <b>'+esc(a.expBy)+'</b></div>':'';
 return '<div class="blk" style="padding:0;border-top:1px solid #bbb"><div style="display:flex;gap:10px;align-items:center;justify-content:space-between;padding:7px 10px;background:'+bg+';border-left:5px solid '+bd+';-webkit-print-color-adjust:exact;print-color-adjust:exact">'
  +'<div style="font-size:11px">'+(showCr?'Shipped by: '+crChip(r,{big:1})+(d.courier.service?' <span style="font-size:10.5px">'+esc(d.courier.service)+'</span>':'')+(d.courier.boxes?' &nbsp;|&nbsp; Boxes: '+esc(d.courier.boxes):''):'&nbsp;')+'</div>'
  +'<div style="text-align:right"><div style="font-weight:800;font-size:12px;color:'+fg+';letter-spacing:.02em">'+say+'</div>'+extra+'</div></div></div>';}
/* the "Courier & account" panel on an invoice page */
function shipAcctPanel(r){const d=(r&&r.d)||{},a=acctOf(r);
 return '<div class="panel"><h2>Courier &amp; account</h2><div class="grid">'
  +'<div><span class="note">Shipped by</span><br>'+crChip(r,{big:1,svc:1})+'</div>'
  +'<div><span class="note">Whose account</span><br>'+acctChip(r,1)+'</div>'
  +(a.intl?'<div><span class="note">Duty paid by</span><br><b>'+esc(d.duty||'Self')+'</b></div><div><span class="note">Expense borne by</span><br><b>'+esc(d.expense_by||'-')+'</b></div>':'')
  +'<div><span class="note">Tracking no.</span><br><b>'+esc(r.tracking_no||'-')+'</b></div></div>'
  +(a.onBuyer?'<div class="msg" style="margin-top:10px;border-color:#D92D20;background:#FDECEC;color:#B42318"><b>On the buyer&#39;s account.</b> The courier bill and the duty go to the buyer&#39;s own courier account'+(a.acct?' ('+esc(a.acct)+')':'')+' &mdash; it must not be paid from our account.</div>'
            :'<div class="msg" style="margin-top:10px;border-color:#12B76A;background:#F1FAF4;color:#05603A"><b>On our account.</b> We pay this courier bill, so it shows in Team accounts and in the buyer expenses.</div>')
  +'</div>';}
`;

const edits = [
  /* 1. the helpers, right after courierOf */
  ["const courierOf=r=>((r.d.courier||{}).name||'');",
   "const courierOf=r=>((r.d.courier||{}).name||'');" + HELPERS, 1],

  /* 2. invoice list AND the admin approvals queue (both have the same header and row): a
        "Courier / account" column, so the approver also sees whose account it is on */
  ["<th>Buyer</th><th>Type</th><th>By</th>",
   "<th>Buyer</th><th>Type</th><th>Courier / account</th><th>By</th>", 2],
  ["<span class=\"pill ${r.ship_type==='International'?'Intl':''}\">${esc(r.ship_type)}</span></td><td>${esc(r.owner_name||'')}</td>",
   "<span class=\"pill ${r.ship_type==='International'?'Intl':''}\">${esc(r.ship_type)}</span></td><td>${crChip(r,{svc:1})}<br>${acctChip(r)}</td><td>${esc(r.owner_name||'')}</td>", 2],

  /* 3. invoice page: the Courier & account panel */
  ["if(r.status==='Approved'&&canAct)h+=dispatchPanel(r);",
   "h+=shipAcctPanel(r);\n  if(r.status==='Approved'&&canAct)h+=dispatchPanel(r);", 1],

  /* 4. printed invoice + courier copy: the small "Duty paid" cell becomes a coloured one
        (the same cell text appears in invoiceHTML and in ppCourier) */
  ["<div class=\"cell\">Duty paid :<b>${d.duty==='Buyer'?'Buyer'+(d.duty_acct?' (A/c no. '+esc(d.duty_acct)+')':''):esc(d.duty||'')}</b></div>",
   "<div class=\"cell\" style=\"background:${d.duty==='Buyer'?'#FDECEC':'#F1FAF4'};-webkit-print-color-adjust:exact;print-color-adjust:exact\">Duty paid :<b style=\"color:${d.duty==='Buyer'?'#B42318':'#05603A'}\">${d.duty==='Buyer'?'BUYER'+(d.duty_acct?' &mdash; A/c no. '+esc(d.duty_acct):''):(esc(d.duty||'Self')+' (our account)')}</b></div>", 2],

  /* 5. printed invoice: the grey "Shipped by" line becomes the coloured band */
  ["${FMT.show_courier!==false&&d.courier&&d.courier.name?`<div class=\"blk sm\">Shipped by: ${esc(d.courier.name)} ${esc(d.courier.service)}${d.courier.boxes?' | Boxes: '+esc(d.courier.boxes):''}</div>`:''}",
   "${acctBand(r)}", 1],
  /* 5b. the same line on every courier copy */
  ["${FMT.show_courier!==false&&d.courier&&d.courier.name?`<div class=\"blk sm\">Shipped by: ${esc(d.courier.name)} ${esc(d.courier.service||'')}${d.courier.boxes?' | Boxes: '+esc(d.courier.boxes):''}</div>`:''}",
   "${acctBand(r)}", 1],

  /* 6. gate pass (printed and the on-screen tear-off copy): say whose account it is on */
  ["<b>Type:</b> ${esc(r.ship_type)}${FMT.show_courier!==false&&d.courier&&d.courier.name?' | <b>Courier:</b> '+esc(d.courier.name):''}",
   "<b>Type:</b> ${esc(r.ship_type)}${FMT.show_courier!==false&&d.courier&&d.courier.name?' | <b>Courier:</b> '+crChip(r):''} | ${acctChip(r)}", 1],
  ["<b>Type:</b> ${esc(r.ship_type)}${d.courier&&d.courier.name?' &nbsp;|&nbsp; <b>Courier:</b> '+esc(d.courier.name):''}",
   "<b>Type:</b> ${esc(r.ship_type)}${d.courier&&d.courier.name?' &nbsp;|&nbsp; <b>Courier:</b> '+crChip(r):''} &nbsp;|&nbsp; ${acctChip(r)}", 1],

  /* 7. shipments list and the tracking-numbers list: the courier column in colour, with the
        account beside it */
  ["<td>${esc(courierOf(r))}</td>",
   "<td>${crChip(r,{svc:1})}<br>${acctChip(r)}</td>", 2],

  /* 8. Team accounts: Apex and Anjani can no longer be mistaken for each other */
  ["<td>${esc(CK[x.ck]||(((x.inv.d||{}).courier||{}).name)||'-')}${x.guess?'<br><span class=\"note\">courier not chosen on invoice, cheapest of Apex / Anjani used</span>':''}",
   "<td>${crChip(x.inv,{key:x.ck,label:CK[x.ck]||(((x.inv.d||{}).courier||{}).name)||'',note:x.guess?'courier not chosen on the invoice, cheapest of Apex / Anjani used':''})}<br>${acctChip(x.inv)}", 1],
];

function patch(t, label) {
  for (const [a, b, want] of edits) {
    const n = t.split(a).length - 1;
    if (n !== want) throw new Error(label + ': expected ' + want + ' match(es), found ' + n + ' for: ' + a.slice(0, 80));
    t = t.split(a).join(b);
  }
  return t;
}

/* index.html: the module lives as base64 in COURIER_HTML_B64 */
let idx = fs.readFileSync('index.html', 'utf8');
const re = /(COURIER_HTML_B64\s*=\s*["'`])([A-Za-z0-9+\/=]+)/;
const m = idx.match(re);
if (!m) throw new Error('COURIER_HTML_B64 not found in index.html');
const live = Buffer.from(m[2], 'base64').toString('utf8');
if (Buffer.from(live, 'utf8').toString('base64') !== m[2]) throw new Error('base64 does not round-trip');
const out = patch(live, 'index.html');
fs.writeFileSync('.tmp/courier-patched.html', out);
fs.writeFileSync('index.html', idx.replace(re, (_, p) => p + Buffer.from(out, 'utf8').toString('base64')));
console.log('index.html  : COURIER_HTML_B64 patched (' + live.length + ' -> ' + out.length + ' chars)');

/* the standalone copy */
fs.writeFileSync('courier_dashboard.html', patch(fs.readFileSync('courier_dashboard.html', 'utf8'), 'courier_dashboard.html'));
console.log('courier_dashboard.html : patched');
