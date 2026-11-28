// Rugs Email v2 - send status: queued -> sending -> sent | failed. Never "stuck".
export const SEND_TIMEOUT_MS = 90_000;   // a send still 'sending' after this is marked failed
export const MAX_ATTEMPTS = 3;

const ALLOWED = {
  queued:  ['sending', 'failed'],
  sending: ['sent', 'failed'],
  failed:  ['queued'],                  // Retry
  sent:    [],                          // final
};

export function canMove(from, to) { return (ALLOWED[from] || []).includes(to); }

export function move(row, to, extra = {}, now = Date.now()) {
  if (!canMove(row.status, to)) throw new Error(`Send status cannot go from ${row.status} to ${to}`);
  const next = { ...row, ...extra, status: to, updated_at: now };
  if (to === 'sending') { next.started_at = now; next.attempts = (row.attempts || 0) + 1; }
  return next;
}

// Watchdog: run on every tick. Anything 'sending' too long becomes 'failed' with a reason.
export function watchdog(rows, now = Date.now()) {
  return rows.map(r => (r.status === 'sending' && now - r.started_at > SEND_TIMEOUT_MS)
    ? move(r, 'failed', { last_error: 'No answer from the mail server in 90 seconds' }, now)
    : r);
}

export function canRetry(row) { return row.status === 'failed' && (row.attempts || 0) < MAX_ATTEMPTS; }
