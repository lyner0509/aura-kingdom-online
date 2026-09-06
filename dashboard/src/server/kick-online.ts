import { z } from 'zod';
import { config } from './config.js';
import { pool } from './database.js';
import { getActivePlayersStrict } from './system.js';
import { sendZoneServerCommand } from './zone-command.js';

export const kickReasons = ['bug_glitch', 'skill_glitch', 'afk_botting', 'other'] as const;
export type KickReason = (typeof kickReasons)[number];

const kickInputSchema = z.object({
  reason: z.enum(kickReasons),
  note: z.string().trim().max(240).optional().default(''),
});

export class KickOnlineError extends Error {
  public status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'KickOnlineError';
    this.status = status;
  }
}

type KickTarget = { id: number; name: string; accountId: number };

export function buildKickCommand(characterName: string): string {
  const name = characterName.trim();
  // ZoneServer's `kick <word>` grammar cannot safely represent separators,
  // whitespace, or control characters. Reject instead of escaping/guessing.
  if (!name || name.length > 64 || /[\s,\u0000-\u001f\u007f]/u.test(name)) {
    throw new KickOnlineError(422, 'Nama karakter tidak dapat dikirim ke perintah kick ZoneServer.');
  }
  return `kick ${name}`;
}

export function isSuccessfulKickResponse(response: string): boolean {
  return /(?:^|\b)(?:DONE|SUCCESS|OK)(?:\b|$)/i.test(response.trim());
}

export function isKickNoReplyTimeout(error: unknown): boolean {
  return error instanceof Error && /ZoneServer CGI .* timeout/i.test(error.message);
}

async function resolveTarget(characterId: number): Promise<KickTarget | null> {
  if (config.NODE_ENV === 'development') {
    const demo: Record<number, KickTarget> = {
      10482: { id: 10482, name: 'AstraVale', accountId: 2418 },
      10431: { id: 10431, name: 'KaelArdent', accountId: 2419 },
    };
    return demo[characterId] ?? null;
  }

  const result = await pool(config.GAME_DB).query<{ id: number; name: string; accountId: number }>(
    `select id, given_name as name, account_id as "accountId"
       from player_characters
      where id = $1 and deleted_time = 0
      limit 1`,
    [characterId],
  );
  return result.rows[0] ?? null;
}

async function targetIsOnline(target: KickTarget): Promise<boolean> {
  if (config.NODE_ENV === 'development') return true;
  // Kick is a destructive operation: an unavailable session controller must
  // fail closed instead of being interpreted as an empty realm.
  const active = await getActivePlayersStrict();
  return active.characters.includes(target.id) || active.accounts.includes(target.accountId);
}

async function waitUntilOffline(target: KickTarget): Promise<boolean> {
  // getActivePlayers caches for three seconds. Wait past that window first,
  // then poll briefly so a CGI handler without a response body can still be
  // confirmed by the authoritative session logs.
  await new Promise((resolve) => setTimeout(resolve, 3200));
  for (let attempt = 0; attempt < 7; attempt += 1) {
    if (!(await targetIsOnline(target))) return true;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return false;
}

export async function kickOnlineCharacter(
  characterId: number,
  rawInput: unknown,
  operator: string,
): Promise<{ ok: true; characterId: number; characterName: string; message: string }> {
  if (!Number.isSafeInteger(characterId) || characterId <= 0) {
    throw new KickOnlineError(400, 'Character ID tidak valid.');
  }

  const parsed = kickInputSchema.safeParse(rawInput);
  if (!parsed.success) throw new KickOnlineError(400, 'Alasan kick wajib dipilih dan catatan maksimal 240 karakter.');
  if (parsed.data.reason === 'other' && parsed.data.note.length < 3) {
    throw new KickOnlineError(400, 'Catatan minimal 3 karakter untuk alasan lainnya.');
  }

  const target = await resolveTarget(characterId);
  if (!target) throw new KickOnlineError(404, 'Karakter tidak ditemukan.');
  if (!(await targetIsOnline(target))) {
    throw new KickOnlineError(409, `${target.name} sudah offline. Muat ulang daftar pemain.`);
  }

  const command = buildKickCommand(target.name);
  let response = 'DONE (simulasi development)';
  let requiresSessionVerification = false;
  if (config.NODE_ENV !== 'development') {
    try {
      response = await sendZoneServerCommand(command, 2000);
    } catch (error) {
      // The patched TC_KickOut handler performs PlayerQuit but emits no CGI
      // response body. Only that known timeout is eligible for verification.
      if (!isKickNoReplyTimeout(error)) throw error;
      response = 'NO_REPLY';
      requiresSessionVerification = true;
    }
  }

  if (!requiresSessionVerification && !isSuccessfulKickResponse(response)) {
    console.error('[KickOnline] ZoneServer menolak perintah', { characterId, response });
    throw new KickOnlineError(502, 'ZoneServer menolak perintah kick. Periksa log ZoneServer.');
  }

  if (requiresSessionVerification && !(await waitUntilOffline(target))) {
    console.error('[KickOnline] Sesi tetap aktif setelah command CGI', { characterId });
    throw new KickOnlineError(502, 'Perintah terkirim, tetapi sesi karakter masih aktif. Periksa log ZoneServer.');
  }

  console.info('[KickOnline]', JSON.stringify({
    event: 'character_session_disconnected',
    operator,
    characterId: target.id,
    characterName: target.name,
    reason: parsed.data.reason,
    note: parsed.data.note || null,
    at: new Date().toISOString(),
  }));

  return {
    ok: true,
    characterId: target.id,
    characterName: target.name,
    message: `Koneksi ${target.name} berhasil diputus melalui ZoneServer.`,
  };
}
