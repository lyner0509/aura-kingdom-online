import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bonusSaveSchema, revisionForBonus, type BonusItem } from '../src/server/bonus-model.js';

const rows: BonusItem[] = [
  { item_group: 2, detail_type: 1, item_index: 1, item_id: 40001, item_num: 1, point: 199, special_price: 0, num_limit: 0, sell: 1 },
  { item_group: 3, detail_type: 1, item_index: 1, item_id: 40005, item_num: 5, point: 69, special_price: 0, num_limit: 0, sell: 1 },
  { item_group: 49, detail_type: 1, item_index: 1, item_id: 62951, item_num: 1, point: 1999, special_price: 1499, num_limit: 2, sell: 0 },
];

test('accepts valid bonus items and canonical revision is deterministic regardless of item order', () => {
  const revision = revisionForBonus(rows);
  assert.equal(bonusSaveSchema.safeParse({ rows, revision }).success, true);
  const reversed = [...rows].reverse();
  assert.equal(revisionForBonus(reversed), revision);
});

test('rejects negative point, zero item_id, invalid item_num, negative special_price, duplicate slot', () => {
  for (const bad of [
    { point: -1 },
    { item_id: 0 },
    { item_id: -10 },
    { item_num: 0 },
    { special_price: -5 },
    { num_limit: -1 },
    { sell: 2 },
    { sell: -1 },
    { extra_malicious_column: 'injection' },
  ]) {
    const invalidRows = [{ ...rows[0], ...bad }, ...rows.slice(1)];
    assert.equal(bonusSaveSchema.safeParse({ rows: invalidRows, revision: revisionForBonus(rows) }).success, false);
  }

  // Duplicate slot key (item_group/detail_type/item_index)
  const duplicateRows = [rows[0], rows[0]];
  assert.equal(bonusSaveSchema.safeParse({ rows: duplicateRows, revision: revisionForBonus(rows) }).success, false);
});

test('detects content modifications in revision computation for bonus items', () => {
  const initial = revisionForBonus(rows);
  const modified = revisionForBonus([{ ...rows[0], point: 299 }, ...rows.slice(1)]);
  assert.notEqual(initial, modified);
});
