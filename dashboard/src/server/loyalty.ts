import { config } from './config.js';
import { pool } from './database.js';
import { loyaltySaveSchema, loyaltySlotKey, revisionForLoyalty, type LoyaltyItem } from './loyalty-model.js';
import { itemNames, itemIcons } from './paragon.js';

export class LoyaltyError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const selectRows = `select item_group, detail_type, item_index, item_id, item_num,
  point, special_price, num_limit, sell
  from public.itemmall where money_unit = 2 order by item_group asc, detail_type asc, item_index asc`;

const demoRows: LoyaltyItem[] = [
  { item_group: 48, detail_type: 1, item_index: 1, item_id: 40001, item_num: 5, point: 50, special_price: 0, num_limit: 0, sell: 1 },
  { item_group: 48, detail_type: 1, item_index: 2, item_id: 40003, item_num: 1, point: 300, special_price: 250, num_limit: 5, sell: 1 },
  { item_group: 48, detail_type: 1, item_index: 3, item_id: 40009, item_num: 10, point: 120, special_price: 100, num_limit: 0, sell: 1 },
  { item_group: 48, detail_type: 1, item_index: 4, item_id: 40011, item_num: 2, point: 250, special_price: 0, num_limit: 0, sell: 1 },
  { item_group: 3, detail_type: 1, item_index: 1, item_id: 40005, item_num: 1, point: 450, special_price: 0, num_limit: 0, sell: 1 },
  { item_group: 3, detail_type: 1, item_index: 2, item_id: 40007, item_num: 1, point: 850, special_price: 750, num_limit: 3, sell: 1 },
  { item_group: 2, detail_type: 1, item_index: 1, item_id: 62949, item_num: 1, point: 1500, special_price: 1200, num_limit: 0, sell: 1 },
  { item_group: 2, detail_type: 1, item_index: 2, item_id: 62950, item_num: 1, point: 1200, special_price: 0, num_limit: 0, sell: 1 },
  { item_group: 4, detail_type: 1, item_index: 1, item_id: 62951, item_num: 1, point: 2000, special_price: 0, num_limit: 2, sell: 1 },
];

export async function readLoyalty() {
  const rows = config.NODE_ENV === 'development'
    ? demoRows
    : (await pool(config.ACCOUNT_DB).query<LoyaltyItem>(selectRows)).rows;

  const history = config.NODE_ENV === 'development' ? [] : (await pool(config.ACCOUNT_DB).query(
    `select id::text, actor, created_at as "createdAt" from dashboard.loyalty_history order by id desc limit 10`,
  )).rows;

  const ids = rows.map(row => row.item_id);
  return {
    rows,
    itemNames: await itemNames(ids),
    itemIcons: await itemIcons(ids),
    revision: revisionForLoyalty(rows),
    history,
    readOnly: config.NODE_ENV === 'development',
  };
}

export async function saveLoyalty(input: unknown, actor: string) {
  const parsed = loyaltySaveSchema.safeParse(input);
  if (!parsed.success) throw new LoyaltyError(400, parsed.error.issues[0]?.message ?? 'Data Loyalty Shop tidak valid.');
  if (config.NODE_ENV === 'development') throw new LoyaltyError(403, 'Preview lokal tidak menyimpan perubahan ke game.');

  const client = await pool(config.ACCOUNT_DB).connect();
  try {
    await client.query('begin');
    await client.query("set local lock_timeout = '3s'");
    await client.query("set local statement_timeout = '10s'");

    const before = (await client.query<LoyaltyItem>(`${selectRows} for update`)).rows;
    if (revisionForLoyalty(before) !== parsed.data.revision) {
      throw new LoyaltyError(409, 'Tabel Loyalty Shop telah berubah oleh admin lain. Muat ulang sebelum menyimpan kembali.');
    }

    const changed = revisionForLoyalty(before) !== revisionForLoyalty(parsed.data.rows);
    if (changed) {
      const incomingKeys = new Set(parsed.data.rows.map(loyaltySlotKey));
      const beforeMap = new Map(before.map(row => [loyaltySlotKey(row), row]));

      // 1. Delete rows no longer present
      for (const oldRow of before) {
        if (!incomingKeys.has(loyaltySlotKey(oldRow))) {
          await client.query(
            `delete from public.itemmall where item_group = $1 and detail_type = $2 and item_index = $3 and money_unit = 2`,
            [oldRow.item_group, oldRow.detail_type, oldRow.item_index]
          );
        }
      }

      // 2. Update existing rows and insert new ones
      for (const newRow of parsed.data.rows) {
        const key = loyaltySlotKey(newRow);
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
               where item_group = $7 and detail_type = $8 and item_index = $9 and money_unit = 2`,
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
               $1, $2, $3, $4, $5, 2,
               $6, $7, $8, 0, -1, $9,
               0, 0, '', 0, ''
             )`,
            [newRow.item_id, newRow.item_group, newRow.detail_type, newRow.item_index, newRow.item_num,
             newRow.point, newRow.special_price, newRow.num_limit, newRow.sell]
          );
        }
      }

      await client.query(
        `insert into dashboard.loyalty_history(actor, before_rows, after_rows)
         values ($1, $2::jsonb, $3::jsonb)`,
        [actor, JSON.stringify(before), JSON.stringify(parsed.data.rows)]
      );
    }

    await client.query('commit');
    return { changed, revision: revisionForLoyalty(parsed.data.rows) };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
