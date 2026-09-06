import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loyaltySaveSchema, revisionForLoyalty, type LoyaltyItem } from '../src/server/loyalty-model.js';

const rows: LoyaltyItem[] = [
  { id: 1, item_id: 40001, category: 'Populer', cost_lp: 50, quantity: 5, buy_limit: 0, discount_percent: 0, is_active: 1, sort_order: 1 },
  { id: 2, item_id: 40003, category: 'Populer', cost_lp: 300, quantity: 1, buy_limit: 5, discount_percent: 10, is_active: 1, sort_order: 2 },
  { id: 3, item_id: 62949, category: 'Kostum', cost_lp: 1500, quantity: 1, buy_limit: 0, discount_percent: 20, is_active: 0, sort_order: 3 },
];

test('accepts valid loyalty items and canonical revision is deterministic regardless of item order', () => {
  const revision = revisionForLoyalty(rows);
  assert.equal(loyaltySaveSchema.safeParse({ rows, revision }).success, true);
  const reversed = [...rows].reverse();
  assert.equal(revisionForLoyalty(reversed), revision);
});

test('rejects negative cost_lp, zero item_id, invalid quantity, and out-of-range discount', () => {
  for (const bad of [
    { cost_lp: -1 },
    { item_id: 0 },
    { item_id: -10 },
    { quantity: 0 },
    { discount_percent: -5 },
    { discount_percent: 101 },
    { buy_limit: -1 },
    { is_active: 2 },
    { is_active: -1 },
    { category: '' },
    { extra_malicious_column: 'injection' },
  ]) {
    const invalidRows = [{ ...rows[0], ...bad }, ...rows.slice(1)];
    assert.equal(loyaltySaveSchema.safeParse({ rows: invalidRows, revision: revisionForLoyalty(rows) }).success, false);
  }
});

test('detects content modifications in revision computation', () => {
  const initial = revisionForLoyalty(rows);
  const modified = revisionForLoyalty([{ ...rows[0], cost_lp: 99 }, ...rows.slice(1)]);
  assert.notEqual(initial, modified);
});
