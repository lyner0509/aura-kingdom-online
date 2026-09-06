import { config } from './config.js';
import { pool } from './database.js';
import { bonusSaveSchema, bonusSlotKey, revisionForBonus, type BonusItem } from './bonus-model.js';
import { itemNames } from './paragon.js';

export class BonusError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const selectRows = `select item_group, detail_type, item_index, item_id, item_num,
  point, special_price, num_limit, sell
  from public.itemmall where money_unit = 3 order by item_group asc, detail_type asc, item_index asc`;

const demoRows: BonusItem[] = [
  { item_group: 2, detail_type: 1, item_index: 1, item_id: 40001, item_num: 1, point: 199, special_price: 0, num_limit: 0, sell: 1 },
  { item_group: 2, detail_type: 1, item_index: 2, item_id: 40769, item_num: 1, point: 299, special_price: 199, num_limit: 10, sell: 1 },
  { item_group: 3, detail_type: 1, item_index: 1, item_id: 40005, item_num: 5, point: 69, special_price: 0, num_limit: 0, sell: 1 },
  { item_group: 3, detail_type: 1, item_index: 2, item_id: 40007, item_num: 1, point: 499, special_price: 399, num_limit: 5, sell: 1 },
  { item_group: 49, detail_type: 1, item_index: 1, item_id: 62951, item_num: 1, point: 1999, special_price: 1499, num_limit: 2, sell: 1 },
  { item_group: 5, detail_type: 1, item_index: 1, item_id: 40003, item_num: 1, point: 250, special_price: 0, num_limit: 0, sell: 1 },
  { item_group: 8, detail_type: 1, item_index: 1, item_id: 40011, item_num: 10, point: 150, special_price: 120, num_limit: 0, sell: 1 },
  { item_group: 47, detail_type: 1, item_index: 1, item_id: 40771, item_num: 1, point: 299, special_price: 0, num_limit: 10, sell: 1 },
];

export async function readBonus() {
  const rows = config.NODE_ENV === 'development'
    ? demoRows
    : (await pool(config.ACCOUNT_DB).query<BonusItem>(selectRows)).rows;

  const history = config.NODE_ENV === 'development' ? [] : (await pool(config.ACCOUNT_DB).query(
    `select id::text, actor, created_at as "createdAt" from dashboard.bonus_history order by id desc limit 10`,
  )).rows;

  return {
    rows,
    itemNames: await itemNames(rows.map(row => row.item_id)),
    revision: revisionForBonus(rows),
    history,
    readOnly: config.NODE_ENV === 'development',
  };
}

export async function saveBonus(input: unknown, actor: string) {
  const parsed = bonusSaveSchema.safeParse(input);
  if (!parsed.success) throw new BonusError(400, parsed.error.issues[0]?.message ?? 'Data Bonus Mall tidak valid.');
  if (config.NODE_ENV === 'development') throw new BonusError(403, 'Preview lokal tidak menyimpan perubahan ke game.');

  const client = await pool(config.ACCOUNT_DB).connect();
  try {
    await client.query('begin');
    await client.query("set local lock_timeout = '3s'");
    await client.query("set local statement_timeout = '10s'");

    const before = (await client.query<BonusItem>(`${selectRows} for update`)).rows;
    if (revisionForBonus(before) !== parsed.data.revision) {
      throw new BonusError(409, 'Tabel Bonus Mall telah berubah oleh admin lain. Muat ulang sebelum menyimpan kembali.');
    }

    const changed = revisionForBonus(before) !== revisionForBonus(parsed.data.rows);
    if (changed) {
      const incomingKeys = new Set(parsed.data.rows.map(bonusSlotKey));
      const beforeMap = new Map(before.map(row => [bonusSlotKey(row), row]));

      // 1. Delete rows no longer present
      for (const oldRow of before) {
        if (!incomingKeys.has(bonusSlotKey(oldRow))) {
          await client.query(
            `delete from public.itemmall where item_group = $1 and detail_type = $2 and item_index = $3 and money_unit = 3`,
            [oldRow.item_group, oldRow.detail_type, oldRow.item_index]
          );
        }
      }

      // 2. Update existing rows and insert new ones
      for (const newRow of parsed.data.rows) {
        const key = bonusSlotKey(newRow);
        const existing = beforeMap.get(key);
        if (existing) {
          const isModified = existing.item_id !== newRow.item_id ||
            existing.item_num !== newRow.item_num ||
            existing.point !== newRow.point ||
            existing.special_price !== newRow.special_price ||
            existing.num_limit !== newRow.num_limit ||
            existing.sell !== newRow.sell;

          if (isModified) {
            await client.query(
              `update public.itemmall
               set item_id = $1, item_num = $2, point = $3, special_price = $4, num_limit = $5, sell = $6
               where item_group = $7 and detail_type = $8 and item_index = $9 and money_unit = 3`,
              [newRow.item_id, newRow.item_num, newRow.point, newRow.special_price, newRow.num_limit, newRow.sell,
               newRow.item_group, newRow.detail_type, newRow.item_index]
            );
          }
        } else {
          await client.query(
            `insert into public.itemmall (
               item_id, item_group, detail_type, item_index, item_num, money_unit,
               point, special_price, num_limit, level_limit, gender, sell,
               not_sell_date, sell_date, message, beginner_only_time, note
             ) values (
               $1, $2, $3, $4, $5, 3,
               $6, $7, $8, 0, -1, $9,
               0, 0, '', 0, ''
             )`,
            [newRow.item_id, newRow.item_group, newRow.detail_type, newRow.item_index, newRow.item_num,
             newRow.point, newRow.special_price, newRow.num_limit, newRow.sell]
          );
        }
      }

      await client.query(
        `insert into dashboard.bonus_history(actor, before_rows, after_rows)
         values ($1, $2::jsonb, $3::jsonb)`,
        [actor, JSON.stringify(before), JSON.stringify(parsed.data.rows)]
      );
    }

    await client.query('commit');
    return { changed, revision: revisionForBonus(parsed.data.rows) };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
