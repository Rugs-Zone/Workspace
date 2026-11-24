/* Runs the dry-run job's own SQL - taken out of the shipped server.mjs, not retyped - against a
 * real copy of the mail database, so the report the office server will print is known in advance.
 * It only reads.
 *   node server/test-onetime-report.js
 */
const fs = require('fs'), path = require('path');
const SRV = path.join(__dirname, 'local-server', 'server.mjs');
const src = fs.readFileSync(SRV, 'utf8');

const parts = [...src.matchAll(/name: "([^"]+)",\s*\n\s*sql: `([\s\S]*?)`\s*\n\s*\}/g)];
if (parts.length !== 2) { console.log('FAIL - expected 2 report queries in server.mjs, found ' + parts.length); process.exit(1); }

const HOME = 'C:/Users/team3pr1/Claude/rugs-mail-local/server';
const { Client } = require(path.join(HOME, 'node_modules', 'pg'));
const url = (fs.readFileSync(path.join(HOME, '.env'), 'utf8').match(/DATABASE_URL=(.+)/) || [])[1].trim();

(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();
  let bad = 0;
  for (const [, name, sql] of parts) {
    const t0 = Date.now();
    let rows;
    try { rows = (await c.query(sql)).rows; }
    catch (e) { bad++; console.log('FAIL ' + name + ' -> ' + e.message); continue; }
    const per = {};
    rows.forEach(r => { per[r.mailbox] = (per[r.mailbox] || 0) + 1; });
    console.log('ok   ' + name);
    console.log('       ' + rows.length + ' conversations in ' + (Date.now() - t0) + ' ms  ' + JSON.stringify(per));
    rows.slice(0, 3).forEach(r => console.log('       e.g. ' + r.mailbox.split('@')[0] + ' · ' + String(r.subject || '').slice(0, 70)));
    /* the query must answer in the shape the job reads */
    for (const k of ['mailbox', 'id', 'subject', 'last_msg_at', 'in_window']) {
      if (rows.length && !(k in rows[0])) { bad++; console.log('FAIL   missing column ' + k); }
    }
  }
  await c.end();
  console.log('\n' + (bad ? 'FAILED' : 'both queries run and answer in the right shape (read only)'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('ERROR ' + e.message); process.exit(1); });
