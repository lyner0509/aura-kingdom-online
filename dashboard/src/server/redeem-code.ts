import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { pool } from './database.js';
import {
  createRedeemCodeSchema,
  batchGenerateRedeemCodeSchema,
  updateRedeemCodeSchema,
  revisionForRedeemCodes,
  type RedeemCodeItem,
  type RedeemCodeReward,
} from './redeem-code-model.js';
import { itemNames } from './paragon.js';

export class RedeemCodeError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const demoCodes: RedeemCodeItem[] = [
  {
    pin: 'WELCOME2026',
    password: '',
    rule_id: 1,
    description: 'Starter Pack Pemain Baru',
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
    pin: 'DISCORD-VIP-01',
    password: '',
    rule_id: 2,
    description: 'Event Discord Community',
    state: 'used',
    pin_set: 2,
    account_id: 1001,
    account_name: 'azuria_hero',
    character_id: 101,
    character_name: 'Kirito',
    log_time: '2026-09-06 09:30:00',
    rewards: [
      { item_id: 40769, item_num: 1, rate: 1000, set: 1 },
    ],
  },
  {
    pin: 'COMPENSATION99',
    password: '',
    rule_id: 3,
    description: 'Kompensasi Server Maintenance',
    state: 'open',
    pin_set: -1,
    account_id: -1,
    account_name: null,
    character_id: -1,
    character_name: null,
    log_time: null,
    rewards: [
      { item_id: 40003, item_num: 3, rate: 1000, set: 1 },
      { item_id: 40011, item_num: 10, rate: 1000, set: 2 },
    ],
  },
];

function generateSecurePin(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const cleanPrefix = prefix.replace(/[^A-Z0-9_-]/g, '').toUpperCase();
  const neededLength = Math.max(4, 16 - cleanPrefix.length);
  const bytes = randomBytes(neededLength);
  let randomStr = '';
  for (let i = 0; i < neededLength; i++) {
    randomStr += chars[bytes[i] % chars.length];
  }
  return (cleanPrefix + randomStr).slice(0, 16);
}

export async function readRedeemCodes() {
  if (config.NODE_ENV === 'development') {
    const allItemIds = demoCodes.flatMap(c => c.rewards.map(r => r.item_id));
    return {
      codes: demoCodes,
      itemNames: await itemNames(allItemIds),
      revision: revisionForRedeemCodes(demoCodes),
      history: [],
      readOnly: true,
    };
  }

  const client = await pool(config.ACCOUNT_DB).connect();
  try {
    const pinQuery = `
      SELECT 
        p.pin,
        COALESCE(p.password, '') AS password,
        p.rule_id,
        COALESCE(l.description, '') AS description,
        p.state,
        p.pin_set,
        p.account_id,
        a.username AS account_name,
        p.character_id,
        p.log_time::text AS log_time
      FROM public.exchange_pin p
      LEFT JOIN public.exchange_list l ON l.id = p.rule_id
      LEFT JOIN public.accounts a ON a.id = p.account_id
      ORDER BY p.log_time DESC NULLS LAST, p.pin ASC
    `;
    const pinsResult = await client.query(pinQuery);

    const rulesQuery = `
      SELECT id AS rule_id, item_id, item_num, rate, set
      FROM public.exchange_rule
      ORDER BY id ASC, set ASC, item_id ASC
    `;
    const rulesResult = await client.query(rulesQuery);

    const rewardsByRule = new Map<number, RedeemCodeReward[]>();
    for (const row of rulesResult.rows) {
      const list = rewardsByRule.get(row.rule_id) || [];
      list.push({
        item_id: row.item_id,
        item_num: row.item_num,
        rate: row.rate,
        set: row.set,
      });
      rewardsByRule.set(row.rule_id, list);
    }

    const allItemIds: number[] = [];
    const codes: RedeemCodeItem[] = pinsResult.rows.map(row => {
      const rewards = rewardsByRule.get(row.rule_id) || [];
      for (const r of rewards) allItemIds.push(r.item_id);
      return {
        pin: row.pin,
        password: row.password,
        rule_id: row.rule_id,
        description: row.description,
        state: row.state as RedeemCodeItem['state'],
        pin_set: row.pin_set,
        account_id: row.account_id,
        account_name: row.account_name,
        character_id: row.character_id,
        character_name: null,
        log_time: row.log_time,
        rewards,
      };
    });

    const historyQuery = `
      SELECT id::text, operator, action, pin, rule_id, details, created_at AS "createdAt"
      FROM dashboard.redeem_code_history
      ORDER BY id DESC LIMIT 20
    `;
    const historyResult = await client.query(historyQuery).catch(() => ({ rows: [] }));

    return {
      codes,
      itemNames: await itemNames(allItemIds),
      revision: revisionForRedeemCodes(codes),
      history: historyResult.rows,
      readOnly: false,
    };
  } finally {
    client.release();
  }
}

export async function createRedeemCode(input: unknown, operator: string) {
  const parsed = createRedeemCodeSchema.safeParse(input);
  if (!parsed.success) {
    throw new RedeemCodeError(400, parsed.error.issues[0]?.message ?? 'Data Redeem Code tidak valid.');
  }
  if (config.NODE_ENV === 'development') {
    throw new RedeemCodeError(403, 'Preview lokal tidak menyimpan perubahan ke game.');
  }

  const { pin, password, description, pin_set, state, rewards } = parsed.data;
  const client = await pool(config.ACCOUNT_DB).connect();
  try {
    await client.query('begin');
    await client.query("set local lock_timeout = '3s'");

    const checkPin = await client.query('SELECT pin FROM public.exchange_pin WHERE pin = $1', [pin]);
    if (checkPin.rows.length > 0) {
      throw new RedeemCodeError(409, `Kode PIN "${pin}" sudah terdaftar.`);
    }

    const nextIdRes = await client.query(`
      SELECT GREATEST(
        (SELECT COALESCE(MAX(id), 0) FROM public.exchange_rule),
        (SELECT COALESCE(MAX(id), 0) FROM public.exchange_list)
      ) + 1 AS next_id
    `);
    const ruleId = Number(nextIdRes.rows[0]?.next_id || 1);

    await client.query(
      'INSERT INTO public.exchange_list (id, description, amount) VALUES ($1, $2, 1)',
      [ruleId, description]
    );

    for (let i = 0; i < rewards.length; i++) {
      const reward = rewards[i];
      const setNum = reward.set ?? (i + 1);
      await client.query(
        'INSERT INTO public.exchange_rule (id, item_id, item_num, rate, set) VALUES ($1, $2, $3, $4, $5)',
        [ruleId, reward.item_id, reward.item_num, reward.rate ?? 1000, setNum]
      );
    }

    await client.query(
      `INSERT INTO public.exchange_pin (pin, password, rule_id, state, pin_set, zoneserver_id, account_id, character_id)
       VALUES ($1, $2, $3, $4, $5, -1, -1, -1)`,
      [pin, password, ruleId, state, pin_set]
    );

    const summary = `Dibuat PIN ${pin} (rule #${ruleId}): ${rewards.length} item hadiah.`;
    await client.query(
      `INSERT INTO dashboard.redeem_code_history (operator, action, pin, rule_id, details)
       VALUES ($1, 'create', $2, $3, $4)`,
      [operator, pin, ruleId, summary]
    );

    await client.query('commit');
    return { ok: true, pin, ruleId };
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function batchGenerateRedeemCodes(input: unknown, operator: string) {
  const parsed = batchGenerateRedeemCodeSchema.safeParse(input);
  if (!parsed.success) {
    throw new RedeemCodeError(400, parsed.error.issues[0]?.message ?? 'Data Batch Generate tidak valid.');
  }
  if (config.NODE_ENV === 'development') {
    throw new RedeemCodeError(403, 'Preview lokal tidak menyimpan perubahan ke game.');
  }

  const { prefix, count, password, description, pin_set, state, rewards } = parsed.data;
  const client = await pool(config.ACCOUNT_DB).connect();
  try {
    await client.query('begin');
    await client.query("set local lock_timeout = '5s'");

    const nextIdRes = await client.query(`
      SELECT GREATEST(
        (SELECT COALESCE(MAX(id), 0) FROM public.exchange_rule),
        (SELECT COALESCE(MAX(id), 0) FROM public.exchange_list)
      ) + 1 AS next_id
    `);
    const ruleId = Number(nextIdRes.rows[0]?.next_id || 1);

    await client.query(
      'INSERT INTO public.exchange_list (id, description, amount) VALUES ($1, $2, $3)',
      [ruleId, description, count]
    );

    for (let i = 0; i < rewards.length; i++) {
      const reward = rewards[i];
      const setNum = reward.set ?? (i + 1);
      await client.query(
        'INSERT INTO public.exchange_rule (id, item_id, item_num, rate, set) VALUES ($1, $2, $3, $4, $5)',
        [ruleId, reward.item_id, reward.item_num, reward.rate ?? 1000, setNum]
      );
    }

    const generatedPins = new Set<string>();
    const existingPinsResult = await client.query('SELECT pin FROM public.exchange_pin');
    const existingSet = new Set(existingPinsResult.rows.map(r => r.pin));

    while (generatedPins.size < count) {
      const candidate = generateSecurePin(prefix);
      if (!existingSet.has(candidate) && !generatedPins.has(candidate)) {
        generatedPins.add(candidate);
      }
    }

    for (const pin of generatedPins) {
      await client.query(
        `INSERT INTO public.exchange_pin (pin, password, rule_id, state, pin_set, zoneserver_id, account_id, character_id)
         VALUES ($1, $2, $3, $4, $5, -1, -1, -1)`,
        [pin, password, ruleId, state, pin_set]
      );
    }

    const summary = `Batch generate ${count} kode PIN (rule #${ruleId}) dengan prefix "${prefix}".`;
    await client.query(
      `INSERT INTO dashboard.redeem_code_history (operator, action, rule_id, details)
       VALUES ($1, 'batch_generate', $2, $3)`,
      [operator, ruleId, summary]
    );

    await client.query('commit');
    return { ok: true, count, ruleId, pins: Array.from(generatedPins) };
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function updateRedeemCodeState(pin: string, input: unknown, operator: string) {
  const parsed = updateRedeemCodeSchema.safeParse(input);
  if (!parsed.success) {
    throw new RedeemCodeError(400, parsed.error.issues[0]?.message ?? 'Data status tidak valid.');
  }
  if (config.NODE_ENV === 'development') {
    throw new RedeemCodeError(403, 'Preview lokal tidak menyimpan perubahan ke game.');
  }

  const client = await pool(config.ACCOUNT_DB).connect();
  try {
    await client.query('begin');
    const existing = await client.query('SELECT pin, state, rule_id FROM public.exchange_pin WHERE pin = $1 FOR UPDATE', [pin]);
    if (existing.rows.length === 0) {
      throw new RedeemCodeError(404, `Kode PIN "${pin}" tidak ditemukan.`);
    }

    const row = existing.rows[0];
    if (row.state === 'used') {
      throw new RedeemCodeError(400, 'Kode PIN yang sudah digunakan tidak dapat diubah statusnya.');
    }

    await client.query('UPDATE public.exchange_pin SET state = $1 WHERE pin = $2', [parsed.data.state, pin]);

    const summary = `Ubah status PIN ${pin} dari "${row.state}" menjadi "${parsed.data.state}".`;
    await client.query(
      `INSERT INTO dashboard.redeem_code_history (operator, action, pin, rule_id, details)
       VALUES ($1, 'update_state', $2, $3, $4)`,
      [operator, pin, row.rule_id, summary]
    );

    await client.query('commit');
    return { ok: true, pin, state: parsed.data.state };
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteRedeemCode(pin: string, operator: string) {
  if (config.NODE_ENV === 'development') {
    throw new RedeemCodeError(403, 'Preview lokal tidak menyimpan perubahan ke game.');
  }

  const client = await pool(config.ACCOUNT_DB).connect();
  try {
    await client.query('begin');
    const existing = await client.query('SELECT pin, state, rule_id FROM public.exchange_pin WHERE pin = $1 FOR UPDATE', [pin]);
    if (existing.rows.length === 0) {
      throw new RedeemCodeError(404, `Kode PIN "${pin}" tidak ditemukan.`);
    }

    const row = existing.rows[0];
    if (row.state === 'used') {
      throw new RedeemCodeError(400, 'Kode PIN yang sudah digunakan pemain tidak dapat dihapus.');
    }

    await client.query('DELETE FROM public.exchange_pin WHERE pin = $1', [pin]);

    const siblingCountRes = await client.query('SELECT count(*) FROM public.exchange_pin WHERE rule_id = $1', [row.rule_id]);
    const siblingCount = Number(siblingCountRes.rows[0]?.count || 0);

    if (siblingCount === 0) {
      await client.query('DELETE FROM public.exchange_rule WHERE id = $1', [row.rule_id]);
      await client.query('DELETE FROM public.exchange_list WHERE id = $1', [row.rule_id]);
    } else {
      await client.query('UPDATE public.exchange_list SET amount = GREATEST(0, amount - 1) WHERE id = $1', [row.rule_id]);
    }

    const summary = `Hapus PIN ${pin} (rule #${row.rule_id}).`;
    await client.query(
      `INSERT INTO dashboard.redeem_code_history (operator, action, pin, rule_id, details)
       VALUES ($1, 'delete', $2, $3, $4)`,
      [operator, pin, row.rule_id, summary]
    );

    await client.query('commit');
    return { ok: true, pin };
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
