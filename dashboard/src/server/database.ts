import pg from 'pg';
import { config } from './config.js';
import { getActivePlayers } from './system.js';

const { Pool } = pg;
const pools = new Map<string, pg.Pool>();

export function pool(database: string): pg.Pool {
  let value = pools.get(database);
  if (!value) {
    value = new Pool({
      host: config.PGHOST,
      user: config.PGUSER,
      database,
      max: 4,
      connectionTimeoutMillis: 2500,
      idleTimeoutMillis: 15_000,
    });
    pools.set(database, value);
  }
  return value;
}

export type PlayerRow = {
  id: string;
  name: string;
  level: number;
  classId: number | null;
  online: boolean;
  lastSeen: string | null;
};

export async function databaseHealth(): Promise<{ available: boolean; latencyMs: number }> {
  if (config.NODE_ENV === 'development') return { available: true, latencyMs: 7 };
  const started = performance.now();
  try {
    await pool(config.GAME_DB).query('select 1');
    return { available: true, latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { available: false, latencyMs: Math.round(performance.now() - started) };
  }
}

const demoPlayers: PlayerRow[] = [
  { id: '10482', name: 'Astra Vale', level: 99, classId: 3, online: true, lastSeen: null },
  { id: '10431', name: 'Kael Ardent', level: 87, classId: 7, online: true, lastSeen: null },
  { id: '9821', name: 'Mira Sol', level: 76, classId: 2, online: false, lastSeen: '2026-09-05T08:14:00Z' },
  { id: '8750', name: 'Rin Ashfall', level: 63, classId: 11, online: false, lastSeen: '2026-09-04T19:42:00Z' },
];

export async function listPlayers(search: string, limit: number): Promise<PlayerRow[]> {
  if (config.NODE_ENV === 'development') {
    return demoPlayers.filter((player) => player.name.toLowerCase().includes(search.toLowerCase())).slice(0, limit);
  }

  const [activeInfo, result] = await Promise.all([
    getActivePlayers().catch(() => ({ online: 0, accounts: [] as number[], characters: [] as number[] })),
    pool(config.GAME_DB).query<{
      id: string;
      name: string;
      level: number;
      classId: number | null;
      accountId: number;
      lastSeen: string | null;
    }>(
      `select
         id::text as id,
         given_name as name,
         level,
         class_id as "classId",
         account_id as "accountId",
         to_timestamp(nullif(last_saving_time, 0)) as "lastSeen"
       from player_characters
       where deleted_time = 0
         and ($1 = '' or given_name ilike '%' || $1 || '%')
       order by level desc, given_name asc`,
      [search],
    ),
  ]);

  const activeChars = new Set(activeInfo.characters);
  const activeAccounts = new Set(activeInfo.accounts);

  const charsByAccount = new Map<number, typeof result.rows>();
  for (const row of result.rows) {
    const accId = Number(row.accountId);
    if (!charsByAccount.has(accId)) charsByAccount.set(accId, []);
    charsByAccount.get(accId)!.push(row);
  }

  const players: PlayerRow[] = result.rows.map((row) => {
    const charId = Number(row.id);
    const accountId = Number(row.accountId);
    let online = activeChars.has(charId);

    if (!online && activeAccounts.has(accountId)) {
      const anyOtherOnline = charsByAccount.get(accountId)?.some((c) => activeChars.has(Number(c.id)));
      if (!anyOtherOnline) {
        const accountChars = charsByAccount.get(accountId) ?? [];
        if (accountChars.length === 1 || accountChars[0]?.id === row.id) {
          online = true;
        }
      }
    }

    return {
      id: row.id,
      name: row.name,
      level: row.level,
      classId: row.classId,
      online,
      lastSeen: row.lastSeen,
    };
  });

  players.sort((a, b) => {
    if (a.online !== b.online) {
      return a.online ? -1 : 1;
    }
    if (a.level !== b.level) {
      return b.level - a.level;
    }
    return a.name.localeCompare(b.name);
  });

  return players.slice(0, limit);
}

export async function playerSummary(): Promise<{ total: number; online: number; maxLevel: number }> {
  if (config.NODE_ENV === 'development') return { total: 1264, online: 38, maxLevel: 99 };

  const [dbSummary, worldsResult, activeInfo] = await Promise.allSettled([
    pool(config.GAME_DB).query<{ total: string; max_level: number }>(
      `select count(*)::text as total,
              coalesce(max(level), 0) as max_level
         from player_characters
        where deleted_time = 0`,
    ),
    pool(config.ACCOUNT_DB).query<{ online: number }>(
      `select coalesce(sum(online_user), 0)::int as online from worlds`,
    ),
    getActivePlayers(),
  ]);

  const total = dbSummary.status === 'fulfilled' ? Number(dbSummary.value.rows[0]?.total ?? 0) : 0;
  const maxLevel = dbSummary.status === 'fulfilled' ? (dbSummary.value.rows[0]?.max_level ?? 0) : 0;

  const worldsOnline = worldsResult.status === 'fulfilled' ? Number(worldsResult.value.rows[0]?.online ?? 0) : 0;
  const activeOnline = activeInfo.status === 'fulfilled' ? activeInfo.value.online : 0;
  const charCount = activeInfo.status === 'fulfilled' ? activeInfo.value.characters.length : 0;

  const online = Math.max(worldsOnline, activeOnline, charCount);

  return { total, online, maxLevel };
}
