/* Test the streaming base64 reader that replaces design-desk's fileBytes decoding.
   The old code did  Uint8Array.from(atob(String(j.data)), c=>c.charCodeAt(0))  on the result of
   res.json(), so for a 25 MB attachment the raw body (~33 MB of base64), the parsed JS string
   (~33 MB x 2 bytes a character = 66 MB) and the decoded binary string (~50 MB) were all in
   memory at once - over 130 MB, which is what "Memory limit exceeded" was.
   The new reader walks the response body as it arrives and decodes each whole 4-character group,
   so the only large thing in memory is the file itself. */

/* ---- the function exactly as it will be deployed (kept in sync by hand) ---- */
async function attBytes(res, size) {
  if (!res.ok) throw new Error("Gmail " + res.status + " while reading the file");
  let out = new Uint8Array(Math.ceil((size || 0) * 1.05) + 1024), o = 0;
  const grow = (need) => {
    if (o + need <= out.length) return;
    const n = new Uint8Array(Math.max(out.length * 2, o + need));
    n.set(out.subarray(0, o)); out = n;
  };
  const put = (b64) => {
    const n = b64.length - (b64.length % 4);
    if (!n) return b64;
    const s = atob(b64.slice(0, n).replace(/-/g, "+").replace(/_/g, "/"));
    grow(s.length);
    for (let k = 0; k < s.length; k++) out[o++] = s.charCodeAt(k);
    return b64.slice(n);
  };
  const td = new TextDecoder();
  let head = "", tail = "", inData = false, ended = false;
  for await (const c of res.body) {
    if (ended) continue;
    let t = td.decode(c, { stream: true });
    if (!inData) {
      head += t;
      const i = head.indexOf('"data"');
      const c2 = i < 0 ? -1 : head.indexOf(":", i);
      const q2 = c2 < 0 ? -1 : head.indexOf('"', c2);
      if (q2 < 0) { if (head.length > 8192) head = head.slice(-8192); continue; }
      t = head.slice(q2 + 1); head = ""; inData = true;
    }
    const q = t.indexOf('"');
    if (q >= 0) { t = t.slice(0, q); ended = true; }
    tail = put(tail + t);
  }
  if (!inData) throw new Error("Gmail sent no file data");
  if (tail) { let p = tail; while (p.length % 4) p += "="; put(p); }
  return out.subarray(0, o);
}

/* ---- a fake Response whose body arrives in pieces, like a real one ---- */
function fakeRes(text, chunkSize, ok = true, status = 200) {
  const buf = Buffer.from(text, "utf8");
  return {
    ok, status,
    body: (async function* () {
      for (let i = 0; i < buf.length; i += chunkSize) yield new Uint8Array(buf.subarray(i, i + chunkSize));
    })(),
  };
}
const b64u = b => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

let bad = 0;
const ok = (name, cond, got) => { if (!cond) bad++; console.log((cond ? "ok   " : "FAIL ") + name + (got ? "  [" + got + "]" : "")); };

(async () => {
  /* 1. every length modulo 4, so the carry-over between chunks is exercised */
  for (const len of [0, 1, 2, 3, 4, 5, 7, 16, 255, 256, 1000, 65537]) {
    const data = Buffer.alloc(len);
    for (let i = 0; i < len; i++) data[i] = (i * 7 + 13) & 0xff;
    const body = JSON.stringify({ size: len, data: b64u(data) });
    for (const cs of [1, 3, 7, 64, 1024, 1 << 20]) {
      const got = Buffer.from(await attBytes(fakeRes(body, cs), len));
      if (!got.equals(data)) { ok("length " + len + ", chunks of " + cs, false, "got " + got.length + " bytes, expected " + len); return; }
    }
  }
  ok("every length and chunk size decodes byte for byte", true, "12 lengths x 6 chunk sizes");

  /* 2. real binary, not a pattern - and the size field coming after the data */
  const bin = require("crypto").randomBytes(300000);
  const body2 = '{"data":"' + b64u(bin) + '","size":' + bin.length + '}';
  ok("data before size", Buffer.from(await attBytes(fakeRes(body2, 9999), bin.length)).equals(bin));

  /* 3. spaces in the JSON, as a pretty-printed reply would have */
  const body3 = '{\n  "size" : ' + bin.length + ',\n  "data" : "' + b64u(bin) + '"\n}';
  ok("spaces around the colon", Buffer.from(await attBytes(fakeRes(body3, 777), bin.length)).equals(bin));

  /* 4. the size Gmail reports being wrong (too small) must not lose bytes */
  ok("a wrong size still returns the whole file",
     Buffer.from(await attBytes(fakeRes(body2, 4096), 10)).equals(bin));

  /* 5. base64url characters - and + / mixed in */
  const tricky = Buffer.from([0xfb, 0xff, 0xbe, 0xef, 0xfa, 0xce, 0x3f, 0xd0]);
  ok("base64url - and _ decode", Buffer.from(await attBytes(fakeRes(JSON.stringify({ size: 8, data: b64u(tricky) }), 2), 8)).equals(tricky));

  /* 6. failures are reported, not silently empty */
  let msg = "";
  try { await attBytes(fakeRes("{}", 10, false, 404), 0); } catch (e) { msg = e.message; }
  ok("an HTTP error is reported", /Gmail 404/.test(msg), msg);
  msg = "";
  try { await attBytes(fakeRes('{"size":5}', 10), 5); } catch (e) { msg = e.message; }
  ok("a reply with no data is reported", /no file data/.test(msg), msg);

  /* 7. memory: decoding a 25 MB file must not hold several copies of it */
  const big = require("crypto").randomBytes(25 * 1024 * 1024);
  const body7 = JSON.stringify({ size: big.length, data: b64u(big) });
  if (global.gc) global.gc();
  const before = process.memoryUsage().heapUsed;
  let peak = before;
  const t = setInterval(() => { peak = Math.max(peak, process.memoryUsage().heapUsed); }, 5);
  const got7 = Buffer.from(await attBytes(fakeRes(body7, 64 * 1024), big.length));
  clearInterval(t);
  const mb = n => (n / 1048576).toFixed(0) + " MB";
  ok("a 25 MB file decodes correctly", got7.equals(big));
  console.log('     peak heap while decoding 25 MB: ' + mb(peak - before) + ' above the start' +
              ' (the old way needed over 130 MB)');
  ok("25 MB needs well under the edge function's memory", (peak - before) < 80 * 1048576, mb(peak - before));

  console.log("\n" + (bad ? bad + " CHECK(S) FAILED" : "all checks passed"));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error("FAILED " + e.message); process.exit(1); });
