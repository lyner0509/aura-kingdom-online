import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignPlayerLevelSchema,
  canWriteNow,
  cancelPlayerLevelSchema,
  checkLevelCap,
  describeChange,
  planFor,
} from '../src/server/player-level-model.js';

test('assignPlayerLevelSchema accepts a well formed assignment', () => {
  const parsed = assignPlayerLevelSchema.parse({ player_id: '10482', target_level: '80', note: 'event winner' });
  assert.equal(parsed.player_id, 10482);
  assert.equal(parsed.target_level, 80);
  assert.equal(parsed.note, 'event winner');
});

test('assignPlayerLevelSchema rejects impossible input', () => {
  assert.equal(assignPlayerLevelSchema.safeParse({ player_id: 0, target_level: 10 }).success, false);
  assert.equal(assignPlayerLevelSchema.safeParse({ player_id: 5, target_level: 0 }).success, false);
  assert.equal(assignPlayerLevelSchema.safeParse({ player_id: 5, target_level: 256 }).success, false);
  assert.equal(assignPlayerLevelSchema.safeParse({ player_id: 5, target_level: 12.5 }).success, false);
  assert.equal(assignPlayerLevelSchema.safeParse({ player_id: 'abc', target_level: 10 }).success, false);
});

test('cancelPlayerLevelSchema needs a real player id', () => {
  assert.equal(cancelPlayerLevelSchema.parse({ player_id: '77' }).player_id, 77);
  assert.equal(cancelPlayerLevelSchema.safeParse({ player_id: -1 }).success, false);
});

test('checkLevelCap refuses levels above the server cap', () => {
  assert.equal(checkLevelCap(99, 99), null);
  assert.equal(checkLevelCap(1, 99), null);
  assert.match(checkLevelCap(100, 99) ?? '', /melebihi batas server \(99\)/);
});

test('planFor queues an online character and applies an offline one', () => {
  const online = planFor({ online: true, currentLevel: 12, targetLevel: 80 });
  assert.equal(online.action, 'queue');
  assert.match(online.reason, /setelah logout/);

  const offline = planFor({ online: false, currentLevel: 12, targetLevel: 80 });
  assert.equal(offline.action, 'apply-now');
});

test('planFor treats a character already at the target as nothing to do', () => {
  assert.equal(planFor({ online: false, currentLevel: 80, targetLevel: 80 }).action, 'noop');
  // Even while online: there is no change worth queueing.
  assert.equal(planFor({ online: true, currentLevel: 80, targetLevel: 80 }).action, 'noop');
});

test('planFor still acts when the current level is unknown', () => {
  assert.equal(planFor({ online: false, currentLevel: null, targetLevel: 80 }).action, 'apply-now');
  assert.equal(planFor({ online: true, currentLevel: null, targetLevel: 80 }).action, 'queue');
});

test('describeChange reads correctly in both directions', () => {
  assert.equal(describeChange(10, 80), 'Naik dari level 10 ke 80');
  assert.equal(describeChange(80, 10), 'Turun dari level 80 ke 10');
  assert.equal(describeChange(null, 80), 'Set ke level 80');
  assert.equal(describeChange(80, 80), 'Tetap di level 80');
});

test('canWriteNow refuses when the online list could not be read', () => {
  const result = canWriteNow({ onlineKnown: false, online: false, secondsSinceSave: 9000, settleSeconds: 90 });
  assert.equal(result.ok, false);
  assert.match(result.reason, /tidak terbaca/);
});

test('canWriteNow refuses while the character is online', () => {
  assert.equal(
    canWriteNow({ onlineKnown: true, online: true, secondsSinceSave: 9000, settleSeconds: 90 }).ok,
    false
  );
});

test('canWriteNow waits for a row the realm has just saved', () => {
  const fresh = canWriteNow({ onlineKnown: true, online: false, secondsSinceSave: 12, settleSeconds: 90 });
  assert.equal(fresh.ok, false);
  assert.match(fresh.reason, /baru saja disimpan/);

  const settled = canWriteNow({ onlineKnown: true, online: false, secondsSinceSave: 91, settleSeconds: 90 });
  assert.equal(settled.ok, true);
});

test('canWriteNow allows a character that has never been saved', () => {
  assert.equal(
    canWriteNow({ onlineKnown: true, online: false, secondsSinceSave: null, settleSeconds: 90 }).ok,
    true
  );
});

test('canWriteNow refuses while only the account is signed in', () => {
  // The player is sitting on the character screen: no character is named,
  // but the realm still owns the row.
  const result = canWriteNow({
    onlineKnown: true,
    online: false,
    accountOnline: true,
    secondsSinceSave: 9000,
    settleSeconds: 90,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /pilih karakter/);
});

test('planFor queues a character whose account is still signed in', () => {
  const plan = planFor({ online: false, accountOnline: true, currentLevel: 12, targetLevel: 60 });
  assert.equal(plan.action, 'queue');
  assert.match(plan.reason, /Akun masih login/);
});

test('planFor applies only when neither the character nor the account is present', () => {
  const plan = planFor({ online: false, accountOnline: false, currentLevel: 12, targetLevel: 60 });
  assert.equal(plan.action, 'apply-now');
});
