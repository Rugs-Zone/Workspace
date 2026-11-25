/* 25 Nov 2026 - FIX: the database backup has never actually run.

   backup.mjs handed DATABASE_URL straight to pg_dump as a connection string. The
   password in it contains an "@", which is not percent-encoded, so libpq read
   everything after the FIRST "@" as the host and gave up:

       pg_dump: error: could not translate host name "2416@localhost" to address

   backup-log.txt holds exactly one line - the failure - so there is no backup of the
   mail database anywhere, and the "nightly backup" has been doing nothing since it was
   written on 21 Nov.

   Now the URL is taken apart properly and the pieces are passed as flags, with the
   password handed to pg_dump through the environment (PGPASSWORD), so it is never on
   the command line, never in the log and never in this repo. Everything after the
   password - host, port, database, user - is read with decodeURIComponent, so an "@",
   ":" or "/" anywhere in the password is harmless.

   This file is in the local server folder on this laptop (and on the office PC). It is
   NOT in the self-updating file list, so the office copy has to be replaced the same
   way - noted in the report.

   Run:  node server/patch-backup-url.js
*/
const fs = require("fs");
const file = "C:/Users/team3pr1/Claude/rugs-mail-local/server/backup.mjs";
let s = fs.readFileSync(file, "utf8");
if (s.includes("parseDbUrl")) { console.log("already fixed - nothing changed"); process.exit(0); }

const old = `const r = spawnSync(pgDump, ["-Fc", "--no-owner", "-f", file, env.DATABASE_URL], { encoding: "utf8" });`;
if (!s.includes(old)) throw new Error("the pg_dump line was not found");

const neu = `/* 25 Nov 2026: take the URL apart instead of handing it over whole - the password holds
   an "@", so libpq read the host as "2416@localhost" and every backup failed. The password
   goes to pg_dump in the environment, so it is never on the command line or in the log. */
function parseDbUrl(u) {
  const m = String(u || "").match(/^postgres(?:ql)?:\\/\\/([^:]+):(.*)@([^@:\\/]+)(?::(\\d+))?\\/([^?]+)/);
  if (!m) throw new Error("DATABASE_URL is not in the form postgres://user:password@host:port/database");
  const dec = (x) => { try { return decodeURIComponent(x); } catch { return x; } };
  return { user: dec(m[1]), pass: m[2], host: m[3], port: m[4] || "5432", db: dec(m[5]) };
}
const db = parseDbUrl(env.DATABASE_URL);
const r = spawnSync(pgDump, ["-Fc", "--no-owner", "-h", db.host, "-p", db.port, "-U", db.user, "-d", db.db, "-f", file],
  { encoding: "utf8", env: { ...process.env, PGPASSWORD: db.pass } });`;

s = s.replace(old, neu);
fs.writeFileSync(file, s);
console.log("fixed C:/Users/team3pr1/Claude/rugs-mail-local/server/backup.mjs");
