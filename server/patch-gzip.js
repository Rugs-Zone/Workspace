/* 25 Nov 2026 - STEP 1f: compress the server's answers.

   MEASURED: opening one of the ten heaviest conversations sends back 0.9-4.2 MB
   (median 2.3 MB) of JSON, uncompressed, and takes 0.8-2.2 s. A mail list page is
   3.4 MB. Mail text and JSON compress extremely well, so this is the cheapest real
   win available on the office server - and it helps most for the people who feel it
   most: anyone working over the office internet rather than on the LAN.

   What this does: if the browser says it accepts gzip (every browser does) and the
   answer is worth compressing (over 1 KB and a text/JSON type), the answer is gzipped
   before it is sent, at level 5 - fast enough that the server spends a few milliseconds
   and saves megabytes. Smaller answers and anything already encoded are sent untouched.

   Content-Length is dropped when the body is compressed (the gzipped length is set
   instead), and Vary: Accept-Encoding is added so nothing downstream caches the wrong
   shape. Nothing about the data changes - the browser decompresses before the app ever
   sees it, so no app change is needed at all.

   Run:  node server/patch-gzip.js
*/
const fs = require("fs");
const file = __dirname + "/local-server/server.mjs";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__gzip:start")) { console.log("already there - nothing changed"); process.exit(0); }

/* the import */
if (!/import zlib from "node:zlib"/.test(s)) {
  s = s.replace('import crypto from "node:crypto";', 'import crypto from "node:crypto";\nimport zlib from "node:zlib";');
}

/* the helper */
const anchor = "/* ---- 25 Nov 2026: what the Server page reads   __srvview:start ----------------------";
if (!s.includes(anchor)) throw new Error("run node server/patch-server-view.js first");
const helper = [
  "/* ---- 25 Nov 2026: answers are gzipped when the browser accepts it   __gzip:start ----",
  "   Opening a heavy conversation sent back 2-4 MB of JSON uncompressed; a list page 3.4 MB.",
  "   Level 5 costs a few milliseconds and saves most of those bytes. Small answers, and",
  "   anything already encoded, are left exactly as they were. */",
  "const GZ_MIN = 1024;",
  "function gzipFor(rq, headers, body) {",
  "  try {",
  "    if (!body || body.length < GZ_MIN) return null;",
  "    const ae = String(rq.headers[\"accept-encoding\"] || \"\");",
  "    if (!/\\bgzip\\b/i.test(ae)) return null;",
  "    const h = {}; for (const k in headers) h[k.toLowerCase()] = headers[k];",
  "    if (h[\"content-encoding\"]) return null;",
  "    const type = String(h[\"content-type\"] || \"\");",
  "    if (type && !/json|text|javascript|xml|html|csv/i.test(type)) return null;",
  "    return zlib.gzipSync(body, { level: 5 });",
  "  } catch (e) { return null; }",
  "}",
  "/* __gzip:end */",
  ""
];
const eol = s.includes("\r\n") ? "\r\n" : "\n";
s = s.replace(anchor, helper.join(eol) + eol + anchor);

/* use it on both ways out: the function answers, and the Server page's own answer */
const out1 = `    rs.writeHead(res.status, { ...Object.fromEntries(res.headers), "access-control-allow-private-network": "true" });   // Chrome: public page -> localhost
    rs.end(out);`;
if (!s.includes(out1)) throw new Error("the main reply line was not found");
s = s.replace(out1, `    {
      const hh = { ...Object.fromEntries(res.headers), "access-control-allow-private-network": "true" };   // Chrome: public page -> localhost
      const gz = gzipFor(rq, hh, out);
      if (gz) { hh["content-encoding"] = "gzip"; hh["vary"] = "Accept-Encoding"; delete hh["content-length"]; hh["Content-Length"] = String(gz.length); }
      rs.writeHead(res.status, hh);
      rs.end(gz || out);
    }`);

const out2 = `      rs.writeHead(r2.status, { ...SRV_CORS, "content-type": "application/json" });
      return rs.end(JSON.stringify(r2.body));`;
if (s.includes(out2)) {
  s = s.replace(out2, `      {
        const body = Buffer.from(JSON.stringify(r2.body));
        const hh = { ...SRV_CORS, "content-type": "application/json" };
        const gz = gzipFor(rq, hh, body);
        if (gz) { hh["content-encoding"] = "gzip"; hh["vary"] = "Accept-Encoding"; hh["Content-Length"] = String(gz.length); }
        rs.writeHead(r2.status, hh);
        return rs.end(gz || body);
      }`);
}

fs.writeFileSync(file, s);
console.log("patched server/local-server/server.mjs - answers over 1 KB are gzipped");
