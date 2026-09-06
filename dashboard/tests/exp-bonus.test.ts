import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEffectiveRates,
  revisionForExpBonus,
  updateExpBonusSchema,
  buildCgiPacket,
  type ExpBonusSettings,
} from '../src/server/exp-bonus-model.js';

const baseSettings: ExpBonusSettings = {
  id: 1,
  exp_rate: 100,
  quest_exp_rate: 100,
  drop_rate: 100,
  gold_rate: 100,
  np_rate: 100,
  is_event_active: false,
  event_name: 'Weekend Boost',
  event_start: null,
  event_end: null,
  event_exp_rate: 200,
  event_quest_exp_rate: 150,
  event_drop_rate: 150,
  event_gold_rate: 150,
  event_np_rate: 150,
  broadcast_event: true,
  updated_at: '2026-09-06T00:00:00.000Z',
  updated_by: 'admin',
  last_applied_at: null,
  last_applied_status: null,
};

test('computeEffectiveRates returns base rates when event is inactive', () => {
  const effective = computeEffectiveRates(baseSettings, Date.now());
  assert.equal(effective.isEventEffective, false);
  assert.equal(effective.exp_rate, 100);
  assert.equal(effective.quest_exp_rate, 100);
  assert.equal(effective.drop_rate, 100);
  assert.equal(effective.gold_rate, 100);
  assert.equal(effective.np_rate, 100);
  assert.equal(effective.eventName, null);
  assert.equal(effective.timeRemainingSeconds, null);
});

test('computeEffectiveRates returns event rates when event is active without time limits', () => {
  const effective = computeEffectiveRates({ ...baseSettings, is_event_active: true }, Date.now());
  assert.equal(effective.isEventEffective, true);
  assert.equal(effective.exp_rate, 200);
  assert.equal(effective.quest_exp_rate, 150);
  assert.equal(effective.drop_rate, 150);
  assert.equal(effective.gold_rate, 150);
  assert.equal(effective.np_rate, 150);
  assert.equal(effective.eventName, 'Weekend Boost');
  assert.equal(effective.timeRemainingSeconds, null);
});

test('computeEffectiveRates respects start and end schedule window', () => {
  const start = new Date('2026-09-06T10:00:00Z').getTime();
  const end = new Date('2026-09-06T18:00:00Z').getTime();
  const scheduled = {
    ...baseSettings,
    is_event_active: true,
    event_start: '2026-09-06T10:00:00.000Z',
    event_end: '2026-09-06T18:00:00.000Z',
  };

  // 1. Before event start
  const before = computeEffectiveRates(scheduled, start - 60_000);
  assert.equal(before.isEventEffective, false);
  assert.equal(before.exp_rate, 100);

  // 2. During event
  const during = computeEffectiveRates(scheduled, start + 3600_000); // 1 hour in
  assert.equal(during.isEventEffective, true);
  assert.equal(during.exp_rate, 200);
  assert.equal(during.drop_rate, 150);
  assert.equal(during.timeRemainingSeconds, 7 * 3600); // 7 hours left

  // 3. After event end
  const after = computeEffectiveRates(scheduled, end + 60_000);
  assert.equal(after.isEventEffective, false);
  assert.equal(after.exp_rate, 100);
});

test('updateExpBonusSchema validates valid rate payloads and defaults', () => {
  const valid = updateExpBonusSchema.safeParse({
    revision: 'abc12345def67890',
    exp_rate: 200,
    quest_exp_rate: 150,
    drop_rate: 150,
    gold_rate: 120,
    np_rate: 100,
    is_event_active: true,
    event_name: 'Festival Fever',
    event_exp_rate: 300,
    event_quest_exp_rate: 200,
    event_drop_rate: 200,
    event_gold_rate: 200,
    event_np_rate: 200,
    broadcast_event: true,
    apply_immediately: true,
  });

  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.exp_rate, 200);
    assert.equal(valid.data.event_exp_rate, 300);
    assert.equal(valid.data.apply_immediately, true);
  }
});

test('updateExpBonusSchema rejects invalid rates outside 50-1000% range and missing revision', () => {
  // 1. Rate too low (< 50)
  const tooLow = updateExpBonusSchema.safeParse({
    revision: 'rev1',
    exp_rate: 20,
    quest_exp_rate: 100,
    drop_rate: 100,
    gold_rate: 100,
    np_rate: 100,
  });
  assert.equal(tooLow.success, false);

  // 2. Rate too high (> 1000)
  const tooHigh = updateExpBonusSchema.safeParse({
    revision: 'rev1',
    exp_rate: 1500,
    quest_exp_rate: 100,
    drop_rate: 100,
    gold_rate: 100,
    np_rate: 100,
  });
  assert.equal(tooHigh.success, false);

  // 3. Missing revision
  const missingRev = updateExpBonusSchema.safeParse({
    exp_rate: 100,
    quest_exp_rate: 100,
    drop_rate: 100,
    gold_rate: 100,
    np_rate: 100,
  });
  assert.equal(missingRev.success, false);
});

test('revisionForExpBonus is deterministic and detects field changes', () => {
  const rev1 = revisionForExpBonus(baseSettings);
  const rev2 = revisionForExpBonus({ ...baseSettings });
  assert.equal(rev1, rev2);
  assert.equal(typeof rev1, 'string');
  assert.equal(rev1.length, 16);

  // Altering rate alters revision
  const revModified = revisionForExpBonus({ ...baseSettings, exp_rate: 200 });
  assert.notEqual(rev1, revModified);

  // Altering event state alters revision
  const revEvent = revisionForExpBonus({ ...baseSettings, is_event_active: true });
  assert.notEqual(rev1, revEvent);
});

test('buildCgiPacket generates exact binary frame for ZoneServer CGI', () => {
  const key = 'TestKey123';
  const command = 'set_node_exp 0 250';
  const pkt = buildCgiPacket(key, command);

  const expectedCmdStr = `${key},${command}`;
  const expectedPayloadLen = 2 + Buffer.byteLength(expectedCmdStr, 'latin1');
  const expectedTotalLen = 2 + expectedPayloadLen;

  assert.equal(pkt.length, expectedTotalLen);
  assert.equal(pkt.readUInt16LE(0), expectedPayloadLen);
  assert.equal(pkt.readUInt16LE(2), Buffer.byteLength(expectedCmdStr, 'latin1'));
  assert.equal(pkt.toString('latin1', 4), expectedCmdStr);
});
