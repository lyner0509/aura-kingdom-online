import { createHash } from 'node:crypto';
import { z } from 'zod';

const integer = z.number().int().min(0).max(2147483647);
const flag = z.union([z.literal(0), z.literal(1)]);

export const bonusItemSchema = z.object({
  item_group: integer,
  detail_type: integer.default(1),
  item_index: integer,
  item_id: integer.min(1),
  item_num: integer.min(1).max(32767).default(1),
  point: integer,
  special_price: integer.default(0),
  num_limit: integer.max(100000).default(0),
  sell: flag.default(1),
}).strict();

export type BonusItem = z.infer<typeof bonusItemSchema>;

export const bonusSaveSchema = z.object({
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  rows: z.array(bonusItemSchema).max(3000),
}).strict().superRefine(({ rows }, ctx) => {
  const keys = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.item_id <= 0) {
      ctx.addIssue({ code: 'custom', message: `Baris ${i + 1}: Item ID harus lebih besar dari 0.` });
    }
    if (row.point < 0) {
      ctx.addIssue({ code: 'custom', message: `Baris ${i + 1}: Harga BP tidak boleh negatif.` });
    }
    const key = `${row.item_group}/${row.detail_type}/${row.item_index}`;
    if (keys.has(key)) {
      ctx.addIssue({ code: 'custom', message: `Slot ${key} duplikat.` });
    }
    keys.add(key);
  }
});

export function bonusSlotKey(row: BonusItem) {
  return `${row.item_group}/${row.detail_type}/${row.item_index}`;
}

export function revisionForBonus(rows: BonusItem[]) {
  const canonical = rows
    .map(row => bonusItemSchema.parse(row))
    .sort((a, b) => (a.item_group - b.item_group) || (a.detail_type - b.detail_type) || (a.item_index - b.item_index));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
