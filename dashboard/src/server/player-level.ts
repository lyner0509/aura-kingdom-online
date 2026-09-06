import { config } from './config.js';
import { pool } from './database.js';
import { getActivePlayersStrict } from './system.js';
import {
  assignPlayerLevelSchema,
  canWriteNow,
  cancelPlayerLevelSchema,
  checkLevelCap,
  describeChange,
  planFor,
  type AssignmentPlan,
  type PlayerLevelAssignment,
  type PlayerLevelData,
  type PlayerLevelHistoryEntry,
} from './player-level-model.js';

export class PlayerLevelError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type CharacterRow = { id: string; name: string; level: number; classId: number | null };

async function findCharacter(playerId: number): Promise<CharacterRow | null> {
  const res = await pool(config.GAME_DB).query<CharacterRow>(
    `select id::text as id, given_name as name, level, class_id as "classId"
       from player_characters
      where id = $1 and deleted_time = 0`,
    [playerId]
  );
  return res.rows[0] ?? null;
}

/**
 * Throws when the realm cannot be asked who is online. An empty set means
 * "nobody is connected"; a failure must never be allowed to read that way,
 * or the sweep would write levels underneath live players.
 */
async function onlineCharacterIds(): Promise<Set<number>> {
  const active = await getActivePlayersStrict();
  return new Set(active.characters ?? []);
}

/**
 * ZoneServer keeps a connected character in memory and flushes it to the
 * database about once a minute, so a row that was saved moments ago may
 * still be owned by a live session even when the character has dropped off
 * the online list. Waiting for the row to go quiet avoids racing that flush.
 */
const SETTLE_SECONDS = 90;

/** How long a written level must survive before it counts as applied. */
const VERIFY_SECONDS = 120;

/** Rewrites to attempt before giving up and asking the operator to look. */
const MAX_ATTEMPTS = 5;

async function secondsSinceLastSave(playerId: number): Promise<number | null> {
  const res = await pool(config.GAME_DB).query<{ age: number | null }>(
    `select extract(epoch from now())::bigint - nullif(last_saving_time, 0) as age
       from player_characters where id = $1`,
    [playerId]
  );
  const age = res.rows[0]?.age;
  return age === null || age === undefined ? null : Number(age);
}

/**
 * Writes the level into the game database.
 *
 * In Aura Kingdom the character level and the level of the class it is
 * currently playing are stored separately, so both move together or the
 * level snaps back the next time the class is loaded. The experience bar
 * is reset to the start of the new level.
 */
async function writeLevel(character: CharacterRow, targetLevel: number): Promise<{ classRowUpdated: boolean; hasClassRows: boolean }> {
  const db = pool(config.GAME_DB);
  const client = await db.connect();
  try {
    await client.query('begin');
    const core = await client.query(
      `update player_characters
          set level = $2, exp = 0, last_level_up_time = extract(epoch from now())::bigint
        where id = $1 and deleted_time = 0`,
      [Number(character.id), targetLevel]
    );
    if (!core.rowCount) {
      throw new PlayerLevelError(404, 'Karakter tidak ditemukan saat menulis level.');
    }
    const classRow = await client.query(
      `update player_classlist
          set level = $2
        where player_id = $1
          and class = (select class_id from player_characters where id = $1)`,
      [Number(character.id), targetLevel]
    );
    // Some builds keep no per-class rows at all; that is not a missing row.
    const anyClassRows = await client.query(
      'select 1 from player_classlist where player_id = $1 limit 1',
      [Number(character.id)]
    );
    await client.query('commit');
    return {
      classRowUpdated: (classRow.rowCount ?? 0) > 0,
      hasClassRows: (anyClassRows.rowCount ?? 0) > 0,
    };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function recordHistory(entry: {
  playerId: number;
  playerName: string;
  fromLevel: number | null;
  toLevel: number;
  action: string;
  operator: string;
  details: string;
}): Promise<void> {
  await pool(config.ACCOUNT_DB).query(
    `insert into dashboard.player_level_history
       (player_id, player_name, from_level, to_level, action, operator, details)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [entry.playerId, entry.playerName, entry.fromLevel, entry.toLevel, entry.action, entry.operator, entry.details]
  );
}

// Local preview has no Postgres behind it, so the page still renders
// with a shape that matches production.
const demoData: PlayerLevelData = {
  levelCap: 99,
  assignments: [
    {
      player_id: '10482', player_name: 'Astra Vale', target_level: 90, from_level: 78,
      status: 'pending', attempts: 0, last_error: null, requested_by: 'admin',
      requested_at: '2026-09-06T09:00:00.000Z', applied_at: null,
      online: true, current_level: 78,
    },
    {
      player_id: '10431', player_name: 'Corvin Ash', target_level: 60, from_level: 41,
      status: 'applied', attempts: 1, last_error: null, requested_by: 'admin',
      requested_at: '2026-09-06T08:10:00.000Z', applied_at: '2026-09-06T08:42:00.000Z',
      online: false, current_level: 60,
    },
  ],
  history: [
    {
      id: '2', player_id: '10431', player_name: 'Corvin Ash', from_level: 41, to_level: 60,
      action: 'applied', operator: 'admin', details: 'Naik dari level 41 ke 60',
      created_at: '2026-09-06T08:42:00.000Z',
    },
    {
      id: '1', player_id: '10482', player_name: 'Astra Vale', from_level: 78, to_level: 90,
      action: 'queued', operator: 'admin', details: 'Pemenang event',
      created_at: '2026-09-06T09:00:00.000Z',
    },
  ],
};

export async function readPlayerLevels(): Promise<PlayerLevelData> {
  if (config.NODE_ENV === 'development') return structuredClone(demoData);
  const accountDb = pool(config.ACCOUNT_DB);
  const [assignmentRes, historyRes, online] = await Promise.all([
    accountDb.query<PlayerLevelAssignment>(
      `select player_id::text as player_id, player_name, target_level, from_level, status,
              attempts, last_error, requested_by,
              requested_at::text as requested_at, applied_at::text as applied_at,
              written_at::text as written_at
         from dashboard.player_level_assignment
        order by case when status = 'pending' then 0 else 1 end, requested_at desc
        limit 200`
    ),
    accountDb.query<PlayerLevelHistoryEntry>(
      `select id::text as id, player_id::text as player_id, player_name, from_level, to_level,
              action, operator, details, created_at::text as created_at
         from dashboard.player_level_history
        order by created_at desc
        limit 100`
    ),
    onlineCharacterIds(),
  ]);

  // Current levels come from the game database so the operator sees what
  // the character actually is, not what it was when the row was written.
  const ids = assignmentRes.rows.map(row => Number(row.player_id)).filter(Number.isSafeInteger);
  const levels = new Map<number, number>();
  if (ids.length) {
    const levelRes = await pool(config.GAME_DB).query<{ id: string; level: number }>(
      `select id::text as id, level from player_characters where id = any($1::bigint[]) and deleted_time = 0`,
      [ids]
    );
    for (const row of levelRes.rows) levels.set(Number(row.id), row.level);
  }

  return {
    levelCap: config.PLAYER_LEVEL_CAP,
    assignments: assignmentRes.rows.map(row => ({
      ...row,
      online: online.has(Number(row.player_id)),
      current_level: levels.get(Number(row.player_id)) ?? null,
    })),
    history: historyRes.rows,
  };
}

export async function assignPlayerLevel(
  rawInput: unknown,
  operator: string
): Promise<{ ok: boolean; plan: AssignmentPlan; message: string; data: PlayerLevelData }> {
  const parsed = assignPlayerLevelSchema.safeParse(rawInput);
  if (!parsed.success) {
    const message = Object.entries(parsed.error.flatten().fieldErrors)
      .map(([field, errors]) => `${field}: ${errors?.join(', ')}`)
      .join('; ');
    throw new PlayerLevelError(400, `Parameter tidak valid: ${message}`);
  }
  const input = parsed.data;

  if (config.NODE_ENV === 'development') {
    throw new PlayerLevelError(403, 'Preview lokal tidak menulis level ke game.');
  }

  const capError = checkLevelCap(input.target_level, config.PLAYER_LEVEL_CAP);
  if (capError) throw new PlayerLevelError(400, capError);

  const character = await findCharacter(input.player_id);
  if (!character) throw new PlayerLevelError(404, 'Karakter tidak ditemukan.');

  // If the realm cannot be asked, queue rather than guess: the sweep will
  // pick it up once the answer is available again.
  const online = await onlineCharacterIds()
    .then(ids => ids.has(input.player_id))
    .catch(() => true);
  const plan = planFor({ online, currentLevel: character.level, targetLevel: input.target_level });

  if (plan.action === 'noop') {
    throw new PlayerLevelError(400, plan.reason);
  }

  const accountDb = pool(config.ACCOUNT_DB);
  await accountDb.query(
    `insert into dashboard.player_level_assignment
       (player_id, player_name, target_level, from_level, status, attempts, last_error, requested_by, requested_at, applied_at)
     values ($1, $2, $3, $4, 'pending', 0, null, $5, now(), null)
     on conflict (player_id) do update
        set player_name  = excluded.player_name,
            target_level = excluded.target_level,
            from_level   = excluded.from_level,
            status       = 'pending',
            attempts     = 0,
            last_error   = null,
            requested_by = excluded.requested_by,
            requested_at = now(),
            applied_at   = null,
            written_at   = null`,
    [input.player_id, character.name, input.target_level, character.level, operator]
  );

  let message = plan.reason;
  if (plan.action === 'apply-now') {
    const applied = await applyAssignment(input.player_id, operator, input.note);
    message = applied.message;
  } else {
    await recordHistory({
      playerId: input.player_id,
      playerName: character.name,
      fromLevel: character.level,
      toLevel: input.target_level,
      action: 'queued',
      operator,
      details: input.note?.trim() || describeChange(character.level, input.target_level),
    });
  }

  return { ok: true, plan, message, data: await readPlayerLevels() };
}

/**
 * Applies one pending assignment. Shared by the immediate path and the
 * background sweep, so both leave exactly the same trail.
 */
/**
 * Writes one pending assignment, if it is safe to do so right now.
 *
 * The row is not marked applied here. ZoneServer can flush a character it
 * still holds over the top of our write, which is exactly how an
 * assignment once reported success while the game showed the old level.
 * Instead the write is stamped and a later sweep reads the level back;
 * only a level that survived that wait counts as applied.
 */
async function applyAssignment(
  playerId: number,
  operator: string,
  note?: string
): Promise<{ ok: boolean; message: string }> {
  const accountDb = pool(config.ACCOUNT_DB);
  const pending = await accountDb.query<{ target_level: number; from_level: number | null; player_name: string; attempts: number }>(
    `select target_level, from_level, player_name, attempts
       from dashboard.player_level_assignment
      where player_id = $1 and status = 'pending'`,
    [playerId]
  );
  const row = pending.rows[0];
  if (!row) return { ok: false, message: 'Tidak ada penugasan tertunda untuk karakter ini.' };

  const character = await findCharacter(playerId);
  if (!character) {
    await accountDb.query(
      `update dashboard.player_level_assignment
          set status = 'failed', attempts = attempts + 1, last_error = $2
        where player_id = $1`,
      [playerId, 'Karakter tidak ditemukan.']
    );
    return { ok: false, message: 'Karakter tidak ditemukan.' };
  }

  // Checked again here, as close to the write as possible: the character may
  // have logged in since the sweep read the online list.
  let onlineKnown = true;
  let online = false;
  try {
    online = (await onlineCharacterIds()).has(playerId);
  } catch {
    onlineKnown = false;
  }
  const settled = await secondsSinceLastSave(playerId);
  const permission = canWriteNow({
    onlineKnown,
    online,
    secondsSinceSave: settled,
    settleSeconds: SETTLE_SECONDS,
  });
  if (!permission.ok) {
    return { ok: false, message: `${permission.reason} Penugasan tetap menunggu.` };
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    await accountDb.query(
      `update dashboard.player_level_assignment
          set status = 'failed', last_error = $2
        where player_id = $1`,
      [playerId, `Level ditulis ${row.attempts} kali tetapi selalu kembali ke nilai lama.`]
    );
    return {
      ok: false,
      message: `Level untuk ${character.name} ditulis ${row.attempts} kali dan selalu ditimpa server. Penugasan ditandai gagal.`,
    };
  }

  try {
    const { classRowUpdated, hasClassRows } = await writeLevel(character, row.target_level);
    await accountDb.query(
      `update dashboard.player_level_assignment
          set attempts = attempts + 1, last_error = null, written_at = now(),
              from_level = coalesce(from_level, $2), note = coalesce($3, note)
        where player_id = $1`,
      [playerId, character.level, note?.trim() || null]
    );
    const classNote = !hasClassRows || classRowUpdated
      ? null
      : 'Catatan: baris class aktif tidak ditemukan di player_classlist.';
    return {
      ok: true,
      message: [
        `Level ${row.target_level} ditulis untuk ${character.name}.`,
        `Dashboard membacanya ulang dalam ~${Math.round(VERIFY_SECONDS / 60)} menit sebelum menandainya diterapkan.`,
        classNote,
      ].filter(Boolean).join(' '),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Kesalahan tidak dikenal.';
    await accountDb.query(
      `update dashboard.player_level_assignment
          set status = 'failed', attempts = attempts + 1, last_error = $2
        where player_id = $1`,
      [playerId, reason.slice(0, 500)]
    );
    throw error instanceof PlayerLevelError
      ? error
      : new PlayerLevelError(500, `Gagal menulis level: ${reason}`);
  }
}

/**
 * Reads back a level that was written earlier. A level that stuck is
 * finally recorded as applied; one that was overwritten goes back in the
 * queue to be written again.
 */
async function verifyAssignment(
  playerId: number,
  operator: string
): Promise<'applied' | 'reverted' | 'waiting'> {
  const accountDb = pool(config.ACCOUNT_DB);
  const res = await accountDb.query<{ target_level: number; from_level: number | null; player_name: string; note: string | null; age: number }>(
    `select target_level, from_level, player_name, note,
            extract(epoch from now() - written_at)::int as age
       from dashboard.player_level_assignment
      where player_id = $1 and status = 'pending' and written_at is not null`,
    [playerId]
  );
  const row = res.rows[0];
  if (!row) return 'waiting';
  if (row.age < VERIFY_SECONDS) return 'waiting';

  const character = await findCharacter(playerId);
  if (!character) return 'waiting';

  if (character.level === row.target_level) {
    await accountDb.query(
      `update dashboard.player_level_assignment
          set status = 'applied', applied_at = now(), last_error = null
        where player_id = $1`,
      [playerId]
    );
    await recordHistory({
      playerId,
      playerName: character.name,
      fromLevel: row.from_level,
      toLevel: row.target_level,
      action: 'applied',
      operator,
      details: row.note?.trim() || describeChange(row.from_level, row.target_level),
    });
    return 'applied';
  }

  // The realm wrote its own value back over ours. Queue another attempt.
  await accountDb.query(
    `update dashboard.player_level_assignment
        set written_at = null,
            last_error = $2
      where player_id = $1`,
    [playerId, `Level kembali ke ${character.level} setelah ditulis; server menimpanya. Akan dicoba lagi.`]
  );
  return 'reverted';
}

export async function retryPlayerLevel(
  rawInput: unknown,
  operator: string
): Promise<{ ok: boolean; message: string; data: PlayerLevelData }> {
  const parsed = cancelPlayerLevelSchema.safeParse(rawInput);
  if (!parsed.success) throw new PlayerLevelError(400, 'Player ID tidak valid.');
  const playerId = parsed.data.player_id;

  if (config.NODE_ENV === 'development') {
    throw new PlayerLevelError(403, 'Preview lokal tidak menulis level ke game.');
  }

  await pool(config.ACCOUNT_DB).query(
    `update dashboard.player_level_assignment
        set status = 'pending', last_error = null, written_at = null, attempts = 0
      where player_id = $1 and status = 'failed'`,
    [playerId]
  );

  if ((await onlineCharacterIds()).has(playerId)) {
    return {
      ok: true,
      message: 'Karakter sedang online. Penugasan kembali menunggu dan akan diterapkan setelah logout.',
      data: await readPlayerLevels(),
    };
  }
  const applied = await applyAssignment(playerId, operator);
  return { ok: applied.ok, message: applied.message, data: await readPlayerLevels() };
}

export async function cancelPlayerLevel(
  rawInput: unknown,
  operator: string
): Promise<{ ok: boolean; message: string; data: PlayerLevelData }> {
  const parsed = cancelPlayerLevelSchema.safeParse(rawInput);
  if (!parsed.success) throw new PlayerLevelError(400, 'Player ID tidak valid.');
  const playerId = parsed.data.player_id;

  if (config.NODE_ENV === 'development') {
    throw new PlayerLevelError(403, 'Preview lokal tidak menulis level ke game.');
  }

  const res = await pool(config.ACCOUNT_DB).query<{ player_name: string; target_level: number; from_level: number | null }>(
    `update dashboard.player_level_assignment
        set status = 'cancelled'
      where player_id = $1 and status in ('pending', 'failed')
      returning player_name, target_level, from_level`,
    [playerId]
  );
  const row = res.rows[0];
  if (!row) {
    throw new PlayerLevelError(404, 'Tidak ada penugasan tertunda yang bisa dibatalkan.');
  }
  await recordHistory({
    playerId,
    playerName: row.player_name,
    fromLevel: row.from_level,
    toLevel: row.target_level,
    action: 'cancelled',
    operator,
    details: `Penugasan ke level ${row.target_level} dibatalkan sebelum diterapkan.`,
  });
  return {
    ok: true,
    message: `Penugasan level untuk ${row.player_name} dibatalkan.`,
    data: await readPlayerLevels(),
  };
}

/**
 * Applies every pending assignment whose character is no longer online.
 * Runs on a timer inside the service; one process owns the schedule, so
 * two sweeps never race for the same row.
 */
export async function sweepPendingLevels(): Promise<{ written: number; applied: number; failed: number; skipped: number }> {
  const accountDb = pool(config.ACCOUNT_DB);
  const pending = await accountDb.query<{ player_id: string; requested_by: string; written: boolean }>(
    `select player_id::text as player_id, requested_by, written_at is not null as written
       from dashboard.player_level_assignment
      where status = 'pending'
      order by requested_at
      limit 50`
  );
  if (!pending.rowCount) return { written: 0, applied: 0, failed: 0, skipped: 0 };

  // Fails loudly rather than treating an unreachable realm as an empty one.
  const online = await onlineCharacterIds();
  let written = 0;
  let applied = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of pending.rows) {
    const playerId = Number(row.player_id);
    if (online.has(playerId)) {
      skipped += 1;
      continue;
    }
    try {
      if (row.written) {
        const outcome = await verifyAssignment(playerId, row.requested_by);
        if (outcome === 'applied') applied += 1;
        else skipped += 1;
        continue;
      }
      const result = await applyAssignment(playerId, row.requested_by);
      if (result.ok) written += 1;
      else skipped += 1;
    } catch (error) {
      failed += 1;
      console.error(`Gagal memproses level untuk karakter ${playerId}:`, error);
    }
  }
  return { written, applied, failed, skipped };
}

let sweepTimer: NodeJS.Timeout | null = null;

export function startPlayerLevelSweep(intervalMs = 30_000): void {
  if (sweepTimer || config.NODE_ENV === 'development') return;
  sweepTimer = setInterval(() => {
    void sweepPendingLevels().catch(error => {
      console.error('Sweep level pemain gagal:', error);
    });
  }, intervalMs);
  sweepTimer.unref();
}
