/* 24 Nov 2026 - the 2.0 attachment cards follow the same real-files rule as the rest of the app
 * (signature pictures the mail already draws are not cards, not counted, not in Download all),
 * with the same "Show hidden inline images" link.
 *   node server/patch-att-clean-v2.js
 */
const fs = require('fs'), path = require('path');
const F = path.join(__dirname, '..', 'mail-v2.js');
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.indexOf('\r\n') >= 0;
if (CRLF) s = s.split('\r\n').join('\n');
let n = 0;
const sub = (a, b) => {
  const c = s.split(a).length - 1;
  if (c !== 1) throw new Error('anchor found ' + c + ' times: ' + a.slice(0, 70));
  s = s.replace(a, b); n++;
};

sub(
`  function attCards(m, t) {
    var list = [];
    (m.files || []).forEach(function (x) { if (x && x.name) list.push({ name: x.name, size: x.size, link: x.link || "", big: !!x.big }); });
    if (!list.length) (m.atts || []).forEach(function (x) { if (x && x.name && !(/^image\\//i.test(x.mime || "") && (x.size || 0) < 40000)) list.push({ name: x.name, size: x.size, mime: x.mime, link: "", saving: true }); });
    if (!list.length) return "";`,
`  function attCards(m, t) {
    /* 24 Nov 2026: the app decides which of these are real files (window.rzAttSplit); the
       pictures the mail draws in its own text get a link under the cards instead. */
    var split = typeof window.rzAttSplit === "function" ? window.rzAttSplit(m) : null;
    var open = !!(window.rzShowInl && window.rzShowInl[m.gid || ""]);
    var src = split ? (open ? split.show.concat(split.hide) : split.show) : null;
    var hid = split ? split.hide.length : 0;
    var list = [];
    if (src) src.forEach(function (x) {
      var meta = ((m.atts || []).filter(function (y) { return y && y.name === x.name; })[0]) || {};
      list.push({ name: x.name, size: x.size, mime: x.mime || meta.mime, link: x.link || "", big: !!x.big, saving: !x.link && !(m.files || []).length });
    });
    else {
      (m.files || []).forEach(function (x) { if (x && x.name) list.push({ name: x.name, size: x.size, link: x.link || "", big: !!x.big }); });
      if (!list.length) (m.atts || []).forEach(function (x) { if (x && x.name && !(/^image\\//i.test(x.mime || "") && (x.size || 0) < 40000)) list.push({ name: x.name, size: x.size, mime: x.mime, link: "", saving: true }); });
    }
    var inlLink = hid ? '<div class="attinl"><button type="button" class="lnk" data-' + (open ? "atthide" : "attshow") + '="' + txt(m.gid || "") + '">' +
      (open ? "Hide the " + hid + " inline picture" + (hid > 1 ? "s" : "") : "\\u{1f5bc} Show hidden inline images (" + hid + ")") +
      '</button><small>pictures the mail already shows in its text (signature logos and icons)</small></div>' : "";
    if (!list.length) return inlLink;`
);

sub(
  `    }).join("") + '</div>';
  }`,
  `    }).join("") + '</div>' + inlLink;
  }`
);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(F, s);
console.log('mail-v2.js patched, ' + n + ' edits');
