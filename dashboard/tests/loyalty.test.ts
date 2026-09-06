import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loyaltySaveSchema, revisionForLoyalty, type LoyaltyItem } from '../src/server/loyalty-model.js';

const rows: LoyaltyItem[] = [
  { item_group: 48, detail_type: 1, item_index: 1, item_id: 40001, item_num: 5, point: 50, special_price: 0, num_limit: 0, sell: 1 },
  { item_group: 48, detail_type: 1, item_index: 2, item_id: 40003, item_num: 1, point: 300, special_price: 250, num_limit: 5, sell: 1 },
  { item_group: 2, detail_type: 1, item_index: 1, item_id: 62949, item_num: 1, point: 1500, special_price: 1200, num_limit: 0, sell: 0 },
];

test('accepts valid loyalty items and canonical revision is deterministic regardless of item order', () => {
  const revision = revisionForLoyalty(rows);
  assert.equal(loyaltySaveSchema.safeParse({ rows, revision }).success, true);
  const reversed = [...rows].reverse();
  assert.equal(revisionForLoyalty(reversed), revision);
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
    assert.equal(loyaltySaveSchema.safeParse({ rows: invalidRows, revision: revisionForLoyalty(rows) }).success, false);
  }

  // Duplicate slot key (item_group/detail_type/item_index)
  const duplicateRows = [rows[0], rows[0]];
  assert.equal(loyaltySaveSchema.safeParse({ rows: duplicateRows, revision: revisionForLoyalty(rows) }).success, false);
});

test('detects content modifications in revision computation', () => {
  const initial = revisionForLoyalty(rows);
  const modified = revisionForLoyalty([{ ...rows[0], point: 99 }, ...rows.slice(1)]);
  assert.notEqual(initial, modified);
});
