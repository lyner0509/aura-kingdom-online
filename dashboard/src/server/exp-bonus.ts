import { Socket } from 'node:net';
import { config } from './config.js';
import { pool } from './database.js';
import {
  buildCgiPacket,
  computeEffectiveRates,
  revisionForExpBonus,
  updateExpBonusSchema,
  type EffectiveRates,
  type ExpBonusHistoryEntry,
  type ExpBonusSettings,
  type UpdateExpBonusInput,
} from './exp-bonus-model.js';

export class ExpBonusError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ExpBonusError';
  }
}

export type ExpBonusData = {
  settings: ExpBonusSettings;
  effectiveRates: EffectiveRates;
  revision: string;
  history: ExpBonusHistoryEntry[];
  readOnly: boolean;
};

export async function sendZoneServerCommand(cmd: string, timeoutMs: number = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let settled = false;
    let received = Buffer.alloc(0);

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    const finish = (err: Error | null, res?: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (err) reject(err);
      else resolve(res ?? '');
    };

    socket.setTimeout(timeoutMs);

    socket.on('timeout', () => {
      finish(new Error(`Koneksi ke ZoneServer CGI (${config.ZONE_CGI_HOST}:${config.ZONE_CGI_PORT}) timeout.`));
    });

    socket.on('error', (err) => {
      finish(new Error(`Gagal menghubungi ZoneServer CGI: ${err.message}`));
    });

    socket.on('data', (chunk) => {
      received = Buffer.concat([received, chunk]);
      // Response format: uint16 payloadLen + uint16 strLen + string
      if (received.length >= 4) {
        const strLen = received.readUInt16LE(2);
        if (received.length >= 4 + strLen) {
          const respText = received.toString('latin1', 4, 4 + strLen);
          finish(null, respText);
        }
      }
    });

    socket.on('close', () => {
      if (!settled) {
        if (received.length >= 4) {
          const strLen = received.readUInt16LE(2);
          const respText = received.toString('latin1', 4, Math.min(received.length, 4 + strLen));
          finish(null, respText);
        } else {
          finish(new Error('Koneksi ZoneServer ditutup sebelum menerima respons lengkap.'));
        }
      }
    });

    socket.connect(config.ZONE_CGI_PORT, config.ZONE_CGI_HOST, () => {
      const packet = buildCgiPacket(config.ZONE_CGI_KEY, cmd);
      socket.write(packet);
    });
  });
}

export async function applyRatesToZoneServer(rates: {
  exp_rate: number;
  drop_rate: number;
  gold_rate: number;
  np_rate: number;
  broadcastMessage?: string | null;
}): Promise<{ success: boolean; applied: string[]; message: string }> {
  if (config.NODE_ENV === 'development' && process.env.ZONE_CGI_MOCK) {
    return {
      success: true,
      applied: ['exp', 'drop', 'gold', 'np'],
      message: 'ZoneServer CGI (Mock development) berhasil diperbarui.',
    };
  }

  const applied: string[] = [];
  const errors: string[] = [];

  // 1. Monster EXP
  try {
    const res = await sendZoneServerCommand(`set_node_exp 0 ${rates.exp_rate}`);
    if (res.includes('DONE')) applied.push(`EXP: ${rates.exp_rate}%`);
    else errors.push(`set_node_exp: ${res}`);
  } catch (e) {
    errors.push(`set_node_exp: ${(e as Error).message}`);
  }

  // 2. Drop Rate
  try {
    const res = await sendZoneServerCommand(`set_node_drop 0 ${rates.drop_rate}`);
    if (res.includes('DONE')) applied.push(`Drop: ${rates.drop_rate}%`);
    else errors.push(`set_node_drop: ${res}`);
  } catch (e) {
    errors.push(`set_node_drop: ${(e as Error).message}`);
  }

  // 3. Gold Rate
  try {
    const res = await sendZoneServerCommand(`set_node_gold 0 ${rates.gold_rate}`);
    if (res.includes('DONE')) applied.push(`Gold: ${rates.gold_rate}%`);
    else errors.push(`set_node_gold: ${res}`);
  } catch (e) {
    errors.push(`set_node_gold: ${(e as Error).message}`);
  }

  // 4. Loyalty / NP Rate
  try {
    const res = await sendZoneServerCommand(`set_node_np 0 ${rates.np_rate}`);
    if (res.includes('DONE')) applied.push(`Loyalty: ${rates.np_rate}%`);
    else errors.push(`set_node_np: ${res}`);
  } catch (e) {
    errors.push(`set_node_np: ${(e as Error).message}`);
  }

  // 5. In-game Announcement broadcast if provided
  if (rates.broadcastMessage) {
    try {
      await sendZoneServerCommand(`announce ${rates.broadcastMessage}`);
      applied.push('Pengumuman in-game');
    } catch {
      // broadcast error is non-fatal
    }
  }

  if (errors.length === 0) {
    return {
      success: true,
      applied,
      message: `Semua rate berhasil diterapkan ke ZoneServer (${applied.join(', ')}).`,
    };
  }

  return {
    success: applied.length > 0,
    applied,
    message: `Sebagian atau seluruh perintah gagal: ${errors.join('; ')}`,
  };
}

export async function readExpBonus(): Promise<ExpBonusData> {
  const db = pool(config.ACCOUNT_DB);

  let result = await db.query<ExpBonusSettings>(
    `SELECT
       id, exp_rate, quest_exp_rate, drop_rate, gold_rate, np_rate,
       is_event_active, event_name,
       event_start::text, event_end::text,
       event_exp_rate, event_quest_exp_rate, event_drop_rate, event_gold_rate, event_np_rate,
       broadcast_event,
       updated_at::text, updated_by,
       last_applied_at::text, last_applied_status
     FROM dashboard.exp_bonus_settings
     WHERE id = 1`
  );

  if (!result.rows.length) {
    await db.query(
      `INSERT INTO dashboard.exp_bonus_settings (id, exp_rate, quest_exp_rate, drop_rate, gold_rate, np_rate)
       VALUES (1, 100, 100, 100, 100, 100)
       ON CONFLICT (id) DO NOTHING`
    );
    result = await db.query<ExpBonusSettings>(
      `SELECT
         id, exp_rate, quest_exp_rate, drop_rate, gold_rate, np_rate,
         is_event_active, event_name,
         event_start::text, event_end::text,
         event_exp_rate, event_quest_exp_rate, event_drop_rate, event_gold_rate, event_np_rate,
         broadcast_event,
         updated_at::text, updated_by,
         last_applied_at::text, last_applied_status
       FROM dashboard.exp_bonus_settings
       WHERE id = 1`
    );
  }

  const settings = result.rows[0];
  const effectiveRates = computeEffectiveRates(settings);
  const revision = revisionForExpBonus(settings);

  const historyResult = await db.query<{
    id: string;
    operator: string;
    action: string;
    exp_rate: number;
    drop_rate: number;
    gold_rate: number;
    np_rate: number;
    is_event_active: boolean;
    event_name: string | null;
    applied_to_server: boolean;
    note: string | null;
    created_at: string;
  }>(
    `SELECT
       id::text, operator, action,
       exp_rate, drop_rate, gold_rate, np_rate,
       is_event_active, event_name, applied_to_server,
       note, created_at::text
     FROM dashboard.exp_bonus_history
     ORDER BY created_at DESC
     LIMIT 40`
  );

  return {
    settings,
    effectiveRates,
    revision,
    history: historyResult.rows,
    readOnly: false,
  };
}

export async function saveExpBonus(
  rawInput: unknown,
  operator: string
): Promise<{ ok: boolean; revision: string; effectiveRates: EffectiveRates; applied: boolean; message: string }> {
  const parsed = updateExpBonusSchema.safeParse(rawInput);
  if (!parsed.success) {
    const errorMsg = Object.entries(parsed.error.flatten().fieldErrors)
      .map(([k, v]) => `${k}: ${v?.join(', ')}`)
      .join('; ');
    throw new ExpBonusError(400, `Parameter tidak valid: ${errorMsg}`);
  }

  const input: UpdateExpBonusInput = parsed.data;
  const db = pool(config.ACCOUNT_DB);

  // Optimistic concurrency check
  const current = await readExpBonus();
  if (current.revision !== input.revision) {
    throw new ExpBonusError(409, 'Konfigurasi telah diubah oleh operator lain. Silakan muat ulang data.');
  }

  const startDate = input.event_start ? new Date(input.event_start).toISOString() : null;
  const endDate = input.event_end ? new Date(input.event_end).toISOString() : null;

  await db.query(
    `UPDATE dashboard.exp_bonus_settings
     SET exp_rate = $1,
         quest_exp_rate = $2,
         drop_rate = $3,
         gold_rate = $4,
         np_rate = $5,
         is_event_active = $6,
         event_name = $7,
         event_start = $8,
         event_end = $9,
         event_exp_rate = $10,
         event_quest_exp_rate = $11,
         event_drop_rate = $12,
         event_gold_rate = $13,
         event_np_rate = $14,
         broadcast_event = $15,
         updated_at = NOW(),
         updated_by = $16
     WHERE id = 1`,
    [
      input.exp_rate,
      input.quest_exp_rate,
      input.drop_rate,
      input.gold_rate,
      input.np_rate,
      input.is_event_active,
      input.event_name?.trim() || null,
      startDate,
      endDate,
      input.event_exp_rate,
      input.event_quest_exp_rate,
      input.event_drop_rate,
      input.event_gold_rate,
      input.event_np_rate,
      input.broadcast_event,
      operator,
    ]
  );

  const updatedSettings: ExpBonusSettings = {
    ...current.settings,
    ...input,
    event_name: input.event_name?.trim() || null,
    event_start: startDate,
    event_end: endDate,
    updated_by: operator,
    updated_at: new Date().toISOString(),
  };

  const effectiveRates = computeEffectiveRates(updatedSettings);
  let appliedToServer = false;
  let serverMessage = 'Pengaturan berhasil disimpan di database.';

  if (input.apply_immediately) {
    const broadcastMsg =
      input.broadcast_event && effectiveRates.isEventEffective
        ? `[Server Event] ${effectiveRates.eventName || 'Event Boost'} sedang berlangsung! EXP ${effectiveRates.exp_rate}%, Drop ${effectiveRates.drop_rate}%!`
        : null;

    const result = await applyRatesToZoneServer({
      exp_rate: effectiveRates.exp_rate,
      drop_rate: effectiveRates.drop_rate,
      gold_rate: effectiveRates.gold_rate,
      np_rate: effectiveRates.np_rate,
      broadcastMessage: broadcastMsg,
    });

    appliedToServer = result.success;
    serverMessage = `Pengaturan tersimpan. ${result.message}`;

    await db.query(
      `UPDATE dashboard.exp_bonus_settings
       SET last_applied_at = NOW(),
           last_applied_status = $1
       WHERE id = 1`,
      [serverMessage]
    );
  }

  // Audit history
  await db.query(
    `INSERT INTO dashboard.exp_bonus_history
     (operator, action, exp_rate, drop_rate, gold_rate, np_rate, is_event_active, event_name, applied_to_server, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      operator,
      input.apply_immediately ? 'SAVE_AND_APPLY' : 'SAVE_SETTINGS',
      effectiveRates.exp_rate,
      effectiveRates.drop_rate,
      effectiveRates.gold_rate,
      effectiveRates.np_rate,
      input.is_event_active,
      input.event_name?.trim() || null,
      appliedToServer,
      serverMessage,
    ]
  );

  const newRevision = revisionForExpBonus(updatedSettings);
  return {
    ok: true,
    revision: newRevision,
    effectiveRates,
    applied: appliedToServer,
    message: serverMessage,
  };
}

export async function applyExpBonusNow(
  operator: string
): Promise<{ ok: boolean; effectiveRates: EffectiveRates; applied: boolean; message: string }> {
  const current = await readExpBonus();
  const effectiveRates = current.effectiveRates;
  const db = pool(config.ACCOUNT_DB);

  const broadcastMsg =
    current.settings.broadcast_event && effectiveRates.isEventEffective
      ? `[Server Event] ${effectiveRates.eventName || 'Event Boost'} sedang berlangsung! EXP ${effectiveRates.exp_rate}%, Drop ${effectiveRates.drop_rate}%!`
      : null;

  const result = await applyRatesToZoneServer({
    exp_rate: effectiveRates.exp_rate,
    drop_rate: effectiveRates.drop_rate,
    gold_rate: effectiveRates.gold_rate,
    np_rate: effectiveRates.np_rate,
    broadcastMessage: broadcastMsg,
  });

  const statusMsg = `Terapkan manual oleh ${operator}: ${result.message}`;

  await db.query(
    `UPDATE dashboard.exp_bonus_settings
     SET last_applied_at = NOW(),
         last_applied_status = $1
     WHERE id = 1`,
    [statusMsg]
  );

  await db.query(
    `INSERT INTO dashboard.exp_bonus_history
     (operator, action, exp_rate, drop_rate, gold_rate, np_rate, is_event_active, event_name, applied_to_server, note)
     VALUES ($1, 'MANUAL_APPLY', $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      operator,
      effectiveRates.exp_rate,
      effectiveRates.drop_rate,
      effectiveRates.gold_rate,
      effectiveRates.np_rate,
      current.settings.is_event_active,
      current.settings.event_name,
      result.success,
      statusMsg,
    ]
  );

  return {
    ok: true,
    effectiveRates,
    applied: result.success,
    message: result.message,
  };
}
