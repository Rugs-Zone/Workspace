// Real-mail rows for the test mailbox (marketing@rugscreation.com)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRows, MAX_ROWS } from '../src/live.mjs';

const BOX = 'marketing@rugscreation.com';
const r = {
  threads: [
    { mailbox: 'Marketing@RugsCreation.com', gmail_thread_id: 't1', subject: 'Heimtextil passes', snippet: 'Ready', last_msg_at: '2026-11-27T10:00:00Z', unread: true, folder: 'inbox', has_out: true, counterpart_name: 'Messe' },
    { mailbox: BOX, gmail_thread_id: 't2', subject: '', last_msg_at: '2026-11-28T10:00:00Z', folder: 'purged' },
    { mailbox: 'pulse@rugscreation.com', gmail_thread_id: 't3', subject: 'Other box', last_msg_at: '2026-11-28T11:00:00Z' },
  ],
  messages: [
    { mailbox: BOX, gmail_thread_id: 't1', from_name: 'Messe', direction: 'in', sent_at: '2026-11-27T09:00:00Z', snippet: 'a' },
    { mailbox: BOX, gmail_thread_id: 't1', from_name: 'Priyanshu', direction: 'out', sent_at: '2026-11-27T10:00:00Z', snippet: 'b' },
  ],
};

test('only the test mailbox, newest first, purged shown as Deleted', () => {
  const rows = toRows(r, BOX).filter(x => x.folder !== 'sent');
  assert.deepEqual(rows.map(x => x.subj), ['(no subject)', 'Heimtextil passes']);
  assert.equal(rows[0].folder, 'deleted');
});

test('last mail written by us shows "To: other party"; messages in time order', () => {
  const t1 = toRows(r, BOX).find(x => x.subj === 'Heimtextil passes' && x.folder === 'inbox');
  assert.equal(t1.from, 'To: Messe');
  assert.deepEqual(t1.msgs.map(m => m.text), ['a', 'b']);
});

test('conversation we wrote in also appears in Sent, read', () => {
  const s = toRows(r, BOX).filter(x => x.folder === 'sent');
  assert.equal(s.length, 1); assert.equal(s[0].unread, false);
});

test('memory: never more than 500 conversations', () => {
  const many = { threads: Array.from({ length: 2000 }, (_, i) => ({ mailbox: BOX, gmail_thread_id: 'x' + i, last_msg_at: String(i).padStart(5, '0') })) };
  assert.equal(toRows(many, BOX).length, MAX_ROWS);
});

test('empty or broken answer gives no rows, no crash', () => {
  assert.deepEqual(toRows({}, BOX), []);
});
