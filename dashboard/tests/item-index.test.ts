import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// The real catalogs are generated on the server from the live game .ini files and
// are not in the repository, so the query tests read committed fixtures instead.
process.env.ITEM_CATALOG_PATH = fileURLToPath(new URL('./fixtures/item-names.json', import.meta.url));
process.env.ITEM_ICON_CATALOG_PATH = fileURLToPath(new URL('./fixtures/item-icons.json', import.meta.url));

const { classifyItem, queryItemIndex } = await import('../src/server/item-index.js');

test('classifyItem correctly categorizes items and detects tradeability', () => {
  // Tradable Weapon
  const w = classifyItem(10001, 'Apprentice Sword and Shield');
  assert.equal(w.category, 'Weapon');
  assert.equal(w.is_bound, false);

  // Non-tradable Consumable
  const c = classifyItem(40002, 'Healing Potion (Non-tradable)');
  assert.equal(c.category, 'Consumable');
  assert.equal(c.is_bound, true);

  // Bag
  const b = classifyItem(40358, '20-Slot Backpack (Non-tradable)');
  assert.equal(b.category, 'Bag');
  assert.equal(b.is_bound, true);

  // Secret Stone
  const s = classifyItem(20001, 'Golden Sanguine Desire Secret Stone');
  assert.equal(s.category, 'Secret Stone');
  assert.equal(s.is_bound, false);

  // Mount
  const m = classifyItem(50001, 'Ethereal Wolf');
  assert.equal(m.category, 'Mount');
  assert.equal(m.is_bound, false);

  // Costume
  const cos = classifyItem(50003, 'Face: Swallowtail Kunai (3 Days)');
  assert.equal(cos.category, 'Costume');
  assert.equal(cos.is_bound, false);

  // Eidolon
  const eid = classifyItem(60100, 'Key of Gaia - Kotonoha');
  assert.equal(eid.category, 'Eidolon');
  assert.equal(eid.is_bound, false);
});

test('queryItemIndex loads catalog and paginates items properly', async () => {
  const res = await queryItemIndex({ limit: 10, page: 1 });
  assert.ok(res.total > 0, 'Catalog should have items');
  assert.equal(res.items.length, 10);
  assert.equal(res.page, 1);
  assert.equal(res.limit, 10);
  assert.ok(res.totalPages > 1);
  assert.ok(res.categories.length > 0);
  assert.ok(res.stats.totalItems > 0);
});

test('queryItemIndex searches by ID and Name', async () => {
  // Search by exact/partial ID
  const resId = await queryItemIndex({ q: '40358' });
  assert.ok(resId.items.some(i => i.id === 40358));

  // Search by Name substring (case-insensitive)
  const resName = await queryItemIndex({ q: 'backpack' });
  assert.ok(resName.total > 0);
  assert.ok(resName.items.every(i => i.name.toLowerCase().includes('backpack') || String(i.id).includes('backpack')));
});

test('queryItemIndex filters by category and tradable status', async () => {
  // Category filter
  const resCat = await queryItemIndex({ category: 'Bag', limit: 20 });
  assert.ok(resCat.total > 0);
  assert.ok(resCat.items.every(i => i.category === 'Bag'));

  // Tradable only
  const resTradable = await queryItemIndex({ tradable: 'tradable', limit: 20 });
  assert.ok(resTradable.total > 0);
  assert.ok(resTradable.items.every(i => !i.is_bound));

  // Non-tradable only
  const resBound = await queryItemIndex({ tradable: 'non_tradable', limit: 20 });
  assert.ok(resBound.total > 0);
  assert.ok(resBound.items.every(i => i.is_bound));
});

test('queryItemIndex sorts correctly', async () => {
  // ID descending
  const resDesc = await queryItemIndex({ sort: 'id_desc', limit: 5 });
  assert.ok(resDesc.items[0].id >= resDesc.items[1].id);
  assert.ok(resDesc.items[1].id >= resDesc.items[2].id);

  // Name ascending
  const resNameAsc = await queryItemIndex({ sort: 'name_asc', limit: 5 });
  assert.ok(resNameAsc.items[0].name.localeCompare(resNameAsc.items[1].name) <= 0);
});

test('queryItemIndex and itemIcons resolve game icons correctly', async () => {
  const res = await queryItemIndex({ q: '10001', limit: 1 });
  assert.ok(res.items.length > 0);
  const item = res.items[0];
  assert.equal(item.id, 10001);
  assert.equal(item.icon, 'w20101');
});

