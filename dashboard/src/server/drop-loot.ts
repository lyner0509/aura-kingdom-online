import { config } from './config.js';
import { pool } from './database.js';
import {
  computeEffectiveDropRates,
  revisionForDropLoot,
  updateDropLootSchema,
  type DropLootHistoryEntry,
  type DropLootSettings,
  type EffectiveDropRates,
  type UpdateDropLootInput,
} from './drop-loot-model.js';

export class DropLootError extends Error {
  public status: number;
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'DropLootError';
    this.status = statusCode;
  }
}

export type DropLootData = {
  settings: DropLootSettings;
  effectiveRates: EffectiveDropRates;
  revision: string;
  history: DropLootHistoryEntry[];
  readOnly: boolean;
};

import { sendZoneServerCommand } from './zone-command.js';
export { sendZoneServerCommand };

export async function applyDropRatesToZoneServer(rates: {
  drop_rate: number;
  gold_rate: number;
  broadcastMessage?: string | null;
}): Promise<{ success: boolean; applied: string[]; message: string }> {
  if (config.NODE_ENV === 'development' && process.env.ZONE_CGI_MOCK) {
    return {
      success: true,
      applied: ['drop', 'gold'],
      message: 'ZoneServer CGI (Mock development) berhasil diperbarui.',
    };
  }

  const applied: string[] = [];
  const errors: string[] = [];

  // 1. Monster / Loot Drop Rate
  try {
    const res = await sendZoneServerCommand(`set_node_drop 0 ${rates.drop_rate}`);
    if (res.includes('DONE')) applied.push(`Drop Rate: ${rates.drop_rate}%`);
    else errors.push(`set_node_drop: ${res}`);
  } catch (e) {
    errors.push(`set_node_drop: ${(e as Error).message}`);
  }

  // 2. Gold Loot Rate
  try {
    const res = await sendZoneServerCommand(`set_node_gold 0 ${rates.gold_rate}`);
    if (res.includes('DONE')) applied.push(`Gold Loot: ${rates.gold_rate}%`);
    else errors.push(`set_node_gold: ${res}`);
  } catch (e) {
    errors.push(`set_node_gold: ${(e as Error).message}`);
  }

  // 3. Optional Broadcast
  if (rates.broadcastMessage) {
    try {
      await sendZoneServerCommand(`announce ${rates.broadcastMessage}`);
      applied.push('Pengumuman server');
    } catch {
      // Non-critical
    }
  }

  if (errors.length === 0) {
    return {
      success: true,
      applied,
      message: `Berhasil diterapkan ke ZoneServer live: ${applied.join(', ')}.`,
    };
  }

  if (applied.length > 0) {
    return {
      success: true,
      applied,
      message: `Diterapkan sebagian (${applied.join(', ')}). Peringatan: ${errors.join('; ')}`,
    };
  }

  return {
    success: false,
    applied: [],
    message: `Sebagian atau seluruh perintah gagal: ${errors.join('; ')}`,
  };
}

export async function readDropLoot(): Promise<DropLootData> {
  const db = pool(config.ACCOUNT_DB);

  let result = await db.query<DropLootSettings>(
    `SELECT
       id, drop_rate, boss_drop_rate, dungeon_drop_rate, quest_drop_rate, gold_drop_rate,
       extra_loot_chance, rare_drop_rate,
       is_event_active, event_name,
       event_start::text, event_end::text,
       event_drop_rate, event_boss_drop_rate, event_dungeon_drop_rate,
       event_quest_drop_rate, event_gold_drop_rate, event_extra_loot_chance, event_rare_drop_rate,
       broadcast_event,
       updated_at::text, updated_by,
       last_applied_at::text, last_applied_status
     FROM dashboard.drop_loot_settings
     WHERE id = 1`
  );

  if (!result.rows.length) {
    await db.query(
      `INSERT INTO dashboard.drop_loot_settings (
         id, drop_rate, boss_drop_rate, dungeon_drop_rate, quest_drop_rate, gold_drop_rate, extra_loot_chance, rare_drop_rate
       ) VALUES (1, 100, 100, 100, 100, 100, 0, 100)
       ON CONFLICT (id) DO NOTHING`
    );
    result = await db.query<DropLootSettings>(
      `SELECT
         id, drop_rate, boss_drop_rate, dungeon_drop_rate, quest_drop_rate, gold_drop_rate,
         extra_loot_chance, rare_drop_rate,
         is_event_active, event_name,
         event_start::text, event_end::text,
         event_drop_rate, event_boss_drop_rate, event_dungeon_drop_rate,
         event_quest_drop_rate, event_gold_drop_rate, event_extra_loot_chance, event_rare_drop_rate,
         broadcast_event,
         updated_at::text, updated_by,
         last_applied_at::text, last_applied_status
       FROM dashboard.drop_loot_settings
       WHERE id = 1`
    );
  }

  const settings = result.rows[0];
  const effectiveRates = computeEffectiveDropRates(settings);
  const revision = revisionForDropLoot(settings);

  const historyResult = await db.query<DropLootHistoryEntry>(
    `SELECT
       id::text, operator, action,
       drop_rate, boss_drop_rate, dungeon_drop_rate, gold_drop_rate, extra_loot_chance, rare_drop_rate,
       is_event_active, event_name, applied_to_server,
       note, created_at::text
     FROM dashboard.drop_loot_history
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

export async function saveDropLoot(
  rawInput: unknown,
  operator: string
): Promise<{ ok: boolean; revision: string; effectiveRates: EffectiveDropRates; applied: boolean; message: string }> {
  const parsed = updateDropLootSchema.safeParse(rawInput);
  if (!parsed.success) {
    const errorMsg = Object.entries(parsed.error.flatten().fieldErrors)
      .map(([k, v]) => `${k}: ${v?.join(', ')}`)
      .join('; ');
    throw new DropLootError(400, `Parameter tidak valid: ${errorMsg}`);
  }

  const input: UpdateDropLootInput = parsed.data;
  const db = pool(config.ACCOUNT_DB);

  // Optimistic concurrency check
  const current = await readDropLoot();
  if (current.revision !== input.revision) {
    throw new DropLootError(409, 'Konfigurasi telah diubah oleh operator lain. Silakan muat ulang data.');
  }

  const startDate = input.event_start ? new Date(input.event_start).toISOString() : null;
  const endDate = input.event_end ? new Date(input.event_end).toISOString() : null;

  await db.query(
    `UPDATE dashboard.drop_loot_settings
     SET drop_rate = $1,
         boss_drop_rate = $2,
         dungeon_drop_rate = $3,
         quest_drop_rate = $4,
         gold_drop_rate = $5,
         extra_loot_chance = $6,
         rare_drop_rate = $7,
         is_event_active = $8,
         event_name = $9,
         event_start = $10,
         event_end = $11,
         event_drop_rate = $12,
         event_boss_drop_rate = $13,
         event_dungeon_drop_rate = $14,
         event_quest_drop_rate = $15,
         event_gold_drop_rate = $16,
         event_extra_loot_chance = $17,
         event_rare_drop_rate = $18,
         broadcast_event = $19,
         updated_at = NOW(),
         updated_by = $20
     WHERE id = 1`,
    [
      input.drop_rate,
      input.boss_drop_rate,
      input.dungeon_drop_rate,
      input.quest_drop_rate,
      input.gold_drop_rate,
      input.extra_loot_chance,
      input.rare_drop_rate,
      input.is_event_active,
      input.event_name?.trim() || null,
      startDate,
      endDate,
      input.event_drop_rate,
      input.event_boss_drop_rate,
      input.event_dungeon_drop_rate,
      input.event_quest_drop_rate,
      input.event_gold_drop_rate,
      input.event_extra_loot_chance,
      input.event_rare_drop_rate,
      input.broadcast_event,
      operator,
    ]
  );

  const updatedSettings: DropLootSettings = {
    ...current.settings,
    ...input,
    event_name: input.event_name?.trim() || null,
    event_start: startDate,
    event_end: endDate,
    updated_by: operator,
    updated_at: new Date().toISOString(),
  };

  const effectiveRates = computeEffectiveDropRates(updatedSettings);
  let appliedToServer = false;
  let serverMessage = 'Pengaturan Drop Loot berhasil disimpan di database.';

  if (input.apply_immediately) {
    const broadcastMsg =
      input.broadcast_event && effectiveRates.isEventEffective
        ? `[Server Event] ${effectiveRates.eventName || 'Drop Fever Event'} sedang berlangsung! Item Drop ${effectiveRates.drop_rate}%, Boss Drop ${effectiveRates.boss_drop_rate}%!`
        : null;

    const result = await applyDropRatesToZoneServer({
      drop_rate: effectiveRates.drop_rate,
      gold_rate: effectiveRates.gold_drop_rate,
      broadcastMessage: broadcastMsg,
    });

    appliedToServer = result.success;
    serverMessage = `Pengaturan tersimpan. ${result.message}`;

    await db.query(
      `UPDATE dashboard.drop_loot_settings
       SET last_applied_at = NOW(),
           last_applied_status = $1
       WHERE id = 1`,
      [serverMessage]
    );

    // Keep exp_bonus_settings drop_rate in sync
    try {
      await db.query(
        `UPDATE dashboard.exp_bonus_settings
         SET drop_rate = $1
         WHERE id = 1`,
        [effectiveRates.drop_rate]
      );
    } catch {
      // exp_bonus_settings might not exist in some environments
    }
  }

  // Audit history
  await db.query(
    `INSERT INTO dashboard.drop_loot_history
     (operator, action, drop_rate, boss_drop_rate, dungeon_drop_rate, gold_drop_rate, extra_loot_chance, rare_drop_rate, is_event_active, event_name, applied_to_server, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      operator,
      input.apply_immediately ? 'SAVE_AND_APPLY' : 'SAVE_SETTINGS',
      effectiveRates.drop_rate,
      effectiveRates.boss_drop_rate,
      effectiveRates.dungeon_drop_rate,
      effectiveRates.gold_drop_rate,
      effectiveRates.extra_loot_chance,
      effectiveRates.rare_drop_rate,
      input.is_event_active,
      input.event_name?.trim() || null,
      appliedToServer,
      serverMessage,
    ]
  );

  const newRevision = revisionForDropLoot(updatedSettings);
  return {
    ok: true,
    revision: newRevision,
    effectiveRates,
    applied: appliedToServer,
    message: serverMessage,
  };
}

export async function applyDropLootNow(
  operator: string
): Promise<{ ok: boolean; effectiveRates: EffectiveDropRates; applied: boolean; message: string }> {
  const current = await readDropLoot();
  const effectiveRates = current.effectiveRates;
  const db = pool(config.ACCOUNT_DB);

  const broadcastMsg =
    current.settings.broadcast_event && effectiveRates.isEventEffective
      ? `[Server Event] ${effectiveRates.eventName || 'Drop Fever Event'} sedang berlangsung! Item Drop ${effectiveRates.drop_rate}%, Boss Drop ${effectiveRates.boss_drop_rate}%!`
      : null;

  const result = await applyDropRatesToZoneServer({
    drop_rate: effectiveRates.drop_rate,
    gold_rate: effectiveRates.gold_drop_rate,
    broadcastMessage: broadcastMsg,
  });

  const serverMessage = result.message;

  await db.query(
    `UPDATE dashboard.drop_loot_settings
     SET last_applied_at = NOW(),
         last_applied_status = $1
     WHERE id = 1`,
    [serverMessage]
  );

  // Keep exp_bonus_settings drop_rate in sync
  try {
    await db.query(
      `UPDATE dashboard.exp_bonus_settings
       SET drop_rate = $1
       WHERE id = 1`,
      [effectiveRates.drop_rate]
    );
  } catch {
    // Non-critical
  }

  // Audit history
  await db.query(
    `INSERT INTO dashboard.drop_loot_history
     (operator, action, drop_rate, boss_drop_rate, dungeon_drop_rate, gold_drop_rate, extra_loot_chance, rare_drop_rate, is_event_active, event_name, applied_to_server, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      operator,
      'APPLY_NOW',
      effectiveRates.drop_rate,
      effectiveRates.boss_drop_rate,
      effectiveRates.dungeon_drop_rate,
      effectiveRates.gold_drop_rate,
      effectiveRates.extra_loot_chance,
      effectiveRates.rare_drop_rate,
      current.settings.is_event_active,
      current.settings.event_name,
      result.success,
      serverMessage,
    ]
  );

  return {
    ok: result.success,
    effectiveRates,
    applied: result.success,
    message: serverMessage,
  };
}
