/**
 * PLANT ELECTRICAL PORTAL - Code.gs  (BUILD 11)
 * NEW IN BUILD 10: HT meter due 6:30 am, Compressor due 10 am; new Ok/Not Ok checks (Servo, UPS, Compressor, DG); weekly/monthly checks that stay due until done
 * (UPS backup Monday, Compressor air filter Tuesday, DG air filter 5th); DG split into Run log (many start/stop per day) and Reading & checks;
 * DG ON/OFF count + 9 am morning DG report. New sheet columns are added AUTOMATICALLY (a backup copy of the sheet is made first; old data untouched).
 * NEW IN BUILD 9: fixed times per form with LATE marking (see DUE below), P.F. meter 2 decimals, Solar Unit Checking form
 * (same QR code SCLEAN), solar cleaning step inside the Solar & Dept form (every 3 days), alert action reports (e-mailed),
 * admin daily photo review checklist, and the three Excel-style reports (HT METER, ELECTRIC CONSUMPTION, DG SET).
 * 1) Run setup() once (keeps old data, asks Google Drive + Gmail + trigger permission).
 * 2) Deploy > Manage deployments > pencil > Version: New version > Deploy.   (after EVERY change)
 * Admin page  : open the web-app URL  (asks the ADMIN_PIN below - CHANGE IT).
 * Form QR code: <web-app URL>?f=SERVO | UPS1 | UPS2 | METER | DG | DSTOCK | FIRE | PFP | SCLEAN | COMP | SOLAR&m=<meter key>
 */
const BUILD = '13';
const CFG = {
  TITLE: 'Plant Electrical Portal', DATA_ID: '', LOG_SHEET: 'ENTRY_LOG', TZ: 'Asia/Kolkata',
  PHOTO_FOLDER: 'Plant Electrical Portal - Photos', PHOTO_REQUIRED: true, PHOTO_DAYS: 7,
  ALERT_TO: 'rugscreationelectrician@gmail.com', ALERT_NAME: 'Naveen',
  ALERT_EXTRA: ['gaurav@rugscreation.com','vinay@rugscreation.com','mis@rugscreation.com'],        // <-- more people to alert, e.g. ['manager@gmail.com', 'boss@gmail.com']. They get an e-mail ONLY when an entry has a wrong / out-of-limit field (never for OK entries)
  ADMIN_PIN: '4321',      // <-- change this
  WEB_URL: ''             // optional: paste your /exec URL here if QR codes show the wrong address
};
/* BUILD 11: every late / out-of-range alert reaches people at ALERT_AT; the action must be recorded by ACTION_BY */
const ALERT_AT = '16:00', ACTION_BY = '17:00';
/* BUILD 12: two more daily mails (background only - they never slow the entry forms): the HT METER + ELECTRIC CONSUMPTION sheets at REPORT_AT, the day review (late / not filled / out of range / planned checks) at REVIEW_AT */
const REPORT_AT = '11:00', REVIEW_AT = '17:00';
/* BUILD 12: the bill counts ONLY these department meters (the other meters are already inside them) */
const BILL_DEPTS = ['colony', 'dvdw', 'dshare', 'eblock', 'ablock', 'hblock'];
const MDI_MAX = 0.65;
/* BUILD 13: the DG burns this many litres in ONE hour of running (70 / 60 litres per minute); a run left open for 24 hours is stopped automatically */
const DG_LPH = 70;
const DASH = {
  RATE: 9, MDI_LIMIT: MDI_MAX, MDI_X: 1000, PF_TARGET: 0.98, EXPORT_SIGN: 1, DIESEL_RATE: 0,
  COOLANT_WARN: 85, COOLANT_CRIT: 90, USAGE_DAY: 'start'
};
/* ===== FIXED TIMES (server time). An entry saved after its time is marked LATE and Naveen gets an e-mail. Edit the times here. =====
   t   = time of day it must be done by         dow = weekday it is due (1=Mon ... 7=Sun) for weekly forms
   mon = different time on Mondays              next = the day's DG entries are due by that time on the NEXT morning */
const DUE = {
  METER:  { t: '06:30' },
  COMP:   { t: '10:00' },
  DG:     { t: '09:00', next: true },
  SOLAR:  { t: '06:00', mon: '10:00' },
  PFP:    { t: '11:00', dow: 1 },
  SERVO:  { t: '09:00' },
  UPS1:   { t: '15:00' },
  UPS2:   { t: '15:00' },
  SCLEAN: { t: '11:00', dow: 3 },
  FIRE:   { t: '11:00', dow: 5 }      /* BUILD 13: fire hydrant pressure check, once a week (Friday) - change dow / t here */
};
/* solar panel cleaning: last cleaned on LAST, then every EVERY days (skip 2 days, clean on the 3rd), to be finished by BY */
const CLEAN = { LAST: '2026-10-29', EVERY: 3, BY: '08:00' };

/* BUILD 10: new rules start on this date. Older dates never ask for the new fields and are never marked late/missing for them. */
const EFF = '2026-11-04';
/* periodic checks inside a daily form: weekly (dow: 1=Monday … 7=Sunday) or monthly (dom = day of month).
   A check is due from its due day and STAYS due until it is filled once in that week / month. */
/* fields added in build 10 that are required only for entries dated EFF or later (old dates stay valid without them) */
const NEW10 = { SERVO: ['oil_s','oil_t','leak','noise'], UPS1: ['ac'], UPS2: ['ac'], COMP: ['pre','dew'] };
function isNew10_(fk, k, date) { return date < EFF && (NEW10[fk] || []).indexOf(k) > -1; }
const PER = {
  UPS1: { bkp: { dow: 1 } },
  UPS2: { bkp: { dow: 1 } },
  COMP: { airf: { dow: 2 }, comp_rad: { dows: [1, 4], from: '2026-11-09' }, dry_rad: { dows: [1, 4], from: '2026-11-09' } },
  DG:   { airf: { dom: 5 } }
};
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const LAYOUT_MSG = 'The sheet layout changed in this version. Open the Apps Script editor, run setup() once (your old data is kept), then deploy a new version.';

const DEPTS = [
  ['colony','Colony',1,1],['dshare','Sharing D Block',40,1],['dvdw','V.D.W D Block',1,1],['shut','Sutteless',1,0],
  ['etp','E.T.P',1,0],['boiler','Boiler',1,0],['dying','Dying',1,0],['fblock','F Block',1,0],
  ['upsroom','U.P.S. Room',1,0],['comp','Compressor',1,0],['eblock','E Block',1,1],['ablock','A Block',1,1],['hblock','H-Block',1,1]
];
const METERS = [{ k: 'solar', n: 'Solar plant', f: ['kwh', 'kvah'], x: ['clean'] }].concat(DEPTS.map(function (d) { return { k: d[0], n: d[1], f: [d[0]] }; }));
const KV_RANGE = { '5': [5.5, 6.5], '10': [11, 13], '15': [17, 19], '20': [23, 26], '25': [31, 33] };
const PFP_DEF = [5,10,15,15,15,15,15,15,20,20,15,15,10,10,20,20,20,20,25,25];

function F(k, n, g, o) { return Object.assign({ k: k, n: n, g: g, t: 'num', step: 'any' }, o || {}); }
/* DG photos: the meter photo and panel photos belong to the READING part; air filter photo only on the monthly day */
function dgSlots_() {
  const o = std_([0]).map(function (s) { s.part = 'READ'; return s; });
  o.push({ n: 'Air filter photo', req: false, per: 'airf', part: 'READ' });
  return o;
}
/* photo slots: required = array of indexes that must be filled */
function std_(req) {
  return ['Meter reading','Panel room 1','Panel room 2','Panel box 1','Panel box 2'].map(function (n, i) { return { n: n, req: req.indexOf(i) > -1 }; });
}

/* Ok / Not Ok dropdown (BUILD 10 checks) */
function okno_(k, n, g, x) { return Object.assign({ k: k, n: n, g: g, t: 'sel', opts: ['OK','NOT OK'], ok: ['OK'], def: '' }, x || {}); }

function servoFields_() {
  const o = [];
  [['r','Red'],['y','Yellow'],['b','Blue']].forEach(function (p) {
    o.push(F(p[0] + '_in',  p[1] + ' In',  p[1] + ' phase', { lo: 210, hi: 250, u: 'V' }));
    o.push(F(p[0] + '_out', p[1] + ' Out', p[1] + ' phase', { lo: 235, hi: 240, u: 'V' }));
  });
  /* BUILD 10 */
  o.push(okno_('oil_s', 'Oil level servo', 'Oil & noise checks'));
  o.push(okno_('oil_t', 'Oil level transformer', 'Oil & noise checks'));
  o.push(okno_('leak', 'Oil leakage', 'Oil & noise checks'));
  o.push(okno_('noise', 'Noise abnormal', 'Oil & noise checks'));
  return o;
}
function upsFields_() {
  return [
    F('ts','Ts temperature','Temperature',{ hi: 45, strict: true, u: '°C' }),
    F('tr','Tr temperature','Temperature',{ hi: 50, strict: true, u: '°C' }),
    F('ti','Ti temperature','Temperature',{ hi: 55, strict: true, u: '°C' }),
    F('load','Load','Load & battery',{ u: '%' }),
    F('bv','Battery voltage','Load & battery',{ lo: 415, hi: 435, u: 'V' }),
    F('vin','Voltage In','Voltage',{ lo: 390, hi: 415, u: 'V' }),
    F('vout','Voltage Out','Voltage',{ lo: 399, hi: 405, u: 'V' }),
    { k: 'status', n: 'UPS status', g: 'Status', t: 'sel', opts: ['OK','Warning','Fault','On battery','Bypass'], ok: ['OK'], def: '' },
    /* BUILD 10 */
    okno_('ac', 'AC working', 'Room checks'),
    okno_('bkp', 'Weekly backup check', 'Weekly check (every Monday)', { per: 1, opt: true })
  ];
}
function meterFields_() {
  return [
    F('kwh','K.W.H (import)','Energy registers',{ cum: 1, mf: 1000 }),
    F('kwh_x','Export K.W.H','Energy registers',{ cum: 1, mf: 1000 }),
    F('kvah','K.V.A.H (import)','Energy registers',{ cum: 1, mf: 1000 }),
    F('kvah_x','Export K.V.A.H','Energy registers',{ cum: 1, mf: 1000 }),
    F('pf','P.F. meter','Quality',{ lo: 0.98, hi: 1, step: 0.01, dec: 2, hard: 1 }),
    F('mdi','M.D.I.','Quality',{ hi: MDI_MAX, strict: true, step: 0.001 }),
    F('vr','Red voltage','Phase voltage'), F('vy','Yellow voltage','Phase voltage'), F('vb','Blue voltage','Phase voltage'),
    F('ir','Red current','Phase current'), F('iy','Yellow current','Phase current'), F('ib','Blue current','Phase current')
  ];
}
function solarFields_() {
  return [
    F('kwh','Solar K.W.H.','Solar plant',{ cum: 1, mf: 160 }),
    F('kvah','Solar K.V.A.H.','Solar plant',{ cum: 1, mf: 160 }),
    { k: 'clean', n: 'Solar cleaning done?', g: 'Solar plant', t: 'sel', opts: ['Yes','No'], ok: ['Yes'], def: '', opt: true, cond: 1 }
  ].concat(DEPTS.map(function (d) { return F(d[0], d[1], 'Department meters', { cum: 1, mf: d[2] }); }));
}
function dgFields_() {
  return [
    { k: 'start', n: 'Start time', g: 'Run', t: 'time', part: 'RUN' },
    { k: 'stop',  n: 'Stop time',  g: 'Run', t: 'time', part: 'RUN' },
    F('hwh','KWH meter reading','Meter',{ cum: 1, step: 1, opt: true, part: 'READ', rp: 'READ' }),
    F('coolant','Coolant temperature','Engine',{ hi: 90, u: '°C', opt: true, needIf: 'hwh', part: 'READ', rp: 'READ' }),
    F('diesel','Diesel consumed','Engine',{ u: 'L', opt: true, part: 'READ', rp: 'READ' }),
    /* BUILD 10: one row is either a RUN (start / stop) or a READING (meter + checks); old rows have no part and keep both */
    { k: 'part', n: 'Entry part', g: 'Part', t: 'sel', opts: ['RUN','READ'], ok: ['RUN','READ'], def: '', opt: true, norule: true, hid: 1 },
    F('stock','Diesel stock','Engine',{ lo: 400, u: 'L', opt: true, part: 'READ', rp: 'READ' }),
    okno_('lube', 'Lube oil pressure', 'Engine checks', { opt: true, part: 'READ', rp: 'READ' }),
    okno_('clvl', 'Coolant level', 'Engine checks', { opt: true, part: 'READ', rp: 'READ' }),
    okno_('airf', 'Air filter cleaning (monthly)', 'Monthly check (5th of the month)', { per: 1, opt: true, part: 'READ' }),
    /* who pressed STOP (the run is started and stopped in two separate entries) */
    { k: 'sby', n: 'Stopped by', g: 'Part', t: 'text', opt: true, norule: true, hid: 1, part: 'RUN' }
  ];
}
/* BUILD 13: diesel stock book (opening stock + diesel received) and the fire hydrant check */
function dstockFields_() {
  return [
    { k: 'kind', n: 'Entry type', g: 'Diesel stock', t: 'sel', opts: ['Opening stock', 'Diesel received'], ok: ['Opening stock', 'Diesel received'], def: '' },
    F('ltr', 'Litres', 'Diesel stock', { u: 'L', step: 'any' }),
    { k: 'note', n: 'Bill / supplier note', g: 'Diesel stock', t: 'text', opt: true }
  ];
}
function fireFields_() {
  return [
    F('press', 'Pressure gauge reading', 'Fire hydrant', { lo: 2.5, hi: 6, step: 0.1 }),
    okno_('status', 'Working status', 'Fire hydrant')
  ];
}
function pfpFields_() {
  const o = [], kv = ['5','10','15','20','25'];
  for (let i = 1; i <= 20; i++) {
    const p = 'c' + i + '_', g = 'Capacitor ' + i;
    o.push({ k: p + 'kv', n: 'C' + i + ' rating (kVAr)', g: g, t: 'sel', opts: kv, ok: kv, def: String(PFP_DEF[i - 1]), norule: true });
    [['r','R phase'],['y','Y phase'],['b','B phase']].forEach(function (q) {
      o.push(F(p + q[0], 'C' + i + ' ' + q[1] + ' (A)', g, { dyn: p + 'kv', ph: q[0], step: 0.1, u: 'A' }));
    });
    [['ct','Contactor'],['fu','Fuse / MCB'],['tm','Terminal / cable'],['ch','Capacitor health']].forEach(function (q) {
      o.push({ k: p + q[0], n: 'C' + i + ' ' + q[1], g: g, t: 'sel', opts: ['OK','NOT OK'], ok: ['OK'], def: '' });
    });
    o.push({ k: p + 'rm', n: 'C' + i + ' remarks', g: g, t: 'text' });
  }
  return o;
}
/* Solar Unit Checking (QR key SCLEAN): 6 inverters x 10 strings (AMP), cleaning, earthing value (must be below 2), status, remarks */
function sunitFields_() {
  const o = [];
  for (let i = 1; i <= 6; i++) {
    const p = 'i' + i + '_', g = 'Inverter ' + i;
    for (let j = 1; j <= 10; j++) o.push(F(p + 's' + j, 'INV' + i + ' string ' + j + ' (A)', g, { step: 0.01, u: 'A', opt: true, norule: true }));
    o.push({ k: p + 'cl', n: 'INV' + i + ' cleaning', g: g, t: 'sel', opts: ['Yes','No'], ok: ['Yes','No'], def: '', norule: true });
    o.push(F(p + 'ea', 'INV' + i + ' earthing value', g, { hi: 2, strict: true, step: 0.01 }));
    o.push({ k: p + 'st', n: 'INV' + i + ' status', g: g, t: 'sel', opts: ['OK','NOT OK'], ok: ['OK'], def: '' });
    o.push({ k: p + 'rm', n: 'INV' + i + ' remarks', g: g, t: 'text' });
  }
  return o;
}
function compFields_() {
  return [
    F('run','Running hours','Hours',{ step: 0.1, u: 'h' }),
    F('load','Load hours','Hours',{ step: 0.1, u: 'h' }),
    { k: 'oil',   n: 'Oil level and leakage check', g: 'Checks', t: 'sel', opts: ['OK','Low level','Leakage','Low level + leakage'], ok: ['OK'], def: '' },
    { k: 'sound', n: 'Abnormal sound', g: 'Checks', t: 'sel', opts: ['No','Yes'], ok: ['No'], def: '' },
    { k: 'dryer', n: 'Dryer status', g: 'Checks', t: 'sel', opts: ['Working','Not working'], ok: ['Working'], def: '' },
    { k: 'drain', n: 'Water auto drain valve status', g: 'Checks', t: 'sel', opts: ['Working','Not working','Blocked'], ok: ['Working'], def: '' },
    { k: 'by',    n: 'Checked by', g: 'Sign-off', t: 'text', req: true },
    /* BUILD 10 */
    okno_('pre', 'Prefilter cleaning', 'Filters & dew point'),
    F('dew', 'Due point', 'Filters & dew point', { step: 0.1 }),
    okno_('airf', 'Air filter cleaning (weekly)', 'Weekly check (every Tuesday)', { per: 1, opt: true }),
    okno_('comp_rad', 'Compressor radiator cleaning', 'Radiator cleaning (every Monday and Thursday)', { per: 1, opt: true }),
    okno_('dry_rad', 'Dryer radiator cleaning', 'Radiator cleaning (every Monday and Thursday)', { per: 1, opt: true })
  ];
}

const FORMS = {
  SERVO:  { title: 'Servo Stabilizer',    icon: '🔌', sheet: 'F_SERVO',  fields: servoFields_(),  slots: std_([0]) },
  UPS1:   { title: 'UPS-1',               icon: '🔋', sheet: 'F_UPS1',   fields: upsFields_(),    slots: std_([0, 1]) },
  UPS2:   { title: 'UPS-2',               icon: '🔋', sheet: 'F_UPS2',   fields: upsFields_(),    slots: std_([0, 1]) },
  METER:  { title: 'HT Meter',            icon: '⚡', sheet: 'F_METER',  fields: meterFields_(),  slots: std_([0]) },
  SOLAR:  { title: 'Solar & Dept Meters', icon: '☀️', sheet: 'F_SOLAR',  fields: solarFields_(),  slots: [{ n: 'Meter photo', req: true }, { n: 'Solar cleaning photo', req: false, cond: 1 }], inline: true, byMeter: true },
  DG:     { title: 'DG Set',              icon: '🛢️', sheet: 'F_DG',     fields: dgFields_(),     slots: dgSlots_(), multi: true, optional: true, parts: true },
  PFP:    { title: 'Power Factor Panel',  icon: '🎛️', sheet: 'F_PFP',    fields: pfpFields_(),    slots: [{ n: 'Panel photo', req: true }], optional: true, table: 'pfp', weekly: true, every: 7 },
  DSTOCK: { title: 'Diesel Stock',        icon: '⛽', sheet: 'F_DSTOCK', fields: dstockFields_(), slots: [{ n: 'Bill / dip-stick photo', req: false }], multi: true, optional: true },
  FIRE:   { title: 'Fire Hydrant',        icon: '🧯', sheet: 'F_FIRE',   fields: fireFields_(),   slots: [{ n: 'Pressure gauge photo', req: true }, { n: 'Hydrant photo 1', req: true }, { n: 'Hydrant photo 2', req: true }], multi: true, optional: true },
  SCLEAN: { title: 'Solar Unit Checking', icon: '🔆', sheet: 'F_SUNIT',  fields: sunitFields_(),  slots: [{ n: 'Checking sheet photo', req: true }], optional: true, table: 'sunit', weekly: true, every: 7 },
  COMP:   { title: 'Compressor',          icon: '🌀', sheet: 'F_COMP',   fields: compFields_(),   slots: std_([0]).concat([{ n: 'Prefilter photo', req: true, n10: 1 }, { n: 'Air filter photo', req: false, per: 'airf' }, { n: 'Compressor radiator photo', req: false, per: 'comp_rad' }, { n: 'Dryer radiator photo', req: false, per: 'dry_rad' }]) }
};

/* ---------- web app ---------- */
function doGet(e) {
  const q = (e && e.parameter) || {}, f = String(q.f || '').toUpperCase();
  const mode = { f: FORMS[f] ? f : '', m: String(q.m || '').replace(/[^\w]/g, '') };
  const t = HtmlService.createTemplateFromFile('index');
  t.mode = JSON.stringify(mode).replace(/</g, '\\u003c');
  t.boot = 'null';
  if (mode.f) { try { t.boot = JSON.stringify(formBootCached_(mode.f)).replace(/</g, '\\u003c'); } catch (e) { t.boot = 'null'; } }
  return t.evaluate().setTitle(FORMS[f] ? FORMS[f].title : CFG.TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function pin_(p) { if (String(p || '') !== String(CFG.ADMIN_PIN)) throw new Error('LOCKED: wrong or missing admin PIN.'); }
function pubUrl_(u) { return String(u || '').replace(/\/a\/macros\/[^\/]+\/s\//, '/macros/s/').replace(/\/a\/[^\/]+\/macros\/s\//, '/macros/s/'); }
function webUrl_() { try { return pubUrl_(CFG.WEB_URL || ScriptApp.getService().getUrl()); } catch (e) { return pubUrl_(CFG.WEB_URL || ''); } }

/* ---------- helpers ---------- */
const TAIL = 1500;
const MEMO = {};

function ss_() {
  if (MEMO.ss) return MEMO.ss;
  let s = null;
  if (CFG.DATA_ID) s = SpreadsheetApp.openById(CFG.DATA_ID);
  else {
    try { s = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { s = null; }
    if (!s) { const id = PropertiesService.getScriptProperties().getProperty('DATA_ID'); if (id) s = SpreadsheetApp.openById(id); }
  }
  if (!s) throw new Error('No data spreadsheet is linked yet. Open the Apps Script editor, run setup() once (or put a spreadsheet ID in CFG.DATA_ID), then deploy a new version.');
  return MEMO.ss = s;
}
function cleanName_(n) {
  let s = String(n || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (/^[=+\-@]/.test(s)) s = s.replace(/^[=+\-@]+/, '').trim();
  return s;
}
function iso_(d) { if (d instanceof Date) return Utilities.formatDate(d, CFG.TZ, 'yyyy-MM-dd'); const s = String(d || ''); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : ''; }
function tm_(t) { return t instanceof Date ? Utilities.formatDate(t, CFG.TZ, 'HH:mm') : String(t || ''); }
function ts_(x) { return Utilities.formatDate(new Date(x), CFG.TZ, 'dd MMM yyyy, hh:mm a'); }
function today_() { return Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'); }
function nextDay_(iso) { return new Date(new Date(iso + 'T00:00:00Z').getTime() + 864e5).toISOString().slice(0, 10); }
function daysBetween_(a, b) { return Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 864e5); }
function weekStart_(iso) { const d = new Date(iso + 'T00:00:00Z'); return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10); }
function dow_(iso) { const d = new Date(iso + 'T00:00:00Z').getUTCDay(); return d === 0 ? 7 : d; }
function addDays_(iso, n) { return new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10); }
function nowHM_() { return Utilities.formatDate(new Date(), CFG.TZ, 'HH:mm'); }
function t12_(t) { const p = String(t).split(':'), h = +p[0]; return (h % 12 || 12) + ':' + p[1] + (h < 12 ? ' am' : ' pm'); }
const DAYN = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
function dueText_(fk) {
  const u = DUE[fk]; if (!u) return '';
  if (u.dow) return 'every ' + DAYN[u.dow] + ' by ' + t12_(u.t);
  if (u.next) return 'by ' + t12_(u.t) + ' every morning (for the day before)';
  return 'by ' + t12_(u.t) + ' daily' + (u.mon ? ' (Mondays by ' + t12_(u.mon) + ')' : '');
}
/* solar cleaning cycle: last time a "Yes" was saved (or the start date above), next one is EVERY days later and stays due until done */
function cleanInfo_() {
  let last = CLEAN.LAST;
  readAll_('SOLAR').forEach(function (r) { if (r.v.clean === 'Yes' && r.date > last) last = r.date; });
  return { last: last, due: addDays_(last, CLEAN.EVERY), by: CLEAN.BY };
}
function cleanDueOn_(date) { return date >= cleanInfo_().due; }
/* ---- periodic checks (BUILD 10): weekly / monthly fields that stay due until done ---- */
function p2_(n) { return (n < 10 ? '0' : '') + n; }
function perEff_(fk, k) { return (PER[fk][k] || {}).from || EFF; }
function perStart_(r, d) {
  if (r.dows) {                                    /* several days a week (e.g. Monday + Thursday): the latest due day on or before d */
    let best = '';
    r.dows.forEach(function (w) { const x = addDays_(d, -((dow_(d) - w + 7) % 7)); if (x > best) best = x; });
    return best;
  }
  if (r.dow) return addDays_(d, -((dow_(d) - r.dow + 7) % 7));
  const p = d.split('-'); let y = +p[0], m = +p[1];
  if (+p[2] >= r.dom) return y + '-' + p2_(m) + '-' + p2_(r.dom);
  m--; if (m < 1) { m = 12; y--; }
  return y + '-' + p2_(m) + '-' + p2_(r.dom);
}
/* is the periodic field k of form fk due for an entry dated d? (not before EFF; stays due until filled in the period) */
function perDue_(fk, k, d) {
  const r = (PER[fk] || {})[k]; if (!r) return false;
  const st = perStart_(r, d); if (st < perEff_(fk, k)) return false;
  return !readAll_(fk).some(function (o) { return o.date >= st && o.date <= d && o.v[k] !== '' && o.v[k] != null; });
}
function perInfo_(fk) {
  const o = {}, rows = readAll_(fk), from = addDays_(today_(), -75);
  Object.keys(PER[fk] || {}).forEach(function (k) {
    const r = PER[fk][k], done = [];
    rows.forEach(function (x) { if (x.date >= from && x.v[k] !== '' && x.v[k] != null && done.indexOf(x.date) < 0) done.push(x.date); });
    o[k] = { dow: r.dow || 0, dows: r.dows || null, dom: r.dom || 0, eff: perEff_(fk, k), done: done };
  });
  return o;
}
/* ---- DG run log, two steps: START is saved first (stop blank = the generator is running), STOP is entered later on the SAME row ---- */
function dgOpen_() {
  const o = readAll_('DG').filter(function (r) { return r.v.part === 'RUN' && r.v.start !== '' && r.v.stop === ''; });
  return o.length ? o[o.length - 1] : null;
}
function dgOpenInfo_() { const r = dgOpen_(); return r ? { date: r.date, start: r.v.start, name: r.name } : null; }
function dgStop_(p, name) {
  const stopT = String((p.v && p.v.stop) || '').trim().slice(0, 5);
  if (!/^\d{1,2}:\d{2}$/.test(stopT)) throw new Error('MISSING: enter the stop time.');
  const idk = p.id ? 'sub|' + p.id : null;
  if (idk) { const d1 = cacheGet_(idk); if (d1) return d1; }
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    if (idk) { const d2 = cacheGet_(idk); if (d2) return d2; }
    MEMO['r_DG'] = null;
    const run = dgOpen_();
    if (!run) throw new Error('INVALID: no generator run is waiting for a stop time (it may already be stopped). Refresh the page.');
    const a = hm_(run.v.start), b = hm_(stopT), D = run.date;
    if (p.date < D) throw new Error('INVALID: the stop date cannot be before the start date (' + D + ').');
    if (p.date === D) { if (b <= a) throw new Error('INVALID: the stop time must be later than the start time (' + run.v.start + ').'); }
    else if (p.date === addDays_(D, 1)) { if (b > a) throw new Error('INVALID: this run would be longer than 24 hours. Contact your manager or admin to correct it.'); }
    else throw new Error('INVALID: this run started on ' + D + '. A stop more than 1 day later cannot be recorded here. Contact your manager or admin to correct it.');
    if (p.date === today_() && b > hm_(nowHM_()) + 5 / 60) throw new Error('INVALID: the stop time cannot be in the future.');
    dgWriteStop_(run, stopT, name, p.date);
    bump_();
    const data = Object.assign({}, run.v, { stop: stopT, sby: name, part: 'RUN' });
    const res = { ok: true, ts: ts_(new Date()), name: name, bad: 0, warns: [], date: D, time: nowHM_(), data: data, photos: [], meter: '', mailed: false, late: '', alertId: '', stopped: true, stopDate: p.date };
    if (idk) cachePut_(idk, res, 600);
    return res;
  } finally { lock.releaseLock(); }
}
/* writes the STOP time on the run's row (sheet + Entry log copy + audit line); used by the normal STOP and by the 24-hour auto stop */
function dgWriteStop_(run, stopT, name, stopDate) {
  const p = { date: stopDate }, D = run.date;
  const label = /^AUTO/.test(name) ? 'DG AUTO STOP' : 'DG STOP';
  const F_ = FORMS.DG, sh = sheet_('DG'), fr = findFormRow_('DG', run.tsn, run.date, run.name);
  if (!fr) throw new Error('The running entry could not be found in the sheet. Refresh the page and try again.');
  const iS = F_.fields.map(function (f) { return f.k; }).indexOf('stop'), iB = F_.fields.map(function (f) { return f.k; }).indexOf('sby');
  sh.getRange(fr, 5 + iS).setValue(stopT); sh.getRange(fr, 5 + iB).setValue(name);
  const lg = logSheet_(), ln = lg.getLastRow();                    /* keep the Entry log copy of this run in step */
  for (let r = ln; r >= Math.max(2, ln - TAIL * 2); r--) {
    const x = lg.getRange(r, 1, 1, 9).getValues()[0];
    if (x[2] === 'DG' && Math.abs(+new Date(x[0]) - run.tsn) < 1000 && String(x[1]) === run.name) {
      let dj = {}; try { dj = JSON.parse(x[7]); } catch (e) {}
      dj.stop = stopT; dj.sby = name; lg.getRange(r, 8).setValue(JSON.stringify(dj)); break;
    }
  }
  auditSheet_().appendRow([new Date(), label, 'DG', p.date, name, JSON.stringify({ started: D + ' ' + run.v.start, stopped: p.date + ' ' + stopT, startedBy: run.name })]);
}
/* a generator run can not run for 24 hours without a stop: after 24 h the run is closed by itself at start time + 24 h (checked by the 30-minute trigger) */
function dgAutoStop_() {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let done = null;
  try {
    MEMO['r_DG'] = null;
    const run = dgOpen_(); if (!run) return;
    const m = /^(\d{1,2}):(\d{2})/.exec(run.v.start); if (!m) return;
    const st = Date.parse(run.date + 'T' + p2_(+m[1]) + ':' + m[2] + ':00+05:30');
    if (!(Date.now() - st >= 24 * 3600 * 1000)) return;
    const stopT = p2_(+m[1]) + ':' + m[2], stopDate = addDays_(run.date, 1);
    dgWriteStop_(run, stopT, 'AUTO-STOP (24 h)', stopDate);
    bump_(); MEMO['r_DG'] = null;
    done = { run: run, stopDate: stopDate, stopT: stopT };
  } finally { lock.releaseLock(); }
  if (done) {
    try {
      MailApp.sendEmail({ to: mailTo_().join(','), subject: '🛢️ DG run closed automatically after 24 hours (started ' + lbl_(done.run.date) + ' ' + done.run.v.start + ')',
        htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px"><h3 style="margin:0 0 6px">🛢️ DG run stopped automatically</h3><p>The run started by <b>' + esc_(done.run.name) + '</b> on <b>' + esc_(lbl_(done.run.date)) + ' at ' + esc_(done.run.v.start) + '</b> had no stop time for 24 hours. A generator can not run that long without a break, so the system closed it at <b>' + esc_(lbl_(done.stopDate)) + ' ' + esc_(done.stopT) + '</b> (24 hours, ' + (DG_LPH * 24) + ' L of diesel).</p><p style="color:#555">If the real stop time was different, ask the admin to correct the run in the Entry log.</p></div>', name: CFG.TITLE });
    } catch (e) { Logger.log('DG auto-stop mail failed: ' + (e.message || e)); }
  }
}
/* DG: how many times the set was switched ON / OFF on a day, and the total running time */
/* ===== BUILD 13: diesel stock = latest OPENING STOCK + diesel RECEIVED - diesel burnt by the DG (running minutes x 70 / 60 litres) ===== */
function dgFuel_() {
  const per = DG_LPH / 60, ev = [], hh = function (t) { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? p2_(+m[1]) + ':' + m[2] : '00:00'; };
  readAll_('DSTOCK').forEach(function (r) {
    if (r.v.ltr === '' || r.v.ltr == null || !isFinite(Number(r.v.ltr))) return;
    ev.push({ dt: r.date + ' ' + hh(r.time), d: r.date, k: r.v.kind === 'Opening stock' ? 'a' : 'b', l: Number(r.v.ltr), o: r.tsn });
  });
  readAll_('DG').forEach(function (r) {
    if (r.v.start === '' || r.v.start == null || hm_(r.v.start) === null) return;
    let mins = dgRunMins_(r);
    if (mins === null) {
      if (r.v.part !== 'RUN') return;                                   /* an old row without a stop time is not a run in progress */
      mins = Math.min(1440, Math.max(0, (Date.now() - Date.parse(r.date + 'T' + hh(r.v.start) + ':00+05:30')) / 60000));
    }
    ev.push({ dt: r.date + ' ' + hh(r.v.start), d: r.date, k: 'c', l: mins * per, o: r.tsn });
  });
  ev.sort(function (x, y) { return x.dt < y.dt ? -1 : x.dt > y.dt ? 1 : x.k < y.k ? -1 : x.k > y.k ? 1 : x.o - y.o; });
  let stock = null, openAt = null; const days = {};
  ev.forEach(function (e) {
    const D = days[e.d] || (days[e.d] = { used: 0, recv: 0, close: null });
    if (e.k === 'a') { stock = e.l; openAt = e.dt; D.open = e.l; }
    else if (e.k === 'b') { if (stock !== null) stock += e.l; D.recv += e.l; }
    else { if (stock !== null) stock -= e.l; D.used += e.l; }
    D.close = stock;
  });
  return { tracked: stock !== null, stock: stock === null ? null : rnd_(stock), openAt: openAt, lph: DG_LPH, days: days };
}
/* the same ledger, one row per calendar day (days with no event carry the stock forward) */
function dgFuelRows_(isos) {
  const L = dgFuel_(), keys = Object.keys(L.days).sort(), rows = {}; let k = 0, carry = null;
  isos.forEach(function (d) {
    while (k < keys.length && keys[k] <= d) { if (L.days[keys[k]].close !== null) carry = L.days[keys[k]].close; k++; }
    const D = L.days[d];
    rows[d] = { used: D ? rnd_(D.used) : 0, recv: D ? rnd_(D.recv) : 0, close: carry === null ? null : rnd_(carry), open: D && D.open != null ? D.open : null };
  });
  return { lph: L.lph, tracked: L.tracked, stock: L.stock, openAt: L.openAt, rows: rows };
}
function dgFuelBrief_() { const L = dgFuel_(); return { tracked: L.tracked, stock: L.stock, openAt: L.openAt, lph: L.lph }; }
/* minutes a finished run lasted (stop earlier than start = after midnight; stop = start from the 24-hour auto stop = 24 h) */
function dgRunMins_(r) {
  const a = hm_(r.v.start), b = hm_(r.v.stop); if (a === null || b === null) return null;
  let m = Math.round((b - a) * 60); if (m < 0 || (m === 0 && /^AUTO/.test(String(r.v.sby || '')))) m += 1440; return m;
}
function dgDay_(d) {
  const o = { date: d, on: 0, off: 0, mins: 0, runs: [], open: dgOpenInfo_() };
  readRows_('DG', d, d).forEach(function (r) {
    const a = hm_(r.v.start), b = hm_(r.v.stop);
    if (a !== null) o.on++;
    if (b !== null) o.off++;
    if (a !== null && b !== null) { const m = dgRunMins_(r); o.mins += m; o.runs.push({ start: r.v.start, stop: r.v.stop, mins: m, auto: /^AUTO/.test(String(r.v.sby || '')) }); }
  });
  return o;
}
function perText_(fk, k) {
  const r = PER[fk][k];
  return r.dows ? 'every ' + r.dows.map(function (w) { return DAYN[w]; }).join(' and ') : r.dow ? 'every ' + DAYN[r.dow] : 'on the ' + r.dom + 'th of every month';
}
/* the time an entry for 'date' must be saved by: { d: due date, t: 'HH:MM' } */
function dueOf_(fk, date, M) {
  const u = DUE[fk]; if (!u) return null;
  let d = date, t = u.t;
  if (u.dow) d = addDays_(weekStart_(date), u.dow - 1);
  else if (u.next) d = addDays_(date, 1);
  else if (u.mon && dow_(date) === 1) t = u.mon;
  if (fk === 'SOLAR' && (!M || M.k === 'solar') && cleanDueOn_(date) && t < CLEAN.BY) t = CLEAN.BY;
  return { d: d, t: t };
}
function lateInfo_(fk, date, M) {
  const u = dueOf_(fk, date, M); if (!u) return '';
  const now = today_(), hm = nowHM_();
  if (now > u.d || (now === u.d && hm > u.t)) return 'LATE: saved ' + (now === u.d ? 'at ' + hm : 'on ' + lbl_(now) + ' at ' + hm) + ', was due by ' + (u.d === now ? '' : lbl_(u.d) + ' ') + u.t;
  return '';
}
function inM_(M, k) { return M.f.indexOf(k) > -1 || (M.x || []).indexOf(k) > -1; }
function lbl_(iso) { const p = iso.split('-'); return Number(p[2]) + ' ' + MON[Number(p[1]) - 1]; }
function rnd_(x) { return Math.round(x * 100) / 100; }
function nz_(x) { return (x === '' || x == null) ? null : x; }
function sum_(a) { return a.reduce(function (s, x) { return s + (x == null ? 0 : x); }, 0); }
function mean_(a) { const n = a.filter(function (x) { return x != null; }); return n.length ? sum_(n) / n.length : null; }
function f0_(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function hm_(s) { const m = /^(\d{1,2}):(\d{2})/.exec(String(s || '')); return m ? Number(m[1]) + Number(m[2]) / 60 : null; }
function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
/* photo cell: one "Label :: url" per line (old plain-url cells still work) */
function phList_(s) {
  /* reads new "Label :: url" lines AND old cells (plain URLs split by space, comma or new line, or a =HYPERLINK formula) */
  const out = [];
  String(s || '').split(/\n+/).forEach(function (line) {
    const urls = line.match(/https?:\/\/[^\s"',;)]+/g); if (!urls) return;
    const m = /^\s*(.*?)\s*::\s*https?:/.exec(line), lab = m && m[1] ? m[1] : '';
    urls.forEach(function (u) { out.push({ l: lab, u: u }); });
  });
  out.forEach(function (x, i) { if (!x.l) x.l = out.length > 1 ? 'Photo ' + (i + 1) : 'Photo'; });
  return out;
}
function dayList_(a, b) {
  const o = []; let d = new Date(a + 'T00:00:00Z'); const e = new Date(b + 'T00:00:00Z');
  while (d <= e && o.length < 400) { o.push(d.toISOString().slice(0, 10)); d = new Date(d.getTime() + 864e5); }
  return o;
}
function rule_(f) {
  if (f.norule || f.t === 'text') return '';
  if (f.dyn) return 'by rating';
  if (f.t === 'sel') return f.ok.join(' / ');
  const u = f.u ? ' ' + f.u : '';
  if (f.lo != null && f.hi != null) return f.lo + '–' + f.hi + u;
  if (f.hi != null) return (f.strict ? 'below ' : 'max ') + f.hi + u;
  if (f.lo != null) return 'min ' + f.lo + u;
  return '';
}
function ruleFor_(f, ctx) {
  if (f.dyn) { const r = KV_RANGE[String((ctx || {})[f.dyn])]; return r ? r[0] + '–' + r[1] + ' A' : 'by rating'; }
  return rule_(f);
}
function chk_(f, v, ctx) {
  if (v === '' || v == null) return 'empty';
  if (f.t === 'sel') return f.ok.map(String).indexOf(String(v)) > -1 ? '' : 'bad';
  if (f.t === 'time' || f.t === 'text') return '';
  let lo = f.lo, hi = f.hi;
  if (f.dyn) { const r = KV_RANGE[String((ctx || {})[f.dyn])]; if (!r) return ''; lo = r[0]; hi = r[1]; }
  if (lo != null && v < lo) return 'bad';
  if (hi != null && (f.strict ? v >= hi : v > hi)) return 'bad';
  return '';
}
function isReq_(f, data) {
  if (f.t === 'text') return !!f.req;
  if (f.needIf) return data[f.needIf] !== '' && data[f.needIf] != null;
  return !f.opt;
}
function phState_(v, kv) {
  const r = KV_RANGE[String(kv)];
  if (v === '' || v == null || !r) return '';
  return v < 1 ? 'open' : v < r[0] ? 'low' : v > r[1] ? 'high' : '';
}

/* ---------- cache ---------- */
function ver_() {
  if (MEMO.ver) return MEMO.ver;
  let v = null; try { v = CacheService.getScriptCache().get('ver'); } catch (e) {}
  return MEMO.ver = BUILD + '.' + (v || '0');
}
function bump_() { try { CacheService.getScriptCache().put('ver', String(Date.now()), 21600); } catch (e) {} MEMO.ver = null; }
function cacheGet_(key) {
  try {
    const c = CacheService.getScriptCache(), meta = c.get(key + '#n'); if (!meta) return null;
    const n = +meta, keys = []; for (let i = 0; i < n; i++) keys.push(key + '#' + i);
    const parts = c.getAll(keys); let s = '';
    for (let i = 0; i < n; i++) { const p = parts[key + '#' + i]; if (p == null) return null; s += p; }
    return JSON.parse(s);
  } catch (e) { return null; }
}
function cachePut_(key, obj, sec) {
  try {
    const s = JSON.stringify(obj), c = CacheService.getScriptCache(), size = 24000, n = Math.ceil(s.length / size), put = {};
    for (let i = 0; i < n; i++) put[key + '#' + i] = s.substr(i * size, size);
    put[key + '#n'] = String(n);
    c.putAll(put, sec);
  } catch (e) {}
}

/* ---------- photos (Google Drive, kept 7 days) ---------- */
function shareFolder_(f) { try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { Logger.log('Folder sharing failed: ' + (e.message || e)); } }
function photoFolder_(fk) {
  const props = PropertiesService.getScriptProperties();
  let root = null; const id = props.getProperty('PHOTO_DIR');
  if (id) { try { root = DriveApp.getFolderById(id); if (root.isTrashed()) root = null; } catch (e) { root = null; } }
  if (!root) { root = DriveApp.createFolder(CFG.PHOTO_FOLDER); props.setProperty('PHOTO_DIR', root.getId()); shareFolder_(root); }
  if (!fk) return root;
  const name = FORMS[fk].title, it = root.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  const nf = root.createFolder(name); shareFolder_(nf); return nf;
}
/* photos arrive as an array aligned to the form's slots (null = empty) */
function parsePhotos_(list, n) {
  const out = [];
  (Array.isArray(list) ? list : []).slice(0, n).forEach(function (d, i) {
    if (!d) return;
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+\/=]+)$/.exec(String(d));
    if (!m) throw new Error('INVALID: photo ' + (i + 1) + ' is not a valid image.');
    if (m[2].length > 10 * 1024 * 1024) throw new Error('INVALID: photo ' + (i + 1) + ' is too large.');
    out.push({ i: i, mime: m[1], b64: m[2] });
  });
  return out;
}
function savePhotos_(fk, date, time, name, list, label) {
  const urls = []; if (!list.length) return urls;
  const dir = photoFolder_(fk), stamp = Utilities.formatDate(new Date(), CFG.TZ, 'HHmmss'), slots = FORMS[fk].slots;
  const safe = name.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').slice(0, 30) || 'doer';
  let inh = null;
  list.forEach(function (p) {
    const lab = (label && p.i === 0) ? label : slots[p.i].n, slug = lab.replace(/[^\w]+/g, '-').slice(0, 30);
    const ext = p.mime === 'image/png' ? '.png' : p.mime === 'image/webp' ? '.webp' : '.jpg';
    const blob = Utilities.newBlob(Utilities.base64Decode(p.b64), p.mime, [fk, date, stamp, slug, safe].join('_') + ext);
    const f = dir.createFile(blob);
    /* files inherit the folder's "anyone with the link" sharing (set in setup); only if they do not, share each file */
    if (inh === null) { try { inh = f.getSharingAccess() === DriveApp.Access.ANYONE_WITH_LINK; } catch (e) { inh = false; } }
    if (!inh) { try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {} }
    urls.push({ l: lab, u: f.getUrl() });
  });
  return urls;
}
/* daily trigger: keeps only today and the previous 6 days of photos (older files go to the Drive bin) */
function purgePhotos() {
  const lim = new Date(new Date(Utilities.formatDate(new Date(Date.now() - (CFG.PHOTO_DAYS - 1) * 864e5), CFG.TZ, 'yyyy-MM-dd') + 'T00:00:00+05:30'));
  const root = photoFolder_(); let n = 0;
  const sweep = function (dir) {
    const fi = dir.getFiles();
    while (fi.hasNext()) { const f = fi.next(); if (f.getDateCreated() < lim) { f.setTrashed(true); n++; } }
  };
  sweep(root);
  const fo = root.getFolders();
  while (fo.hasNext()) sweep(fo.next());
  Logger.log('Photo purge done, ' + n + ' file(s) older than ' + lim + ' moved to bin.');
}

/* ---------- e-mail alerts to Naveen ---------- */
function mailAlert_(fk, name, date, time, warns, bad, urls, data, meterName, late, aid, released) {
  try {
    /* BUILD 11: a wrong-reading / late mail waits until 4 pm; the 30-minute trigger sends it then (and only if the person is not saving after 4 pm) */
    if ((warns.length || late) && !released && nowHM_() < ALERT_AT) {
      PropertiesService.getScriptProperties().setProperty('HOLD_' + Date.now() + '_' + Math.floor(Math.random() * 1e6), JSON.stringify([fk, name, date, time, warns, bad, urls, data, meterName, late || '', aid || '']));
      return true;
    }
    const F_ = FORMS[fk], isM = fk === 'METER';
    const subject = (bad || warns.length ? '⚠ ALERT: ' : late ? '⏰ LATE: ' : 'Reading received: ') + F_.title + (meterName ? ' (' + meterName + ')' : '') + ' – ' + date + ' ' + time;
  const build = function (full) {
    let h = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">' +
      '<h2 style="margin:0 0 6px">' + esc_(F_.icon + ' ' + F_.title + (meterName ? ' – ' + meterName : '')) + '</h2>' +
      '<p style="margin:0 0 10px;color:#555">Entry date ' + esc_(date) + ' ' + esc_(time) + ' · by <b>' + esc_(name) + '</b></p>';
    if (warns.length) {
      h += '<p style="color:#b91c1c;font-weight:bold;margin:8px 0 4px">Out of limits / needs attention:</p><ul style="margin:0 0 10px">' +
        warns.map(function (w) { return '<li>' + esc_(w) + '</li>'; }).join('') + '</ul>';
    } else h += '<p style="color:#047857;margin:8px 0">All readings are within the allowed range.</p>';
    if (late) h += '<p style="color:#c2410c;font-weight:bold;margin:8px 0">⏰ ' + esc_(late) + '</p>';
    if (warns.length || late) h += '<p style="margin:8px 0;font-weight:bold;color:#b91c1c">Action deadline: ' + esc_(t12_(ACTION_BY)) + (nowHM_() >= ACTION_BY ? ' tomorrow' : ' today') + '</p>';
    if (aid && warns.length) h += '<p style="margin:8px 0;padding:6px 10px;background:#fef3c7;border:1px solid #fcd34d">Alert ID <b>' + esc_(aid) + '</b>. The action taken to fix this will be recorded on the portal and e-mailed to the same people.</p>';
    if (isM && full) {
      h += '<table style="border-collapse:collapse"><tbody>' + F_.fields.filter(function (f) { return data[f.k] !== '' && data[f.k] != null; }).map(function (f) {
        const b = chk_(f, data[f.k], data) === 'bad';
        return '<tr><td style="border:1px solid #ddd;padding:3px 8px">' + esc_(f.n) + '</td><td style="border:1px solid #ddd;padding:3px 8px;' + (b ? 'background:#fecaca;font-weight:bold' : '') + '">' + esc_(data[f.k]) + '</td><td style="border:1px solid #ddd;padding:3px 8px;color:#666">' + esc_(rule_(f)) + '</td></tr>';
      }).join('') + '</tbody></table>';
    }
    if (urls.length) h += '<p style="margin:10px 0 4px"><b>Photos (kept 7 days):</b></p>' + urls.map(function (x) { return '<div><a href="' + esc_(x.u) + '">' + esc_(x.l) + '</a></div>'; }).join('');
    h += '<p style="color:#888;font-size:12px;margin-top:14px">Automatic message from the Plant Electrical Portal.</p></div>';
    return h;
  };
    /* Naveen gets every METER reading and every flawed entry; the extra people get ONLY entries that have something wrong, and only the wrong fields */
    MailApp.sendEmail({ to: CFG.ALERT_TO, subject: subject, htmlBody: build(true), name: CFG.TITLE });
    if (warns.length) {
      const extra = [].concat(CFG.ALERT_EXTRA || []).join(',').split(/[\s,;]+/).filter(function (x) { return /@/.test(x) && x.toLowerCase() !== String(CFG.ALERT_TO).toLowerCase(); });
      if (extra.length) { try { MailApp.sendEmail({ to: extra.join(','), subject: subject, htmlBody: build(false), name: CFG.TITLE }); } catch (e2) { Logger.log('Extra alert mail failed: ' + (e2.message || e2)); } }
    }
    return true;
  } catch (e) { Logger.log('Alert mail failed: ' + (e.message || e)); return false; }
}

/* ---------- sheets ---------- */
/* ---------- overdue check: ONE e-mail per missed item per day, never repeated ---------- */
function missedNow_() {
  const out = [], today = today_(), hm = nowHM_();
  const past = function (d, t) { return today > d || (today === d && hm >= t); };
  Object.keys(DUE).forEach(function (fk) {
    const F_ = FORMS[fk], u = DUE[fk];
    if (!F_ || fk === 'DG') return;            /* DG runs only when the set runs: its entries are only flagged LATE, never reported as missing */
    if (u.dow) {                               /* weekly form: stays overdue until it is done this week */
      const ws = weekStart_(today), d = addDays_(ws, u.dow - 1);
      if (!past(d, u.t) || readRows_(fk, ws, null).length) return;
      out.push({ key: fk + '|' + ws, label: F_.icon + ' ' + F_.title + ' (weekly)', by: (d === today ? '' : lbl_(d) + ' ') + u.t });
      return;
    }
    if (F_.byMeter) {
      const rows = readRows_(fk, today, today), row = rows.length ? rows[rows.length - 1] : null;
      METERS.forEach(function (m) {
        const t = dueOf_(fk, today, m).t; if (hm < t) return;
        if (!row || m.f.some(function (f) { return row.v[f] === '' || row.v[f] == null; })) out.push({ key: fk + '|' + m.k + '|' + today, label: F_.icon + ' ' + F_.title + ' – ' + m.n, by: t });
      });
      return;
    }
    const t = dueOf_(fk, today).t; if (hm < t) return;
    if (!readRows_(fk, today, today).length) out.push({ key: fk + '|' + today, label: F_.icon + ' ' + F_.title, by: t });
  });
 /* BUILD 10: weekly / monthly checks that are still not done (due from their day, by the form's fixed time) */
  Object.keys(PER).forEach(function (fk) {
    Object.keys(PER[fk]).forEach(function (k) {
      const st = perStart_(PER[fk][k], today);
      if (st < perEff_(fk, k) || !past(st, (DUE[fk] || { t: '09:00' }).t) || !perDue_(fk, k, today)) return;
      out.push({ key: fk + '|' + k + '|' + st, label: FORMS[fk].icon + ' ' + FORMS[fk].title + ' – ' + perLabel_(fk, k), by: (st === today ? '' : lbl_(st) + ' ') + (DUE[fk] || { t: '09:00' }).t });
    });
  });
  /* BUILD 10b: a run that was STARTED but whose stop time is still not entered after 12 hours */
  const op = dgOpen_();
  if (op && (Date.now() - Date.parse(op.date + 'T' + op.v.start + ':00+05:30')) > 12 * 3600 * 1000)
    out.push({ key: 'DGOPEN|' + op.date + '|' + op.v.start, label: FORMS.DG.icon + ' ' + FORMS.DG.title + ' – Stop time not entered', by: 'now', msg: 'Stop time not entered. Run started ' + op.date + ' ' + op.v.start + ' by ' + op.name });
  const ci = cleanInfo_();
  if (past(ci.due, ci.by)) out.push({ key: 'CLEAN|' + ci.due, label: '🧽 Solar panel cleaning (planned for ' + lbl_(ci.due) + ')', by: (ci.due === today ? '' : lbl_(ci.due) + ' ') + ci.by });
  return out;
}
function perLabel_(fk, k) {
  const f = FORMS[fk].fields.filter(function (x) { return x.k === k; })[0];
  return f.n + ' (' + perText_(fk, k) + ')';
}
function releaseHeld_() {
  if (nowHM_() < ALERT_AT) return;
  const props = PropertiesService.getScriptProperties(), lock = LockService.getScriptLock(), jobs = [];
  if (!lock.tryLock(5000)) return;
  try {
    const all = props.getProperties();
    Object.keys(all).filter(function (k) { return k.indexOf('HOLD_') === 0; }).sort().forEach(function (k) {
      try { jobs.push({ k: k, a: JSON.parse(all[k]) }); } catch (e) {}
      props.deleteProperty(k);
    });
  } finally { lock.releaseLock(); }
  jobs.forEach(function (j) {
    const a = j.a.slice(0, 11); a.push(true);
    try { if (!mailAlert_.apply(null, a)) props.setProperty(j.k, JSON.stringify(j.a)); } catch (e) { props.setProperty(j.k, JSON.stringify(j.a)); }
  });
}
function checkMissed() {
  try { dgAutoStop_(); } catch (e) { Logger.log('DG auto stop failed: ' + (e.message || e)); }
  try { dailyMails_(); } catch (e) { Logger.log('Daily mails failed: ' + (e.message || e)); }
  try { dgDailyReport_(); } catch (e) { Logger.log('DG daily report failed: ' + (e.message || e)); }
  try { releaseHeld_(); } catch (e) { Logger.log('Held alert mails failed: ' + (e.message || e)); }
  if (nowHM_() < ALERT_AT) return;      /* BUILD 11: "not done in time" alerts are raised from 4 pm, and only for what is STILL not filled */
  const items = missedNow_(); if (!items.length) return;
  const props = PropertiesService.getScriptProperties(), day = today_();
  let fresh = [];
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    let seen = {}; try { seen = JSON.parse(props.getProperty('MISS_SEEN') || '{}'); } catch (e) { seen = {}; }
    fresh = items.filter(function (i) { return !seen[i.key]; });
    if (fresh.length) {
      fresh.forEach(function (i) { seen[i.key] = day; });
      const sol = fresh.filter(function (i) { return i.key.indexOf('SOLAR|') === 0; });
      if (sol.length) { const sid = newAlert_('OVERDUE', 'Solar & Dept Meters', day, '', sol.length + ' meter(s) not entered: ' + sol.map(function (i) { return i.label.replace(/^.*– /, ''); }).join(', '), 'MAIN'); sol.forEach(function (i) { i.aid = sid; }); }
      fresh.forEach(function (i) { if (!i.aid) i.aid = newAlert_('OVERDUE', i.label.replace(/^\S+\s/, ''), day, '', i.msg || 'Not done by ' + i.by, 'MAIN'); });
      Object.keys(seen).forEach(function (k) { if (daysBetween_(day, seen[k]) > 8) delete seen[k]; });
      props.setProperty('MISS_SEEN', JSON.stringify(seen));
    }
  } finally { lock.releaseLock(); }
  if (!fresh.length) return;
  bump_();
  try {
    const h = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111"><h2 style="margin:0 0 6px;color:#b91c1c">⏰ Entry not done: time has passed</h2>' +
      '<p style="margin:0 0 10px;color:#555">' + esc_(day) + ' · these entries were not submitted by their fixed time:</p><table style="border-collapse:collapse"><tbody>' +
      fresh.map(function (i) { return '<tr><td style="border:1px solid #ddd;padding:4px 10px">' + esc_(i.label) + '</td><td style="border:1px solid #ddd;padding:4px 10px;color:#b91c1c">' + (i.msg ? esc_(i.msg) : 'due by ' + esc_(i.by)) + '</td><td style="border:1px solid #ddd;padding:4px 10px;color:#666">' + esc_(i.aid) + '</td></tr>'; }).join('') +
      '</tbody></table><p style="color:#888;font-size:12px;margin-top:14px">Action deadline: ' + esc_(t12_(ACTION_BY)) + '. You get this message once for each missed entry. The action taken is recorded on the portal under the alert ID. Automatic message from the Plant Electrical Portal.</p></div>';
    MailApp.sendEmail({ to: CFG.ALERT_TO, subject: '⏰ ' + fresh.length + ' entry(ies) not done after the fixed time – ' + day, htmlBody: h, name: CFG.TITLE });
  } catch (e) { Logger.log('Missed mail failed: ' + (e.message || e)); }
}

/* alert e-mails are queued and sent within a minute by flushMail (so the person saving never waits for Gmail) */
function queueMail_(fk, name, date, time, warns, bad, urls, data, meterName, late, aid) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('MQ_ON') !== '1') return mailAlert_(fk, name, date, time, warns, bad, urls, data, meterName, late, aid);
  try {
    props.setProperty('MQ_' + Date.now() + '_' + Math.floor(Math.random() * 1e6), JSON.stringify({ a: [fk, name, date, time, warns, bad, urls, data, meterName, late || '', aid || ''], n: 0 }));
    return true;
  } catch (e) { return mailAlert_(fk, name, date, time, warns, bad, urls, data, meterName, late, aid); }
}
function flushMail() {
  const props = PropertiesService.getScriptProperties(), lock = LockService.getScriptLock(), jobs = [];
  if (!lock.tryLock(5000)) return;
  try {
    const all = props.getProperties();
    Object.keys(all).filter(function (k) { return k.indexOf('MQ_') === 0 && k !== 'MQ_ON'; }).sort().forEach(function (k) {
      try { jobs.push({ k: k, o: JSON.parse(all[k]) }); } catch (e) {}
      props.deleteProperty(k);
    });
  } finally { lock.releaseLock(); }
  jobs.forEach(function (j) {
    if (mailAlert_.apply(null, j.o.a)) return;
    j.o.n++; if (j.o.n < 3) props.setProperty(j.k, JSON.stringify(j.o));
  });
}

function headers_(fk) { return ['Timestamp','Doer name','Date','Time'].concat(FORMS[fk].fields.map(function (f) { return f.n; }), ['Warnings','Photos']); }
function oldHeaders_(fk) { return ['Timestamp','Email','Date','Time'].concat(FORMS[fk].fields.map(function (f) { return f.n; }), ['Warnings']); }
function hdrIs_(sh, h) { return sh.getMaxColumns() >= h.length && sh.getRange(1, 1, 1, h.length).getValues()[0].join('|') === h.join('|'); }
function sheet_(fk) {
  if (MEMO['s_' + fk]) return MEMO['s_' + fk];
  const F_ = FORMS[fk], ss = ss_();
  let sh = ss.getSheetByName(F_.sheet);
  if (!sh) {
    sh = ss.insertSheet(F_.sheet);
    const h = headers_(fk);
    if (sh.getMaxColumns() < h.length) sh.insertColumnsAfter(sh.getMaxColumns(), h.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('dd-mmm-yyyy hh:mm:ss');
    sh.getRange('C:D').setNumberFormat('@');
    F_.fields.forEach(function (f, i) { if (f.t === 'time') sh.getRange(1, 5 + i, sh.getMaxRows(), 1).setNumberFormat('@'); });
  }
  return MEMO['s_' + fk] = sh;
}
function layoutOk_(fk) {
  MEMO.lay = MEMO.lay || {};
  if (MEMO.lay[fk] !== undefined) return MEMO.lay[fk];
  if (hdrIs_(sheet_(fk), headers_(fk))) return MEMO.lay[fk] = true;
  /* build 10: the new columns are added automatically on first use (safe cases only, old data kept) */
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try { delete MEMO['s_' + fk]; migrateSheets_(true); delete MEMO['s_' + fk]; } finally { lock.releaseLock(); }
  return MEMO.lay[fk] = hdrIs_(sheet_(fk), headers_(fk));
}
const ADDED = {
  SOLAR: ['Solar cleaning done?'],
  SERVO: ['Oil level servo', 'Oil level transformer', 'Oil leakage', 'Noise abnormal'],
  UPS1: ['AC working', 'Weekly backup check'],
  UPS2: ['AC working', 'Weekly backup check'],
  COMP: ['Prefilter cleaning', 'Due point', 'Air filter cleaning (weekly)', 'Compressor radiator cleaning', 'Dryer radiator cleaning'],
  DG: ['Entry part', 'Diesel stock', 'Lube oil pressure', 'Coolant level', 'Air filter cleaning (monthly)', 'Stopped by']
};
/* one full copy of the spreadsheet before the first layout change of build 10 */
function backupOnce_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('BACKUP_B10')) return;
  try {
    const f = DriveApp.getFileById(ss_().getId()).makeCopy(ss_().getName() + ' – BACKUP before build 10 (' + Utilities.formatDate(new Date(), CFG.TZ, 'dd-MMM-yyyy HH:mm') + ')');
    props.setProperty('BACKUP_B10', f.getId()); Logger.log('Backup copy created: ' + f.getUrl());
  } catch (e) { Logger.log('Backup copy failed (continue anyway): ' + (e.message || e)); }
}
/* UNDO: removes ONLY the columns added by build 10, if you ever need to go back to build 9 (run it, then deploy the old code) */
function undoBuild10() {
  Object.keys(ADDED).forEach(function (fk) {
    if (fk === 'SOLAR') return;
    const sh = ss_().getSheetByName(FORMS[fk].sheet); if (!sh) return;
    ADDED[fk].forEach(function (name) {
      const hdr = sh.getRange(1, 1, 1, sh.getMaxColumns()).getValues()[0], at = hdr.indexOf(name) + 1;
      if (at > 0) sh.deleteColumn(at);
    });
  });
  bump_();
  Logger.log('Build 10 columns removed. Deploy the build 9 code again.');
}
function migrateSheets_(auto) {
  Object.keys(FORMS).forEach(function (fk) {
    const sh = ss_().getSheetByName(FORMS[fk].sheet); if (!sh) return;
    if (hdrIs_(sh, headers_(fk))) return;
    const h = headers_(fk), old = oldHeaders_(fk);
    if (hdrIs_(sh, old)) {
      const need = old.length + 1;
      if (sh.getMaxColumns() < need) sh.insertColumnsAfter(sh.getMaxColumns(), need - sh.getMaxColumns());
      sh.getRange(1, 2).setValue('Doer name');
      sh.getRange(1, need).setValue('Photos').setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
      Logger.log(FORMS[fk].sheet + ' upgraded (data kept).');
      return;
    }
    /* a new field was added inside the form (SOLAR: 'Solar cleaning done?'): insert its column, old data stays aligned */
    const added = ADDED[fk] || [];
    let from = -1;                                  /* the sheet may already have the first j added columns (an earlier build): find where it stops */
    for (let j = added.length - 1; j >= 0 && from < 0; j--) { if (hdrIs_(sh, h.filter(function (x) { return added.slice(j).indexOf(x) < 0; }))) from = j; }
    if (added.length && from >= 0) {
      backupOnce_();
      added.slice(from).forEach(function (name) {              /* ascending order: each new column goes in front of Warnings, old rows stay blank there */
        const at = h.indexOf(name) + 1;
        sh.insertColumnBefore(at);
        sh.getRange(1, at).setValue(name).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
      });
      FORMS[fk].fields.forEach(function (f, i) { if (f.t === 'time') sh.getRange(1, 5 + i, sh.getMaxRows(), 1).setNumberFormat('@'); });
      Logger.log(FORMS[fk].sheet + ': ' + (added.length - from) + ' new column(s) added (old data kept, blank in the new columns).');
      return;
    }
    /* same structure, only some column titles renamed (e.g. HWH -> KWH) */
    if (sh.getMaxColumns() >= h.length && String(sh.getRange(1, 2).getValue()) === 'Doer name' && String(sh.getRange(1, h.length).getValue()) === 'Photos') {
      sh.getRange(1, 1, 1, h.length).setValues([h]);
      Logger.log(FORMS[fk].sheet + ' column titles refreshed (data kept).');
      return;
    }
    if (auto) return;                                 /* automatic mode never renames a sheet */
    const nn = FORMS[fk].sheet + '_OLD_' + Utilities.formatDate(new Date(), CFG.TZ, 'yyMMdd_HHmm');
    sh.setName(nn);
    Logger.log('Unknown layout of ' + FORMS[fk].sheet + ' kept as ' + nn);
  });
}
function migrateLog_() {
  const sh = ss_().getSheetByName(CFG.LOG_SHEET); if (!sh) return;
  if (String(sh.getRange(1, 2).getValue()) === 'Email') sh.getRange(1, 2).setValue('Doer name');
  if (sh.getMaxColumns() < 9) sh.insertColumnsAfter(sh.getMaxColumns(), 9 - sh.getMaxColumns());
  if (String(sh.getRange(1, 9).getValue()) !== 'Photos') sh.getRange(1, 9).setValue('Photos').setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
}
function logSheet_() {
  if (MEMO.log) return MEMO.log;
  const ss = ss_(); let sh = ss.getSheetByName(CFG.LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CFG.LOG_SHEET);
    if (sh.getMaxColumns() < 9) sh.insertColumnsAfter(sh.getMaxColumns(), 9 - sh.getMaxColumns());
    sh.getRange(1, 1, 1, 9).setValues([['Timestamp','Doer name','Form','Entry date','Time','Out of range','Warnings','Data (JSON)','Photos']])
      .setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('dd-mmm-yyyy hh:mm:ss');
    sh.getRange('D:E').setNumberFormat('@');
  }
  return MEMO.log = sh;
}

/* RUN ONCE from the editor (again after every new build). Links data, upgrades tabs, photo folders, daily photo clean-up, mail permission. */
function setup() {
  if (!CFG.DATA_ID) {
    let bound = null; try { bound = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { bound = null; }
    const props = PropertiesService.getScriptProperties();
    if (!bound && !props.getProperty('DATA_ID')) {
      const n = SpreadsheetApp.create('Plant Electrical Portal - data');
      props.setProperty('DATA_ID', n.getId());
      Logger.log('Created data spreadsheet: ' + n.getUrl());
    }
  }
  migrateSheets_();
  migrateLog_();
  Object.keys(FORMS).forEach(sheet_);
  logSheet_(); actSheet_(); revSheet_();
  const pf = photoFolder_();
  Object.keys(FORMS).forEach(function (k) { photoFolder_(k); });
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'purgePhotos') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('purgePhotos').timeBased().everyDays(1).atHour(2).inTimezone(CFG.TZ).create();
  shareFolder_(pf); Object.keys(FORMS).forEach(function (k) { shareFolder_(photoFolder_(k)); });
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'flushMail') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('flushMail').timeBased().everyMinutes(1).create();
  PropertiesService.getScriptProperties().setProperty('MQ_ON', '1');
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'checkMissed') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkMissed').timeBased().everyMinutes(30).create();
  MailApp.sendEmail({ to: CFG.ALERT_TO, subject: 'Plant Electrical Portal: alert e-mail test (build ' + BUILD + ')', body: 'Setup finished. Naveen will receive automatic alerts at this address.', name: CFG.TITLE });
  bump_();
  Logger.log('READY (build ' + BUILD + '). Data spreadsheet: ' + ss_().getUrl());
  Logger.log('Photo folder: ' + pf.getUrl());
}

function seedBackfill() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SEEDED')) { Logger.log('Backfill was already done. Nothing changed.'); return; }
  const N = 'Backfill', S = { seed: true };
  [['2026-09-30','','',79357,''],['2026-10-01','03:08','03:13',79370,60],['2026-10-03','11:10','13:10','',''],
   ['2026-10-03','13:50','15:10','',''],['2026-10-03','11:25','11:55',79697,86],['2026-10-05','09:55','10:25',79728,82],
   ['2026-10-06','11:00','12:05','',''],['2026-10-06','04:15','07:50',80317,90],['2026-10-07','10:00','10:30','',''],
   ['2026-10-08','12:40','13:15',80338,82]
  ].forEach(function (r) {
    saveEntry_('DG', { date: r[0], time: r[1] || '00:00', name: N, allowDup: true, v: { start: r[1], stop: r[2], hwh: r[3], coolant: r[4], diesel: '' } }, S);
  });
  const P = [[5,6.5,5.8,5.6],[10,12.8,12.2,12.4],[15,18.2,19.0,19.8],[15,16.6,15.5,14.2],[15,19.1,17.6,18.6],[15,17.9,18.5,19.2],
    [15,18.5,20.2,19.6],[15,18.1,18.2,20.7],[20,23.1,24.0,24.8],[20,26.3,22.2,23.5],[15,20.1,19.1,18.2],[15,18.4,18.0,18.9],
    [10,17.3,0.1,16.6],[10,10.5,10.8,10.3],[20,26.9,25.1,23.9],[20,0.2,0.1,0.2],[20,24.9,26.9,21.9],[20,19.6,24.1,25],
    [25,33.0,31.5,31.2],[25,0.3,0.7,0.4]];
  const v = {};
  P.forEach(function (r, i) {
    const p = 'c' + (i + 1) + '_';
    v[p + 'kv'] = String(r[0]); v[p + 'r'] = r[1]; v[p + 'y'] = r[2]; v[p + 'b'] = r[3];
    v[p + 'ct'] = i === 12 ? 'NOT OK' : 'OK'; v[p + 'fu'] = 'OK'; v[p + 'tm'] = 'OK'; v[p + 'ch'] = 'OK'; v[p + 'rm'] = '';
  });
  saveEntry_('PFP', { date: '2026-10-12', time: '11:45', name: N, allowDup: true, v: v }, S);
  props.setProperty('SEEDED', '1');
  Logger.log('Backfill done.');
}

/* read each tab ONCE per call */
function readAll_(fk) {
  if (MEMO['r_' + fk]) return MEMO['r_' + fk];
  const F_ = FORMS[fk], sh = sheet_(fk), last = sh.getLastRow(), nf = F_.fields.length, out = [];
  if (last >= 2) {
    const start = Math.max(2, last - TAIL + 1);
    const v = sh.getRange(start, 1, last - start + 1, 6 + nf).getValues();
    for (let i = 0; i < v.length; i++) {
      const r = v[i], d = iso_(r[2]); if (!d) continue;
      const vals = {};
      for (let j = 0; j < nf; j++) {
        const f = F_.fields[j]; let x = r[4 + j];
        if (f.t === 'time' && x instanceof Date) x = Utilities.formatDate(x, CFG.TZ, 'HH:mm');
        if (f.t === 'sel' && x !== '' && x != null) x = String(x);
        vals[f.k] = (x === '' || x == null) ? '' : x;
      }
      out.push({ tsn: +new Date(r[0]), name: String(r[1] || ''), date: d, time: tm_(r[3]), v: vals, ph: phList_(r[5 + nf]), late: /LATE:/.test(String(r[4 + nf] || '')), imp: /IMPORTED FROM EXCEL/.test(String(r[4 + nf] || '')) });
    }
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.tsn - b.tsn; });
    for (let i = 0; i < out.length; i++) {
      const o = out[i]; o.bad = []; o.roll = [];
      for (let j = 0; j < nf; j++) {
        const f = F_.fields[j], x = o.v[f.k];
        if (x !== '' && chk_(f, x, o.v) === 'bad') o.bad.push(f.k);
        if (f.cum && i > 0 && x !== '' && out[i - 1].v[f.k] !== '' && x < out[i - 1].v[f.k]) o.roll.push(f.k);
      }
    }
  }
  return MEMO['r_' + fk] = out;
}
function readRows_(fk, from, to) {
  return readAll_(fk).filter(function (o) { return (!from || o.date >= from) && (!to || o.date <= to); });
}
function withTs_(rows) { return rows.map(function (o) { return Object.assign({ ts: ts_(o.tsn) }, o); }); }
function tailRows_(fk, n) {
  const F_ = FORMS[fk], sh = sheet_(fk), last = sh.getLastRow(); if (last < 2) return [];
  const start = Math.max(2, last - n + 1);
  return sh.getRange(start, 1, last - start + 1, 4 + F_.fields.length).getValues().map(function (r) {
    const vals = {}; F_.fields.forEach(function (f, j) { const x = r[4 + j]; vals[f.k] = (x === '' || x == null) ? '' : x; });
    return { date: iso_(r[2]), name: String(r[1] || ''), v: vals, ts: +new Date(r[0]) };
  }).filter(function (r) { return r.date; });
}

/* ---------- entry API ---------- */
function bootData_(only) {
  const keys = only ? [only] : Object.keys(FORMS);
  keys.forEach(function (k) { if (!layoutOk_(k)) throw new Error(LAYOUT_MSG); });
  const today = today_(), forms = {}, last = {}, lastv = {}, status = {}, dates = {};
  keys.forEach(function (k) {
    const F_ = FORMS[k];
    forms[k] = { title: F_.title, icon: F_.icon, multi: !!F_.multi, optional: !!F_.optional, table: !!F_.table, inline: !!F_.inline, byMeter: !!F_.byMeter,
      weekly: !!F_.weekly, every: F_.every || 0, parts: !!F_.parts, perInfo: PER[k] ? perInfo_(k) : null, perText: PER[k] ? Object.keys(PER[k]).reduce(function (o, q) { o[q] = perText_(k, q); return o; }, {}) : null, due: dueText_(k), dueRaw: DUE[k] || null, tbl: F_.table || '', slots: F_.slots, meters: F_.byMeter ? METERS : null,
      fields: F_.fields.map(function (f) {
        return { k: f.k, n: f.n, g: f.g, t: f.t, step: f.step, u: f.u || '', lo: f.lo, hi: f.hi, strict: !!f.strict, cum: !!f.cum, mf: f.mf || 1,
                 opts: f.opts, ok: f.ok, dyn: f.dyn || '', ph: f.ph || '', def: f.def == null ? '' : f.def, opt: !!f.opt, req: !!f.req, needIf: f.needIf || '', dec: f.dec || 0, hard: f.hard == null ? null : f.hard, cond: !!f.cond, n10: (NEW10[k] || []).indexOf(f.k) > -1, part: f.part || '', rp: f.rp || '', per: !!f.per, hid: !!f.hid, rule: rule_(f) };
      }) };
    const rows = readAll_(k), l = rows.length ? rows[rows.length - 1] : null;
    last[k] = l ? { date: l.date, time: l.time, name: l.name, v: l.v, ts: ts_(l.tsn) } : null;
    const lv = {};
    for (let i = rows.length - 1; i >= 0; i--) F_.fields.forEach(function (f) { if (lv[f.k] === undefined && rows[i].v[f.k] !== '' && rows[i].v[f.k] != null) lv[f.k] = rows[i].v[f.k]; });
    lastv[k] = lv;
    let n = 0, bad = 0;
    for (let i = rows.length - 1; i >= 0 && rows[i].date >= today; i--) if (rows[i].date === today) { n++; bad += rows[i].bad.length; }
    status[k] = { n: n, bad: bad };
    if (F_.every) {
      const d = l ? daysBetween_(today, l.date) : null, ws = weekStart_(today);
      status[k].due = { due: F_.weekly ? !rows.some(function (r) { return weekStart_(r.date) === ws; }) : (d === null || d >= F_.every), days: d };
    }
    const ds = [];
    rows.forEach(function (r) { if (!ds.length || ds[ds.length - 1] !== r.date) ds.push(r.date); });
    dates[k] = ds.slice(-120);
  });
  let dgPrev = null;
  if (!only || only === 'DG') readAll_('DG').forEach(function (r) { if (r.v.hwh !== '' && r.v.hwh != null) dgPrev = r.v.hwh; });
  return { build: BUILD, eff: EFF, title: CFG.TITLE, today: today, photoReq: CFG.PHOTO_REQUIRED, photoDays: CFG.PHOTO_DAYS, forms: forms, last: last, lastv: lastv, status: status, dates: dates, dgPrev: dgPrev, dgToday: (!only || only === 'DG') ? dgDay_(today) : null, dgOpen: (!only || only === 'DG') ? dgOpenInfo_() : null, clean: (!only || only === 'SOLAR') ? cleanInfo_() : null, fuel: (!only || only === 'DG' || only === 'DSTOCK') ? dgFuelBrief_() : null };
}

/* barcode page: only this one form is returned */
/* the form page gets its data inside the page itself (no second round trip); cached until the next save */
function formBootCached_(fk) {
  const key = 'fboot|' + fk + '|' + today_() + '|' + ver_();
  let d = cacheGet_(key);
  if (!d) { d = bootData_(fk); cachePut_(key, d, 300); }
  return d;
}
function getFormBoot(fk) {
  fk = String(fk || '').toUpperCase();
  if (!FORMS[fk]) throw new Error('Unknown form.');
  return formBootCached_(fk);
}
/* admin page */
function getAdminStart(pin) {
  pin_(pin);
  const key = 'start|' + ver_();
  let s = cacheGet_(key);
  if (!s) {
    const to = today_(), from = to.slice(0, 8) + '01';
    s = { boot: bootData_(), dash: dashCompute_(from, to) };
    cachePut_(key, s, 180);
  }
  return { boot: s.boot, dash: s.dash, url: webUrl_() };
}

function submitEntry(fk, p) { return saveEntry_(fk, p, {}); }

function saveEntry_(fk, p, o) {
  o = o || {};
  const F_ = FORMS[fk]; if (!F_) throw new Error('Unknown form');
  p = p || {};
  const name = cleanName_(p.name);
  if (name.length < 2) throw new Error('MISSING: enter the doer name.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) throw new Error('Pick a valid date.');
  if (!o.seed && p.date > today_()) throw new Error('The entry date cannot be in the future.');
  if (!layoutOk_(fk)) throw new Error(LAYOUT_MSG);

  /* meter-wise form (Solar & Dept): one meter per submission */
  let M = null;
  if (F_.byMeter) {
    M = METERS.filter(function (m) { return m.k === p.meter; })[0];
    if (!M) throw new Error('MISSING: choose the meter / department.');
  }

  /* BUILD 10: DG is saved as one of two parts (RUN = start/stop, READ = meter reading + checks) */
  let part = '';
  if (F_.parts) {
    part = String((p.v && p.v.part) || p.part || '');
    if (part !== '' && part !== 'RUN' && part !== 'READ' && part !== 'STOP') throw new Error('INVALID: unknown DG part.');
    if (part === 'STOP') return dgStop_(p, name);
    if (part === '' && !o.seed) throw new Error('MISSING: choose "Run log" or "Reading & checks".');
  }
  /* periodic checks (weekly / monthly) that are due for this entry date */
  const perOn = {};
  Object.keys(PER[fk] || {}).forEach(function (k) { perOn[k] = !o.seed && perDue_(fk, k, p.date); });
  const slotPart = function (s) { return !(F_.parts && part && s.part && s.part !== part) && !(s.n10 && p.date < EFF); };

  /* photos: array aligned to slots */
  const slots = F_.slots || [];
  const photos = parsePhotos_(p.photos, slots.length);
  const missPh = slots.filter(function (s, i) { return (s.req || (s.per && perOn[s.per])) && slotPart(s) && !photos.some(function (x) { return x.i === i; }); });
  if (!o.seed && CFG.PHOTO_REQUIRED && missPh.length) throw new Error('MISSING: photo still to upload: ' + missPh.map(function (s) { return s.n; }).join(', ') + '.');

  const data = {}, errs = [], miss = [];
  F_.fields.forEach(function (f) {
    let v = (p.v && p.v[f.k] != null) ? p.v[f.k] : '';
    if (M && !inM_(M, f.k)) v = '';
    if (F_.parts && part && f.part && f.part !== part) v = '';
    if (F_.parts && part === 'RUN' && (f.k === 'stop' || f.k === 'sby')) v = '';   /* a run is STARTED first; its stop time is added later */
    if (f.k === 'part' && F_.parts) v = part;
    if (f.t === 'sel') { v = String(v).trim(); if (v !== '' && f.opts.indexOf(v) < 0) errs.push(f.n + ' has an invalid choice'); }
    else if (f.t === 'text') { v = String(v).trim().slice(0, 200); if (/^[=+\-@]/.test(v)) v = ' ' + v; }
    else if (f.t === 'time') { v = String(v).trim(); if (v !== '') { if (/^\d{1,2}:\d{2}/.test(v)) v = v.slice(0, 5); else { errs.push(f.n + ' is not a valid time'); v = ''; } } }
    else {
      if (String(v).trim() === '') v = '';
      else {
        const n = Number(v);
        if (!isFinite(n)) { errs.push(f.n + ' is not a number'); v = ''; }
        else {
          if (n < 0) errs.push(f.n + ' cannot be negative');
          if (f.dec) { const dp = String(v).trim().split('.')[1]; if (dp && dp.replace(/0+$/, '').length > f.dec) errs.push(f.n + ' allows only ' + f.dec + ' decimal places'); }
          if (f.hard != null && Number(v) > f.hard) errs.push(f.n + ' cannot be more than ' + f.hard + ' (typing mistake?)');
          v = n;
        }
      }
    }
    data[f.k] = v;
  });
  if (!o.seed) {
    F_.fields.forEach(function (f) {
      let need;
      if (M) need = M.f.indexOf(f.k) > -1;
      else if (isNew10_(fk, f.k, p.date)) need = false;
      else if (F_.parts && part === 'RUN' && f.k === 'stop') need = false;
      else if (F_.parts && part && f.part && f.part !== part) need = false;
      else if (f.per) need = !!perOn[f.k];
      else if (f.rp && part) need = f.rp === part;
      else need = isReq_(f, data);
      if (need && data[f.k] === '') miss.push(f.n);
    });
    if (M && M.k === 'solar' && data.clean === '' && cleanDueOn_(p.date)) miss.push('Solar cleaning done? (cleaning is planned for this day)');
    if (data.clean === 'Yes' && CFG.PHOTO_REQUIRED && !photos.some(function (x) { return x.i === 1; })) miss.push('Solar cleaning photo');
    if (fk === 'DSTOCK' && data.ltr !== '' && data.kind === 'Diesel received' && data.ltr <= 0) errs.push('Litres received must be more than 0');
    if (miss.length) throw new Error('MISSING: ' + miss.length + ' required field(s) are empty: ' + miss.slice(0, 8).join(', ') + (miss.length > 8 ? ' …' : ''));
    if (errs.length) throw new Error('INVALID: ' + errs.join('; '));
  }

  const idk = p.id ? 'sub|' + p.id : null;
  let fp = null;
  if (!o.seed) fp = 'fp|' + fk + '|' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify([fk, name.toLowerCase(), p.date, p.time, p.meter || '', data, photos.length])));
  if (idk) { const d1 = cacheGet_(idk); if (d1) return d1; }
  if (fp) { const d2 = cacheGet_(fp); if (d2) return d2; }

  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    if (idk) { const d3 = cacheGet_(idk); if (d3) return d3; }
    if (fp) { const d4 = cacheGet_(fp); if (d4) return d4; }
    if (F_.parts && !o.seed && part) {
      const sameDay = tailRows_(fk, 120).filter(function (r) { return r.date === p.date; });
      if (part === 'READ') {
        const ex = sameDay.filter(function (r) { return r.v.part === 'READ' || (r.v.hwh !== '' && r.v.hwh != null); });
        if (ex.length) throw new Error('DUPLICATE: the DG reading and checks for ' + p.date + ' are already submitted (by ' + ex[ex.length - 1].name + '). A second reading is not allowed. If it is wrong, contact your manager or admin to correct or delete it.');
      } else {
        const a1 = hm_(data.start);
        if (a1 === null) throw new Error('MISSING: enter the start time.');
        const op = dgOpen_();
        if (op) throw new Error('INVALID: the generator is already running (started ' + op.v.start + ' on ' + op.date + ', by ' + op.name + '). Scan again and enter its STOP time first.');
        if (p.date === today_() && a1 > hm_(nowHM_()) + 5 / 60) throw new Error('INVALID: the start time cannot be in the future.');
        const prevDay = addDays_(p.date, -1);
        const hit = tailRows_(fk, 160).filter(function (r) {
          const a2 = hm_(r.v.start), b2o = hm_(r.v.stop); if (a2 === null || b2o === null) return false;
          const b2 = b2o > a2 ? b2o : b2o + 24;
          if (r.date === p.date) return a1 >= a2 && a1 < b2;
          if (r.date === prevDay && b2o <= a2) return a1 < b2o;      /* yesterday's run that went past midnight */
          return false;
        });
        if (hit.length) throw new Error('DUPLICATE: this start time falls inside a run already saved (' + hit[0].v.start + ' to ' + hit[0].v.stop + ' on ' + hit[0].date + ', by ' + hit[0].name + '). Check the time. If a saved run is wrong, contact your manager or admin to correct or delete it.');
      }
    }
    const prior = tailRows_(fk, 80).filter(function (r) { return r.date <= p.date; });
    const priorPrev = F_.byMeter ? prior.filter(function (r) { return r.date < p.date; }) : prior;
    const prevVal = function (k) { for (let i = priorPrev.length - 1; i >= 0; i--) { const x = priorPrev[i].v[k]; if (x !== '' && x != null) return x; } return null; };
    /* one entry per period, no second entry: a wrong entry is corrected or deleted by the admin only */
    const allRows = tailRows_(fk, 120); let dup = [];
    if (F_.weekly) dup = allRows.filter(function (r) { return weekStart_(r.date) === weekStart_(p.date); });
    else if (F_.every) dup = allRows.filter(function (r) { return Math.abs(daysBetween_(p.date, r.date)) < F_.every; });
    else if (!F_.multi && !F_.byMeter) dup = allRows.filter(function (r) { return Date.now() - r.ts < 12 * 3600 * 1000; });
    if (dup.length && !o.seed) {
      const d0 = dup[dup.length - 1];
      throw new Error('DUPLICATE: ' + F_.title + (F_.weekly ? ' is already submitted for this week' : F_.every ? ' was already submitted on ' + d0.date + ' (it is due only every ' + F_.every + ' days)' : ' is already submitted for ' + p.date) + ' (by ' + d0.name + '). A second entry is not allowed. If it is wrong, contact your manager or admin to correct or delete it.');
    }
    const warns = [], vals = []; let bad = 0;
    F_.fields.forEach(function (f) {
      const v = data[f.k]; vals.push(v);
      if (v !== '' && chk_(f, v, data) === 'bad') { bad++; warns.push(f.n + ' = ' + v + ' (allowed ' + ruleFor_(f, data) + ')'); }
      if (f.cum && v !== '') { const pv = prevVal(f.k); if (pv !== null && v < pv) warns.push(f.n + ' = ' + v + ' is lower than previous reading ' + pv); }
    });
    const now = new Date();
    const nowHM = Utilities.formatDate(now, CFG.TZ, 'HH:mm');
    const alertW = warns.slice();
    const lateMsg = o.seed ? '' : lateInfo_(fk, p.date, M);
    if (lateMsg) warns.push('⏰ ' + lateMsg);
    const time = /^\d{2}:\d{2}/.test(p.time || '') ? p.time.slice(0, 5) : nowHM;
    let urls = [];
    try { urls = savePhotos_(fk, p.date, time, name, photos, M ? M.n + ' meter' : ''); }
    catch (e) { throw new Error('Photo upload to Google Drive failed: ' + (e.message || e) + '. Run setup() once in the editor to give Drive permission, then deploy a new version.'); }
    const phCell = urls.map(function (x) { return x.l + ' :: ' + x.u; }).join('\n');

    if (F_.byMeter) {
      const sh = sheet_(fk), last = sh.getLastRow(), nf = F_.fields.length;
      let rowN = 0;
      if (last >= 2) {
        const start = Math.max(2, last - TAIL + 1), ds = sh.getRange(start, 3, last - start + 1, 1).getValues();
        for (let i = ds.length - 1; i >= 0; i--) if (iso_(ds[i][0]) === p.date) { rowN = start + i; break; }
      }
      if (rowN) {
        const row = sh.getRange(rowN, 1, 1, 6 + nf).getValues()[0];
        const already = F_.fields.some(function (f, j) { return M.f.indexOf(f.k) > -1 && row[4 + j] !== '' && row[4 + j] != null; });
        if (already && !o.seed) throw new Error('DUPLICATE: the ' + M.n + ' reading for ' + p.date + ' is already submitted. A second entry is not allowed. If it is wrong, contact your manager or admin to correct or delete it.');
        F_.fields.forEach(function (f, j) { if (inM_(M, f.k)) sh.getRange(rowN, 5 + j).setValue(data[f.k]); });
        const w0 = String(row[4 + nf] || ''), p0 = String(row[5 + nf] || '');
        const wn = warns.length ? '[' + M.n + '] ' + warns.join(' | ') : '';
        sh.getRange(rowN, 5 + nf).setValue(w0 && wn ? w0 + ' | ' + wn : (w0 || wn));
        sh.getRange(rowN, 6 + nf).setValue(p0 && phCell ? p0 + '\n' + phCell : (p0 || phCell));
      } else {
        sh.appendRow([now, name, p.date, time].concat(vals, [warns.length ? '[' + M.n + '] ' + warns.join(' | ') : '', phCell]));
      }
    } else {
      sheet_(fk).appendRow([now, name, p.date, time].concat(vals, [warns.join(' | '), phCell]));
    }
    logSheet_().appendRow([now, name, fk, p.date, time, bad, (M ? '[' + M.n + '] ' : '') + warns.join(' | '), JSON.stringify(data), phCell]);
    let aid = '';
    if (!o.seed && alertW.length) { try { aid = newAlert_('FLAW', F_.title + (M ? ' – ' + M.n : ''), p.date, name, alertW.join(' | '), 'ALL'); } catch (e) { Logger.log('Alert row failed: ' + (e.message || e)); } }
    bump_();
    let mailed = false;
    if (!o.seed && (fk === 'METER' || alertW.length || lateMsg)) mailed = queueMail_(fk, name, p.date, time, alertW, bad, urls, data, M ? M.n : '', lateMsg, aid);
    const res = { ok: true, ts: ts_(now), name: name, bad: bad, warns: warns, date: p.date, time: time, data: data, photos: urls, meter: M ? M.n : '', mailed: mailed, late: lateMsg, alertId: aid };
    if (idk) cachePut_(idk, res, 600);
    if (fp) cachePut_(fp, res, 60);
    return res;
  } finally { lock.releaseLock(); }
}

function getLog(q) {
  q = q || {}; pin_(q.pin);
  const sh = logSheet_(), n = sh.getLastRow(); if (n < 2) return { rows: [] };
  const me = cleanName_(q.name).toLowerCase();
  const start = Math.max(2, n - 3000 + 1), nc = Math.min(9, sh.getMaxColumns());
  const v = sh.getRange(start, 1, n - start + 1, nc).getValues(), out = [];
  for (let i = v.length - 1; i >= 0 && out.length < 1000; i--) {
    const r = v[i], d = iso_(r[3]), who = String(r[1] || '');
    if (q.form && r[2] !== q.form) continue;
    if (q.from && d < q.from) continue; if (q.to && d > q.to) continue;
    if (q.mine && (!me || who.toLowerCase() !== me)) continue;
    if (q.q && who.toLowerCase().indexOf(String(q.q).toLowerCase()) < 0) continue;
    let data = {}; try { data = JSON.parse(r[7]); } catch (e) {}
    out.push({ row: start + i, id: +new Date(r[0]), ts: ts_(r[0]), name: who, form: r[2], date: d, time: tm_(r[4]), bad: r[5], warns: r[6], data: data, photos: phList_(nc >= 9 ? r[8] : '') });
  }
  return { rows: out };
}

/* ---------- admin: correct or delete a wrong entry (PIN protected) ---------- */
function auditSheet_() {
  const ss = ss_(); let sh = ss.getSheetByName('ADMIN_AUDIT');
  if (!sh) { sh = ss.insertSheet('ADMIN_AUDIT'); sh.getRange(1, 1, 1, 6).setValues([['When','Action','Form','Entry date','Entry by','Details']]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function logRow_(row, id, form) {
  const sh = logSheet_(); row = Number(row);
  if (!(row >= 2) || row > sh.getLastRow()) throw new Error('This entry is no longer in the log. Press Search again.');
  const r = sh.getRange(row, 1, 1, 9).getValues()[0];
  if (Math.abs(+new Date(r[0]) - Number(id)) > 1000 || r[2] !== form) throw new Error('The log has changed. Press Search again.');
  return { sh: sh, r: r };
}
function meterOf_(data) { return METERS.filter(function (m) { return data[m.f[0]] !== '' && data[m.f[0]] != null; })[0] || null; }
function findFormRow_(fk, id, date, name) {
  const F_ = FORMS[fk], sh = sheet_(fk), last = sh.getLastRow(); if (last < 2) return 0;
  const start = Math.max(2, last - TAIL * 2 + 1), v = sh.getRange(start, 1, last - start + 1, 3).getValues();
  for (let i = v.length - 1; i >= 0; i--) {
    if (F_.byMeter) { if (iso_(v[i][2]) === date) return start + i; }
    else if (Math.abs(+new Date(v[i][0]) - Number(id)) < 1000 && String(v[i][1]) === name) return start + i;
  }
  return 0;
}
function trashFile_(u) {
  const m = /[?&]id=([\w-]+)/.exec(u) || /\/d\/([\w-]+)/.exec(u);
  if (m) { try { DriveApp.getFileById(m[1]).setTrashed(true); } catch (e) {} }
}
function adminDelete(pin, row, id, form) {
  pin_(pin);
  if (!FORMS[form]) throw new Error('Unknown form');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const L = logRow_(row, id, form), r = L.r, F_ = FORMS[form], date = iso_(r[3]), name = String(r[1] || '');
    let data = {}; try { data = JSON.parse(r[7]); } catch (e) {}
    const phCell = String(r[8] || ''), nf = F_.fields.length, sh = sheet_(form), fr = findFormRow_(form, id, date, name);
    if (fr) {
      if (F_.byMeter) {
        const M = meterOf_(data);
        if (M) {
          F_.fields.forEach(function (f, j) { if (inM_(M, f.k)) sh.getRange(fr, 5 + j).clearContent(); });
          const wc = sh.getRange(fr, 5 + nf), pc = sh.getRange(fr, 6 + nf), wt = String(r[6] || '');
          let w = String(wc.getValue() || ''); if (wt) w = w.replace(wt, '').replace(/^\s*\|\s*|\s*\|\s*$/g, '').replace(/\s\|\s\|\s/g, ' | ');
          wc.setValue(w);
          let ph = String(pc.getValue() || ''); phCell.split(/\n+/).forEach(function (l) { if (l) ph = ph.replace(l, ''); });
          pc.setValue(ph.replace(/\n{2,}/g, '\n').replace(/^\n+|\n+$/g, ''));
          const rowV = sh.getRange(fr, 1, 1, 4 + nf).getValues()[0];
          if (!F_.fields.some(function (f, j) { return rowV[4 + j] !== '' && rowV[4 + j] != null; })) sh.deleteRow(fr);
        }
      } else sh.deleteRow(fr);
    }
    phList_(phCell).forEach(function (x) { trashFile_(x.u); });
    L.sh.deleteRow(Number(row));
    auditSheet_().appendRow([new Date(), 'DELETE', form, date, name, JSON.stringify(data)]);
    bump_();
    return { ok: true };
  } finally { lock.releaseLock(); }
}
function adminEdit(pin, row, id, form, vals) {
  pin_(pin); vals = vals || {};
  if (!FORMS[form]) throw new Error('Unknown form');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const L = logRow_(row, id, form), r = L.r, F_ = FORMS[form], date = iso_(r[3]), name = String(r[1] || '');
    let old = {}; try { old = JSON.parse(r[7]); } catch (e) {}
    const M = F_.byMeter ? meterOf_(old) : null;
    if (F_.byMeter && !M) throw new Error('Could not tell which meter this entry belongs to.');
    const nd = {}, errs = [], miss = [];
    F_.fields.forEach(function (f) {
      let v = (M && !inM_(M, f.k)) ? '' : (vals[f.k] != null ? vals[f.k] : (old[f.k] != null ? old[f.k] : ''));
      if (f.t === 'sel') { v = String(v).trim(); if (v !== '' && f.opts.indexOf(v) < 0) errs.push(f.n + ' has an invalid choice'); }
      else if (f.t === 'text') { v = String(v).trim().slice(0, 200); if (/^[=+\-@]/.test(v)) v = ' ' + v; }
      else if (f.t === 'time') { v = String(v).trim(); if (v !== '') { if (/^\d{1,2}:\d{2}/.test(v)) v = v.slice(0, 5); else { errs.push(f.n + ' is not a valid time'); v = ''; } } }
      else { if (String(v).trim() === '') v = ''; else { const n = Number(v); if (!isFinite(n) || n < 0) { errs.push(f.n + ' is not a valid number'); v = ''; } else v = n; } }
      nd[f.k] = v;
    });
    F_.fields.forEach(function (f) {
      let need;
      if (M) need = M.f.indexOf(f.k) > -1;
      else if (f.per || isNew10_(form, f.k, date)) need = false;
      else if (F_.parts && nd.part === 'RUN' && f.k === 'stop') need = false;
      else if (F_.parts && nd.part && f.part && f.part !== nd.part) need = false;
      else if (f.rp && nd.part) need = f.rp === nd.part;
      else need = isReq_(f, nd);
      if (need && nd[f.k] === '') miss.push(f.n);
    });
    if (miss.length) throw new Error('MISSING: ' + miss.join(', ') + ' cannot be empty.');
    if (errs.length) throw new Error('INVALID: ' + errs.join('; '));
    const warns = []; let bad = 0;
    F_.fields.forEach(function (f) { const v = nd[f.k]; if (v !== '' && chk_(f, v, nd) === 'bad') { bad++; warns.push(f.n + ' = ' + v + ' (allowed ' + ruleFor_(f, nd) + ')'); } });
    warns.push('Corrected by admin ' + Utilities.formatDate(new Date(), CFG.TZ, 'dd MMM, hh:mm a'));
    const logW = (M ? '[' + M.n + '] ' : '') + warns.join(' | ');
    const nf = F_.fields.length, sh = sheet_(form), fr = findFormRow_(form, id, date, name);
    if (fr) {
      F_.fields.forEach(function (f, j) { if (!M || inM_(M, f.k)) sh.getRange(fr, 5 + j).setValue(nd[f.k]); });
      const wc = sh.getRange(fr, 5 + nf);
      if (M) { const w = String(wc.getValue() || ''), ow = String(r[6] || ''); wc.setValue(ow && w.indexOf(ow) > -1 ? w.replace(ow, logW) : (w ? w + ' | ' + logW : logW)); }
      else wc.setValue(warns.join(' | '));
    }
    L.sh.getRange(Number(row), 6, 1, 3).setValues([[bad, logW, JSON.stringify(nd)]]);
    auditSheet_().appendRow([new Date(), 'EDIT', form, date, name, JSON.stringify({ before: old, after: nd })]);
    bump_();
    return { ok: true, bad: bad, warns: logW };
  } finally { lock.releaseLock(); }
}

function diffs_(rows, fields, from, to, startDay) {
  const res = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].date === rows[i - 1].date) continue;
    const lab = startDay ? rows[i - 1].date : rows[i].date;
    if ((from && lab < from) || (to && lab > to)) continue;
    const o = { date: lab, pre: {}, end: {} };
    fields.forEach(function (f) {
      const a = rows[i].v[f.k], b = rows[i - 1].v[f.k];
      o.pre[f.k] = b === '' ? null : b; o.end[f.k] = a === '' ? null : a;
      o[f.k] = (a === '' || b === '' || a < b) ? null : Math.round((a - b) * (f.mf || 1) * 100) / 100;
    });
    res.push(o);
  }
  return res;
}

/* ---------- pfp helper ---------- */
function pfpCaps_(v) {
  const caps = []; let alerts = 0;
  for (let i = 1; i <= 20; i++) {
    const p = 'c' + i + '_', kv = v[p + 'kv'];
    const ph = ['r', 'y', 'b'].map(function (x) { return { v: v[p + x], s: phState_(v[p + x], kv) }; });
    const st = { ct: v[p + 'ct'], fu: v[p + 'fu'], tm: v[p + 'tm'], ch: v[p + 'ch'] };
    const comp = [['ct','Contactor'],['fu','Fuse/MCB'],['tm','Terminal'],['ch','Capacitor']].filter(function (q) { return st[q[0]] === 'NOT OK'; }).map(function (q) { return q[1]; });
    const bad = comp.length > 0 || ph.some(function (x) { return x.s; });
    if (bad) alerts++;
    caps.push({ no: i, kv: kv, ph: ph, st: st, comp: comp, bad: bad, rm: v[p + 'rm'] || '' });
  }
  return { caps: caps, alerts: alerts };
}

/* ---------- REPORT ---------- */
/* ---------- REPORTS: the same three sheets as UNIT_REPORT-2026.xlsx (HT METER, ELECTRIC CONSUMPTION, DG SET) ---------- */
/* the server only sends the readings; the page does the same arithmetic as the Excel formulas */
function getXlReport(pin, ym) { pin_(pin); return xlReport_(ym); }
function xlReport_(ym) {
  if (!/^\d{4}-\d{2}$/.test(ym || '')) throw new Error('Pick a month.');
  const y = +ym.slice(0, 4), m = +ym.slice(5, 7), nd = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = ym + '-01', to = ym + '-' + (nd < 10 ? '0' : '') + nd, lim = nextDay_(to), days = dayList_(from, to);
  const perDay = function (fk) {
    const list = [];
    readRows_(fk, null, lim).forEach(function (r) { if (list.length && list[list.length - 1].date === r.date) list[list.length - 1] = r; else list.push(r); });
    const out = {};
    /* usage = the next reading of the SAME meter (a day on which that meter was not read is skipped, as in the Excel sheet) */
    list.forEach(function (r, i) {
      if (r.date < from || r.date > to) return;
      const nx = {};
      Object.keys(r.v).forEach(function (k) {
        for (let j = i + 1; j < list.length; j++) if (list[j].v[k] !== '' && list[j].v[k] != null) { nx[k] = list[j].v[k]; break; }
      });
      out[r.date] = { time: r.time, v: r.v, nx: nx };
    });
    return out;
  };
  const M = perDay('METER'), S = perDay('SOLAR');
  /* DG: one line per run, previous reading = the last reading before it (same as the Excel sheet) */
  const dgAll = readRows_('DG', null, to), byDate = {}; let prevH = null;
  const newRead = {};
  dgAll.forEach(function (r) {
    const hw = nz_(r.v.hwh); let prev = null;
    if (hw !== null) { prev = prevH; prevH = hw; }
    const line = { date: r.date, start: r.v.start || '', stop: r.v.stop || '', prev: prev, end: hw, coolant: nz_(r.v.coolant), diesel: nz_(r.v.diesel), auto: /^AUTO/.test(String(r.v.sby || '')) ? 1 : 0 };
    if (r.date < from) return;
    if (r.v.part === 'READ') {                      /* BUILD 10 reading: joins the last run of that day, or its own line */
      const L = byDate[r.date] || (byDate[r.date] = []);
      const tgt = L.filter(function (x) { return x.np && x.end === null; }).pop();
      if (tgt) { tgt.prev = prev; tgt.end = hw; tgt.coolant = line.coolant; tgt.diesel = line.diesel; } else { line.np = 1; L.push(line); newRead[r.date] = line; }
    } else {
      if (r.v.part === 'RUN') line.np = 1;
      (byDate[r.date] = byDate[r.date] || []).push(line);
    }
  });
  /* a reading saved BEFORE the runs of the same day: attach it to the day's last new-style run line */
  Object.keys(newRead).forEach(function (d) {
    const L = byDate[d], rd = newRead[d], run = L.filter(function (x) { return x.np && x !== rd && x.start; }).pop();
    if (run) { run.prev = rd.prev; run.end = rd.end; run.coolant = rd.coolant; run.diesel = rd.diesel; L.splice(L.indexOf(rd), 1); }
  });
  const dg = [];
  days.forEach(function (d) { if (byDate[d]) byDate[d].forEach(function (x) { dg.push(x); }); else dg.push({ date: d, none: true }); });
  return {
    ym: ym, y: y, m: m, days: days, rate: DASH.RATE, mdiLimit: DASH.MDI_LIMIT,
    ht: days.map(function (d) { return { date: d, m: M[d] || null, s: S[d] || null }; }),
    dept: DEPTS.map(function (d) { return { k: d[0], mf: d[2] }; }),
    dg: dg,
    fuel: dgFuelRows_(days)
  };
}

/* ---------- alert actions: what was done about every red alert ---------- */
const ACT_H = ['Alert ID','Raised','Type','Form','Entry date','Doer','Problem','Status','Action taken','Action by','Action time','Alert went to'];
function actSheet_() {
  if (MEMO.act) return MEMO.act;
  const ss = ss_(); let sh = ss.getSheetByName('ALERT_ACTIONS');
  if (!sh) {
    sh = ss.insertSheet('ALERT_ACTIONS');
    sh.getRange(1, 1, 1, ACT_H.length).setValues([ACT_H]).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.getRange('B:B').setNumberFormat('dd-mmm-yyyy hh:mm:ss'); sh.getRange('K:K').setNumberFormat('dd-mmm-yyyy hh:mm:ss'); sh.getRange('E:E').setNumberFormat('@');
  }
  return MEMO.act = sh;
}
function newAlert_(type, form, date, doer, problem, scope) {
  const id = 'A' + Utilities.formatDate(new Date(), CFG.TZ, 'yyMMdd') + '-' + (1000 + Math.floor(Math.random() * 9000));
  actSheet_().appendRow([id, new Date(), type, form, date, doer, problem, 'OPEN', '', '', '', scope]);
  return id;
}
function actRows_(max) {
  const sh = actSheet_(), n = sh.getLastRow(); if (n < 2) return [];
  const start = Math.max(2, n - max + 1), v = sh.getRange(start, 1, n - start + 1, 12).getValues(), out = [];
  for (let i = v.length - 1; i >= 0; i--) {
    const r = v[i];
    out.push({ row: start + i, id: String(r[0]), ts: ts_(r[1]), tms: new Date(r[1]).getTime(), type: String(r[2]), form: String(r[3]), date: iso_(r[4]), doer: String(r[5] || ''), problem: String(r[6] || ''),
      status: String(r[7]), action: String(r[8] || ''), by: String(r[9] || ''), at: r[10] ? ts_(r[10]) : '', scope: String(r[11] || '') });
  }
  return out;
}
/* BUILD 10: the Action page lists ONLY (1) readings that were out of range and (2) entries that are STILL not filled after their time.
   A "not done in time" alert disappears from the list as soon as that entry / check is filled (even if filled late). */
function actDone_(r) {
  if (r.type !== 'OVERDUE' || r.status !== 'OPEN') return false;
  try {
    const f = r.form, d = r.date;
    if (f === 'Solar & Dept Meters') {
      const row = readRows_('SOLAR', d, d).pop(); if (!row) return false;
      const ms = METERS.filter(function (m) { return r.problem.indexOf(m.n) > -1; });
      return ms.length > 0 && ms.every(function (m) { return m.f.every(function (x) { return row.v[x] !== '' && row.v[x] != null; }); });
    }
    if (/^Solar panel cleaning/.test(f)) return cleanInfo_().due > d;
    if (f === FORMS.DG.title + ' – Stop time not entered') {
      const m = /started (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/.exec(r.problem), op = dgOpen_();
      return !(op && m && op.date === m[1] && op.v.start === m[2]);
    }
    let done = null;
    Object.keys(FORMS).forEach(function (fk) {
      const t = FORMS[fk].title;
      if (f === t) done = readRows_(fk, d, d).length > 0;
      else if (f === t + ' (weekly)') done = readRows_(fk, weekStart_(d), null).length > 0;
      else if ((PER[fk] || null) && f.indexOf(t + ' – ') === 0) {
        Object.keys(PER[fk]).forEach(function (k) {
          if (f === t + ' – ' + perLabel_(fk, k)) { const st = perStart_(PER[fk][k], d); done = readAll_(fk).some(function (o) { return o.date >= st && o.v[k] !== '' && o.v[k] != null; }); }
        });
      }
    });
    return done === true;
  } catch (e) { return false; }
}
function getActions(pin) {
  pin_(pin);
  const td = today_(), hm = nowHM_(), tz = CFG.TZ;
  const rows = actRows_(500).filter(function (r) {
    /* BUILD 11: an alert shows from 4 pm (alerts raised after 4 pm show at once); its action deadline is 5 pm */
    const d = Utilities.formatDate(new Date(r.tms), tz, 'yyyy-MM-dd'), t = Utilities.formatDate(new Date(r.tms), tz, 'HH:mm');
    const vis = d < td || (d === td && (t >= ALERT_AT || hm >= ALERT_AT));
    if (!vis) return false;
    const dd = t < ACTION_BY ? d : nextDay_(d);
    r.due = dd + ' ' + ACTION_BY; r.dueTxt = (dd === td ? 'today' : lbl_(dd)) + ' ' + t12_(ACTION_BY);
    r.overdue = r.status === 'OPEN' && (dd < td || (dd === td && hm >= ACTION_BY));
    return !actDone_(r);
  });
  return { rows: rows.slice(0, 300), open: rows.filter(function (r) { return r.status === 'OPEN'; }).length };
}
function saveAction(pin, id, action, by) {
  pin_(pin);
  action = String(action || '').replace(/\s+/g, ' ').trim().slice(0, 600); by = cleanName_(by);
  if (action.length < 5) throw new Error('MISSING: write what action was taken (at least a few words).');
  if (by.length < 2) throw new Error('MISSING: enter who took the action.');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  let row = null;
  try {
    const sh = actSheet_(), found = actRows_(500).filter(function (r) { return r.id === String(id); })[0];
    if (!found) throw new Error('This alert was not found. Reload the list.');
    if (found.status !== 'OPEN') throw new Error('An action is already recorded for this alert (' + found.by + ').');
    const now = new Date();
    sh.getRange(found.row, 8, 1, 4).setValues([['RESOLVED', action, by, now]]);
    row = found; row.action = action; row.by = by; row.at = ts_(now);
  } finally { lock.releaseLock(); }
  bump_();
  /* the same people who got the alert get the action */
  let mailed = false;
  try {
    const extra = row.scope === 'ALL' ? [].concat(CFG.ALERT_EXTRA || []).join(',').split(/[\s,;]+/).filter(function (x) { return /@/.test(x) && x.toLowerCase() !== String(CFG.ALERT_TO).toLowerCase(); }) : [];
    const h = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111"><h2 style="margin:0 0 6px;color:#047857">✅ Action taken on alert ' + esc_(row.id) + '</h2>' +
      '<table style="border-collapse:collapse"><tbody>' + [['Alert', row.form + (row.doer ? ' · entered by ' + row.doer : '')], ['Entry date', row.date], ['Problem', row.problem], ['Action taken', row.action], ['Action by', row.by], ['Recorded', row.at]].map(function (x) {
        return '<tr><td style="border:1px solid #ddd;padding:4px 10px;background:#f3f4f6"><b>' + esc_(x[0]) + '</b></td><td style="border:1px solid #ddd;padding:4px 10px">' + esc_(x[1]) + '</td></tr>'; }).join('') +
      '</tbody></table><p style="color:#888;font-size:12px;margin-top:14px">Automatic message from the Plant Electrical Portal.</p></div>';
    MailApp.sendEmail({ to: [CFG.ALERT_TO].concat(extra).join(','), subject: '✅ Action taken: ' + row.form + ' – ' + row.date + ' (' + row.id + ')', htmlBody: h, name: CFG.TITLE });
    mailed = true;
  } catch (e) { Logger.log('Action mail failed: ' + (e.message || e)); }
  return { ok: true, mailed: mailed, id: row.id, at: row.at };
}

/* ---------- admin daily review: the admin opens every photo of the day and confirms ---------- */
const REV_H = ['Review date','Reviewed at','Admin name','Entries','Photos','Photos opened','Note'];
function revSheet_() {
  if (MEMO.rev) return MEMO.rev;
  const ss = ss_(); let sh = ss.getSheetByName('ADMIN_REVIEW');
  if (!sh) {
    sh = ss.insertSheet('ADMIN_REVIEW');
    sh.getRange(1, 1, 1, REV_H.length).setValues([REV_H]).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    sh.setFrozenRows(1); sh.getRange('A:A').setNumberFormat('@'); sh.getRange('B:B').setNumberFormat('dd-mmm-yyyy hh:mm:ss');
  }
  return MEMO.rev = sh;
}
function reviewDone_(date) {
  const sh = revSheet_(), n = sh.getLastRow(); let best = null;
  if (n >= 2) sh.getRange(Math.max(2, n - 200 + 1), 1, n - Math.max(2, n - 200 + 1) + 1, 7).getValues().forEach(function (r) {
    if (iso_(r[0]) === date) best = { by: String(r[2]), at: ts_(r[1]), entries: +r[3], photos: +r[4], opened: +r[5], note: String(r[6] || '') };
  });
  return best;
}
function getReview(pin, date) {
  pin_(pin);
  date = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : today_();
  const sh = logSheet_(), n = sh.getLastRow(), items = []; let entries = 0;
  if (n >= 2) {
    const start = Math.max(2, n - 3000 + 1), nc = Math.min(9, sh.getMaxColumns()), v = sh.getRange(start, 1, n - start + 1, nc).getValues();
    v.forEach(function (r) {
      if (iso_(r[3]) !== date) return;
      entries++;
      const F_ = FORMS[r[2]];
      phList_(nc >= 9 ? r[8] : '').forEach(function (x) { items.push({ form: String(r[2]), title: F_ ? F_.title : String(r[2]), who: String(r[1]), time: tm_(r[4]), label: x.l, u: x.u, bad: +r[5] || 0, warns: String(r[6] || '') }); });
    });
  }
  const order = Object.keys(FORMS);
  items.sort(function (a, b) { return order.indexOf(a.form) - order.indexOf(b.form) || (a.time < b.time ? -1 : a.time > b.time ? 1 : 0); });
  const rv = reviewDone_(date);
  return { date: date, today: today_(), entries: entries, items: items, review: rv, complete: !!rv && rv.photos >= items.length };
}
function saveReview(pin, date, name, note, opened) {
  pin_(pin);
  name = cleanName_(name); if (name.length < 2) throw new Error('MISSING: enter your name to confirm the review.');
  const cur = getReview(pin, date);
  if (cur.complete) return { ok: true, already: true, review: cur.review };
  if (Number(opened) < cur.items.length) throw new Error('MISSING: open every photo first (' + (Number(opened) || 0) + ' of ' + cur.items.length + ' opened).');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    revSheet_().appendRow([cur.date, new Date(), name, cur.entries, cur.items.length, Number(opened) || 0, String(note || '').replace(/\s+/g, ' ').trim().slice(0, 300)]);
  } finally { lock.releaseLock(); }
  bump_();
  return { ok: true, review: reviewDone_(cur.date) };
}

/* =====================  DASHBOARD  ===================== */
function getDashboard(from, to, fresh, pin) {
  pin_(pin);
  to = to || today_(); from = from || to.slice(0, 8) + '01';
  const key = 'dash|' + ver_() + '|' + from + '|' + to;
  let d = fresh ? null : cacheGet_(key);
  if (!d) { d = dashCompute_(from, to); cachePut_(key, d, 180); }
  return d;
}

function dashCompute_(from, to) {
  const safe = function (fn) { try { return fn(); } catch (e) { return { error: String(e.message || e) }; } };
  const grid = safe(function () { return dashGrid_(from, to); });
  const dg = safe(function () { return dashDG_(from, to); });
  const eq = safe(function () { return dashEquip_(from, to); });
  const pfp = safe(function () { return dashPFP_(from, to); });
  return {
    from: from, to: to, generated: Utilities.formatDate(new Date(), CFG.TZ, 'dd MMM yyyy, hh:mm a'),
    cfg: { rate: DASH.RATE, mdiLimit: DASH.MDI_LIMIT * DASH.MDI_X, pfTarget: DASH.PF_TARGET, usageDay: DASH.USAGE_DAY },
    grid: grid, dg: dg, eq: eq, pfp: pfp,
    alerts: safe(function () { return dashAlerts_(grid, dg, eq, to, pfp); })
  };
}

function livePf_() {
  try {
    const rows = readAll_('METER').filter(function (r) { return r.v.pf !== '' && r.v.pf != null && !isNaN(+r.v.pf); });
    if (!rows.length) return null;
    rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    const r = rows[rows.length - 1];
    return { val: +r.v.pf, date: r.date, today: r.date === today_() };
  } catch (e) { return null; }
}
function dashGrid_(from, to) {
  const cum = function (k) { return FORMS[k].fields.filter(function (f) { return f.cum; }); };
  const startDay = DASH.USAGE_DAY !== 'end', lim = startDay ? nextDay_(to) : to;
  const mrows = readRows_('METER', null, lim), srows = readRows_('SOLAR', null, lim);
  const md = diffs_(mrows, cum('METER'), from, to, startDay), sd = diffs_(srows, cum('SOLAR'), from, to, startDay);
  const M = {}, S = {}, R = {};
  md.forEach(function (x) { M[x.date] = x; }); sd.forEach(function (x) { S[x.date] = x; });
  mrows.forEach(function (r) { R[r.date] = r; });
  const isos = Object.keys(M).concat(Object.keys(S)).filter(function (d, i, a) { return a.indexOf(d) === i && d <= to; }).sort();
  if (!isos.length) throw new Error('Needs HT meter / solar entries on at least two different days to calculate usage.');

  const at = function (map, k) { return isos.map(function (d) { return map[d] && map[d][k] != null ? map[d][k] : null; }); };
  const val = function (d, k) { const r = R[d]; return r && r.v[k] !== '' && r.v[k] != null ? r.v[k] : null; };
  const imp = at(M, 'kwh'), exp = at(M, 'kwh_x'), sol = at(S, 'kwh');
  const total = isos.map(function (d, i) { return imp[i] === null ? null : rnd_(Math.max(0, imp[i] - (exp[i] || 0)) + (sol[i] || 0)); });   /* Total = HT NET units (import - export) + Solar units */
  const pf = isos.map(function (d) { return val(d, 'pf'); });
  const apf = isos.map(function (d) { const a = val(d, 'kwh'), b = val(d, 'kvah'); return (a !== null && b) ? Math.round(a / b * 10000) / 10000 : null; });
  const mdi = isos.map(function (d) { const m = val(d, 'mdi'); return m === null ? null : rnd_(m * DASH.MDI_X); });

  const L = DASH.MDI_LIMIT * DASH.MDI_X;
  const mv = mdi.filter(function (x) { return x !== null; });
  const pk = mv.length ? Math.max.apply(null, mv) : null, pkI = pk === null ? -1 : mdi.indexOf(pk);
  const tot = sum_(total);
  const k = {
    imp: sum_(imp), exp: sum_(exp), sol: sum_(sol), total: tot,
    avgPf: mean_(pf), avgApf: mean_(apf), peakMdi: pk, peakMdiDay: pkI > -1 ? lbl_(isos[pkI]) : '',
    pfLow: pf.filter(function (x) { return x !== null && x < DASH.PF_TARGET; }).length,
    mdiHigh: mv.filter(function (x) { return x >= 0.9 * L; }).length,
    solarShare: tot ? sum_(sol) / tot * 100 : 0
  };

  const depts = DEPTS.map(function (d) {
    return { key: d[0], name: d[1], units: isos.map(function (x) { return S[x] && S[x][d[0]] != null ? S[x][d[0]] : null; }) };
  }).filter(function (d) { return d.units.some(function (x) { return x !== null; }); });
  const inBill = function (d) { return BILL_DEPTS.indexOf(d.key) > -1; }, billD = depts.filter(inBill);
  const grand = sum_(billD.map(function (d) { return sum_(d.units); }));
  depts.forEach(function (d) {
    const nn = []; d.units.forEach(function (x, i) { if (x !== null) nn.push(i); });
    d.sum = rnd_(sum_(d.units)); d.amtSum = rnd_(d.sum * DASH.RATE); d.share = grand && inBill(d) ? d.sum / grand * 100 : 0; d.bill = inBill(d);
    const li = nn[nn.length - 1]; d.last = d.units[li]; d.lastDay = lbl_(isos[li]);
    const prev = nn.slice(0, -1).map(function (i) { return d.units[i]; });
    d.avgPrev = prev.length ? sum_(prev) / prev.length : null;
  });
  const dayTotal = isos.map(function (x, i) { return rnd_(sum_(billD.map(function (d) { return d.units[i]; }))); });
  /* BUILD 11: last day (latest day that has a usage figure) and the period split by department, units + amount only */
  let li = -1; for (let i = isos.length - 1; i >= 0; i--) { if (imp[i] !== null || (sol[i] !== null && sol[i] !== undefined)) { li = i; break; } }
  const rate = DASH.RATE, pack = function (arr, i) {
    return billD.map(function (d) { const u = i === null ? d.sum : d.units[i]; return { key: d.key, name: d.name, units: u === null || u === undefined ? null : rnd_(u), amt: u === null || u === undefined ? null : rnd_(u * rate) }; })
      .sort(function (a, b) { return (b.units || 0) - (a.units || 0); });
  };
  const lastDay = li < 0 ? null : (function () {
    const ht = imp[li] === null ? 0 : Math.max(0, imp[li] - (exp[li] || 0)), so = sol[li] || 0, tt = rnd_(ht + so), dl = pack(depts, li), du = rnd_(sum_(dl.map(function (x) { return x.units; })));
    return { iso: isos[li], label: lbl_(isos[li]), ht: rnd_(ht), htAmt: rnd_(ht * rate), sol: rnd_(so), solAmt: rnd_(so * rate), total: tt, amt: rnd_(tt * rate),
             depts: dl, deptUnits: du, deptAmt: rnd_(du * rate), rate: rate };
  })();
  const htNet = sum_(isos.map(function (x, i) { return imp[i] === null ? 0 : Math.max(0, imp[i] - (exp[i] || 0)); }));
  const period = { from: isos[0], to: isos[isos.length - 1], depts: pack(depts, null), ht: rnd_(htNet), htAmt: rnd_(htNet * rate), sol: rnd_(sum_(sol)), solAmt: rnd_(sum_(sol) * rate), total: rnd_(sum_(total)), amt: rnd_(sum_(total) * rate), rate: rate };
  return {
    livePf: livePf_(), isos: isos, days: isos.map(lbl_), imp: imp, exp: exp, sol: sol, total: total, pf: pf, apf: apf, mdi: mdi, k: k, lastDay: lastDay, period: period,
    dept: { depts: depts, dayTotal: dayTotal, dayAmt: dayTotal.map(function (x) { return rnd_(x * DASH.RATE); }),
            total: rnd_(grand), totalAmt: rnd_(grand * DASH.RATE), rate: DASH.RATE }
  };
}

/* BUILD 10: DG report e-mailed every morning after 09:00 for the day before (sent once a day, checked by the 30-minute trigger) */
function f2_(x) { return (Math.round(Number(x || 0) * 100) / 100).toFixed(2); }
function dgDailyReport_(force) {
  const props = PropertiesService.getScriptProperties(), td = today_();
  if (!force && (nowHM_() < '09:00' || props.getProperty('DG_REP') === td)) return;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { if (!force && props.getProperty('DG_REP') === td) return; props.setProperty('DG_REP', td); } finally { lock.releaseLock(); }
  const y = addDays_(td, -1), d = dgDay_(y), rows = readRows_('DG', null, y);
  let prev = null, rd = null;
  rows.forEach(function (r) {
    if (r.v.hwh === '' || r.v.hwh == null) return;
    if (r.date === y) rd = { r: r, prev: prev }; prev = r.v.hwh;
  });
  const chk = function (v) { return v === '' || v == null ? '–' : (v === 'OK' ? '✅ OK' : '🚨 ' + v); };
  const hh = function (m) { return Math.floor(m / 60) + 'h ' + p2_(m % 60) + 'm'; };
  const tr = function (a, b) { return '<tr><td style="border:1px solid #ddd;padding:4px 10px;background:#f6f7f9">' + esc_(a) + '</td><td style="border:1px solid #ddd;padding:4px 10px">' + b + '</td></tr>'; };
  let t = tr('DG switched ON', d.on + ' time(s)') + tr('DG switched OFF', d.off + ' time(s)') + tr('Total running time', d.mins ? hh(d.mins) : '–');
  if (d.open) t += tr('⚠ Generator still running', 'Started ' + esc_(d.open.start) + ' on ' + esc_(lbl_(d.open.date)) + ' (by ' + esc_(d.open.name) + ') – STOP time not entered yet');
  d.runs.forEach(function (x, i) { t += tr('Run ' + (i + 1), esc_(x.start) + ' → ' + esc_(x.stop) + ' (' + hh(x.mins) + ', ' + f2_(x.mins * DG_LPH / 60) + ' L)' + (x.auto ? ' <span style="color:#d97706">auto-stopped after 24 h</span>' : '')); });
  const fu = dgFuelRows_([y]), fy = fu.rows[y];
  t += tr('⛽ Diesel used (' + DG_LPH + ' L / hour)', f2_(fy.used) + ' L') + tr('⛽ Diesel received', fy.recv ? '<b style="color:#059669">+ ' + f2_(fy.recv) + ' L</b>' : '–') +
    tr('⛽ Diesel stock in hand', fu.tracked && fy.close !== null ? '<b' + (fy.close < 400 ? ' style="color:#dc2626"' : '') + '>' + f2_(fy.close) + ' L</b>' + (fy.close < 400 ? ' (below 400 L)' : '') : 'not tracked yet – enter the opening stock in the Diesel Stock form');
  if (rd) {
    const v = rd.r.v, st = v.stock === '' || v.stock == null ? '–' : (v.stock < 400 ? '🚨 ' + v.stock + ' L (below 400)' : v.stock + ' L');
    t += tr('KWH reading', esc_(v.hwh) + (rd.prev != null ? ' (previous ' + esc_(rd.prev) + ', units ' + (v.hwh - rd.prev) + ')' : '')) + tr('Diesel stock', st) + tr('Diesel consumed', v.diesel === '' ? '–' : v.diesel + ' L') +
      tr('Lube oil pressure', chk(v.lube)) + tr('Coolant level', chk(v.clvl)) + tr('Coolant temperature', v.coolant === '' ? '–' : v.coolant + ' °C') + tr('Air filter cleaning (monthly)', chk(v.airf)) + tr('Reading by', esc_(rd.r.name));
  } else t += tr('Reading and checks', 'not entered');
  const h = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111"><h2 style="margin:0 0 6px">🛢️ DG Set daily report – ' + esc_(lbl_(y)) + '</h2><p style="margin:0 0 10px;color:#555">' + (d.on || d.off ? 'The DG ran on this day.' : 'No DG run was entered for this day.') + '</p><table style="border-collapse:collapse"><tbody>' + t + '</tbody></table><p style="color:#888;font-size:12px;margin-top:14px">Automatic morning report from the Plant Electrical Portal.</p></div>';
  MailApp.sendEmail({ to: CFG.ALERT_TO, subject: '🛢️ DG report ' + lbl_(y) + ': ON ' + d.on + ' / OFF ' + d.off + (d.mins ? ', ' + hh(d.mins) + ', ' + f2_(fy.used) + ' L diesel' : '') + (fu.tracked && fy.close !== null ? ', stock ' + f2_(fy.close) + ' L' : ''), htmlBody: h, name: CFG.TITLE });
}
function sendDgReportNow() { dgDailyReport_(true); }

/* ===== BUILD 12: daily ELECTRICITY BILL report ===== */
function inr_(n) {
  const neg = n < 0, p = Math.abs(Number(n) || 0).toFixed(2).split('.'); let i = p[0];
  if (i.length > 3) i = i.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + i.slice(-3);
  return (neg ? '-' : '') + i + '.' + p[1];
}

/* ===== BUILD 12: daily mails sent by the background trigger ===== */
function mailTo_() { return [CFG.ALERT_TO].concat(CFG.ALERT_EXTRA || []).join(',').split(/[\s,;]+/).filter(function (x, i, a) { return /@/.test(x) && a.indexOf(x) === i; }); }
function once_(prop, td, fn) {
  const props = PropertiesService.getScriptProperties(), lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { if (props.getProperty(prop) === td) return; props.setProperty(prop, td); } finally { lock.releaseLock(); }
  try { fn(); } catch (e) { props.deleteProperty(prop); throw e; }
}
function dailyMails_() {
  const td = today_(), hm = nowHM_();
  if (hm >= REPORT_AT && PropertiesService.getScriptProperties().getProperty('XL_REP') !== td) once_('XL_REP', td, xlMail_);
  if (hm >= REVIEW_AT && PropertiesService.getScriptProperties().getProperty('DAY_REV') !== td) once_('DAY_REV', td, dayReviewMail_);
}
function sendReportsNow() { xlMail_(); }
function sendDayReviewNow() { dayReviewMail_(); }
const MAIL_CSS = '<style>.x{border-collapse:collapse;font:11px Calibri,Arial,sans-serif;text-align:center;color:#000}.x th,.x td{border:1px solid #888;padding:2px 6px;white-space:nowrap}.x th{background:#e5e7eb;font-weight:bold}.x .t{text-align:left;font-size:15px}.x .s td{background:#f3f4f6;font-weight:bold}</style>';
function mailBand_(title, sub) { return '<div style="background:#0f172a;color:#fff;padding:14px 18px;border-radius:10px 10px 0 0"><div style="font-size:19px;font-weight:bold">' + esc_(title) + '</div><div style="font-size:12px;color:#9fb0c8;margin-top:3px">' + esc_(sub) + '</div></div>'; }
/* ---- the two Excel-style sheets, same numbers and colours as the Reports page ---- */
const XCOL = { y: '#FFFF00', g: '#92D050', r: '#FF0000', p: '#7030A0' };
function xn_(x, d) { return x == null || x === '' || isNaN(x) ? '' : Number(x).toFixed(d); }
function xdt_(iso) { const p = iso.split('-'); return +p[2] + '-' + MON[p[1] - 1]; }
function xg_(o, k) { return o && o[k] !== '' && o[k] != null ? +o[k] : null; }
function xsum_(a) { const n = a.filter(function (x) { return x != null && !isNaN(x); }); return n.length ? n.reduce(function (t, x) { return t + x; }, 0) : null; }
function xavg_(a) { const n = a.filter(function (x) { return x != null && !isNaN(x); }); return n.length ? n.reduce(function (t, x) { return t + x; }, 0) / n.length : null; }
function xhm_(t) { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? (+m[1]) + (+m[2] / 100) : null; }
function xtd_(v, bg, fc) { return '<td' + (bg ? ' bgcolor="' + bg + '"' : '') + (fc ? ' style="color:' + fc + '"' : '') + '>' + v + '</td>'; }
function xlHtHtml_(R) {
  const use = function (a, b, mul) { return a != null && b != null ? (b - a) * mul : null; };
  const rows = R.ht.map(function (r) {
    const M = r.m, S = r.s, v = M ? M.v : null, n = M ? M.nx : null, sv = S ? S.v : null, sn = S ? S.nx : null;
    const kwh = xg_(v, 'kwh'), kx = xg_(v, 'kwh_x'), kv = xg_(v, 'kvah'), kvx = xg_(v, 'kvah_x');
    const D = use(kwh, xg_(n, 'kwh'), 1000), Fx = use(kx, xg_(n, 'kwh_x'), 1000), I = use(kv, xg_(n, 'kvah'), 1000), L = use(kvx, xg_(n, 'kvah_x'), 1000);
    const so = xg_(sv, 'kwh'), sq = xg_(sv, 'kvah'), P = use(so, xg_(sn, 'kwh'), 160), Rr = use(sq, xg_(sn, 'kvah'), 160);
    return { date: r.date, B: M ? xhm_(M.time) : null, C: kwh, D: D, E: kx, F: Fx, G: (kwh != null && kx != null) ? kwh - kx : null,
      GN: (kwh != null && kx != null && xg_(n, 'kwh') != null && xg_(n, 'kwh_x') != null) ? Math.max(0, ((xg_(n, 'kwh') - xg_(n, 'kwh_x')) - (kwh - kx)) * 1000) : null,
      H: kv, I: I, J: (D != null && I != null) ? I - D : null, K: kvx, L: L, M: xg_(v, 'pf'), N: (D != null && I) ? D / I : null, O: so, P: P, Q: sq, R: Rr, S: xg_(v, 'mdi'), T: D != null ? D + (Fx || 0) + (P || 0) : null };
  });
  const H = ['DATE', 'TIME', 'KWH', 'UNITS KWH', 'EXPORT KWH', 'EXPORT UNITS IN KWH', 'KWH NET', 'KWH NET UNITS', 'KVAH', 'UNITS KVAH', 'DIFFERENCE', 'EXPORT KVAH', 'EXPORT UNITS IN KVAH', 'POWR FECTOR', 'ACTUAL POWR FECTOR', 'KWH', 'UNITS KWH', 'KVAH', 'UNITS KVAH', 'MDI (MAX 650 KVA)', 'TOTAL UNIT'];
  const cols = ['C', 'D', 'E', 'F', 'G', 'GN', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];
  let h = '<table class="x"><tr><th colspan="15" style="font-size:16px">HT METER</th><th colspan="4">600 KW SOLAR UNITS</th><th>MDI</th><th></th></tr><tr>' + H.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr>';
  rows.forEach(function (r) {
    h += '<tr><td>' + xdt_(r.date) + '</td><td>' + xn_(r.B, 2) + '</td>' + cols.map(function (c) {
      const v = r[c]; let bg = '', fc = '';
      if (c === 'J' && v != null && v >= 30) { bg = XCOL.r; fc = '#fff'; }
      if ((c === 'P' || c === 'R') && v != null) { if (v <= 2300) bg = XCOL.r; else if (v <= 2500) bg = XCOL.p; }
      if (c === 'S' && v != null && v * 1000 >= 650) { bg = XCOL.r; fc = '#fff'; }
      return xtd_(xn_(v, 2), bg, fc);
    }).join('') + '</tr>';
  });
  const T = {}; cols.forEach(function (c) { const a = rows.map(function (r) { return r[c]; }); T[c] = (c === 'M' || c === 'N' || c === 'S') ? xavg_(a) : xsum_(a); });
  h += '<tr class="s"><td>TOTAL</td><td></td>' + cols.map(function (c) { return c === 'T' ? '<td></td>' : '<td>' + xn_(T[c], 2) + '</td>'; }).join('') + '</tr>';
  return h + '</table>';
}
function xlDeptHtml_(R) {
  const ORDER = [['colony', 'COLONY'], ['dvdw', 'D BLOCK (VDV)'], ['dshare', 'D BLOCK (SHARING)'], ['shut', 'SHUTLESS'], ['etp', 'ETP'], ['dying', 'WASHING/DYE'], ['fblock', 'F BLOCK (VDV FINISHING)'], ['boiler', 'BOILER'], ['eblock', 'C & H BLOCK (PRINTING)'], ['ablock', 'A BLCOK (CARPET)'], ['hblock', "H BLOCK (MADEUPS'S)"]];
  const COMB = ['colony', 'dvdw', 'dshare', 'eblock', 'ablock', 'hblock'], mf = {}, rate = R.rate;
  R.dept.forEach(function (d) { mf[d.k] = d.mf; });
  const rows = R.ht.map(function (r) {
    const S = r.s, v = S ? S.v : null, n = S ? S.nx : null, o = { date: r.date, g: {} };
    ORDER.forEach(function (x) { const pre = xg_(v, x[0]), end = xg_(n, x[0]), u = (pre != null && end != null) ? (end - pre) * mf[x[0]] : null; o.g[x[0]] = { pre: pre, end: end, u: u, a: u != null ? u * rate : null }; });
    let pre = 0, end = 0, u = 0, has = false;
    COMB.forEach(function (k) { const c = o.g[k]; if (c.pre != null) pre += c.pre; if (c.end != null) end += c.end; if (c.u != null) { u += c.u; has = true; } });
    o.g.comb = has ? { pre: pre, end: end, u: u, a: u * rate } : { pre: null, end: null, u: null, a: null };
    ['b1', 'b2', 'b3'].forEach(function (k) { o.g[k] = has ? { pre: null, end: null, u: 0, a: 0 } : { pre: null, end: null, u: null, a: null }; });
    return o;
  });
  const groups = ORDER.map(function (x) { return { k: x[0], t: x[1] }; }).concat([{ k: 'comb', t: 'COLONY,A,C,D,H BLOCK' }]);
  const tot = {}, avg = {};
  groups.forEach(function (g) { const us = rows.map(function (r) { return r.g[g.k].u; }), as = rows.map(function (r) { return r.g[g.k].a; }); tot[g.k] = { u: xsum_(us), a: xsum_(as) }; avg[g.k] = { u: xavg_(us), a: xavg_(as) }; });
  const R1 = groups.reduce(function (t, g) { return t + (tot[g.k].u || 0); }, 0), Z1 = groups.reduce(function (t, g) { return t + (tot[g.k].a || 0); }, 0);
  let out = '';
  for (let i = 0; i < groups.length; i += 4) {
    const gs = groups.slice(i, i + 4), first = i === 0;
    let h = '<table class="x" style="margin-bottom:12px">';
    if (first) h += '<tr><th colspan="9" class="t">DEPT WISE ELECTRIC CONSUMPTION-(' + MON[R.m - 1].toUpperCase() + '-' + R.y + ')</th><th colspan="4">TOTAL UNIT CONSUMPTION</th><th colspan="4">' + xn_(R1, 2) + '</th></tr><tr><th colspan="9"></th><th colspan="4">TOTAL AMOUNT</th><th colspan="4">' + xn_(Z1, 2) + '</th></tr>';
    h += '<tr><th rowspan="3">DATE</th>' + gs.map(function (g) { return '<th colspan="4" bgcolor="#f1f5f9">' + g.t + '</th>'; }).join('') + '</tr>';
    h += '<tr>' + gs.map(function () { return '<th colspan="2">READING</th><th rowspan="2">TOTAL UNITS</th><th rowspan="2">TOTAL AMT</th>'; }).join('') + '</tr><tr>' + gs.map(function () { return '<th>PRE</th><th>END</th>'; }).join('') + '</tr>';
    rows.forEach(function (r) {
      h += '<tr><td>' + xdt_(r.date) + '</td>' + gs.map(function (g) { const c = r.g[g.k], uc = g.k === 'colony' && c.u != null && c.u >= 120 ? XCOL.p : '', f = function (x) { return xn_(x, 2); };
        return '<td>' + f(c.pre) + '</td><td>' + f(c.end) + '</td>' + xtd_(f(c.u), uc, uc ? '#fff' : '') + '<td>' + f(c.a) + '</td>'; }).join('') + '</tr>';
    });
    ['TOTAL', 'AVG'].forEach(function (lab) { const src = lab === 'TOTAL' ? tot : avg; h += '<tr class="s"><td>' + lab + '</td>' + gs.map(function (g) { return '<td></td><td></td><td>' + xn_(src[g.k].u, 2) + '</td><td>' + xn_(src[g.k].a, 2) + '</td>'; }).join('') + '</tr>'; });
    out += h + '</table>';
  }
  return out;
}
function xlMail_() {
  const td = today_(), ym = td.slice(0, 7), R = xlReport_(ym), mon = MON[R.m - 1].toUpperCase();
  const h = '<div style="font-family:Arial,sans-serif;color:#111;max-width:100%">' + MAIL_CSS + mailBand_('📊 Daily reports – ' + mon + '-' + R.y, 'Same sheets as the Reports page · month so far, till ' + lbl_(td) + ' · automatic mail from the Plant Electrical Portal') +
    '<div style="border:1px solid #e2e8f0;border-top:0;padding:14px;border-radius:0 0 10px 10px"><h3 style="margin:0 0 6px">1. ' + mon + '-' + String(R.y).slice(2) + ' (HT METER)</h3><div style="overflow-x:auto">' + xlHtHtml_(R) + '</div>' +
    '<h3 style="margin:20px 0 6px">2. ELECTRIC CONSUMPTION (' + mon + ')</h3><div style="overflow-x:auto">' + xlDeptHtml_(R) + '</div></div></div>';
  MailApp.sendEmail({ to: mailTo_().join(','), subject: '📊 HT Meter + Electric Consumption – ' + mon + '-' + R.y + ' (till ' + lbl_(td) + ')', htmlBody: h, name: CFG.TITLE });
}
/* ---- the 5 pm day review: filled / late / not filled / out of range / planned checks / alerts waiting ---- */
function dayReviewMail_() {
  const td = today_(), hmN = nowHM_(), chip = function (c, t) { return '<span style="background:' + c + ';color:#fff;border-radius:10px;padding:2px 9px;font-size:12px;font-weight:bold;white-space:nowrap">' + t + '</span>'; };
  const G = '#059669', O = '#d97706', RD = '#dc2626', GR = '#64748b', cnt = { ok: 0, late: 0, miss: 0 }, lines = [];
  const add = function (title, st, detail) { cnt[st]++; lines.push('<tr><td style="padding:6px 10px;border-bottom:1px solid #eef2f7">' + esc_(title) + '</td><td style="padding:6px 10px;border-bottom:1px solid #eef2f7">' + (st === 'ok' ? chip(G, '✅ Done') : st === 'late' ? chip(O, '⏰ Late') : chip(RD, '❌ Not filled')) + '</td><td style="padding:6px 10px;border-bottom:1px solid #eef2f7;color:#475569">' + detail + '</td></tr>'); };
  const info = function (title, label, detail) { lines.push('<tr><td style="padding:6px 10px;border-bottom:1px solid #eef2f7">' + esc_(title) + '</td><td style="padding:6px 10px;border-bottom:1px solid #eef2f7">' + chip(GR, label) + '</td><td style="padding:6px 10px;border-bottom:1px solid #eef2f7;color:#475569">' + detail + '</td></tr>'); };
  const oor = [];
  Object.keys(FORMS).forEach(function (fk) {
    const F_ = FORMS[fk], u = DUE[fk], title = F_.icon + ' ' + F_.title, rows = readRows_(fk, td, td), last = rows.length ? rows[rows.length - 1] : null;
    rows.forEach(function (r) {
      if (!r.bad.length) return;
      oor.push([title, r.name + ' · ' + r.time, r.bad.slice(0, 6).map(function (k) { const f = F_.fields.filter(function (x) { return x.k === k; })[0]; return esc_(f.n) + ' = <b>' + esc_(r.v[k]) + '</b>' + (ruleFor_(f, r.v) ? ' <span style="color:#64748b">(allowed ' + esc_(ruleFor_(f, r.v)) + ')</span>' : ''); }).join('<br>') + (r.bad.length > 6 ? '<br>+' + (r.bad.length - 6) + ' more' : '')]);
    });
    if (fk === 'DG') {
      const d = dgDay_(td), hh = function (m) { return Math.floor(m / 60) + 'h ' + p2_(m % 60) + 'm'; };
      info(title, d.on ? '🟢 Ran' : 'No run', d.on ? 'ON ' + d.on + ' / OFF ' + d.off + (d.mins ? ' · ' + hh(d.mins) + ' · ' + f2_(d.mins * DG_LPH / 60) + ' L diesel' : '') + (d.open ? ' · <b style="color:#dc2626">still running since ' + esc_(d.open.start) + '</b>' : '') : 'DG did not run today');
      const fb = dgFuelBrief_(), rc = dgFuelRows_([td]).rows[td];
      info('⛽ Diesel stock', fb.tracked ? f2_(fb.stock) + ' L' : 'Not tracked', fb.tracked ? 'stock in hand now' + (rc.recv ? ' · received today ' + f2_(rc.recv) + ' L' : '') + (fb.stock < 400 ? ' · <b style="color:#dc2626">below 400 L</b>' : '') : 'enter the opening stock in the Diesel Stock form');
      return;
    }
    if (u && u.dow) {                                          /* weekly form */
      const ws = weekStart_(td), dd = addDays_(ws, u.dow - 1), wk = readRows_(fk, ws, null), w = wk.length ? wk[wk.length - 1] : null;
      if (td < dd) return;
      if (w) add(title + ' (weekly)', w.late ? 'late' : 'ok', esc_(lbl_(w.date)) + ' ' + esc_(w.time) + ' · ' + esc_(w.name));
      else add(title + ' (weekly)', 'miss', 'was due ' + esc_(lbl_(dd)) + ' ' + esc_(t12_(u.t)));
      return;
    }
    if (F_.byMeter) {
      const miss = METERS.filter(function (m) { return !last || m.f.some(function (f) { return last.v[f] === '' || last.v[f] == null; }); });
      if (!miss.length) add(title, last.late ? 'late' : 'ok', 'all ' + METERS.length + ' meters entered' + (last.late ? ' (some late)' : ''));
      else add(title, 'miss', miss.length + ' meter(s) missing: ' + esc_(miss.map(function (m) { return m.n; }).join(', ')));
      return;
    }
    const due = dueOf_(fk, td); if (!u) return;
    if (last) add(title, last.late ? 'late' : 'ok', esc_(last.time) + ' · ' + esc_(last.name) + (last.late ? ' · due ' + esc_(t12_(due.t)) : ''));
    else add(title, 'miss', 'due by ' + esc_(t12_(due.t)));
  });
  /* planned today: solar cleaning + weekly / monthly checks */
  const ci = cleanInfo_();
  if (ci.last === td) add('🧽 Solar panel cleaning', 'ok', 'cleaned today');
  else if (ci.due <= td) add('🧽 Solar panel cleaning', 'miss', 'planned ' + esc_(lbl_(ci.due)) + ' (last cleaned ' + esc_(lbl_(ci.last)) + ')');
  Object.keys(PER).forEach(function (fk) {
    Object.keys(PER[fk]).forEach(function (k) {
      const st = perStart_(PER[fk][k], td); if (st < perEff_(fk, k)) return;
      const doneToday = readRows_(fk, td, td).some(function (o) { return o.v[k] !== '' && o.v[k] != null; }), pend = perDue_(fk, k, td), nm = FORMS[fk].icon + ' ' + FORMS[fk].title + ' – ' + perLabel_(fk, k);
      if (doneToday) add(nm, 'ok', 'done today');
      else if (pend) add(nm, 'miss', 'due ' + (st === td ? 'today' : 'since ' + esc_(lbl_(st))));
    });
  });
  const acts = actRows_(500).filter(function (r) { return r.status === 'OPEN' && !actDone_(r); });
  const sec = function (t, body) { return '<h3 style="margin:18px 0 6px;font-size:15px">' + t + '</h3>' + body; };
  const box = function (c, n, lab) { return '<td style="padding:8px 14px;text-align:center;background:' + c + '1a;border-radius:8px"><div style="font-size:22px;font-weight:bold;color:' + c + '">' + n + '</div><div style="font-size:11px;color:#475569">' + lab + '</div></td><td width="8"></td>'; };
  let h = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;max-width:760px">' + mailBand_('📋 Daily review – ' + lbl_(td), 'Today at ' + t12_(hmN) + ' · filled, late, not filled, out of range and planned checks') +
    '<div style="border:1px solid #e2e8f0;border-top:0;padding:14px;border-radius:0 0 10px 10px"><table style="border-collapse:separate"><tr>' + box(G, cnt.ok, 'done on time') + box(O, cnt.late, 'filled late') + box(RD, cnt.miss, 'not filled') + box('#7c3aed', oor.length, 'out of range') + box('#0369a1', acts.length, 'alerts waiting') + '</tr></table>' +
    sec('✅ Today\'s entries and planned checks', '<table style="border-collapse:collapse;width:100%;font-size:13px">' + lines.join('') + '</table>');
  h += sec('🚨 Out of range today', oor.length ? '<table style="border-collapse:collapse;width:100%;font-size:13px">' + oor.map(function (o) { return '<tr><td style="padding:6px 10px;border-bottom:1px solid #eef2f7;vertical-align:top">' + esc_(o[0]) + '<br><span style="color:#64748b;font-size:12px">' + esc_(o[1]) + '</span></td><td style="padding:6px 10px;border-bottom:1px solid #eef2f7;background:#fef2f2">' + o[2] + '</td></tr>'; }).join('') + '</table>' : '<p style="margin:0;color:#059669">Every reading today was within range. 👍</p>');
  h += sec('🛠️ Alerts still waiting for an action report', acts.length ? '<table style="border-collapse:collapse;width:100%;font-size:13px">' + acts.slice(0, 10).map(function (r) { return '<tr><td style="padding:6px 10px;border-bottom:1px solid #eef2f7">' + esc_(r.id) + '</td><td style="padding:6px 10px;border-bottom:1px solid #eef2f7">' + esc_(r.form) + ' · ' + esc_(lbl_(r.date)) + '</td><td style="padding:6px 10px;border-bottom:1px solid #eef2f7;color:#475569">' + esc_(r.problem.slice(0, 110)) + '</td></tr>'; }).join('') + '</table>' + (acts.length > 10 ? '<p style="color:#64748b">+' + (acts.length - 10) + ' more on the Actions page.</p>' : '') : '<p style="margin:0;color:#059669">No alert is waiting. ✅</p>');
  h += '<p style="color:#94a3b8;font-size:12px;margin:16px 0 0">Automatic daily review from the Plant Electrical Portal.</p></div></div>';
  MailApp.sendEmail({ to: mailTo_().join(','), subject: '📋 Daily review ' + lbl_(td) + ': ' + cnt.ok + ' done · ' + cnt.late + ' late · ' + cnt.miss + ' not filled · ' + oor.length + ' out of range', htmlBody: h, name: CFG.TITLE });
}



function dashFuel_(isos) {
  const F_ = dgFuelRows_(isos); let used = 0, recv = 0;
  isos.forEach(function (d) { used += F_.rows[d].used; recv += F_.rows[d].recv; });
  return { tracked: F_.tracked, stock: F_.stock, openAt: F_.openAt, lph: F_.lph, used: rnd_(used), recv: rnd_(recv) };
}
function dashDG_(from, to) {
  const rows = readRows_('DG', null, to), isos = dayList_(from, to), by = {}, log = [];
  isos.forEach(function (d) { by[d] = { hrs: 0, units: 0, coolant: null, diesel: 0, on: 0, off: 0 }; });
  let prevH = null;
  rows.forEach(function (r) {
    const s = hm_(r.v.start), e = hm_(r.v.stop); let h = 0;
    if (s !== null && e !== null) { h = dgRunMins_(r) / 60; }
    const hw = r.v.hwh === '' ? null : r.v.hwh;
    const u = (hw !== null && prevH !== null && hw >= prevH) ? hw - prevH : 0;
    if (hw !== null) prevH = hw;
    const g = by[r.date]; if (!g) return;
    g.hrs += h; g.units += u; g.diesel += r.v.diesel === '' ? 0 : r.v.diesel;
    if (s !== null) g.on++; if (e !== null) g.off++;
    if (r.v.coolant !== '') g.coolant = Math.max(g.coolant || 0, r.v.coolant);
    if (h > 0) log.push({ date: lbl_(r.date), start: r.v.start, stop: r.v.stop, hrs: rnd_(h) });
  });
  const hrs = isos.map(function (d) { return rnd_(by[d].hrs); }), units = isos.map(function (d) { return rnd_(by[d].units); });
  const diesel = isos.map(function (d) { return rnd_(by[d].diesel); });
  const cool = isos.map(function (d) { return by[d].coolant; }).filter(function (x) { return x !== null; });
  const tH = sum_(hrs), tU = sum_(units), tD = sum_(diesel);
  return {
    days: isos.map(lbl_), hrs: hrs, units: units, diesel: diesel, log: log, fuel: dashFuel_(isos),
    on: isos.map(function (d) { return by[d].on; }), off: isos.map(function (d) { return by[d].off; }),
    k: { hrs: rnd_(tH), units: rnd_(tU), diesel: rnd_(tD), runDays: hrs.filter(function (x) { return x > 0; }).length, runs: log.length, on: sum_(isos.map(function (d) { return by[d].on; })), off: sum_(isos.map(function (d) { return by[d].off; })),
         peakCoolant: cool.length ? Math.max.apply(null, cool) : null, kwhPerL: tD > 0 ? rnd_(tU / tD) : null,
         cost: DASH.DIESEL_RATE ? rnd_(tD * DASH.DIESEL_RATE) : null }
  };
}

function dashEquip_(from, to) {
  return ['SERVO', 'UPS1', 'UPS2', 'COMP', 'FIRE', 'SCLEAN'].map(function (k) {
    const F_ = FORMS[k], rows = readRows_(k, from, to), last = rows.length ? rows[rows.length - 1] : null;
    const names = function (r) { return r.bad.map(function (x) { return F_.fields.filter(function (f) { return f.k === x; })[0].n; }); };
    return {
      key: k, title: F_.title, icon: F_.icon, n: rows.length,
      badEntries: rows.filter(function (r) { return r.bad.length; }).length,
      last: last ? { date: last.date, time: last.time, name: last.name, bad: names(last) } : null,
      recent: rows.slice(-10).reverse().map(function (r) { return { date: r.date, time: r.time, v: r.v, bad: r.bad, ph: r.ph }; })
    };
  });
}

function dashPFP_(from, to) {
  const rows = readRows_('PFP', from, to), last = rows.length ? rows[rows.length - 1] : null;
  if (!last) return { last: null, caps: [], alerts: 0 };
  const c = pfpCaps_(last.v);
  return { last: { date: last.date, time: last.time, name: last.name, ph: last.ph }, caps: c.caps, alerts: c.alerts };
}

function dashAlerts_(g, dg, eq, to, pfp) {
  const A = [], add = function (level, icon, title, text, key) { A.push({ level: level, icon: icon, title: title, text: text, key: key || '' }); };
  const L = DASH.MDI_LIMIT * DASH.MDI_X;
  if (g && !g.error) {
    const k = g.k;
    if (k.peakMdi !== null) {
      if (k.peakMdi >= L) add('crit', '🔥', 'MDI limit crossed', 'Peak demand ' + f0_(k.peakMdi) + ' kVA on ' + k.peakMdiDay + ' against the ' + f0_(L) + ' kVA limit. Penalty risk.');
      else if (k.peakMdi >= 0.9 * L) add('warn', '⚠️', 'MDI close to the limit', 'Peak ' + f0_(k.peakMdi) + ' kVA = ' + Math.round(k.peakMdi / L * 100) + '% of limit (' + k.peakMdiDay + '). ' + k.mdiHigh + ' day(s) above 90%.');
      else add('ok', '✅', 'MDI under control', 'Peak ' + f0_(k.peakMdi) + ' kVA, ' + Math.round(k.peakMdi / L * 100) + '% of the limit.');
    }
    if (k.pfLow === 0 && k.avgPf !== null) add('ok', '✅', 'Power factor healthy', 'Average meter PF ' + k.avgPf.toFixed(2) + '.');
    const spikes = [];
    g.dept.depts.forEach(function (d) {
      if (d.avgPrev === null || d.avgPrev < 50) return;
      const p = (d.last / d.avgPrev - 1) * 100; if (p >= 25) spikes.push({ d: d, p: p });
    });
    spikes.sort(function (a, b) { return b.p - a.p; }).slice(0, 3).forEach(function (s) {
      add('warn', '📈', s.d.name + ' running high', f0_(s.d.last) + ' units on ' + s.d.lastDay + ', ' + Math.round(s.p) + '% above its earlier average.');
    });
      } else if (g) add('warn', '🛠️', 'Waiting for meter data', g.error);

  if (dg && !dg.error) {
    const k = dg.k;
    if (k.hrs <= 0) add('ok', '✅', 'No DG running', 'The DG set did not run in this period.');
    if (k.peakCoolant !== null && k.peakCoolant >= DASH.COOLANT_CRIT) add('crit', '🌡️', 'DG coolant too hot', 'Peak coolant temperature ' + k.peakCoolant + ' °C.');
    else if (k.peakCoolant !== null && k.peakCoolant >= DASH.COOLANT_WARN) add('warn', '🌡️', 'DG coolant running warm', 'Peak coolant temperature ' + k.peakCoolant + ' °C.');
  }
  if (eq && !eq.error) {
    eq.forEach(function (e) {
      if (e.last && e.last.bad.length) add(e.last.bad.length >= 3 ? 'crit' : 'warn', e.icon, e.title + ' out of range', 'Latest entry (' + lbl_(e.last.date) + ' ' + e.last.time + '): ' + e.last.bad.join(', ') + '.');
      else if (e.last) add('ok', '✅', e.title + ' within range', 'Latest entry on ' + lbl_(e.last.date) + ' is fine.');
    });
  }
  if (pfp && !pfp.error && pfp.last) {
    if (pfp.alerts) add(pfp.alerts >= 3 ? 'crit' : 'warn', '🎛️', 'Capacitor panel: ' + pfp.alerts + ' capacitor(s) need attention', 'Inspection of ' + lbl_(pfp.last.date) + ' by ' + pfp.last.name + '.');
    else add('ok', '✅', 'Capacitor panel healthy', 'All 20 capacitors within range on ' + lbl_(pfp.last.date) + '.');
  }
  if (to === today_()) {
    const hmNow = nowHM_(), tdy = today_();
    Object.keys(DUE).forEach(function (k) {
      const F_ = FORMS[k], u = DUE[k];
      if (k === 'DG' || F_.byMeter) return;
      if (u.dow) {
        const ws = weekStart_(tdy), dd = addDays_(ws, u.dow - 1);
        if (tdy < dd || readRows_(k, ws, null).length) return;
        const late = tdy > dd || hmNow >= u.t;
        add(late ? 'crit' : 'warn', late ? '🚨' : '⏳', F_.title + (late ? ' OVERDUE' : ' is due today'), 'Weekly form, due ' + dueText_(k) + (late ? '. The time has passed and it is not done this week.' : '.'));
        return;
      }
      const t = dueOf_(k, tdy).t, late = hmNow >= t;
      if (!readRows_(k, tdy, tdy).length) add(late ? 'crit' : 'warn', late ? '🚨' : '⏳', F_.title + (late ? ' OVERDUE' : ' not entered yet'), late ? 'Fixed time ' + t12_(t) + ' has passed and nobody has submitted today.' : 'No reading yet today (due by ' + t12_(t) + ').');
    });
    /* BUILD 10b: a DG run that is running now (stop not entered) */
    const dgo = dgOpenInfo_();
    if (dgo) { const ageH = (Date.now() - Date.parse(dgo.date + 'T' + dgo.start + ':00+05:30')) / 3600000; add(ageH > 12 ? 'crit' : 'info', '🛢️', 'DG is RUNNING since ' + dgo.start + (dgo.date === tdy ? '' : ' (' + lbl_(dgo.date) + ')'), 'Started by ' + dgo.name + '. The operator must scan the DG QR code again and enter the STOP time when the set is off.'); }
    /* BUILD 10: weekly / monthly checks still to be done */
    Object.keys(PER).forEach(function (fk) {
      Object.keys(PER[fk]).forEach(function (k) {
        const st = perStart_(PER[fk][k], tdy);
        if (st < perEff_(fk, k) || !perDue_(fk, k, tdy)) return;
        const t = (DUE[fk] || { t: '09:00' }).t, late = tdy > st || hmNow >= t;
        add(late ? 'crit' : 'warn', late ? '🚨' : '⏳', FORMS[fk].title + ' – ' + perLabel_(fk, k) + (late ? ' OVERDUE' : ' due today'), 'Fill it in the next ' + FORMS[fk].title + ' entry (due ' + (st === tdy ? '' : lbl_(st) + ' ') + 'by ' + t12_(t) + ').');
      });
    });
    /* solar & dept meters: which meters are still missing today */
    const sr = readRows_('SOLAR', tdy, tdy), row = sr.length ? sr[sr.length - 1] : null;
    const miss = METERS.filter(function (m) { return !row || m.f.some(function (f) { return row.v[f] === '' || row.v[f] == null; }); });
    const lateM = miss.filter(function (m) { return hmNow >= dueOf_('SOLAR', tdy, m).t; });
    if (miss.length) add(lateM.length ? 'crit' : 'warn', lateM.length ? '🚨' : '☀️', miss.length + ' meter(s) ' + (lateM.length ? 'OVERDUE' : 'pending today'), miss.map(function (m) { return m.n; }).join(', ') + ' (due by ' + t12_(dueOf_('SOLAR', tdy).t) + ')');
    const ci = cleanInfo_();
    if (tdy >= ci.due) {
      const cl = tdy > ci.due || hmNow >= ci.by;
      add(cl ? 'crit' : 'warn', '🧽', cl ? 'Solar cleaning OVERDUE' : 'Solar cleaning planned today', 'Planned for ' + lbl_(ci.due) + ' (last cleaned ' + lbl_(ci.last) + '), to be done by ' + t12_(ci.by) + ' and marked in the Solar plant entry.');
    } else add('info', '🧽', 'Next solar cleaning', 'Planned on ' + lbl_(ci.due) + ' (last cleaned ' + lbl_(ci.last) + ').');
    const nOpen = actRows_(500).filter(function (r) { return r.status === 'OPEN' && !actDone_(r); }).length;
    if (nOpen) add('crit', '🛠️', nOpen + ' alert(s) waiting for an action report', 'Open the Actions tab and write what was done for each alert. The action is e-mailed to the same people.', 'ACT');
    const rv = reviewDone_(tdy);
    if (!rv) add('warn', '✅', 'Daily photo review not done', 'Open the Daily review tab, look at every photo of today and confirm.', 'REV');
  }
  const rank = { crit: 0, warn: 1, info: 2, ok: 3 };
  return A.sort(function (a, b) { return rank[a.level] - rank[b.level]; });
}

/* =====================================================================================
   ONE-TIME DATA IMPORT  (run importExcelHistory once from the Apps Script editor)
   Copies the readings that exist only in UNIT_REPORT-2026.xlsx (1-21 Oct, 25 Oct and the
   30 Sep opening DG reading) into F_METER, F_SOLAR, F_DG and the Entry log.
   - Every imported row is YELLOW, its name is "Imported from UNIT_REPORT-2026 Excel" and the
     Warnings cell says "IMPORTED FROM EXCEL FILE ...". The portal shows a "From Excel" tag.
   - A date that already has an entry on the portal is never touched (22-24 and 26-29 Oct stay as entered).
   - Safe to run twice: dates already present are skipped.
   ===================================================================================== */
const IMPORT_NAME = 'Imported from UNIT_REPORT-2026 Excel';
const IMPORT_DATA = {"METER":[["2026-10-01","06:00",4757.15,177.85,4900.85,182.66,0.998,0.553,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-02","06:30",4762.48,177.88,4906.28,182.7,0.998,0.497,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-03","10:40",4763.3,179.81,4907.1,184.72,0.996,0.497,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-04","06:00",4767.7,179.81,4911.52,184.72,0.999,0.497,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-05","10:00",4771.68,179.92,4915.55,184.85,0.998,0.497,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-06","06:00",4777.14,179.92,4921.03,184.86,0.999,0.552,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-07","09:30",4781.73,179.92,4925.63,184.86,0.998,0.552,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-08","06:00",4787.25,179.92,4931.19,184.86,0.998,0.552,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-09","06:00",4793.23,179.93,4937.19,184.87,0.999,0.552,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-10","06:00",4799.31,179.93,4943.39,184.87,0.999,0.552,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-11","06:00",4804.72,179.95,4948.88,184.89,0.992,0.552,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-12","09:30",4809.12,179.95,4953.35,184.89,0.999,0.552,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-13","06:00",4814.3,179.97,4958.64,184.91,0.94,0.552,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-14","06:00",4819.45,180,4963.87,184.95,0.999,0.552,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-15","06:00",4825.32,180.01,4969.79,184.96,0.999,0.552,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-16","06:00",4830.57,180.03,4975.07,184.98,0.999,0.552,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-17","06:00",4835.07,180.08,4979.66,185.05,0.999,0.552,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-18","06:00",4840.25,180.1,4984.89,185.07,0.99,0.552,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-19","09:30",4841.22,181.08,4985.88,186.11,0.889,0.552,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-20","06:00",4846.03,181.12,4990.85,186.15,0.999,0.552,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-21","09:59",4846.73,182.65,4991.55,187.76,0.999,0.553,"","","","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""]],"SOLAR":[["2026-10-01","06:00",13872.2,13935.1,"",22320.19,26583.5,670913.47,97199.1,8235.13,33730.03,18557.6,179588,"","",286566.65,43381.63,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-02","06:30",13887.3,13950.3,"",22410.71,26636.1,673443.26,97571.2,8265.79,33879.02,18678.97,180984,"","",288348.12,43669.26,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-03","10:40",13907,13970.1,"",22520.28,26645.9,673994.75,97624.2,8273.84,33935.36,18698.67,181263,"","",288840.76,43792.35,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-04","06:00",13913.6,13976.6,"",22583.83,26690.9,676182.27,97897.7,8296.18,34065.58,18797.56,182363,"","",290180.76,44010.27,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-05","10:00",13930.4,13993.6,"",22707.37,26747.1,679187.86,97974.3,8302.66,34099.16,18816.71,184151,"","",290744.48,44164.48,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-06","06:00",13941.8,14005,"",22788.35,26799,681590.46,98308.7,8338.18,34260.21,18909.46,185401,"","",292269.76,44374.62,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-07","09:30",13956,14019.2,"",22883.78,26857.7,684521.53,98720,8379.88,34434.92,19050.36,186952,"","",294308.35,44690.36,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-08","06:00",13966.3,14029.5,"",22969.41,26904,686598.97,99032.1,8405.16,34588.14,19164.06,188108,"","",295840.7,44963.42,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-09","06:00",13977.2,14040.5,"",23065.64,26956.5,689191.16,99436.9,8437.3,34753.68,19282.07,189514,"","",297647,45233.5,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-10","06:00",13989.7,14053,"",23153.69,27015.3,691593.66,99857.5,8470.01,34932.74,19413.9,191061,"","",299467.1,45443.67,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-11","06:00",14001.9,14065.3,"",23243.91,27065.3,693891.9,100259,8498.42,35050.97,19533.47,192394,"","",301295.45,45665.93,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-12","09:30",14009.2,14072.7,"",23340.12,27111,695927.06,100587,8512.88,35147.57,19651.78,193846,"","",302240.6,45807.05,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-13","06:00",14019,14082.5,"",23406.41,27158.2,697962.3,100907,8543.58,35319.43,19754.81,194963,"","",303758.78,46050.43,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-14","06:00",14031.5,14095.1,"",23483.43,27205.9,700367.48,101306,8576.08,35466.56,19859.98,196181,"","",305555.87,46265.24,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-15","06:00",14043.8,14107.4,"",23560.97,27259.5,702939.32,101736,8601.73,35604.31,19940.63,197697,"","",307469.12,46550.12,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-16","06:00",14048.7,14112.4,"",23622.53,27301.5,705152.96,102106,8626.05,35771.32,20030.37,198786,"","",308965.34,46808.9,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-17","06:00",14061.5,14125.3,"",23685.6,27341.8,707245.37,102501,8653.37,35871.52,20105.24,199917,"","",310536.92,47083.89,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-18","06:00",14073.1,14136.9,"",23752.14,27386.9,709493.63,102862,8685.68,36033.18,20238.52,201172,"","",312316.67,47334.28,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-19","09:30",14090.3,14154.2,"",23827.68,27402.3,710047.42,103145,8695.72,36093.28,20258.35,201623,"","",313241.85,47481.77,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-20","06:00",14101.8,14165.7,"",23879.35,27447.9,712218.62,103466,8723.69,36254.2,20342.06,202720,"","",314705.37,47688.29,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-21","09:59",14118.2,14182.3,"",23957.35,27453.7,712724.16,103506,8727.43,36269.95,20355.63,202938,"","",315084.32,47751.12,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-25","","","","",24195.59,27642.5,722446.27,104793,8850.62,36902.33,20817.05,207862,"","",321590.68,48759.96,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal | F Block taken from the 24-Oct \"END\" reading (Excel row 25 had 0)",""]],"DG":[["2026-09-30","","","",79357,"","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal (opening meter reading)",""],["2026-10-01","3:08","3:08","3:13",79370,60,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-03","11:10","11:10","13:10","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-03","13:50","13:50","15:10","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-03","11:25","11:25","11:55",79697,86,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-05","9:55","9:55","10:25",79728,82,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-06","11:00","11:00","12:05","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-06","4:15","4:15","7:50",80317,90,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-07","10:00","10:00","10:30","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-07","12:40","12:40","13:15",80338,82,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-11","2:00","2:00","2:40",80390,71,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-12","1:50","1:50","2:45",80524,79,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-14","5:45","5:45","5:50","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-14","9:40","9:40","9:50","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-14","10:40","10:40","11:30",80724,81,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-15","8:30","8:30","9:30","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-15","12:10","12:10","12:45",80802,80,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-16","4:30","4:30","4:35",80809,41,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-17","1:30","1:30","1:45","","","","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""],["2026-10-17","3:20","3:20","3:30",80838,60,"","IMPORTED FROM EXCEL FILE (UNIT_REPORT-2026.xlsx) – not entered on the portal",""]]};
function importExcelHistory() {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  const rep = [];
  try {
    Object.keys(IMPORT_DATA).forEach(function (fk) {
      const F_ = FORMS[fk], sh = sheet_(fk), nf = F_.fields.length, last = sh.getLastRow(), have = {};
      if (last >= 2) sh.getRange(2, 3, last - 1, 1).getValues().forEach(function (r) { const d = iso_(r[0]); if (d) have[d] = 1; });
      const rows = IMPORT_DATA[fk].filter(function (r) { return !have[r[0]]; });
      if (!rows.length) { rep.push(fk + ': nothing to import (already done)'); return; }
      const base = Date.now(), out = rows.map(function (r, i) { return [new Date(base + i * 1000), '📥 ' + IMPORT_NAME].concat(r); });
      const start = last + 1, n = out.length, w = 6 + nf;
      if (sh.getMaxRows() < start + n) sh.insertRowsAfter(sh.getMaxRows(), start + n - sh.getMaxRows());
      sh.getRange(start, 3, n, 2).setNumberFormat('@');
      F_.fields.forEach(function (f, i) { if (f.t === 'time') sh.getRange(start, 5 + i, n, 1).setNumberFormat('@'); });
      sh.getRange(start, 1, n, w).setValues(out).setBackground('#fff2a8');
      const lg = logSheet_(), ll = lg.getLastRow() + 1;
      const lrows = out.map(function (r) {
        const data = {}; F_.fields.forEach(function (f, j) { data[f.k] = r[4 + j]; });
        return [r[0], r[1], fk, r[2], r[3], 0, r[4 + nf], JSON.stringify(data), ''];
      });
      if (lg.getMaxRows() < ll + n) lg.insertRowsAfter(lg.getMaxRows(), ll + n - lg.getMaxRows());
      lg.getRange(ll, 4, n, 2).setNumberFormat('@');
      lg.getRange(ll, 1, n, 9).setValues(lrows).setBackground('#fff2a8');
      rep.push(fk + ': ' + n + ' rows imported');
    });
    bump_();
  } finally { lock.releaseLock(); }
  Logger.log(rep.join('\n')); return rep.join(' | ');
}

/* ONE-TIME: fix the typing mistake P.F. 998 (should be 0.998) saved on 29 Oct. Run fixKnownEntries once. */
function fixKnownEntries() {
  const rep = [], sh = sheet_('METER'), F_ = FORMS.METER, ip = F_.fields.map(function (f) { return f.k; }).indexOf('pf');
  const last = sh.getLastRow(); if (last < 2) return 'no data';
  const v = sh.getRange(2, 1, last - 1, 6 + F_.fields.length).getValues();
  for (let i = 0; i < v.length; i++) {
    if (iso_(v[i][2]) === '2026-10-29' && Number(v[i][4 + ip]) === 998) {
      sh.getRange(i + 2, 5 + ip).setValue(0.998);
      const lg = logSheet_(), lv = lg.getRange(2, 1, Math.max(1, lg.getLastRow() - 1), 9).getValues();
      for (let j = lv.length - 1; j >= 0; j--) {
        if (lv[j][2] === 'METER' && iso_(lv[j][3]) === '2026-10-29') { let d = {}; try { d = JSON.parse(lv[j][7]); } catch (e) {} d.pf = 0.998; lg.getRange(j + 2, 8).setValue(JSON.stringify(d)); break; }
      }
      auditSheet_().appendRow([new Date(), 'Auto-correct', 'METER', '2026-10-29', String(v[i][1]), 'P.F. meter 998 changed to 0.998 (typing mistake: P.F. can never be above 1)']);
      rep.push('P.F. on 29 Oct corrected 998 -> 0.998');
    }
  }
  bump_(); return rep.join(' | ') || 'nothing to fix';
}
