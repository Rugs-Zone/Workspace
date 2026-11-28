// Tests built from REAL v1 bugs (REBUILD-PLAN section 5). Run: node --test mail2/tests
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAddressList } from '../src/addresses.mjs';
import { cleanSenderName, whoSent } from '../src/sender.mjs';
import { move, watchdog, canRetry, SEND_TIMEOUT_MS } from '../src/outbox.mjs';

const ALIASES = [
  { user_id: 'arun',   kind: 'email', value: 'arun@rugscreation.com' },
  { user_id: 'arun',   kind: 'name',  value: 'arun' },
  { user_id: 'ashish1', kind: 'name', value: 'ashish' },
  { user_id: 'ashish2', kind: 'name', value: 'ashish' },
  { user_id: 'robin',  kind: 'email', value: 'robin@rugscreation.com' },
];

test('Cc with [cid:image001...] marker keeps only real addresses', () => {
  const r = parseAddressList('Bianca <bianca@turner.nl>, [cid:image001.png@01DC5E7A.4F2B1C30], jai@rugscreation.com');
  assert.deepEqual(r.map(a => a.email), ['bianca@turner.nl', 'jai@rugscreation.com']);
});

test('@shadow.outlook.com is never a recipient', () => {
  const r = parseAddressList('a@buyer.com; x1y2@eur03.prod.shadow.outlook.com; b@buyer.com');
  assert.deepEqual(r.map(a => a.email), ['a@buyer.com', 'b@buyer.com']);
});

test('quoted names with commas and semicolons separators', () => {
  const r = parseAddressList('"Turner, Bianca" <Bianca@Turner.nl>; Loods 5 <inkoop@loods5.nl>,');
  assert.deepEqual(r, [
    { name: 'Turner, Bianca', email: 'bianca@turner.nl' },
    { name: 'Loods 5', email: 'inkoop@loods5.nl' },
  ]);
});

test('duplicates and junk are dropped, empty header is empty', () => {
  assert.deepEqual(parseAddressList('a@x.com, A@X.com, not-an-address'), [{ name: '', email: 'a@x.com' }]);
  assert.deepEqual(parseAddressList(''), []);
  assert.deepEqual(parseAddressList(null), []);
});

test("Arun's Gmail-written mail lands in Arun's Sent (name has company suffix)", () => {
  assert.equal(cleanSenderName('Arun – Rugs Creation'), 'arun');
  assert.equal(cleanSenderName('"Arun | Team Pulse"'), 'arun');
  const r = whoSent({ from_email: 'pulse@rugscreation.com', from_name: 'Arun – Rugs Creation' }, ALIASES);
  assert.deepEqual(r, { user_id: 'arun', how: 'gmail-alias' });
});

test('login address wins over name', () => {
  assert.deepEqual(whoSent({ from_email: 'Robin@RugsCreation.com', from_name: 'Somebody' }, ALIASES),
    { user_id: 'robin', how: 'gmail-login' });
});

test('two people with the same first name -> nobody is guessed', () => {
  assert.equal(whoSent({ from_email: 'team@rugscreation.com', from_name: 'Ashish' }, ALIASES), null);
});

test('mail sent from the app is known by user id, no matching needed', () => {
  assert.deepEqual(whoSent({ app_user_id: 'ashish2', from_name: 'Ashish' }, ALIASES), { user_id: 'ashish2', how: 'app' });
});

test('a send can never stay stuck on "Sending..."', () => {
  let row = { id: 1, status: 'queued', attempts: 0 };
  row = move(row, 'sending', {}, 1000);
  const [after] = watchdog([row], 1000 + SEND_TIMEOUT_MS + 1);
  assert.equal(after.status, 'failed');
  assert.match(after.last_error, /90 seconds/);
  assert.equal(canRetry(after), true);
});

test('sent is final; illegal moves throw', () => {
  const sent = move(move({ status: 'queued' }, 'sending'), 'sent');
  assert.throws(() => move(sent, 'queued'));
  assert.throws(() => move({ status: 'queued' }, 'sent'));
});

test('retry stops after 3 attempts', () => {
  let r = { status: 'queued', attempts: 0 };
  for (let i = 0; i < 3; i++) { r = move(r, 'sending'); r = move(r, 'failed'); if (i < 2) r = move(r, 'queued'); }
  assert.equal(canRetry(r), false);
});
