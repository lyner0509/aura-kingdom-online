import { config } from './config.js';
import { pool } from './database.js';
import { loyaltySaveSchema, revisionForLoyalty, type LoyaltyItem } from './loyalty-model.js';
import { itemNames } from './paragon.js';

export class LoyaltyError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const selectRows = `select id, item_id, category, cost_lp, quantity, buy_limit,
  discount_percent, is_active, sort_order
  from dashboard.loyalty_shop order by category asc, sort_order asc, id asc`;

const demoRows: LoyaltyItem[] = [
  { id: 1, item_id: 40001, category: 'Populer', cost_lp: 50, quantity: 5, buy_limit: 0, discount_percent: 0, is_active: 1, sort_order: 1 },
  { id: 2, item_id: 40003, category: 'Populer', cost_lp: 300, quantity: 1, buy_limit: 5, discount_percent: 0, is_active: 1, sort_order: 2 },
  { id: 3, item_id: 40009, category: 'Populer', cost_lp: 120, quantity: 10, buy_limit: 0, discount_percent: 10, is_active: 1, sort_order: 3 },
  { id: 4, item_id: 40011, category: 'Populer', cost_lp: 250, quantity: 2, buy_limit: 0, discount_percent: 0, is_active: 1, sort_order: 4 },
  { id: 5, item_id: 40005, category: 'Konsumsi', cost_lp: 450, quantity: 1, buy_limit: 0, discount_percent: 0, is_active: 1, sort_order: 1 },
  { id: 6, item_id: 40007, category: 'Konsumsi', cost_lp: 850, quantity: 1, buy_limit: 3, discount_percent: 0, is_active: 1, sort_order: 2 },
  { id: 7, item_id: 62949, category: 'Kostum', cost_lp: 1500, quantity: 1, buy_limit: 0, discount_percent: 15, is_active: 1, sort_order: 1 },
  { id: 8, item_id: 62950, category: 'Kostum', cost_lp: 1200, quantity: 1, buy_limit: 0, discount_percent: 0, is_active: 1, sort_order: 2 },
  { id: 9, item_id: 62951, category: 'Eidolon', cost_lp: 2000, quantity: 1, buy_limit: 2, discount_percent: 0, is_active: 1, sort_order: 1 },
];

export async function readLoyalty() {
  const rows = config.NODE_ENV === 'development'
    ? demoRows
    : (await pool(config.ACCOUNT_DB).query<LoyaltyItem>(selectRows)).rows;

  const history = config.NODE_ENV === 'development' ? [] : (await pool(config.ACCOUNT_DB).query(
    `select id::text, actor, created_at as "createdAt" from dashboard.loyalty_history order by id desc limit 10`,
  )).rows;

  return {
    rows,
    itemNames: await itemNames(rows.map(row => row.item_id)),
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
      throw new LoyaltyError(409, 'Data Loyalty Shop telah berubah oleh admin lain. Muat ulang sebelum menyimpan kembali.');
    }

    const changed = revisionForLoyalty(before) !== revisionForLoyalty(parsed.data.rows);
    if (changed) {
      const incomingIds = new Set(parsed.data.rows.map(r => r.id).filter(id => id > 0));
      
      for (const oldRow of before) {
        if (!incomingIds.has(oldRow.id)) {
          await client.query('delete from dashboard.loyalty_shop where id = $1', [oldRow.id]);
        }
      }

      const afterRows: LoyaltyItem[] = [];
      for (const row of parsed.data.rows) {
        if (row.id > 0 && before.some(b => b.id === row.id)) {
          const res = await client.query<LoyaltyItem>(
            `update dashboard.loyalty_shop
             set item_id=$1, category=$2, cost_lp=$3, quantity=$4, buy_limit=$5,
                 discount_percent=$6, is_active=$7, sort_order=$8, updated_at=now()
             where id=$9
             returning id, item_id, category, cost_lp, quantity, buy_limit, discount_percent, is_active, sort_order`,
            [row.item_id, row.category, row.cost_lp, row.quantity, row.buy_limit,
             row.discount_percent, row.is_active, row.sort_order, row.id]
          );
          afterRows.push(res.rows[0]);
        } else {
          const res = await client.query<LoyaltyItem>(
            `insert into dashboard.loyalty_shop(item_id, category, cost_lp, quantity, buy_limit, discount_percent, is_active, sort_order)
             values ($1, $2, $3, $4, $5, $6, $7, $8)
             returning id, item_id, category, cost_lp, quantity, buy_limit, discount_percent, is_active, sort_order`,
            [row.item_id, row.category, row.cost_lp, row.quantity, row.buy_limit,
             row.discount_percent, row.is_active, row.sort_order]
          );
          afterRows.push(res.rows[0]);
        }
      }

      await client.query(
        `insert into dashboard.loyalty_history(actor, before_rows, after_rows)
         values ($1, $2::jsonb, $3::jsonb)`,
        [actor, JSON.stringify(before), JSON.stringify(afterRows)]
      );

      await client.query('commit');
      return { changed: true, revision: revisionForLoyalty(afterRows) };
    }

    await client.query('commit');
    return { changed: false, revision: revisionForLoyalty(parsed.data.rows) };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
