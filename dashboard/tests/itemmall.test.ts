import assert from 'node:assert/strict';
import { test } from 'node:test';
import { itemMallSaveSchema, revisionForItemMall, type ItemMallItem } from '../src/server/itemmall-model.js';

const rows: ItemMallItem[] = [
  { item_group: 1, detail_type: 1, item_index: 1, item_id: 40358, item_num: 1, point: 210, special_price: 0, num_limit: 0, sell: 1 },
  { item_group: 2, detail_type: 1, item_index: 1, item_id: 60853, item_num: 1, point: 19, special_price: 0, num_limit: 0, sell: 1 },
  { item_group: 5, detail_type: 1, item_index: 1, item_id: 40210, item_num: 1, point: 210, special_price: 180, num_limit: 5, sell: 0 },
];

test('accepts valid item mall items and canonical revision is deterministic regardless of item order', () => {
  const revision = revisionForItemMall(rows);
  assert.equal(itemMallSaveSchema.safeParse({ rows, revision }).success, true);
  const reversed = [...rows].reverse();
  assert.equal(revisionForItemMall(reversed), revision);
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
    assert.equal(itemMallSaveSchema.safeParse({ rows: invalidRows, revision: revisionForItemMall(rows) }).success, false);
  }

  // Duplicate slot key (item_group/detail_type/item_index)
  const duplicateRows = [rows[0], rows[0]];
  assert.equal(itemMallSaveSchema.safeParse({ rows: duplicateRows, revision: revisionForItemMall(rows) }).success, false);
});

test('detects content modifications in revision computation for item mall items', () => {
  const initial = revisionForItemMall(rows);
  const modified = revisionForItemMall([{ ...rows[0], point: 299 }, ...rows.slice(1)]);
  assert.notEqual(initial, modified);
});
