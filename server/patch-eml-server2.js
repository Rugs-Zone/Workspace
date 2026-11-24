/* 24 Nov 2026 - two things on the server for attached mail (.eml) and signature pictures.
 *
 * (1) THE SUSPECTED CASE, now covered: Gmail usually stores an attached mail as its own part with
 *     its own attachmentId (checked on real mail in seven mailboxes - every one had it), but it may
 *     instead EXPAND the mail into nested parts and give the message/rfc822 part no attachmentId at
 *     all. Those were invisible: attachments() needs "filename AND attachmentId", so such a part was
 *     never listed, never shown and never downloadable. It is now listed, and the download rebuilds
 *     the .eml from the nested parts (headers + each part written back out, bodies as base64), so it
 *     saves and previews like any other mail file.
 *
 * (2) The attachment list now records whether a part was INLINE and its cid, so the app can keep
 *     signature pictures (image001.png and friends) out of the attachment bar, out of the count and
 *     out of Download all without guessing. Old rows have no such flag, so the app also has its own
 *     rule; this makes it exact for everything that arrives from now on.
 *
 *   node server/patch-eml-server2.js
 */
const fs = require('fs'), path = require('path');
const F = path.join(__dirname, 'local-server', 'rugs-mail.bundle.mjs');
let s = fs.readFileSync(F, 'utf8');
let n = 0;
const sub = (a, b) => {
  const c = s.split(a).length - 1;
  if (c !== 1) throw new Error('anchor found ' + c + ' times: ' + a.slice(0, 70));
  s = s.replace(a, b); n++;
};

/* ---- attachments(): inline flag, cid, and an expanded attached mail ---- */
sub(
`function attachments(p, out = []) {
  if (!p) return out;
  if (p.filename && p.body?.attachmentId) out.push({ id: p.body.attachmentId, name: p.filename, mime: p.mimeType, size: p.body.size || 0 });
  for (const c of p.parts || []) attachments(c, out);
  return out;
}`,
`function attachments(p, out = []) {
  if (!p) return out;
  const hv = (nm) => (p.headers || []).find((h) => h.name.toLowerCase() === nm)?.value || "";
  const disp = hv("content-disposition");
  const cid = hv("content-id").replace(/[<>\\s]/g, "") || hv("x-attachment-id").trim();
  const inline = /^\\s*inline/i.test(disp) || (!!cid && !/^\\s*attachment/i.test(disp));
  if (p.filename && p.body?.attachmentId) out.push({ id: p.body.attachmentId, name: p.filename, mime: p.mimeType, size: p.body.size || 0, ...inline ? { inline: true } : {}, ...cid ? { cid } : {} });
  /* 24 Nov 2026: a mail attached as a file that Gmail expanded instead of keeping whole - no
     attachmentId to fetch, so it is marked and the download rebuilds it from these parts */
  else if (/^message\\/rfc822$/i.test(p.mimeType || "") && (p.parts || []).length) {
    const nm = p.filename || ((p.parts[0].headers || []).find((h) => h.name.toLowerCase() === "subject")?.value || "Attached mail").replace(/[\\\\/:*?"<>|\\r\\n]+/g, " ").trim().slice(0, 80) + ".eml";
    out.push({ id: "", name: /\\.eml$/i.test(nm) ? nm : nm + ".eml", mime: "message/rfc822", size: p.body?.size || 0, rebuild: true, part: p });
  }
  for (const c of p.parts || []) attachments(c, out);
  return out;
}
/* write a Gmail payload back out as a mail file. Gmail hands us each body already decoded, so
   every part goes out as base64 and says so; headers are kept as they came. */
function rfc822Raw(part) {
  const CRLF = "\\r\\n";
  const one = (p) => {
    const keep = (p.headers || []).filter((h) => !/^content-transfer-encoding$/i.test(h.name));
    const ct = keep.find((h) => /^content-type$/i.test(h.name));
    if ((p.parts || []).length) {
      let bd = /boundary="?([^";]+)"?/i.exec(ct?.value || "")?.[1] || "";
      const hs = keep.slice();
      if (!bd) { bd = "rzb" + Math.random().toString(36).slice(2, 10); hs.push({ name: "Content-Type", value: (p.mimeType || "multipart/mixed") + '; boundary="' + bd + '"' }); }
      return hs.map((h) => h.name + ": " + h.value).join(CRLF) + CRLF + CRLF +
        (p.parts || []).map((c) => "--" + bd + CRLF + one(c)).join("") + "--" + bd + "--" + CRLF;
    }
    const b64 = toStdB64(String(p.body?.data || "")).replace(/[^A-Za-z0-9+/=]/g, "");
    const wrapped = (b64.match(/.{1,76}/g) || []).join(CRLF);
    const hs = keep.concat(b64 ? [{ name: "Content-Transfer-Encoding", value: "base64" }] : []);
    return hs.map((h) => h.name + ": " + h.value).join(CRLF) + CRLF + CRLF + wrapped + CRLF;
  };
  const msg = (part.parts || [])[0];
  if (!msg) throw new E("That attached mail could not be read from Gmail", 502);
  return one(msg);
}`
);

/* ---- the download: rebuild when there is nothing to fetch ---- */
sub(
`      let data = a2.data || "";
      const aid = a2.id || a2.aid;
      if (!data && aid) data = (await gmail(tok, \`messages/\${p.gmailId}/attachments/\${aid}\`)).data || "";
      return { name: a2.name, mime: a2.mime, b64: toStdB64(data) };`,
`      if (a2.rebuild) {
        /* an attached mail Gmail expanded: build the .eml back from its parts */
        const raw = rfc822Raw(a2.part);
        return { name: a2.name, mime: "message/rfc822", b64: Buffer.from(raw, "utf8").toString("base64"), rebuilt: true };
      }
      let data = a2.data || "";
      const aid = a2.id || a2.aid;
      if (!data && aid) data = (await gmail(tok, \`messages/\${p.gmailId}/attachments/\${aid}\`)).data || "";
      return { name: a2.name, mime: a2.mime, b64: toStdB64(data) };`
);

/* ---- keep the two new facts when the long Gmail ids are dropped after the Drive copy ---- */
sub(
  `var slimAtts = (a) => (Array.isArray(a) ? a : []).map((x) => ({ name: x.name, mime: x.mime, size: x.size }));`,
  `var slimAtts = (a) => (Array.isArray(a) ? a : []).map((x) => ({ name: x.name, mime: x.mime, size: x.size, ...x.inline ? { inline: true } : {}, ...x.cid ? { cid: x.cid } : {} }));`
);

/* ---- the Drive copy must not try to fetch bytes that have no id ---- */
sub(
  `      const atts = (m.attachments || []).filter((a) => !skipAtt(a));`,
  `      const atts = (m.attachments || []).filter((a) => !skipAtt(a) && a.id);   /* 24 Nov 2026: an expanded attached mail has no id to fetch */`
);

/* ---- never keep the Gmail payload of an expanded attached mail in the database ---- */
sub(
  `    attachments: atts,`,
  `    attachments: atts.map(({ part, ...x }) => x),   /* 24 Nov 2026: never store the Gmail payload of an expanded attached mail */`
);

fs.writeFileSync(F, s);
console.log('rugs-mail.bundle.mjs patched, ' + n + ' edits');
