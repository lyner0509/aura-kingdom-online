import { config } from './config.js';
import { pool } from './database.js';
import {
  grantStarterPackSchema,
  revisionForStarterPack,
  updateStarterPackSettingsSchema,
  type GrantStarterPackInput,
  type StarterPackClaim,
  type StarterPackHistoryEntry,
  type StarterPackItem,
  type StarterPackSettings,
  type UpdateStarterPackSettingsInput,
} from './starter-pack-model.js';

export class StarterPackError extends Error {
  public status: number;
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'StarterPackError';
    this.status = statusCode;
  }
}

export type StarterPackData = {
  settings: StarterPackSettings;
  items: StarterPackItem[];
  recentClaims: StarterPackClaim[];
  stats: {
    totalClaims: number;
    uniqueAccounts: number;
    totalItemsInPack: number;
    autoDeliveryActive: boolean;
  };
  revision: string;
  history: StarterPackHistoryEntry[];
  readOnly: boolean;
};

export async function readStarterPackData(): Promise<StarterPackData> {
  const db = pool(config.ACCOUNT_DB);

  // 1. Settings
  let settingsRes = await db.query<StarterPackSettings>(
    `SELECT
       id, is_enabled, auto_deliver_new_chars, mail_sender_name,
       mail_title, mail_content, bonus_gold, bonus_loyalty_points,
       min_character_level, max_claims_per_account,
       last_dispatch_at::text, last_dispatch_status,
       updated_at::text, updated_by
     FROM dashboard.starter_pack_settings
     WHERE id = 1`
  );

  if (!settingsRes.rows.length) {
    await db.query(`INSERT INTO dashboard.starter_pack_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
    settingsRes = await db.query<StarterPackSettings>(
      `SELECT
         id, is_enabled, auto_deliver_new_chars, mail_sender_name,
         mail_title, mail_content, bonus_gold, bonus_loyalty_points,
         min_character_level, max_claims_per_account,
         last_dispatch_at::text, last_dispatch_status,
         updated_at::text, updated_by
       FROM dashboard.starter_pack_settings
       WHERE id = 1`
    );
  }

  const settings = settingsRes.rows[0];

  // 2. Items
  const itemsRes = await db.query<StarterPackItem>(
    `SELECT
       id, item_id, item_name, item_count, is_bound, category, sort_order, note
     FROM dashboard.starter_pack_items
     ORDER BY sort_order ASC, id ASC`
  );

  const items = itemsRes.rows.map((row) => ({
    id: row.id,
    item_id: row.item_id,
    item_name: row.item_name || '',
    item_count: row.item_count,
    is_bound: !!row.is_bound,
    category: row.category || 'general',
    sort_order: row.sort_order ?? 0,
    note: row.note || '',
  }));

  // 3. Claims
  const claimsRes = await db.query<StarterPackClaim>(
    `SELECT
       id, account_id, username, character_id, character_name,
       delivery_method, items_delivered_count, gold_delivered, loyalty_delivered,
       operator, claimed_at::text
     FROM dashboard.starter_pack_claims
     ORDER BY claimed_at DESC
     LIMIT 100`
  );

  // 4. Stats
  const statsRes = await db.query<{ total_claims: string; unique_accounts: string }>(
    `SELECT
       COUNT(*)::text AS total_claims,
       COUNT(DISTINCT account_id)::text AS unique_accounts
     FROM dashboard.starter_pack_claims`
  );

  const stats = {
    totalClaims: Number(statsRes.rows[0]?.total_claims || 0),
    uniqueAccounts: Number(statsRes.rows[0]?.unique_accounts || 0),
    totalItemsInPack: items.length,
    autoDeliveryActive: settings.auto_deliver_new_chars && settings.is_enabled,
  };

  // 5. Revision
  const revision = revisionForStarterPack(settings, items);

  // 6. History
  const historyRes = await db.query<StarterPackHistoryEntry>(
    `SELECT id::text, operator, action, target, details, created_at::text
     FROM dashboard.starter_pack_history
     ORDER BY created_at DESC
     LIMIT 50`
  );

  return {
    settings,
    items,
    recentClaims: claimsRes.rows,
    stats,
    revision,
    history: historyRes.rows,
    readOnly: false,
  };
}

export async function saveStarterPackSettings(
  input: UpdateStarterPackSettingsInput,
  operator: string
): Promise<{ ok: boolean; revision: string; message: string }> {
  const payload = updateStarterPackSettingsSchema.parse(input);
  const db = pool(config.ACCOUNT_DB);

  // Check current revision
  const current = await readStarterPackData();
  if (current.revision !== payload.revision) {
    throw new StarterPackError(
      409,
      'Konfigurasi Starter Pack telah diubah oleh operator lain. Silakan muat ulang data.'
    );
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. Update settings
    await client.query(
      `UPDATE dashboard.starter_pack_settings
       SET is_enabled = $1,
           auto_deliver_new_chars = $2,
           mail_sender_name = $3,
           mail_title = $4,
           mail_content = $5,
           bonus_gold = $6,
           bonus_loyalty_points = $7,
           min_character_level = $8,
           max_claims_per_account = $9,
           updated_at = NOW(),
           updated_by = $10
       WHERE id = 1`,
      [
        payload.is_enabled,
        payload.auto_deliver_new_chars,
        payload.mail_sender_name.trim(),
        payload.mail_title.trim(),
        payload.mail_content.trim(),
        payload.bonus_gold,
        payload.bonus_loyalty_points,
        payload.min_character_level,
        payload.max_claims_per_account,
        operator,
      ]
    );

    // 2. Replace items
    await client.query('DELETE FROM dashboard.starter_pack_items');

    for (let i = 0; i < payload.items.length; i++) {
      const it = payload.items[i];
      await client.query(
        `INSERT INTO dashboard.starter_pack_items (
           item_id, item_name, item_count, is_bound, category, sort_order, note
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          it.item_id,
          (it.item_name || '').trim(),
          it.item_count,
          !!it.is_bound,
          (it.category || 'general').trim(),
          it.sort_order ?? i + 1,
          (it.note || '').trim(),
        ]
      );
    }

    // 3. Log history
    await client.query(
      `INSERT INTO dashboard.starter_pack_history (operator, action, target, details)
       VALUES ($1, 'UPDATE_SETTINGS', 'CONFIG', $2)`,
      [
        operator,
        `Pembaruan Starter Pack: ${payload.items.length} item, Gold: ${payload.bonus_gold.toLocaleString('id-ID')}, LP: ${payload.bonus_loyalty_points.toLocaleString('id-ID')}, Status: ${payload.is_enabled ? 'Aktif' : 'Nonaktif'}`,
      ]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const updated = await readStarterPackData();
  return {
    ok: true,
    revision: updated.revision,
    message: 'Pengaturan Starter Pack berhasil disimpan.',
  };
}

export async function grantStarterPack(
  input: GrantStarterPackInput,
  operator: string
): Promise<{ ok: boolean; message: string; claim: StarterPackClaim }> {
  const payload = grantStarterPackSchema.parse(input);
  const accDb = pool(config.ACCOUNT_DB);
  const gameDb = pool(config.GAME_DB);

  // 1. Settings & items
  const settingsRes = await accDb.query<StarterPackSettings>(
    `SELECT * FROM dashboard.starter_pack_settings WHERE id = 1`
  );
  const settings = settingsRes.rows[0];
  if (!settings || !settings.is_enabled) {
    throw new StarterPackError(400, 'Sistem Starter Pack saat ini sedang dinonaktifkan.');
  }

  const itemsRes = await accDb.query<StarterPackItem>(
    `SELECT * FROM dashboard.starter_pack_items ORDER BY sort_order ASC, id ASC`
  );
  const items = itemsRes.rows;
  if (!items.length) {
    throw new StarterPackError(400, 'Belum ada item yang dikonfigurasikan dalam Starter Pack.');
  }

  // 2. Resolve Character & Account
  let charId: number;
  let charName: string;
  let accountId: number;
  let username: string;
  let charLevel: number;

  if (payload.target_type === 'character') {
    const charRes = await gameDb.query<{ id: number; given_name: string; account_id: number; level: number }>(
      `SELECT id, given_name, account_id, level
       FROM public.player_characters
       WHERE LOWER(given_name) = LOWER($1)
       LIMIT 1`,
      [payload.target_name.trim()]
    );
    if (!charRes.rows.length) {
      throw new StarterPackError(404, `Karakter "${payload.target_name}" tidak ditemukan di server.`);
    }
    const char = charRes.rows[0];
    charId = char.id;
    charName = char.given_name;
    accountId = char.account_id;
    charLevel = char.level;

    const accRes = await accDb.query<{ username: string }>(
      `SELECT username FROM public.accounts WHERE id = $1`,
      [accountId]
    );
    username = accRes.rows[0]?.username || `Account#${accountId}`;
  } else {
    // By account username
    const accRes = await accDb.query<{ id: number; username: string }>(
      `SELECT id, username FROM public.accounts WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      [payload.target_name.trim()]
    );
    if (!accRes.rows.length) {
      throw new StarterPackError(404, `Akun "${payload.target_name}" tidak ditemukan di database.`);
    }
    accountId = accRes.rows[0].id;
    username = accRes.rows[0].username;

    // Find top character
    const charRes = await gameDb.query<{ id: number; given_name: string; level: number }>(
      `SELECT id, given_name, level
       FROM public.player_characters
       WHERE account_id = $1
       ORDER BY level DESC, id ASC
       LIMIT 1`,
      [accountId]
    );
    if (!charRes.rows.length) {
      throw new StarterPackError(400, `Akun "${username}" belum memiliki karakter aktif di server.`);
    }
    charId = charRes.rows[0].id;
    charName = charRes.rows[0].given_name;
    charLevel = charRes.rows[0].level;
  }

  // 3. Level requirement check
  if (charLevel < settings.min_character_level) {
    throw new StarterPackError(
      400,
      `Karakter ${charName} (Lv ${charLevel}) belum memenuhi level minimum (${settings.min_character_level}) untuk menerima Starter Pack.`
    );
  }

  // 4. Claim limit check
  if (settings.max_claims_per_account > 0 && !payload.override_claim_limit) {
    const claimsCountRes = await accDb.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM dashboard.starter_pack_claims WHERE account_id = $1`,
      [accountId]
    );
    const count = Number(claimsCountRes.rows[0]?.count || 0);
    if (count >= settings.max_claims_per_account) {
      throw new StarterPackError(
        400,
        `Akun ${username} sudah pernah menerima Starter Pack (${count}/${settings.max_claims_per_account}x). Gunakan opsi paksa/override jika ingin mengirimkan ulang.`
      );
    }
  }

  // 5. Dispatch mails in FFDB1.sys_mail_queue
  const nowUnix = Math.floor(Date.now() / 1000);
  const senderName = (settings.mail_sender_name || 'Azuria Operations').slice(0, 32);
  const mailTitle = (settings.mail_title || '[Starter Pack] Hadiah Pemula').slice(0, 40);
  const mailContent = settings.mail_content || 'Selamat datang di Dunia Aura Kingdom!';

  let itemsSent = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isFirst = i === 0;
    const goldToAttach = isFirst ? Math.max(0, settings.bonus_gold || 0) : 0;
    const bindVal = item.is_bound ? 1 : 0;

    await gameDb.query(
      `INSERT INTO public.sys_mail_queue (
         receiver_id, state, sender_name, title, content, gold, item_id,
         durability, identify, embedded_amount, bind, create_time, due_date
       ) VALUES (
         $1, 'New', $2, $3, $4, $5, $6,
         -1, 1, $7, $8, $9, 0
       )`,
      [
        charId,
        senderName,
        mailTitle,
        mailContent,
        goldToAttach,
        item.item_id,
        item.item_count,
        bindVal,
        nowUnix,
      ]
    );
    itemsSent++;
  }

  // 6. Bonus Loyalty Points
  let loyaltyGiven = 0;
  if (settings.bonus_loyalty_points > 0) {
    loyaltyGiven = settings.bonus_loyalty_points;
    await accDb.query(
      `UPDATE public.accounts
       SET gift_point = COALESCE(gift_point, 0) + $1
       WHERE id = $2`,
      [loyaltyGiven, accountId]
    );
  }

  // 7. Record claim
  const claimInsertRes = await accDb.query<StarterPackClaim>(
    `INSERT INTO dashboard.starter_pack_claims (
       account_id, username, character_id, character_name, delivery_method,
       items_delivered_count, gold_delivered, loyalty_delivered, operator
     ) VALUES (
       $1, $2, $3, $4, 'manual_grant', $5, $6, $7, $8
     ) RETURNING *`,
    [
      accountId,
      username,
      charId,
      charName,
      itemsSent,
      settings.bonus_gold,
      loyaltyGiven,
      operator,
    ]
  );
  const claim = claimInsertRes.rows[0];

  // 8. Log history
  await accDb.query(
    `INSERT INTO dashboard.starter_pack_history (operator, action, target, details)
     VALUES ($1, 'GRANT_STARTER_PACK', $2, $3)`,
    [
      operator,
      `${username} (${charName})`,
      `Starter Pack terkirim: ${itemsSent} item mail, ${settings.bonus_gold.toLocaleString('id-ID')} Gold, ${loyaltyGiven.toLocaleString('id-ID')} LP`,
    ]
  );

  return {
    ok: true,
    message: `Berhasil mengirimkan Starter Pack (${itemsSent} item mail & ${settings.bonus_gold.toLocaleString('id-ID')} Gold) ke karakter ${charName} (Akun: ${username}).`,
    claim,
  };
}

export async function batchDispatchStarterPack(
  operator: string,
  minLevel = 1
): Promise<{ ok: boolean; dispatchedCount: number; message: string }> {
  const accDb = pool(config.ACCOUNT_DB);
  const gameDb = pool(config.GAME_DB);

  const settingsRes = await accDb.query<StarterPackSettings>(
    `SELECT * FROM dashboard.starter_pack_settings WHERE id = 1`
  );
  const settings = settingsRes.rows[0];
  if (!settings || !settings.is_enabled) {
    throw new StarterPackError(400, 'Sistem Starter Pack sedang nonaktif.');
  }

  const itemsRes = await accDb.query<StarterPackItem>(
    `SELECT * FROM dashboard.starter_pack_items ORDER BY sort_order ASC, id ASC`
  );
  const items = itemsRes.rows;
  if (!items.length) {
    throw new StarterPackError(400, 'Tidak ada item dalam Starter Pack.');
  }

  // Find all characters whose accounts haven't claimed yet
  const charsRes = await gameDb.query<{ id: number; given_name: string; account_id: number; level: number }>(
    `SELECT DISTINCT ON (account_id) id, given_name, account_id, level
     FROM public.player_characters
     WHERE level >= $1
     ORDER BY account_id, level DESC`,
    [minLevel]
  );

  // Check claims
  const claimedAccsRes = await accDb.query<{ account_id: number }>(
    `SELECT account_id FROM dashboard.starter_pack_claims GROUP BY account_id HAVING COUNT(*) >= $1`,
    [settings.max_claims_per_account > 0 ? settings.max_claims_per_account : 999999]
  );
  const claimedAccIds = new Set(claimedAccsRes.rows.map((r) => r.account_id));

  const eligibleChars = charsRes.rows.filter((c) => !claimedAccIds.has(c.account_id));
  if (!eligibleChars.length) {
    return {
      ok: true,
      dispatchedCount: 0,
      message: 'Tidak ada karakter baru yang memenuhi syarat untuk menerima Starter Pack.',
    };
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  const senderName = (settings.mail_sender_name || 'Azuria Operations').slice(0, 32);
  const mailTitle = (settings.mail_title || '[Starter Pack] Hadiah Pemula').slice(0, 40);
  const mailContent = settings.mail_content || 'Selamat datang di Dunia Aura Kingdom!';

  let count = 0;
  for (const c of eligibleChars) {
    try {
      // Look up username
      const accRes = await accDb.query<{ username: string }>(
        `SELECT username FROM public.accounts WHERE id = $1`,
        [c.account_id]
      );
      const username = accRes.rows[0]?.username || `Account#${c.account_id}`;

      // Insert mails
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const isFirst = i === 0;
        const goldToAttach = isFirst ? Math.max(0, settings.bonus_gold || 0) : 0;
        const bindVal = item.is_bound ? 1 : 0;

        await gameDb.query(
          `INSERT INTO public.sys_mail_queue (
             receiver_id, state, sender_name, title, content, gold, item_id,
             durability, identify, embedded_amount, bind, create_time, due_date
           ) VALUES (
             $1, 'New', $2, $3, $4, $5, $6,
             -1, 1, $7, $8, $9, 0
           )`,
          [
            c.id,
            senderName,
            mailTitle,
            mailContent,
            goldToAttach,
            item.item_id,
            item.item_count,
            bindVal,
            nowUnix,
          ]
        );
      }

      if (settings.bonus_loyalty_points > 0) {
        await accDb.query(
          `UPDATE public.accounts
           SET gift_point = COALESCE(gift_point, 0) + $1
           WHERE id = $2`,
          [settings.bonus_loyalty_points, c.account_id]
        );
      }

      await accDb.query(
        `INSERT INTO dashboard.starter_pack_claims (
           account_id, username, character_id, character_name, delivery_method,
           items_delivered_count, gold_delivered, loyalty_delivered, operator
         ) VALUES (
           $1, $2, $3, $4, 'batch_dispatch', $5, $6, $7, $8
         )`,
        [
          c.account_id,
          username,
          c.id,
          c.given_name,
          items.length,
          settings.bonus_gold,
          settings.bonus_loyalty_points,
          operator,
        ]
      );

      count++;
    } catch (e) {
      console.error(`Gagal batch dispatch ke karakter ${c.given_name}:`, e);
    }
  }

  const msg = `Batch dispatch selesai: Terkirim ke ${count} dari ${eligibleChars.length} karakter baru.`;

  await accDb.query(
    `UPDATE dashboard.starter_pack_settings
     SET last_dispatch_at = NOW(),
         last_dispatch_status = $1
     WHERE id = 1`,
    [msg]
  );

  await accDb.query(
    `INSERT INTO dashboard.starter_pack_history (operator, action, target, details)
     VALUES ($1, 'BATCH_DISPATCH', 'ALL_NEW', $2)`,
    [operator, msg]
  );

  return {
    ok: true,
    dispatchedCount: count,
    message: msg,
  };
}

export async function revokeStarterPackClaim(
  claimId: number,
  operator: string
): Promise<{ ok: boolean; message: string }> {
  const db = pool(config.ACCOUNT_DB);
  const claimRes = await db.query<StarterPackClaim>(
    `SELECT * FROM dashboard.starter_pack_claims WHERE id = $1`,
    [claimId]
  );
  if (!claimRes.rows.length) {
    throw new StarterPackError(404, 'Data klaim Starter Pack tidak ditemukan.');
  }
  const claim = claimRes.rows[0];

  await db.query(`DELETE FROM dashboard.starter_pack_claims WHERE id = $1`, [claimId]);

  await db.query(
    `INSERT INTO dashboard.starter_pack_history (operator, action, target, details)
     VALUES ($1, 'REVOKE_CLAIM', $2, $3)`,
    [
      operator,
      `${claim.username} (${claim.character_name})`,
      `Klaim Starter Pack #${claimId} direset agar pemain dapat menerima kembali.`,
    ]
  );

  return {
    ok: true,
    message: `Klaim Starter Pack untuk karakter ${claim.character_name} berhasil direset.`,
  };
}
