import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createRedeemCodeSchema,
  batchGenerateRedeemCodeSchema,
  updateRedeemCodeSchema,
  revisionForRedeemCodes,
  type RedeemCodeItem,
} from '../src/server/redeem-code-model.js';

const sampleCodes: RedeemCodeItem[] = [
  {
    pin: 'WELCOME2026',
    password: '',
    rule_id: 1,
    description: 'Starter Pack',
    state: 'open',
    pin_set: 1,
    account_id: -1,
    account_name: null,
    character_id: -1,
    character_name: null,
    log_time: null,
    rewards: [
      { item_id: 40358, item_num: 1, rate: 1000, set: 1 },
      { item_id: 40001, item_num: 5, rate: 1000, set: 2 },
    ],
  },
  {
    pin: 'EVENT-GIFT-01',
    password: '123',
    rule_id: 2,
    description: 'Special Event',
    state: 'used',
    pin_set: -1,
    account_id: 1005,
    account_name: 'test_user',
    character_id: 50,
    character_name: null,
    log_time: '2026-09-06 10:00:00',
    rewards: [
      { item_id: 40769, item_num: 2, rate: 1000, set: 1 },
    ],
  },
];

test('createRedeemCodeSchema validates valid single code creation', () => {
  const input = {
    pin: 'ak-launch-2026',
    password: '',
    description: 'Hadiah Pembukaan Server',
    pin_set: 1,
    state: 'open',
    rewards: [
      { item_id: 40358, item_num: 1, rate: 1000 },
      { item_id: 40001, item_num: 10, rate: 1000 },
    ],
  };
  const result = createRedeemCodeSchema.safeParse(input);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.pin, 'AK-LAUNCH-2026'); // Trims and uppercases
    assert.equal(result.data.rewards.length, 2);
  }
});

test('createRedeemCodeSchema rejects invalid PIN, empty description, empty rewards, or bad rates', () => {
  // Too short (<3)
  assert.equal(createRedeemCodeSchema.safeParse({
    pin: 'AB',
    description: 'Test',
    rewards: [{ item_id: 40001, item_num: 1 }],
  }).success, false);

  // Too long (>16)
  assert.equal(createRedeemCodeSchema.safeParse({
    pin: '12345678901234567',
    description: 'Test',
    rewards: [{ item_id: 40001, item_num: 1 }],
  }).success, false);

  // Invalid chars (e.g. space, symbols)
  assert.equal(createRedeemCodeSchema.safeParse({
    pin: 'PIN WITH SPACE',
    description: 'Test',
    rewards: [{ item_id: 40001, item_num: 1 }],
  }).success, false);

  // Empty rewards
  assert.equal(createRedeemCodeSchema.safeParse({
    pin: 'VALIDPIN',
    description: 'Test',
    rewards: [],
  }).success, false);

  // Invalid item ID
  assert.equal(createRedeemCodeSchema.safeParse({
    pin: 'VALIDPIN',
    description: 'Test',
    rewards: [{ item_id: 0, item_num: 1 }],
  }).success, false);

  // Invalid rate (>1000)
  assert.equal(createRedeemCodeSchema.safeParse({
    pin: 'VALIDPIN',
    description: 'Test',
    rewards: [{ item_id: 40001, item_num: 1, rate: 1001 }],
  }).success, false);
});

test('batchGenerateRedeemCodeSchema validates batch generation params', () => {
  const validBatch = {
    prefix: 'EVT',
    count: 50,
    description: 'Discord Giveaway 50 Codes',
    pin_set: 10,
    state: 'open',
    rewards: [{ item_id: 40769, item_num: 1, rate: 1000 }],
  };
  assert.equal(batchGenerateRedeemCodeSchema.safeParse(validBatch).success, true);

  // Exceeds max count (>500)
  assert.equal(batchGenerateRedeemCodeSchema.safeParse({ ...validBatch, count: 501 }).success, false);
  // Zero count
  assert.equal(batchGenerateRedeemCodeSchema.safeParse({ ...validBatch, count: 0 }).success, false);
  // Prefix too long (>8)
  assert.equal(batchGenerateRedeemCodeSchema.safeParse({ ...validBatch, prefix: 'VERYLONGPREFIX' }).success, false);
});

test('revisionForRedeemCodes is deterministic and detects modifications', () => {
  const rev1 = revisionForRedeemCodes(sampleCodes);
  const reversed = [...sampleCodes].reverse();
  const rev2 = revisionForRedeemCodes(reversed);
  assert.equal(rev1, rev2);

  // Modify state
  const modifiedState = [{ ...sampleCodes[0], state: 'disabled' as const }, sampleCodes[1]];
  assert.notEqual(revisionForRedeemCodes(modifiedState), rev1);

  // Modify reward item
  const modifiedReward = [
    {
      ...sampleCodes[0],
      rewards: [{ ...sampleCodes[0].rewards[0], item_num: 99 }, sampleCodes[0].rewards[1]],
    },
    sampleCodes[1],
  ];
  assert.notEqual(revisionForRedeemCodes(modifiedReward), rev1);
});
