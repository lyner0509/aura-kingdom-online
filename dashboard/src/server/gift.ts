import { config } from './config.js';
import { pool } from './database.js';
import {
  giftSettingsSchema,
  sendGiftPayloadSchema,
  type GiftHistoryEntry,
  type GiftSettings,
  type SendGiftPayload,
} from './gift-model.js';
import { itemNames } from './paragon.js';
import { sendCharacterMail } from './mail.js';
import { triggerMailQueue, sendAnnounce } from './zone-command.js';
import { getActivePlayers } from './system.js';

export class GiftError extends Error {
  public status: number;
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'GiftError';
    this.status = statusCode;
  }
}

export async function readGiftSettings(): Promise<GiftSettings> {
  const accDb = pool(config.ACCOUNT_DB);
  const res = await accDb.query<GiftSettings>(
    `SELECT * FROM dashboard.gift_settings WHERE id = 1`
  );
  if (!res.rows.length) {
    return {
      id: 1,
      default_sender_name: 'Game Master',
      default_mail_title: '[Hadiah GM] Hadiah Spesial',
      default_mail_content: 'Selamat! Kamu menerima hadiah item dari Game Master. Selamat berpetualang di Azuria!',
      default_is_bound: true,
      allow_online_broadcast: true,
    };
  }
  return res.rows[0];
}

export async function saveGiftSettings(
  rawInput: unknown,
  operator: string
): Promise<{ ok: boolean; settings: GiftSettings; message: string }> {
  const parsed = giftSettingsSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstErr = parsed.error.issues[0]?.message || 'Input tidak valid.';
    throw new GiftError(400, firstErr);
  }

  const d = parsed.data;
  const accDb = pool(config.ACCOUNT_DB);

  await accDb.query(
    `INSERT INTO dashboard.gift_settings (
       id, default_sender_name, default_mail_title, default_mail_content,
       default_is_bound, allow_online_broadcast, updated_at, updated_by
     ) VALUES (
       1, $1, $2, $3, $4, $5, NOW(), $6
     )
     ON CONFLICT (id) DO UPDATE SET
       default_sender_name = EXCLUDED.default_sender_name,
       default_mail_title = EXCLUDED.default_mail_title,
       default_mail_content = EXCLUDED.default_mail_content,
       default_is_bound = EXCLUDED.default_is_bound,
       allow_online_broadcast = EXCLUDED.allow_online_broadcast,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [
      d.default_sender_name,
      d.default_mail_title,
      d.default_mail_content,
      d.default_is_bound,
      d.allow_online_broadcast,
      operator,
    ]
  );

  const updated = await readGiftSettings();
  return {
    ok: true,
    settings: updated,
    message: 'Pengaturan template hadiah berhasil disimpan.',
  };
}

export async function sendPlayerGift(
  rawPayload: unknown,
  operator: string
): Promise<{ ok: boolean; deliveredCount: number; message: string }> {
  const parsed = sendGiftPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const firstErr = parsed.error.issues[0]?.message || 'Data gift tidak valid.';
    throw new GiftError(400, firstErr);
  }

  const payload: SendGiftPayload = parsed.data;
  const accDb = pool(config.ACCOUNT_DB);
  const gameDb = pool(config.GAME_DB);
  const settings = await readGiftSettings();

  // 1. Resolve item name
  let itemName = payload.item_name || '';
  if (!itemName) {
    const nameMap = await itemNames([payload.item_id]);
    itemName = nameMap[String(payload.item_id)] || `Item #${payload.item_id}`;
  }

  const senderName = payload.sender_name || settings.default_sender_name || 'Game Master';
  const mailTitle = payload.title || settings.default_mail_title || '[Hadiah GM] Hadiah Spesial';
  const mailContent = payload.content || settings.default_mail_content || 'Selamat! Kamu menerima hadiah item dari Game Master.';

  let recipients: Array<{ id: number; given_name: string }> = [];

  // 2. Resolve recipients based on target_type
  if (payload.target_type === 'character') {
    const query = payload.target_query!.trim();
    const isNum = /^\d+$/.test(query);

    const charRes = await gameDb.query<{ id: number; given_name: string }>(
      isNum
        ? `SELECT id, given_name FROM public.player_characters WHERE id = $1 OR LOWER(given_name) = LOWER($2) LIMIT 1`
        : `SELECT id, given_name FROM public.player_characters WHERE LOWER(given_name) = LOWER($1) LIMIT 1`,
      isNum ? [parseInt(query, 10), query] : [query]
    );

    if (!charRes.rows.length) {
      throw new GiftError(404, `Karakter dengan nama atau ID "${query}" tidak ditemukan.`);
    }

    recipients = charRes.rows;
  } else if (payload.target_type === 'online') {
    const active = await getActivePlayers();
    if (!active.characters || active.characters.length === 0) {
      throw new GiftError(400, 'Saat ini tidak ada pemain yang sedang online.');
    }

    const charRes = await gameDb.query<{ id: number; given_name: string }>(
      `SELECT id, given_name FROM public.player_characters WHERE given_name = ANY($1::text[])`,
      [active.characters]
    );

    recipients = charRes.rows;
    if (!recipients.length) {
      throw new GiftError(400, 'Karakter pemain online tidak ditemukan di database.');
    }
  } else if (payload.target_type === 'all') {
    // Deliver to top character of all active accounts
    const charRes = await gameDb.query<{ id: number; given_name: string }>(
      `SELECT DISTINCT ON (account_id) id, given_name
       FROM public.player_characters
       ORDER BY account_id, level DESC, id ASC`
    );
    recipients = charRes.rows;
    if (!recipients.length) {
      throw new GiftError(400, 'Tidak ada karakter terdaftar di server.');
    }
  }

  // 3. Dispatch mails
  let deliveredCount = 0;
  for (const r of recipients) {
    try {
      await sendCharacterMail(gameDb, {
        receiverCharId: r.id,
        senderName,
        title: mailTitle,
        content: mailContent,
        itemId: payload.item_id,
        itemCount: payload.item_count,
        isBound: payload.is_bound,
        gold: payload.gold,
      });
      deliveredCount++;
    } catch (e) {
      console.error(`[Gift] Gagal mengirim item ke ${r.given_name} (${r.id}):`, e);
    }
  }

  // 4. Batch flush if sending to multiple
  if (recipients.length > 1) {
    try {
      await triggerMailQueue(0);
    } catch (e) {
      console.warn('[Gift] Gagal flush mail queue:', e);
    }
  }

  // 5. In-game broadcast announcement if requested
  if (payload.announce && deliveredCount > 0) {
    try {
      let defaultAnnounceText = '';
      if (payload.target_type === 'character') {
        defaultAnnounceText = `[Hadiah GM] Karakter ${recipients[0].given_name} telah menerima hadiah ${itemName}!`;
      } else if (payload.target_type === 'online') {
        defaultAnnounceText = `[Hadiah GM] Hadiah ${itemName} telah dikirimkan ke kotak surat seluruh pemain online!`;
      } else {
        defaultAnnounceText = `[Pengumuman Server] Hadiah spesial ${itemName} telah dikirimkan ke kotak surat karakter!`;
      }

      const broadcastText = payload.announce_message || defaultAnnounceText;
      await sendAnnounce(broadcastText);
    } catch (e) {
      console.warn('[Gift] Gagal broadcast announcement:', e);
    }
  }

  // 6. Record to dashboard.gift_history
  const targetName =
    payload.target_type === 'character'
      ? recipients[0]?.given_name || payload.target_query!
      : payload.target_type === 'online'
      ? `Semua Pemain Online (${deliveredCount} pemain)`
      : `Semua Karakter (${deliveredCount} karakter)`;

  await accDb.query(
    `INSERT INTO dashboard.gift_history (
       operator, target_type, target_name, char_id, item_id, item_name,
       item_count, is_bound, gold, title, content, announced, delivered_count
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10, $11, $12, $13
     )`,
    [
      operator,
      payload.target_type,
      targetName,
      payload.target_type === 'character' ? recipients[0]?.id : null,
      payload.item_id,
      itemName,
      payload.item_count,
      payload.is_bound,
      payload.gold,
      mailTitle,
      mailContent,
      payload.announce,
      deliveredCount,
    ]
  );

  const summaryMsg =
    payload.target_type === 'character'
      ? `Hadiah ${itemName} (x${payload.item_count}) berhasil dikirimkan ke kotak surat ${recipients[0]?.given_name}.`
      : `Hadiah ${itemName} (x${payload.item_count}) berhasil dikirimkan ke ${deliveredCount} karakter in-game.`;

  return {
    ok: true,
    deliveredCount,
    message: summaryMsg,
  };
}

export async function readGiftHistory(limit = 50): Promise<GiftHistoryEntry[]> {
  const accDb = pool(config.ACCOUNT_DB);
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const res = await accDb.query<GiftHistoryEntry>(
    `SELECT
       id, operator, target_type, target_name, char_id,
       item_id, item_name, item_count, is_bound, gold,
       title, content, announced, delivered_count,
       created_at::text
     FROM dashboard.gift_history
     ORDER BY id DESC
     LIMIT $1`,
    [safeLimit]
  );
  return res.rows;
}
