import test from 'node:test';
import assert from 'node:assert/strict';
import {
  grantVipSchema,
  revisionForVip,
  updateVipSettingsSchema,
  vipTierSchema,
  type VipSettings,
  type VipTier,
} from '../src/server/vip-model.js';

const baseSettings: VipSettings = {
  id: 1,
  is_enabled: true,
  points_per_ap: 1,
  auto_vip_on_spending: true,
  daily_mail_reward_enabled: true,
  daily_mail_title: 'Hadiah Harian VIP Server',
  daily_mail_content: 'Berikut adalah hadiah harian VIP Anda.',
  last_mail_dispatch_at: null,
  last_mail_dispatch_status: null,
  updated_at: '2026-09-06T00:00:00.000Z',
  updated_by: 'admin',
};

const baseTiers: VipTier[] = [
  {
    level: 1,
    name: 'VIP 1 - Bronze',
    required_points: 100,
    exp_bonus_percent: 10,
    drop_bonus_percent: 5,
    gold_bonus_percent: 5,
    move_speed_percent: 2,
    daily_loyalty_points: 50,
    daily_item_id: 42001,
    daily_item_count: 1,
    buff_desc: 'Bronze tier',
  },
  {
    level: 2,
    name: 'VIP 2 - Silver',
    required_points: 300,
    exp_bonus_percent: 15,
    drop_bonus_percent: 10,
    gold_bonus_percent: 8,
    move_speed_percent: 4,
    daily_loyalty_points: 100,
    daily_item_id: 42002,
    daily_item_count: 1,
    buff_desc: 'Silver tier',
  },
];

test('vipTierSchema validates tier rules correctly', () => {
  const valid = vipTierSchema.safeParse(baseTiers[0]);
  assert.equal(valid.success, true);

  const invalidLevel = vipTierSchema.safeParse({
    ...baseTiers[0],
    level: 15, // > 10
  });
  assert.equal(invalidLevel.success, false);

  const invalidBonus = vipTierSchema.safeParse({
    ...baseTiers[0],
    exp_bonus_percent: 350, // > 200
  });
  assert.equal(invalidBonus.success, false);
});

test('updateVipSettingsSchema validates full settings and tier payload', () => {
  const valid = updateVipSettingsSchema.safeParse({
    revision: 'vip-rev-1234',
    is_enabled: true,
    points_per_ap: 2,
    auto_vip_on_spending: true,
    daily_mail_reward_enabled: true,
    daily_mail_title: 'Hadiah Harian VIP',
    daily_mail_content: 'Terima kasih atas donasi Anda!',
    tiers: baseTiers,
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.points_per_ap, 2);
    assert.equal(valid.data.tiers.length, 2);
  }

  const missingRevision = updateVipSettingsSchema.safeParse({
    is_enabled: true,
    tiers: baseTiers,
  });
  assert.equal(missingRevision.success, false);

  const emptyTiers = updateVipSettingsSchema.safeParse({
    revision: 'vip-rev-1234',
    tiers: [],
  });
  assert.equal(emptyTiers.success, false);
});

test('grantVipSchema validates grant inputs', () => {
  const valid = grantVipSchema.safeParse({
    username: 'admin',
    vip_level: 3,
    vip_points: 600,
    duration_days: 30,
  });
  assert.equal(valid.success, true);

  const shortName = grantVipSchema.safeParse({
    username: 'a',
    vip_level: 1,
  });
  assert.equal(shortName.success, false);

  const invalidLevel = grantVipSchema.safeParse({
    username: 'player1',
    vip_level: 0,
  });
  assert.equal(invalidLevel.success, false);
});

test('revisionForVip produces deterministic hash and detects modifications', () => {
  const rev1 = revisionForVip(baseSettings, baseTiers);
  const rev2 = revisionForVip({ ...baseSettings }, [...baseTiers]);
  assert.equal(rev1, rev2);

  // Reordering tiers produces identical revision
  const reversedTiers = [...baseTiers].reverse();
  const revReversed = revisionForVip(baseSettings, reversedTiers);
  assert.equal(rev1, revReversed);

  // Modifying settings changes revision
  const revModified = revisionForVip({ ...baseSettings, points_per_ap: 5 }, baseTiers);
  assert.notEqual(rev1, revModified);

  // Modifying a tier changes revision
  const modifiedTiers = [{ ...baseTiers[0], exp_bonus_percent: 25 }, baseTiers[1]];
  const revTierMod = revisionForVip(baseSettings, modifiedTiers);
  assert.notEqual(rev1, revTierMod);
});
