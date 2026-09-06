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

export const WEAPON_INFO: Record<number, { name: string; icon: string; maleAvatar: string; femaleAvatar: string }> = {
  1:      { name: 'Guardian',     icon: 'wp0101', maleAvatar: 'p00001', femaleAvatar: 'p00112' },
  2:      { name: 'Duelist',      icon: 'wp0201', maleAvatar: 'p00104', femaleAvatar: 'p00004' },
  4:      { name: 'Ravager',      icon: 'wp0301', maleAvatar: 'p00003', femaleAvatar: 'p00118' },
  8:      { name: 'Wizard',       icon: 'wp0401', maleAvatar: 'p00102', femaleAvatar: 'p00110' },
  16:     { name: 'Gunslinger',   icon: 'wp0501', maleAvatar: 'p00105', femaleAvatar: 'p00007' },
  32:     { name: 'Grenadier',    icon: 'wp0601', maleAvatar: 'p00101', femaleAvatar: 'p00006' },
  64:     { name: 'Bard',         icon: 'wp0701', maleAvatar: 'p00107', femaleAvatar: 'p00002' },
  128:    { name: 'Brawler',      icon: 'wp0801', maleAvatar: 'p00103', femaleAvatar: 'p00108' },
  256:    { name: 'Sorcerer',     icon: 'wp0901', maleAvatar: 'p00106', femaleAvatar: 'p00004' },
  512:    { name: 'Greatsword',   icon: 'wp1001', maleAvatar: 'p00104', femaleAvatar: 'p00111' },
  1024:   { name: 'Warbow',       icon: 'wp1101', maleAvatar: 'p00107', femaleAvatar: 'p00003' },
  2048:   { name: 'Tachi',        icon: 'wp1201', maleAvatar: 'p00105', femaleAvatar: 'p00112' },
  4096:   { name: 'Necromancer',  icon: 'wp1301', maleAvatar: 'p00106', femaleAvatar: 'p00004' },
  8192:   { name: 'Crusader',     icon: 'wp1401', maleAvatar: 'p00001', femaleAvatar: 'p00109' },
  16384:  { name: 'Shinobi',      icon: 'wp1501', maleAvatar: 'p00105', femaleAvatar: 'p00007' },
  32768:  { name: 'Lancer',       icon: 'wp1601', maleAvatar: 'p00102', femaleAvatar: 'p00110' },
  65536:  { name: 'Whip',         icon: 'wp1701', maleAvatar: 'p00104', femaleAvatar: 'p00112' },
  131072: { name: 'Chime',        icon: 'wp1801', maleAvatar: 'p00107', femaleAvatar: 'p00002' },
};

export const MAP_NAMES: Record<number, string> = {
  1: 'Navea',
  2: 'Port Skandia',
  3: 'Helonia Coast',
  4: 'Crescent Hill',
  5: 'Cactakara Forest',
  6: 'Demarech Mines',
  7: 'Triatio Highlands',
  8: 'Candeo Marsh',
  9: 'Ventos Prairie',
  10: 'Oblitus Wood',
  11: 'Star Sand Desert',
  12: 'Rainmist Reach',
  13: 'Emerald Marsh',
  14: 'Starstruck Plateau',
  15: 'Silent Ice Field',
  16: "Vulture's Vale",
  17: 'Blizzard Berg',
  20: 'Starcrescent Valley',
  21: 'Port Morton',
  22: 'Candetonn Hill',
  23: 'Viridian Steppe',
  24: 'Desolate Valley',
  25: 'Tanglevine Cascades',
  26: "Sunhunter's Vale",
  27: 'Chronology Forest',
  28: 'Tempest Desert',
  29: 'Frigga Peak',
};

export function resolveWeapon(weaponId: number) {
  if (WEAPON_INFO[weaponId]) return WEAPON_INFO[weaponId];
  for (const [key, val] of Object.entries(WEAPON_INFO)) {
    const bit = Number(key);
    if ((weaponId & bit) === bit) return val;
  }
  return { name: 'Adventurer', icon: 'wp0101', maleAvatar: 'p00001', femaleAvatar: 'p00002' };
}

export type PlayerRow = {
  id: string;
  name: string;
  accountName: string;
  level: number;
  classId: number | null;
  genderId: number;
  gender: 'Male' | 'Female';
  weapon1: number;
  weapon2: number;
  className: string;
  subClassName: string | null;
  classIcon: string;
  avatarIcon: string;
  online: boolean;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  gold: number;
  bindGold: number;
  skillPoint: number;
  nodeId: number;
  mapName: string;
  x: number;
  y: number;
  z: number;
  csKillNum: number;
  csWinNum: number;
  bfKillNum: number;
  bfWinNum: number;
  craftingScore: number;
  createTime: string | null;
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
  {
    id: '10482',
    name: 'Astra Vale',
    accountName: 'astra',
    level: 99,
    classId: 3,
    genderId: 2,
    gender: 'Female',
    weapon1: 1024,
    weapon2: 16,
    className: 'Warbow',
    subClassName: 'Gunslinger',
    classIcon: 'wp1101',
    avatarIcon: 'p00003',
    online: true,
    hp: 45000,
    maxHp: 45000,
    mp: 25000,
    maxMp: 25000,
    gold: 15400,
    bindGold: 3200,
    skillPoint: 120,
    nodeId: 1,
    mapName: 'Navea',
    x: 596.2,
    y: 369.6,
    z: 0,
    csKillNum: 42,
    csWinNum: 18,
    bfKillNum: 65,
    bfWinNum: 29,
    craftingScore: 1200,
    createTime: '2026-08-01 12:00:00',
    lastSeen: null,
  },
  {
    id: '10431',
    name: 'Kael Ardent',
    accountName: 'kael',
    level: 87,
    classId: 7,
    genderId: 1,
    gender: 'Male',
    weapon1: 1,
    weapon2: 4,
    className: 'Guardian',
    subClassName: 'Ravager',
    classIcon: 'wp0101',
    avatarIcon: 'p00001',
    online: true,
    hp: 38000,
    maxHp: 38000,
    mp: 18000,
    maxMp: 18000,
    gold: 8900,
    bindGold: 1500,
    skillPoint: 95,
    nodeId: 1,
    mapName: 'Navea',
    x: 620.1,
    y: 410.5,
    z: 0,
    csKillNum: 31,
    csWinNum: 14,
    bfKillNum: 48,
    bfWinNum: 20,
    craftingScore: 850,
    createTime: '2026-08-10 14:30:00',
    lastSeen: null,
  },
  {
    id: '9821',
    name: 'Mira Sol',
    accountName: 'mira',
    level: 76,
    classId: 2,
    genderId: 2,
    gender: 'Female',
    weapon1: 65536,
    weapon2: 64,
    className: 'Whip',
    subClassName: 'Bard',
    classIcon: 'wp1701',
    avatarIcon: 'p00112',
    online: false,
    hp: 29000,
    maxHp: 29000,
    mp: 21000,
    maxMp: 21000,
    gold: 4200,
    bindGold: 800,
    skillPoint: 70,
    nodeId: 2,
    mapName: 'Port Skandia',
    x: 340.5,
    y: 280.2,
    z: 0,
    csKillNum: 15,
    csWinNum: 7,
    bfKillNum: 22,
    bfWinNum: 9,
    craftingScore: 600,
    createTime: '2026-08-20 09:15:00',
    lastSeen: '2026-09-05T08:14:00Z',
  },
  {
    id: '8750',
    name: 'Rin Ashfall',
    accountName: 'rin',
    level: 63,
    classId: 11,
    genderId: 1,
    gender: 'Male',
    weapon1: 16384,
    weapon2: 2,
    className: 'Shinobi',
    subClassName: 'Duelist',
    classIcon: 'wp1501',
    avatarIcon: 'p00105',
    online: false,
    hp: 22000,
    maxHp: 22000,
    mp: 15000,
    maxMp: 15000,
    gold: 2100,
    bindGold: 450,
    skillPoint: 50,
    nodeId: 3,
    mapName: 'Helonia Coast',
    x: 450.8,
    y: 512.4,
    z: 0,
    csKillNum: 8,
    csWinNum: 3,
    bfKillNum: 14,
    bfWinNum: 5,
    craftingScore: 400,
    createTime: '2026-08-25 18:40:00',
    lastSeen: '2026-09-04T19:42:00Z',
  },
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
      accountName: string;
      level: number;
      classId: number | null;
      genderId: number;
      weapon1: number;
      weapon2: number;
      hp: number;
      maxHp: number;
      mp: number;
      maxMp: number;
      gold: number;
      bindGold: number;
      skillPoint: number;
      nodeId: number;
      x: number;
      y: number;
      z: number;
      csKillNum: number;
      csWinNum: number;
      bfKillNum: number;
      bfWinNum: number;
      craftingScore: number;
      createTime: string | null;
      accountId: number;
      lastSeen: string | null;
    }>(
      `select
         c.id::text as id,
         c.given_name as name,
         coalesce(c.account_name, '') as "accountName",
         c.level,
         c.class_id as "classId",
         coalesce(c.gender_id, 1) as "genderId",
         coalesce(w.weapon_type_1, 0) as "weapon1",
         coalesce(w.weapon_type_2, 0) as "weapon2",
         coalesce(c.hp, 0) as hp,
         coalesce(c.max_hp, 0) as "maxHp",
         coalesce(c.mp, 0) as mp,
         coalesce(c.max_mp, 0) as "maxMp",
         coalesce(c.gold, 0) as gold,
         coalesce(c.bind_gold, 0) as "bindGold",
         coalesce(c.skill_point, 0) as "skillPoint",
         coalesce(c.node_id, 1) as "nodeId",
         coalesce(c.x, 0) as x,
         coalesce(c.y, 0) as y,
         coalesce(c.z, 0) as z,
         coalesce(c.cs_kill_num, 0) as "csKillNum",
         coalesce(c.cs_win_num, 0) as "csWinNum",
         coalesce(c.bf_kill_num, 0) as "bfKillNum",
         coalesce(c.bf_win_num, 0) as "bfWinNum",
         coalesce(c.crafting_score, 0) as "craftingScore",
         c.create_time::text as "createTime",
         c.account_id as "accountId",
         to_timestamp(nullif(c.last_saving_time, 0)) as "lastSeen"
       from player_characters c
       left join player_weapon_type w on w.id = c.id
       where c.deleted_time = 0
         and ($1 = '' or c.given_name ilike '%' || $1 || '%')
       order by c.level desc, c.given_name asc`,
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

    const genderId = Number(row.genderId) === 2 ? 2 : 1;
    const gender: 'Male' | 'Female' = genderId === 2 ? 'Female' : 'Male';
    const primaryWp = resolveWeapon(Number(row.weapon1));
    const secondaryWp = Number(row.weapon2) > 0 ? resolveWeapon(Number(row.weapon2)).name : null;
    const avatar = genderId === 2 ? primaryWp.femaleAvatar : primaryWp.maleAvatar;
    const mapName = MAP_NAMES[Number(row.nodeId)] ?? `Zone #${row.nodeId}`;

    return {
      id: row.id,
      name: row.name,
      accountName: row.accountName,
      level: row.level,
      classId: row.classId,
      genderId,
      gender,
      weapon1: Number(row.weapon1),
      weapon2: Number(row.weapon2),
      className: primaryWp.name,
      subClassName: secondaryWp,
      classIcon: primaryWp.icon,
      avatarIcon: avatar,
      online,
      hp: Number(row.hp),
      maxHp: Number(row.maxHp),
      mp: Number(row.mp),
      maxMp: Number(row.maxMp),
      gold: Number(row.gold),
      bindGold: Number(row.bindGold),
      skillPoint: Number(row.skillPoint),
      nodeId: Number(row.nodeId),
      mapName,
      x: Math.round(Number(row.x) * 10) / 10,
      y: Math.round(Number(row.y) * 10) / 10,
      z: Math.round(Number(row.z) * 10) / 10,
      csKillNum: Number(row.csKillNum),
      csWinNum: Number(row.csWinNum),
      bfKillNum: Number(row.bfKillNum),
      bfWinNum: Number(row.bfWinNum),
      craftingScore: Number(row.craftingScore),
      createTime: row.createTime,
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
