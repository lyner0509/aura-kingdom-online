import { config } from './config.js';
import { pool } from './database.js';
import {
  grantVipSchema,
  revisionForVip,
  updateVipSettingsSchema,
  type AccountVip,
  type GrantVipInput,
  type UpdateVipSettingsInput,
  type VipHistoryEntry,
  type VipSettings,
  type VipTier,
} from './vip-model.js';
import { itemNames, itemIcons } from './paragon.js';
import { sendCharacterMail } from './mail.js';
import { triggerMailQueue, sendAnnounce } from './zone-command.js';

export class VipError extends Error {
  public status: number;
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'VipError';
    this.status = statusCode;
  }
}

export type VipData = {
  settings: VipSettings;
  tiers: VipTier[];
  members: AccountVip[];
  stats: {
    totalVipAccounts: number;
    activeVipAccounts: number;
    maxVipLevel: number;
    totalVipPoints: number;
  };
  itemNames?: Record<string, string>;
  itemIcons?: Record<string, string>;
  revision: string;
  history: VipHistoryEntry[];
  readOnly: boolean;
};

export async function readVipData(): Promise<VipData> {
  const db = pool(config.ACCOUNT_DB);

  // 1. Settings
  let settingsRes = await db.query<VipSettings>(
    `SELECT
       id, is_enabled, points_per_ap, auto_vip_on_spending,
       daily_mail_reward_enabled, daily_mail_title, daily_mail_content,
       last_mail_dispatch_at::text, last_mail_dispatch_status,
       updated_at::text, updated_by
     FROM dashboard.vip_settings
     WHERE id = 1`
  );

  if (!settingsRes.rows.length) {
    await db.query(`INSERT INTO dashboard.vip_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
    settingsRes = await db.query<VipSettings>(
      `SELECT
         id, is_enabled, points_per_ap, auto_vip_on_spending,
         daily_mail_reward_enabled, daily_mail_title, daily_mail_content,
         last_mail_dispatch_at::text, last_mail_dispatch_status,
         updated_at::text, updated_by
       FROM dashboard.vip_settings
       WHERE id = 1`
    );
  }

  const settings = settingsRes.rows[0];

  // 2. Tiers
  const tiersRes = await db.query<VipTier>(
    `SELECT
       level, name, required_points,
       exp_bonus_percent, drop_bonus_percent, gold_bonus_percent, move_speed_percent,
       daily_loyalty_points, daily_item_id, daily_item_count, buff_desc
     FROM dashboard.vip_tiers
     ORDER BY level ASC`
  );
  const tiers = tiersRes.rows;

  // 3. Members
  const membersRes = await db.query<AccountVip>(
    `SELECT
       account_id, username, vip_level, vip_points,
       is_active,
       expires_at::text,
       last_daily_claim_at::text,
       created_at::text, updated_at::text, updated_by
     FROM dashboard.account_vip
     ORDER BY vip_level DESC, vip_points DESC, account_id ASC
     LIMIT 100`
  );
  const members = membersRes.rows;

  // 4. Stats
  const statsRes = await db.query<{
    total_count: string;
    active_count: string;
    max_level: number | null;
    total_points: string;
  }>(
    `SELECT
       COUNT(*)::text AS total_count,
       COUNT(CASE WHEN is_active = true AND (expires_at IS NULL OR expires_at > NOW()) THEN 1 END)::text AS active_count,
       MAX(vip_level) AS max_level,
       COALESCE(SUM(vip_points), 0)::text AS total_points
     FROM dashboard.account_vip`
  );

  const statsRow = statsRes.rows[0];
  const stats = {
    totalVipAccounts: Number(statsRow?.total_count || 0),
    activeVipAccounts: Number(statsRow?.active_count || 0),
    maxVipLevel: Number(statsRow?.max_level || 0),
    totalVipPoints: Number(statsRow?.total_points || 0),
  };

  // 5. History
  const historyRes = await db.query<VipHistoryEntry>(
    `SELECT
       id::text, operator, action, target_account, vip_level, details, created_at::text
     FROM dashboard.vip_history
     ORDER BY created_at DESC
     LIMIT 50`
  );

  const revision = revisionForVip(settings, tiers);
  const tierItemIds = tiers.map((t) => t.daily_item_id).filter((id) => id > 0);

  return {
    settings,
    tiers,
    members,
    stats,
    itemNames: await itemNames(tierItemIds),
    itemIcons: await itemIcons(tierItemIds),
    revision,
    history: historyRes.rows,
    readOnly: false,
  };
}

export async function saveVipSettings(
  rawInput: unknown,
  operator: string
): Promise<{ ok: boolean; revision: string; message: string }> {
  const parsed = updateVipSettingsSchema.safeParse(rawInput);
  if (!parsed.success) {
    const errorMsg = Object.entries(parsed.error.flatten().fieldErrors)
      .map(([k, v]) => `${k}: ${v?.join(', ')}`)
      .join('; ');
    throw new VipError(400, `Parameter tidak valid: ${errorMsg}`);
  }

  const input: UpdateVipSettingsInput = parsed.data;
  const db = pool(config.ACCOUNT_DB);

  const current = await readVipData();
  if (current.revision !== input.revision) {
    throw new VipError(409, 'Konfigurasi VIP telah diubah oleh operator lain. Silakan muat ulang data.');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Update settings
    await client.query(
      `UPDATE dashboard.vip_settings
       SET is_enabled = $1,
           points_per_ap = $2,
           auto_vip_on_spending = $3,
           daily_mail_reward_enabled = $4,
           daily_mail_title = $5,
           daily_mail_content = $6,
           updated_at = NOW(),
           updated_by = $7
       WHERE id = 1`,
      [
        input.is_enabled,
        input.points_per_ap,
        input.auto_vip_on_spending,
        input.daily_mail_reward_enabled,
        input.daily_mail_title.trim(),
        input.daily_mail_content.trim(),
        operator,
      ]
    );

    // Upsert tiers
    for (const tier of input.tiers) {
      await client.query(
        `INSERT INTO dashboard.vip_tiers (
           level, name, required_points, exp_bonus_percent, drop_bonus_percent, gold_bonus_percent,
           move_speed_percent, daily_loyalty_points, daily_item_id, daily_item_count, buff_desc, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
         ON CONFLICT (level) DO UPDATE
         SET name = EXCLUDED.name,
             required_points = EXCLUDED.required_points,
             exp_bonus_percent = EXCLUDED.exp_bonus_percent,
             drop_bonus_percent = EXCLUDED.drop_bonus_percent,
             gold_bonus_percent = EXCLUDED.gold_bonus_percent,
             move_speed_percent = EXCLUDED.move_speed_percent,
             daily_loyalty_points = EXCLUDED.daily_loyalty_points,
             daily_item_id = EXCLUDED.daily_item_id,
             daily_item_count = EXCLUDED.daily_item_count,
             buff_desc = EXCLUDED.buff_desc,
             updated_at = NOW()`,
        [
          tier.level,
          tier.name.trim(),
          tier.required_points,
          tier.exp_bonus_percent,
          tier.drop_bonus_percent,
          tier.gold_bonus_percent,
          tier.move_speed_percent,
          tier.daily_loyalty_points,
          tier.daily_item_id,
          tier.daily_item_count,
          tier.buff_desc.trim(),
        ]
      );
    }

    // Log history
    await client.query(
      `INSERT INTO dashboard.vip_history (operator, action, target_account, vip_level, details)
       VALUES ($1, 'UPDATE_SETTINGS', 'ALL', NULL, $2)`,
      [operator, `Memperbarui pengaturan sistem VIP (${input.tiers.length} tiers, status: ${input.is_enabled ? 'Aktif' : 'Nonaktif'})`]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const updatedSettings: VipSettings = {
    ...current.settings,
    ...input,
    updated_by: operator,
    updated_at: new Date().toISOString(),
  };

  const newRevision = revisionForVip(updatedSettings, input.tiers);
  return {
    ok: true,
    revision: newRevision,
    message: 'Pengaturan VIP dan Tier berhasil disimpan.',
  };
}

export async function grantVipMember(
  rawInput: unknown,
  operator: string
): Promise<{ ok: boolean; message: string; member: AccountVip }> {
  const parsed = grantVipSchema.safeParse(rawInput);
  if (!parsed.success) {
    const errorMsg = Object.entries(parsed.error.flatten().fieldErrors)
      .map(([k, v]) => `${k}: ${v?.join(', ')}`)
      .join('; ');
    throw new VipError(400, `Parameter tidak valid: ${errorMsg}`);
  }

  const input: GrantVipInput = parsed.data;
  const db = pool(config.ACCOUNT_DB);

  // Check if account exists
  const accRes = await db.query<{ id: number; username: string }>(
    `SELECT id, username FROM public.accounts WHERE LOWER(username) = LOWER($1)`,
    [input.username.trim()]
  );

  if (!accRes.rows.length) {
    throw new VipError(404, `Akun dengan username "${input.username}" tidak ditemukan.`);
  }

  const account = accRes.rows[0];

  // Calculate expires_at
  let expiresAt: string | null = null;
  if (input.custom_expires_at) {
    expiresAt = new Date(input.custom_expires_at).toISOString();
  } else if (input.duration_days && input.duration_days > 0) {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + input.duration_days);
    expiresAt = expDate.toISOString();
  }

  const memberRes = await db.query<AccountVip>(
    `INSERT INTO dashboard.account_vip (
       account_id, username, vip_level, vip_points, is_active, expires_at, updated_at, updated_by
     ) VALUES ($1, $2, $3, $4, true, $5, NOW(), $6)
     ON CONFLICT (account_id) DO UPDATE
     SET username = EXCLUDED.username,
         vip_level = EXCLUDED.vip_level,
         vip_points = dashboard.account_vip.vip_points + EXCLUDED.vip_points,
         is_active = true,
         expires_at = EXCLUDED.expires_at,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by
     RETURNING
       account_id, username, vip_level, vip_points, is_active,
       expires_at::text, last_daily_claim_at::text, created_at::text, updated_at::text, updated_by`,
    [account.id, account.username, input.vip_level, input.vip_points, expiresAt, operator]
  );

  const durationText = expiresAt ? `berlaku hingga ${new Date(expiresAt).toLocaleDateString('id-ID')}` : 'Permanen';
  const detailText = `Diberikan VIP Level ${input.vip_level} (${durationText}, +${input.vip_points} poin)`;

  await db.query(
    `INSERT INTO dashboard.vip_history (operator, action, target_account, vip_level, details)
     VALUES ($1, 'GRANT_VIP', $2, $3, $4)`,
    [operator, account.username, input.vip_level, detailText]
  );

  return {
    ok: true,
    message: `Berhasil memberikan status VIP Level ${input.vip_level} ke akun ${account.username} (${durationText}).`,
    member: memberRes.rows[0],
  };
}

export async function revokeVipMember(
  username: string,
  operator: string
): Promise<{ ok: boolean; message: string }> {
  const db = pool(config.ACCOUNT_DB);
  const result = await db.query(
    `UPDATE dashboard.account_vip
     SET is_active = false,
         updated_at = NOW(),
         updated_by = $1
     WHERE LOWER(username) = LOWER($2)`,
    [operator, username.trim()]
  );

  if (result.rowCount === 0) {
    throw new VipError(404, `Akun VIP "${username}" tidak ditemukan.`);
  }

  await db.query(
    `INSERT INTO dashboard.vip_history (operator, action, target_account, vip_level, details)
     VALUES ($1, 'REVOKE_VIP', $2, 0, 'Status VIP dinonaktifkan / dicabut oleh operator')`,
    [operator, username.trim()]
  );

  return {
    ok: true,
    message: `Status VIP akun ${username} berhasil dicabut.`,
  };
}

export async function extendVipMember(
  username: string,
  days: number,
  operator: string
): Promise<{ ok: boolean; message: string; expires_at: string }> {
  if (days <= 0 || days > 365) {
    throw new VipError(400, 'Jumlah hari perpanjangan harus antara 1 dan 365 hari.');
  }

  const db = pool(config.ACCOUNT_DB);
  const current = await db.query<{ account_id: number; expires_at: string | null }>(
    `SELECT account_id, expires_at::text FROM dashboard.account_vip WHERE LOWER(username) = LOWER($1)`,
    [username.trim()]
  );

  if (!current.rows.length) {
    throw new VipError(404, `Akun VIP "${username}" tidak ditemukan.`);
  }

  let baseDate = new Date();
  if (current.rows[0].expires_at) {
    const prev = new Date(current.rows[0].expires_at);
    if (prev.getTime() > baseDate.getTime()) {
      baseDate = prev;
    }
  }

  baseDate.setDate(baseDate.getDate() + days);
  const newExpiry = baseDate.toISOString();

  await db.query(
    `UPDATE dashboard.account_vip
     SET expires_at = $1,
         is_active = true,
         updated_at = NOW(),
         updated_by = $2
     WHERE account_id = $3`,
    [newExpiry, operator, current.rows[0].account_id]
  );

  const detailText = `Masa aktif VIP diperpanjang +${days} hari hingga ${new Date(newExpiry).toLocaleDateString('id-ID')}`;

  await db.query(
    `INSERT INTO dashboard.vip_history (operator, action, target_account, vip_level, details)
     VALUES ($1, 'EXTEND_VIP', $2, NULL, $3)`,
    [operator, username.trim(), detailText]
  );

  return {
    ok: true,
    message: `Masa aktif VIP akun ${username} berhasil diperpanjang +${days} hari.`,
    expires_at: newExpiry,
  };
}

export async function dispatchDailyVipMail(
  operator: string
): Promise<{ ok: boolean; dispatchedCount: number; message: string }> {
  const accDb = pool(config.ACCOUNT_DB);
  const gameDb = pool(config.GAME_DB);

  // 1. Get settings
  const settingsRes = await accDb.query<VipSettings>(`SELECT * FROM dashboard.vip_settings WHERE id = 1`);
  const settings = settingsRes.rows[0];
  if (!settings || !settings.is_enabled) {
    throw new VipError(400, 'Sistem VIP saat ini sedang nonaktif.');
  }

  // 2. Get active VIP members with their tiers
  const membersRes = await accDb.query<{
    account_id: number;
    username: string;
    vip_level: number;
    daily_item_id: number;
    daily_item_count: number;
    daily_loyalty_points: number;
  }>(
    `SELECT
       m.account_id, m.username, m.vip_level,
       t.daily_item_id, t.daily_item_count, t.daily_loyalty_points
     FROM dashboard.account_vip m
     JOIN dashboard.vip_tiers t ON t.level = m.vip_level
     WHERE m.is_active = true
       AND (m.expires_at IS NULL OR m.expires_at > NOW())`
  );

  const members = membersRes.rows;
  if (!members.length) {
    return {
      ok: true,
      dispatchedCount: 0,
      message: 'Tidak ada akun VIP aktif untuk menerima hadiah harian.',
    };
  }

  let sentCount = 0;
  const nowUnix = Math.floor(Date.now() / 1000);
  const mailTitle = settings.daily_mail_title || 'Hadiah Harian VIP Server';
  const mailContent = settings.daily_mail_content || 'Terima kasih atas dukunganmu!';

  for (const m of members) {
    try {
      // Find top character in FFDB1
      const charRes = await gameDb.query<{ id: number; given_name: string }>(
        `SELECT id, given_name
         FROM public.player_characters
         WHERE account_id = $1
         ORDER BY level DESC, id ASC
         LIMIT 1`,
        [m.account_id]
      );

      if (!charRes.rows.length) continue;
      const charId = charRes.rows[0].id;

      // Send daily VIP mail (with item if daily_item_id > 0, or greeting/points)
      await sendCharacterMail(gameDb, {
        receiverCharId: charId,
        senderName: 'Sistem VIP',
        title: mailTitle,
        content: mailContent,
        itemId: m.daily_item_id > 0 ? m.daily_item_id : 0,
        itemCount: m.daily_item_count || 1,
        isBound: true,
        gold: 0,
      });

      // Add loyalty points if > 0
      if (m.daily_loyalty_points > 0) {
        await accDb.query(
          `UPDATE public.accounts
           SET gift_point = COALESCE(gift_point, 0) + $1
           WHERE id = $2`,
          [m.daily_loyalty_points, m.account_id]
        );
      }

      // Mark claim time
      await accDb.query(
        `UPDATE dashboard.account_vip
         SET last_daily_claim_at = NOW()
         WHERE account_id = $1`,
        [m.account_id]
      );

      sentCount++;
    } catch (e) {
      console.error(`Gagal mengirim hadiah VIP ke akun ${m.username}:`, e);
    }
  }

  // Flush any remaining mail queue via ZoneServer
  try {
    await triggerMailQueue(0);
  } catch (e) {
    console.warn('[VIP] Gagal flush send_sys_mail_queue 0:', e);
  }

  // Broadcast in-game announcement if mails were dispatched
  if (sentCount > 0) {
    try {
      await sendAnnounce(
        `[Sistem VIP] Hadiah harian VIP (${sentCount} penerima) telah dikirimkan ke kotak surat! Silakan periksa mailbox Anda.`
      );
    } catch (e) {
      console.warn('[VIP] Gagal broadcast announcement ZoneServer:', e);
    }
  }

  const statusMsg = `Terkirim ke ${sentCount} dari ${members.length} karakter VIP in-game.`;

  await accDb.query(
    `UPDATE dashboard.vip_settings
     SET last_mail_dispatch_at = NOW(),
         last_mail_dispatch_status = $1
     WHERE id = 1`,
    [statusMsg]
  );

  await accDb.query(
    `INSERT INTO dashboard.vip_history (operator, action, target_account, vip_level, details)
     VALUES ($1, 'DISPATCH_MAIL', 'ALL', NULL, $2)`,
    [operator, statusMsg]
  );

  return {
    ok: true,
    dispatchedCount: sentCount,
    message: `Pengiriman hadiah VIP harian selesai: ${statusMsg}`,
  };
}
