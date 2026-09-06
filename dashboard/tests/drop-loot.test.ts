import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEffectiveDropRates,
  revisionForDropLoot,
  updateDropLootSchema,
  type DropLootSettings,
} from '../src/server/drop-loot-model.js';

const baseSettings: DropLootSettings = {
  id: 1,
  drop_rate: 100,
  boss_drop_rate: 100,
  dungeon_drop_rate: 100,
  quest_drop_rate: 100,
  gold_drop_rate: 100,
  extra_loot_chance: 0,
  rare_drop_rate: 100,
  is_event_active: false,
  event_name: 'Weekend Drop Fever',
  event_start: null,
  event_end: null,
  event_drop_rate: 200,
  event_boss_drop_rate: 150,
  event_dungeon_drop_rate: 200,
  event_quest_drop_rate: 150,
  event_gold_drop_rate: 150,
  event_extra_loot_chance: 25,
  event_rare_drop_rate: 150,
  broadcast_event: true,
  updated_at: '2026-09-06T00:00:00.000Z',
  updated_by: 'admin',
  last_applied_at: null,
  last_applied_status: null,
};

test('computeEffectiveDropRates returns base rates when event is inactive', () => {
  const effective = computeEffectiveDropRates(baseSettings, Date.now());
  assert.equal(effective.isEventEffective, false);
  assert.equal(effective.drop_rate, 100);
  assert.equal(effective.boss_drop_rate, 100);
  assert.equal(effective.dungeon_drop_rate, 100);
  assert.equal(effective.quest_drop_rate, 100);
  assert.equal(effective.gold_drop_rate, 100);
  assert.equal(effective.extra_loot_chance, 0);
  assert.equal(effective.rare_drop_rate, 100);
  assert.equal(effective.eventName, null);
  assert.equal(effective.timeRemainingSeconds, null);
});

test('computeEffectiveDropRates returns event rates when event is active without time limits', () => {
  const effective = computeEffectiveDropRates({ ...baseSettings, is_event_active: true }, Date.now());
  assert.equal(effective.isEventEffective, true);
  assert.equal(effective.drop_rate, 200);
  assert.equal(effective.boss_drop_rate, 150);
  assert.equal(effective.dungeon_drop_rate, 200);
  assert.equal(effective.quest_drop_rate, 150);
  assert.equal(effective.gold_drop_rate, 150);
  assert.equal(effective.extra_loot_chance, 25);
  assert.equal(effective.rare_drop_rate, 150);
  assert.equal(effective.eventName, 'Weekend Drop Fever');
  assert.equal(effective.timeRemainingSeconds, null);
});

test('computeEffectiveDropRates respects start and end schedule window', () => {
  const start = new Date('2026-09-06T10:00:00Z').getTime();
  const end = new Date('2026-09-06T18:00:00Z').getTime();
  const scheduled = {
    ...baseSettings,
    is_event_active: true,
    event_start: '2026-09-06T10:00:00.000Z',
    event_end: '2026-09-06T18:00:00.000Z',
  };

  // 1. Before event start
  const before = computeEffectiveDropRates(scheduled, start - 60_000);
  assert.equal(before.isEventEffective, false);
  assert.equal(before.drop_rate, 100);

  // 2. During event
  const during = computeEffectiveDropRates(scheduled, start + 3600_000); // 1 hour in
  assert.equal(during.isEventEffective, true);
  assert.equal(during.drop_rate, 200);
  assert.equal(during.boss_drop_rate, 150);
  assert.equal(during.timeRemainingSeconds, 7 * 3600); // 7 hours left

  // 3. After event end
  const after = computeEffectiveDropRates(scheduled, end + 60_000);
  assert.equal(after.isEventEffective, false);
  assert.equal(after.drop_rate, 100);
});

test('updateDropLootSchema validates valid rate payloads and defaults', () => {
  const valid = updateDropLootSchema.safeParse({
    revision: 'test-rev-1234',
    drop_rate: 150,
    boss_drop_rate: 120,
    dungeon_drop_rate: 150,
    quest_drop_rate: 100,
    gold_drop_rate: 130,
    extra_loot_chance: 15,
    rare_drop_rate: 110,
    is_event_active: true,
    event_name: 'Summer Drop Frenzy',
    event_start: '2026-09-06T10:00',
    event_end: '2026-09-07T10:00',
    event_drop_rate: 250,
    event_boss_drop_rate: 200,
    event_dungeon_drop_rate: 250,
    event_quest_drop_rate: 150,
    event_gold_drop_rate: 200,
    event_extra_loot_chance: 30,
    event_rare_drop_rate: 180,
    broadcast_event: true,
    apply_immediately: true,
  });

  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.drop_rate, 150);
    assert.equal(valid.data.extra_loot_chance, 15);
    assert.equal(valid.data.event_name, 'Summer Drop Frenzy');
  }
});

test('updateDropLootSchema rejects invalid rates outside allowed range and missing revision', () => {
  const tooLow = updateDropLootSchema.safeParse({
    revision: 'abc',
    drop_rate: 40, // < 50
    boss_drop_rate: 100,
    dungeon_drop_rate: 100,
    quest_drop_rate: 100,
    gold_drop_rate: 100,
    extra_loot_chance: 0,
    rare_drop_rate: 100,
  });
  assert.equal(tooLow.success, false);

  const tooHigh = updateDropLootSchema.safeParse({
    revision: 'abc',
    drop_rate: 1200, // > 1000
    boss_drop_rate: 100,
    dungeon_drop_rate: 100,
    quest_drop_rate: 100,
    gold_drop_rate: 100,
    extra_loot_chance: 0,
    rare_drop_rate: 100,
  });
  assert.equal(tooHigh.success, false);

  const invalidChance = updateDropLootSchema.safeParse({
    revision: 'abc',
    drop_rate: 100,
    boss_drop_rate: 100,
    dungeon_drop_rate: 100,
    quest_drop_rate: 100,
    gold_drop_rate: 100,
    extra_loot_chance: 150, // > 100
    rare_drop_rate: 100,
  });
  assert.equal(invalidChance.success, false);

  const missingRev = updateDropLootSchema.safeParse({
    drop_rate: 100,
    boss_drop_rate: 100,
    dungeon_drop_rate: 100,
    quest_drop_rate: 100,
    gold_drop_rate: 100,
    extra_loot_chance: 0,
    rare_drop_rate: 100,
  });
  assert.equal(missingRev.success, false);
});

test('revisionForDropLoot is deterministic and detects field changes', () => {
  const rev1 = revisionForDropLoot(baseSettings);
  const rev2 = revisionForDropLoot({ ...baseSettings });
  assert.equal(rev1, rev2);

  const revModified = revisionForDropLoot({ ...baseSettings, drop_rate: 200 });
  assert.notEqual(rev1, revModified);

  const revChance = revisionForDropLoot({ ...baseSettings, extra_loot_chance: 20 });
  assert.notEqual(rev1, revChance);

  const revEvent = revisionForDropLoot({ ...baseSettings, is_event_active: true });
  assert.notEqual(rev1, revEvent);
});
