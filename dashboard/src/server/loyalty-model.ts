import { createHash } from 'node:crypto';
import { z } from 'zod';

const integer = z.number().int().min(0).max(2147483647);
const flag = z.union([z.literal(0), z.literal(1)]);

export const loyaltyItemSchema = z.object({
  id: integer,
  item_id: integer.min(1),
  category: z.string().trim().min(1).max(64),
  cost_lp: integer.min(0),
  quantity: integer.min(1).max(32767),
  buy_limit: integer.min(0).max(100000),
  discount_percent: z.number().int().min(0).max(100),
  is_active: flag,
  sort_order: integer.min(0).max(99999),
}).strict();

export type LoyaltyItem = z.infer<typeof loyaltyItemSchema>;

export const loyaltySaveSchema = z.object({
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  rows: z.array(loyaltyItemSchema).max(1000),
}).strict().superRefine(({ rows }, ctx) => {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.item_id <= 0) {
      ctx.addIssue({ code: 'custom', message: `Baris ${i + 1}: Item ID harus lebih besar dari 0.` });
    }
    if (row.cost_lp < 0) {
      ctx.addIssue({ code: 'custom', message: `Baris ${i + 1}: Harga LP tidak boleh negatif.` });
    }
  }
});

export function revisionForLoyalty(rows: LoyaltyItem[]) {
  const canonical = rows
    .map(row => loyaltyItemSchema.parse(row))
    .sort((a, b) => (a.id - b.id) || (a.sort_order - b.sort_order) || (a.item_id - b.item_id) || a.category.localeCompare(b.category));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
