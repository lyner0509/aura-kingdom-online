import test from 'node:test';
import assert from 'node:assert/strict';
import {
  grantStarterPackSchema,
  revisionForStarterPack,
  starterPackItemSchema,
  updateStarterPackSettingsSchema,
  type StarterPackItem,
  type StarterPackSettings,
} from '../src/server/starter-pack-model.js';

const mockSettings: StarterPackSettings = {
  id: 1,
  is_enabled: true,
  auto_deliver_new_chars: false,
  mail_sender_name: 'Azuria Operations',
  mail_title: '[Starter Pack] Hadiah Selamat Datang',
  mail_content: 'Paket perlengkapan petualang untukmu.',
  bonus_gold: 50000,
  bonus_loyalty_points: 500,
  min_character_level: 1,
  max_claims_per_account: 1,
  last_dispatch_at: null,
  last_dispatch_status: null,
  updated_at: new Date().toISOString(),
  updated_by: 'system',
};

const mockItems: StarterPackItem[] = [
  { item_id: 40358, item_name: '20-Slot Backpack', item_count: 2, is_bound: true, category: 'bag', sort_order: 1, note: 'Tas' },
  { item_id: 40079, item_name: '24 Hour XP Crystal', item_count: 5, is_bound: true, category: 'buff', sort_order: 2, note: 'XP' },
  { item_id: 40176, item_name: 'Exclusive Healing Potion', item_count: 50, is_bound: true, category: 'potion', sort_order: 3, note: 'HP' },
];

test('starterPackItemSchema validates correct items and applies defaults', () => {
  const parsed = starterPackItemSchema.parse({
    item_id: 40358,
    item_count: 2,
  });
  assert.equal(parsed.item_id, 40358);
  assert.equal(parsed.item_count, 2);
  assert.equal(parsed.is_bound, true);
  assert.equal(parsed.category, 'general');
  assert.equal(parsed.sort_order, 0);
});

test('starterPackItemSchema rejects invalid item count and negative item_id', () => {
  assert.throws(() => starterPackItemSchema.parse({ item_id: 0, item_count: 1 }), /Item ID harus berupa angka positif/);
  assert.throws(() => starterPackItemSchema.parse({ item_id: 40001, item_count: 0 }), /Jumlah item minimal 1/);
  assert.throws(() => starterPackItemSchema.parse({ item_id: 40001, item_count: 1000 }), /Jumlah item maksimal 999/);
});

test('updateStarterPackSettingsSchema validates full payload and rejects missing revision', () => {
  const validPayload = {
    revision: 'abcdef1234567890',
    is_enabled: true,
    auto_deliver_new_chars: true,
    mail_sender_name: 'Azuria Admin',
    mail_title: 'Selamat Datang!',
    mail_content: 'Gunakan hadiah ini dengan bijak.',
    bonus_gold: 100000,
    bonus_loyalty_points: 1000,
    min_character_level: 5,
    max_claims_per_account: 1,
    items: mockItems,
  };

  const parsed = updateStarterPackSettingsSchema.parse(validPayload);
  assert.equal(parsed.mail_sender_name, 'Azuria Admin');
  assert.equal(parsed.bonus_gold, 100000);
  assert.equal(parsed.items.length, 3);

  // Rejects empty revision
  assert.throws(() => updateStarterPackSettingsSchema.parse({ ...validPayload, revision: '' }), /Revision diperlukan/);
  // Rejects empty title
  assert.throws(() => updateStarterPackSettingsSchema.parse({ ...validPayload, mail_title: '   ' }), /Judul surat tidak boleh kosong/);
});

test('grantStarterPackSchema validates target types and requirements', () => {
  const charTarget = grantStarterPackSchema.parse({
    target_type: 'character',
    target_name: 'Balee',
  });
  assert.equal(charTarget.target_type, 'character');
  assert.equal(charTarget.override_claim_limit, false);

  const accTarget = grantStarterPackSchema.parse({
    target_type: 'account',
    target_name: 'iqbal',
    override_claim_limit: true,
  });
  assert.equal(accTarget.target_type, 'account');
  assert.equal(accTarget.override_claim_limit, true);

  assert.throws(() => grantStarterPackSchema.parse({ target_type: 'invalid', target_name: 'Balee' }));
  assert.throws(() => grantStarterPackSchema.parse({ target_type: 'character', target_name: '   ' }));
});

test('revisionForStarterPack is deterministic and detects field changes', () => {
  const rev1 = revisionForStarterPack(mockSettings, mockItems);
  const rev2 = revisionForStarterPack(mockSettings, [...mockItems].reverse());
  assert.equal(rev1, rev2, 'Revision should be deterministic regardless of input items order');

  // Change gold
  const rev3 = revisionForStarterPack({ ...mockSettings, bonus_gold: 99999 }, mockItems);
  assert.notEqual(rev1, rev3, 'Revision should change when gold is changed');

  // Change item count
  const modifiedItems = mockItems.map((it, idx) => (idx === 0 ? { ...it, item_count: 10 } : it));
  const rev4 = revisionForStarterPack(mockSettings, modifiedItems);
  assert.notEqual(rev1, rev4, 'Revision should change when item quantity is changed');
});
