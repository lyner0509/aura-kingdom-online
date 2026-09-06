import test from 'node:test';
import assert from 'node:assert/strict';
import { sendCharacterMail } from '../src/server/mail.js';
import type { Pool } from 'pg';

test('sendCharacterMail inserts into sys_mail_queue with correct values and state=New', async () => {
  const executedQueries: Array<{ sql: string; params: unknown[] }> = [];

  const fakePool = {
    query: async (sql: string, params: unknown[]) => {
      executedQueries.push({ sql, params });
      return { rows: [{ mail_id: 101 }] };
    },
  } as unknown as Pool;

  const result = await sendCharacterMail(fakePool, {
    receiverCharId: 50000002,
    senderName: 'Sistem VIP',
    title: '[VIP] Hadiah Harian',
    content: 'Terima kasih atas dukunganmu.',
    itemId: 45719,
    itemCount: 2,
    isBound: true,
    gold: 500,
  });

  assert.equal(result.mailId, 101);
  assert.equal(executedQueries.length, 1);

  const query = executedQueries[0];
  assert.match(query.sql, /INSERT INTO public\.sys_mail_queue/);
  assert.equal(query.params[0], 50000002); // receiver_id
  assert.equal(query.params[1], 'Sistem VIP'); // sender_name
  assert.equal(query.params[2], '[VIP] Hadiah Harian'); // title
  assert.equal(query.params[3], 'Terima kasih atas dukunganmu.'); // content
  assert.equal(query.params[4], 500); // gold
  assert.equal(query.params[5], 45719); // item_id
  assert.equal(query.params[6], 2); // durability (count)
  assert.equal(query.params[7], 1); // bind
});

test('sendCharacterMail handles zero item_id and negative gold safely', async () => {
  const executedQueries: Array<{ sql: string; params: unknown[] }> = [];

  const fakePool = {
    query: async (sql: string, params: unknown[]) => {
      executedQueries.push({ sql, params });
      return { rows: [{ mail_id: 102 }] };
    },
  } as unknown as Pool;

  const result = await sendCharacterMail(fakePool, {
    receiverCharId: 50000001,
    title: 'Surat Info',
    content: 'Pesan tanpa item',
    itemId: 0,
    gold: -50,
  });

  assert.equal(result.mailId, 102);
  const query = executedQueries[0];
  assert.equal(query.params[0], 50000001); // receiver_id
  assert.equal(query.params[4], 0); // gold floored to 0
  assert.equal(query.params[5], 0); // item_id is 0
  assert.equal(query.params[6], 1); // itemCount defaults to 1
  assert.equal(query.params[7], 1); // isBound default true -> 1
});
