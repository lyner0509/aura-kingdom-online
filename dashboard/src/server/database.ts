import pg from 'pg';
import { config } from './config.js';

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

  // Column aliases match the Aura Kingdom V15 FFDB1 schema. The database role is SELECT-only.
  const result = await pool(config.GAME_DB).query<PlayerRow>(
    `select
       id::text as id,
       given_name as name,
       level,
       class_id as "classId",
       (quit = 0) as online,
       to_timestamp(nullif(last_saving_time, 0)) as "lastSeen"
     from player_characters
     where deleted_time = 0
       and ($1 = '' or given_name ilike '%' || $1 || '%')
     order by (quit = 0) desc, level desc, given_name asc
     limit $2`,
    [search, limit],
  );
  return result.rows;
}

export async function playerSummary(): Promise<{ total: number; online: number; maxLevel: number }> {
  if (config.NODE_ENV === 'development') return { total: 1264, online: 38, maxLevel: 99 };
  const result = await pool(config.GAME_DB).query<{
    total: string;
    online: string;
    max_level: number;
  }>(
    `select count(*)::text as total,
            count(*) filter (where quit = 0)::text as online,
            coalesce(max(level), 0) as max_level
       from player_characters
      where deleted_time = 0`,
  );
  return {
    total: Number(result.rows[0]?.total ?? 0),
    online: Number(result.rows[0]?.online ?? 0),
    maxLevel: result.rows[0]?.max_level ?? 0,
  };
}
