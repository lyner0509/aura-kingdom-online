import { createHash } from 'node:crypto';
import { z } from 'zod';

const integer = z.number().int().min(0).max(2147483647);
const flag = z.union([z.literal(0), z.literal(1)]);
export const rewardSchema = z.object({
  lottery_id: integer,
  category: integer,
  weekday: integer,
  drop_level: integer.min(1),
  level_order: integer.min(1),
  item_id: integer.min(1),
  max_stack: integer.min(1).max(32767),
  drop_rate: z.number().min(0).max(100),
  notify: flag,
  get_only: flag,
  shining_hint: flag,
  jack_pot: flag,
}).strict();
export type ParagonReward = z.infer<typeof rewardSchema>;
export const paragonSaveSchema = z.object({
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  rows: z.array(rewardSchema).min(1).max(500),
}).strict().superRefine(({ rows }, ctx) => {
  const keys = new Set<string>();
  const totals = new Map<string, number>();
  for (const row of rows) {
    const tier = `${row.category}/${row.weekday}/${row.drop_level}`;
    const key = rewardKey(row);
    if (keys.has(key)) ctx.addIssue({ code: 'custom', message: 'Slot hadiah duplikat.' });
    keys.add(key);
    totals.set(tier, (totals.get(tier) ?? 0) + row.drop_rate);
  }
  for (const [tier, total] of totals) {
    if (Math.abs(total - 100) > 0.000001) ctx.addIssue({ code: 'custom', message: `Total peluang tingkat ${tier} harus 100%.` });
  }
});

export function rewardKey(row: ParagonReward) {
  return `${row.category}/${row.weekday}/${row.drop_level}/${row.level_order}`;
}
export function revisionFor(rows: ParagonReward[]) {
  const canonical = rows.map(row => rewardSchema.parse(row)).sort((a, b) => rewardKey(a).localeCompare(rewardKey(b)));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
export function sameSlots(before: ParagonReward[], after: ParagonReward[]) {
  const keys = new Map(before.map(row => [rewardKey(row), row.lottery_id]));
  return before.length === after.length && after.every(row => keys.get(rewardKey(row)) === row.lottery_id);
}
