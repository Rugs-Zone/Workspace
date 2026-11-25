// Nightly backup of the local rugsmail database. Keeps the newest 14 backups.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = {};
for (const l of fs.readFileSync(path.join(here, ".env"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const log = (s) => fs.appendFileSync(path.join(here, "backup-log.txt"), new Date().toISOString() + " " + s + "\n");

const pgRoot = "C:\\Program Files\\PostgreSQL";
const ver = fs.readdirSync(pgRoot).filter((x) => /^\d+$/.test(x)).sort((a, b) => b - a)[0];
const pgDump = path.join(pgRoot, ver, "bin", "pg_dump.exe");

let dir = "E:\\rugsmail-backups";
try { fs.mkdirSync(dir, { recursive: true }); } catch { dir = "D:\\rugsmail-backups"; fs.mkdirSync(dir, { recursive: true }); }

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const file = path.join(dir, `rugsmail-${stamp}.dump`);
/* 25 Nov 2026: take the URL apart instead of handing it over whole - the password holds
   an "@", so libpq read the host as "2416@localhost" and every backup failed. The password
   goes to pg_dump in the environment, so it is never on the command line or in the log. */
function parseDbUrl(u) {
  const m = String(u || "").match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^@:\/]+)(?::(\d+))?\/([^?]+)/);
  if (!m) throw new Error("DATABASE_URL is not in the form postgres://user:password@host:port/database");
  const dec = (x) => { try { return decodeURIComponent(x); } catch { return x; } };
  return { user: dec(m[1]), pass: m[2], host: m[3], port: m[4] || "5432", db: dec(m[5]) };
}
const db = parseDbUrl(env.DATABASE_URL);
const r = spawnSync(pgDump, ["-Fc", "--no-owner", "-h", db.host, "-p", db.port, "-U", db.user, "-d", db.db, "-f", file],
  { encoding: "utf8", env: { ...process.env, PGPASSWORD: db.pass } });
if (r.status !== 0) {
  log("FAILED: " + (r.stderr || "").slice(0, 300));
  process.exit(1);
}
log(`ok ${file} ${(fs.statSync(file).size / 1048576).toFixed(0)} MB`);

const old = fs.readdirSync(dir).filter((f) => f.startsWith("rugsmail-") && f.endsWith(".dump")).sort().reverse().slice(14);
for (const f of old) { fs.unlinkSync(path.join(dir, f)); log("deleted old " + f); }
