// Rugs Email v2 push gate: if the commits being pushed touch mail2/, every v2 test must pass or the push is blocked.
// Pushes that do not touch mail2/ (v1 fixes, Workspace) are never blocked by this.
import { execSync, spawnSync } from 'node:child_process';

let changed = '';
try { changed = execSync('git diff --name-only @{u}..HEAD', { encoding: 'utf8' }); }
catch { changed = execSync('git diff --name-only HEAD~1..HEAD', { encoding: 'utf8' }); }

if (!changed.split('\n').some(f => f.startsWith('mail2/'))) process.exit(0);

const r = spawnSync(process.execPath, ['--test', 'mail2/tests/'], { stdio: 'inherit' });
const s = r.status === 0 ? spawnSync(process.execPath, ['mail2/tests/shell.check.mjs'], { stdio: 'inherit' }) : r;
if (r.status !== 0 || s.status !== 0) {
  console.error('\nRUGS EMAIL v2 GATE: tests failed - push BLOCKED. Fix the failing test, then push again.');
  process.exit(1);
}
console.log('Rugs Email v2 gate: all tests passed.');
