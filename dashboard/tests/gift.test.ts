import test from 'node:test';
import assert from 'node:assert/strict';
import {
  giftSettingsSchema,
  sendGiftPayloadSchema,
} from '../src/server/gift-model.js';

test('giftSettingsSchema provides default values when given empty object', () => {
  const parsed = giftSettingsSchema.parse({});
  assert.equal(parsed.default_sender_name, 'Game Master');
  assert.equal(parsed.default_mail_title, '[Hadiah GM] Hadiah Spesial');
  assert.ok(parsed.default_mail_content.length > 0);
  assert.equal(parsed.default_is_bound, true);
  assert.equal(parsed.allow_online_broadcast, true);
});

test('giftSettingsSchema accepts custom valid settings', () => {
  const parsed = giftSettingsSchema.parse({
    default_sender_name: 'Admin Azuria',
    default_mail_title: 'Hadiah Spesial Event',
    default_mail_content: 'Selamat atas partisipasi anda!',
    default_is_bound: false,
    allow_online_broadcast: false,
  });
  assert.equal(parsed.default_sender_name, 'Admin Azuria');
  assert.equal(parsed.default_mail_title, 'Hadiah Spesial Event');
  assert.equal(parsed.default_is_bound, false);
  assert.equal(parsed.allow_online_broadcast, false);
});

test('sendGiftPayloadSchema parses valid character target payload', () => {
  const payload = {
    target_type: 'character',
    target_query: 'Lynerouxes',
    item_id: 40358,
    item_name: '20-Slot Backpack',
    item_count: 2,
    is_bound: true,
    gold: 1000,
    sender_name: 'GM Arthur',
    title: 'Bonus Backpack',
    content: 'Terima kasih telah bermain!',
    announce: true,
    announce_message: 'Pemain Lynerouxes menerima bonus backpack!',
  };

  const parsed = sendGiftPayloadSchema.parse(payload);
  assert.equal(parsed.target_type, 'character');
  assert.equal(parsed.target_query, 'Lynerouxes');
  assert.equal(parsed.item_id, 40358);
  assert.equal(parsed.item_count, 2);
  assert.equal(parsed.gold, 1000);
  assert.equal(parsed.announce, true);
});

test('sendGiftPayloadSchema rejects character target without target_query', () => {
  assert.throws(
    () =>
      sendGiftPayloadSchema.parse({
        target_type: 'character',
        item_id: 40358,
      }),
    /Nama atau ID karakter tujuan wajib diisi/
  );
});

test('sendGiftPayloadSchema accepts online and all targets without target_query', () => {
  const onlineParsed = sendGiftPayloadSchema.parse({
    target_type: 'online',
    item_id: 11001,
  });
  assert.equal(onlineParsed.target_type, 'online');
  assert.equal(onlineParsed.item_count, 1);
  assert.equal(onlineParsed.is_bound, true);

  const allParsed = sendGiftPayloadSchema.parse({
    target_type: 'all',
    item_id: 11001,
  });
  assert.equal(allParsed.target_type, 'all');
});

test('sendGiftPayloadSchema validates item_id and item_count boundaries', () => {
  assert.throws(
    () =>
      sendGiftPayloadSchema.parse({
        target_type: 'online',
        item_id: 0,
      }),
    /Item ID harus angka positif/
  );

  assert.throws(
    () =>
      sendGiftPayloadSchema.parse({
        target_type: 'online',
        item_id: 12345,
        item_count: 0,
      }),
    /Jumlah item minimal 1/
  );

  assert.throws(
    () =>
      sendGiftPayloadSchema.parse({
        target_type: 'online',
        item_id: 12345,
        item_count: 10000,
      }),
    /Jumlah item maksimal 9999/
  );
});
