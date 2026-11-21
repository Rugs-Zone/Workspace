/* Test the live insp-edit function the way the app calls it.
   Run with two 20-minute throwaway sessions in deleg_sessions and the throwaway inspection row
   INSP-TEST-21NOV (both created and removed again by hand around the run — see PROGRESS.md).
   Usage: node server/test-insp-edit.js                                                         */
const URL = "https://asbgfjngxsabnnzgxugu.supabase.co/functions/v1/insp-edit";
const ANON = "sb_publishable_puw8o_XzDvXmitIaNZvCtQ_5UGjXTBB";
const ID = "INSP-TEST-21NOV";

/* the throwaway sessions: a merchant who HAS the Inspection module, and a designer who does not */
const ASHOK = { token: "rztest-insp-ashok-21nov-9f3a", doc: "ashok_merchant" };
const ANAMIKA = { token: "rztest-insp-anamika-21nov-9f3a", doc: "anamika_kumari_designer" };

async function call(body) {
  const r = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + ANON, apikey: ANON },
    body: JSON.stringify(body),
  });
  let j = {};
  try { j = await r.json(); } catch { /* non-JSON */ }
  return { status: r.status, ok: j.ok === true, error: j.error || "", code: j.code || "", data: j.data || null };
}
const edit = (who, patch, id) => call({
  action: "inspectionUpdate", requester_doc_id: who.doc, session_token: who.token,
  id: id === undefined ? ID : id, patch,
});

let bad = 0;
const check = (name, cond, got) => { if (!cond) bad++; console.log((cond ? "ok   " : "FAIL ") + name + (got ? "   [" + got + "]" : "")); };

(async () => {
  /* ---------- 1. a merchant who can open Inspection may fix the details and the date ------- */
  const when = new Date(Date.now() + 9 * 86400000);
  when.setUTCSeconds(0, 0);
  const r1 = await edit(ASHOK, { visitor_name: "Mr Fixed Name", reason: "Date moved by the buyer", visit_at: when.toISOString() });
  check("a merchant who can open Inspection may edit", r1.ok, r1.status + " " + r1.error);
  check("his name is recorded against the change", r1.data && /ASHOK/i.test(String(r1.data.edited_by || "")), r1.data && r1.data.edited_by);

  /* ---------- 2. somebody without the module is refused, in plain words ---------- */
  const r2 = await edit(ANAMIKA, { reason: "should not be allowed" });
  check("without the Inspection module it is refused", !r2.ok && r2.status === 403, r2.status + " " + r2.error);
  check("the refusal says why", /do not have the Inspection module/i.test(r2.error), r2.error);

  /* ---------- 3. no session, wrong session, somebody else's doc_id ---------- */
  const r3 = await call({ action: "inspectionUpdate", requester_doc_id: ASHOK.doc, id: ID, patch: { reason: "x" } });
  check("no session token is refused", !r3.ok && r3.status === 401 && r3.code === "SESSION_EXPIRED", r3.status + " " + r3.error);

  const r4 = await call({ action: "inspectionUpdate", requester_doc_id: ASHOK.doc, session_token: "not-a-real-token-at-all", id: ID, patch: { reason: "x" } });
  check("a made-up session token is refused", !r4.ok && r4.status === 401, r4.status + " " + r4.error);

  /* the heart of it: a real session may not act as somebody else */
  const r5 = await call({ action: "inspectionUpdate", requester_doc_id: "vinay", session_token: ASHOK.token, id: ID, patch: { reason: "x" } });
  check("a real session cannot claim another person's id", !r5.ok && r5.status === 401, r5.status + " " + r5.error);

  /* ---------- 4. only the five allowed columns are ever written ---------- */
  const r6 = await edit(ASHOK, { created_by: "SOMEBODY ELSE", department: "Hacked", id: "OTHER", location: "Second floor" });
  check("a column that is not editable is ignored, the allowed one still saves", r6.ok, r6.status + " " + r6.error);

  /* ---------- 5. a required field cannot be emptied, and says so plainly ---------- */
  const r7 = await edit(ASHOK, { visitor_name: "   " });
  check("the person's name cannot be emptied", !r7.ok && /please fill in the visitor name/i.test(r7.error), r7.error);
  const r8 = await edit(ASHOK, { location: "" });
  check("the location may be cleared (it is optional)", r8.ok, r8.status + " " + r8.error);

  /* ---------- 6. rubbish input is answered clearly, not with a database error ---------- */
  const r9 = await edit(ASHOK, { visit_at: "not a date" });
  check("an unreadable date is refused in plain words", !r9.ok && /date and time could not be read/i.test(r9.error), r9.error);
  const r10 = await edit(ASHOK, {}, ID);
  check("an empty change is refused", !r10.ok && /nothing to update/i.test(r10.error), r10.error);
  const r11 = await edit(ASHOK, { reason: "x" }, "INSP-DOES-NOT-EXIST");
  check("an inspection that is gone is reported, not invented", !r11.ok && r11.status === 404, r11.status + " " + r11.error);
  const r12 = await call({ action: "somethingElse", requester_doc_id: ASHOK.doc, session_token: ASHOK.token });
  check("any other action is refused", !r12.ok && /unknown action/i.test(r12.error), r12.error);

  console.log("\n" + (bad ? bad + " CHECK(S) FAILED" : "all checks passed"));
  console.log("Now confirm in SQL that INSP-TEST-21NOV holds: visitor_name 'Mr Fixed Name',");
  console.log("reason 'Date moved by the buyer', the new date, location null, edited_by ASHOK,");
  console.log("and that created_by is still 'ASHOK' and department still 'Merchant'.");
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error("FAILED " + e.message); process.exit(1); });
