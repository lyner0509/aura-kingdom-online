import { config } from './config.js';
import { pool } from './database.js';
import { paragonSaveSchema, revisionFor, sameSlots, type ParagonReward } from './paragon-model.js';

const selectRows = `select lottery_id, category, weekday, drop_level, level_order,
  item_id, max_stack, drop_rate, notify, get_only, shining_hint, jack_pot
  from public.lottery order by category, weekday, drop_level, level_order`;
export class ParagonError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const demoRows: ParagonReward[] = Array.from({ length: 42 }, (_, i) => ({
  lottery_id: i + 1, category: 0, weekday: 0, drop_level: Math.floor(i / 6) + 1,
  level_order: i % 6 + 1, item_id: 40001 + i, max_stack: 1,
  drop_rate: [20, 34, 20, 25, 0.5, 0.5][i % 6], notify: 0, get_only: i >= 36 ? 1 : 0,
  shining_hint: 0, jack_pot: 0,
}));
export async function readParagon() {
  const rows = config.NODE_ENV === 'development' ? demoRows : (await pool(config.ACCOUNT_DB).query<ParagonReward>(selectRows)).rows;
  const history = config.NODE_ENV === 'development' ? [] : (await pool(config.ACCOUNT_DB).query(
    `select id::text, actor, created_at as "createdAt" from dashboard.paragon_history order by id desc limit 10`,
  )).rows;
  return { rows, revision: revisionFor(rows), history, readOnly: config.NODE_ENV === 'development' };
}
export async function saveParagon(input: unknown, actor: string) {
  const parsed = paragonSaveSchema.safeParse(input);
  if (!parsed.success) throw new ParagonError(400, parsed.error.issues[0]?.message ?? 'Data Paragon tidak valid.');
  if (config.NODE_ENV === 'development') throw new ParagonError(403, 'Preview lokal tidak menyimpan perubahan ke game.');
  const client = await pool(config.ACCOUNT_DB).connect();
  try {
    await client.query('begin');
    await client.query("set local lock_timeout = '3s'");
    await client.query("set local statement_timeout = '10s'");
    // Row locks serialize edits without granting table-wide UPDATE privileges.
    const before = (await client.query<ParagonReward>(`${selectRows} for update`)).rows;
    if (revisionFor(before) !== parsed.data.revision) throw new ParagonError(409, 'Tabel telah berubah. Muat ulang sebelum menyimpan kembali.');
    if (!sameSlots(before, parsed.data.rows)) throw new ParagonError(400, 'Kategori, tingkat, dan slot hadiah tidak boleh berubah.');
    const changed = revisionFor(before) !== revisionFor(parsed.data.rows);
    if (changed) {
      for (const row of parsed.data.rows) {
        await client.query(`update public.lottery set item_id=$1, max_stack=$2, drop_rate=$3,
          notify=$4, get_only=$5, shining_hint=$6, jack_pot=$7
          where category=$8 and weekday=$9 and drop_level=$10 and level_order=$11`,
        [row.item_id, row.max_stack, row.drop_rate, row.notify, row.get_only, row.shining_hint, row.jack_pot,
          row.category, row.weekday, row.drop_level, row.level_order]);
      }
      await client.query(`insert into dashboard.paragon_history(actor, before_rows, after_rows)
        values ($1, $2::jsonb, $3::jsonb)`, [actor, JSON.stringify(before), JSON.stringify(parsed.data.rows)]);
    }
    await client.query('commit');
    return { changed, revision: revisionFor(parsed.data.rows) };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}
