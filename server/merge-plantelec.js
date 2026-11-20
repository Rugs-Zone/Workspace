/* 20 Nov 2026 - bring the Plant Electrical module from the user's Desktop\index.html into the live index.html.
   Copies each added piece verbatim from the Desktop file and inserts it in front of the same following text
   in the live file (each anchor must occur exactly once), so nothing else in the live file changes.
   Run: node server/merge-plantelec.js C:\Users\Administrator\Desktop\index.html */
const fs = require('fs');
const NL = /\r\n/g;
const D = fs.readFileSync(process.argv[2], 'utf8').replace(NL, '\n');
let L = fs.readFileSync('index.html', 'utf8').replace(NL, '\n');

function once(s, x, what) {
  const i = s.indexOf(x);
  if (i < 0 || s.indexOf(x, i + 1) >= 0) throw new Error('anchor not unique/absent: ' + what);
  return i;
}
// copy the block that starts with startStr and ends with endStr (inclusive) from D into L, in front of the same following text
function piece(startStr, endStr, what) {
  const a = once(D, startStr, what + ' start');
  const e = D.indexOf(endStr, a);
  if (e < 0) throw new Error('end not found: ' + what);
  const b = e + endStr.length;
  const block = D.slice(a, b);
  if (L.includes(block)) throw new Error('already present: ' + what);
  const after = D.slice(b, b + 300);
  const i = once(L, after, what + ' anchor');
  L = L.slice(0, i) + block + L.slice(i);
  console.log('added', what, block.length, 'chars');
}
function swap(o, n, what) { once(L, o, what); L = L.replace(o, n); console.log('changed', what); }

piece('    <div id="view-plantelec"', '    </div>\n\n', 'screen');
piece('<script>var PLANTELEC_HTML_B64 = "', '";</script>\n', 'module blob');
piece('    { key: "plantelec",', '\n', 'tile');
piece('  function loadPlantelecFrame()', '\n', 'loader');
piece('  var plantelecFrameLoaded = false;\n', '\n', 'loader flag');
piece('    if (view === "plantelec") loadPlantelecFrame();', '\n', 'open hook');
swap('var ALL_VIEWS = ["myday", "management",', 'var ALL_VIEWS = ["myday", "plantelec", "management",', 'ALL_VIEWS');
swap('document.body.classList.toggle("embed-focus", view === "myday" ||', 'document.body.classList.toggle("embed-focus", view === "plantelec" || view === "myday" ||', 'full-screen list');

fs.writeFileSync('index.html', L.replace(/\n/g, '\r\n'));
console.log('written');
