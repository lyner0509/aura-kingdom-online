import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paragonSaveSchema, revisionFor, sameSlots, type ParagonReward } from '../src/server/paragon-model.js';

const rows: ParagonReward[] = [20, 34, 20, 25, 0.5, 0.5].map((rate, i) => ({
  lottery_id: i + 1, category: 0, weekday: 0, drop_level: 1, level_order: i + 1,
  item_id: 40001, max_stack: 1, drop_rate: rate, notify: 0, get_only: 0, shining_hint: 0, jack_pot: 0,
}));
test('accepts fractional rates totaling 100 and canonical revisions ignore row/key order', () => {
  assert.equal(paragonSaveSchema.safeParse({ rows, revision: revisionFor(rows) }).success, true);
  assert.equal(revisionFor(rows), revisionFor([...rows].reverse().map(row => Object.fromEntries(Object.entries(row).reverse()) as ParagonReward)));
});
test('rejects invalid rates, counts, flags, duplicates and unknown write fields', () => {
  for (const change of [{ drop_rate: -1 }, { drop_rate: 21 }, { max_stack: 0 }, { max_stack: 1.5 }, { item_id: 0 }, { notify: 2 }, { password: 'unexpected' }]) {
    assert.equal(paragonSaveSchema.safeParse({ rows: [{ ...rows[0], ...change }, ...rows.slice(1)], revision: revisionFor(rows) }).success, false);
  }
  assert.equal(paragonSaveSchema.safeParse({ rows: [rows[0], rows[0]], revision: revisionFor(rows) }).success, false);
});
test('validates totals independently for each category, schedule and tier', () => {
  const next = rows.map(row => ({ ...row, category: 4 }));
  assert.equal(paragonSaveSchema.safeParse({ rows: [...rows, ...next], revision: revisionFor(rows) }).success, true);
  next[0].drop_rate = 19;
  assert.equal(paragonSaveSchema.safeParse({ rows: [...rows, ...next], revision: revisionFor(rows) }).success, false);
});
test('slot identity cannot be added, removed or reassigned', () => {
  assert.equal(sameSlots(rows, rows.map(row => ({ ...row, item_id: 50000 }))), true);
  assert.equal(sameSlots(rows, rows.slice(1)), false);
  assert.equal(sameSlots(rows, rows.map(row => ({ ...row, category: 4 }))), false);
  assert.equal(sameSlots(rows, rows.map(row => ({ ...row, lottery_id: 99 }))), false);
  assert.notEqual(revisionFor(rows), revisionFor(rows.map(row => ({ ...row, item_id: 50000 }))));
});
