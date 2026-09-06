import { createHash } from 'node:crypto';
import { z } from 'zod';

export const redeemCodeRewardSchema = z.object({
  item_id: z.number().int().min(1, 'Item ID harus lebih besar dari 0.'),
  item_name: z.string().optional(),
  item_num: z.number().int().min(1, 'Jumlah item minimal 1.').max(999, 'Jumlah item maksimal 999.').default(1),
  rate: z.number().int().min(1, 'Rate minimal 1.').max(1000, 'Rate maksimal 1000 (100%).').default(1000),
  set: z.number().int().min(1).max(20).default(1),
}).strict();

export type RedeemCodeReward = z.infer<typeof redeemCodeRewardSchema>;

export const redeemCodeStateSchema = z.enum(['open', 'used', 'create', 'disabled']);
export type RedeemCodeState = z.infer<typeof redeemCodeStateSchema>;

export const redeemCodeItemSchema = z.object({
  pin: z.string().min(3).max(16),
  password: z.string().max(16).default(''),
  rule_id: z.number().int(),
  description: z.string().max(50).default(''),
  state: redeemCodeStateSchema,
  pin_set: z.number().int().default(-1),
  account_id: z.number().int().default(-1),
  account_name: z.string().nullable().optional(),
  character_id: z.number().int().default(-1),
  character_name: z.string().nullable().optional(),
  log_time: z.string().nullable().optional(),
  rewards: z.array(redeemCodeRewardSchema),
}).strict();

export type RedeemCodeItem = z.infer<typeof redeemCodeItemSchema>;

export const createRedeemCodeSchema = z.object({
  pin: z.string()
    .trim()
    .toUpperCase()
    .min(3, 'Kode PIN minimal 3 karakter.')
    .max(16, 'Kode PIN maksimal 16 karakter.')
    .regex(/^[A-Z0-9_-]+$/, 'Kode PIN hanya boleh berisi huruf, angka, tanda hubung (-), atau garis bawah (_).'),
  password: z.string().trim().max(16, 'Password maksimal 16 karakter.').default(''),
  description: z.string().trim().min(1, 'Deskripsi/Nama event wajib diisi.').max(50, 'Deskripsi maksimal 50 karakter.'),
  pin_set: z.number().int().default(-1),
  state: z.enum(['open', 'create', 'disabled']).default('open'),
  rewards: z.array(redeemCodeRewardSchema).min(1, 'Minimal 1 item hadiah harus ditentukan.').max(20, 'Maksimal 20 item hadiah per kode.'),
}).strict();

export type CreateRedeemCodeInput = z.infer<typeof createRedeemCodeSchema>;

export const batchGenerateRedeemCodeSchema = z.object({
  prefix: z.string()
    .trim()
    .toUpperCase()
    .max(8, 'Prefix maksimal 8 karakter.')
    .regex(/^[A-Z0-9_-]*$/, 'Prefix hanya boleh huruf, angka, tanda hubung (-), atau garis bawah (_).')
    .default(''),
  count: z.number().int().min(1, 'Minimal 1 kode.').max(500, 'Maksimal 500 kode per batch.'),
  password: z.string().trim().max(16, 'Password maksimal 16 karakter.').default(''),
  description: z.string().trim().min(1, 'Deskripsi/Nama event wajib diisi.').max(50, 'Deskripsi maksimal 50 karakter.'),
  pin_set: z.number().int().default(-1),
  state: z.enum(['open', 'create', 'disabled']).default('open'),
  rewards: z.array(redeemCodeRewardSchema).min(1, 'Minimal 1 item hadiah harus ditentukan.').max(20, 'Maksimal 20 item hadiah per kode.'),
}).strict();

export type BatchGenerateRedeemCodeInput = z.infer<typeof batchGenerateRedeemCodeSchema>;

export const updateRedeemCodeSchema = z.object({
  state: z.enum(['open', 'create', 'disabled']),
}).strict();

export type UpdateRedeemCodeInput = z.infer<typeof updateRedeemCodeSchema>;

export function revisionForRedeemCodes(codes: RedeemCodeItem[]) {
  const canonical = codes
    .map(c => ({
      pin: c.pin,
      password: c.password,
      rule_id: c.rule_id,
      state: c.state,
      pin_set: c.pin_set,
      account_id: c.account_id,
      rewards: c.rewards.map(r => ({
        item_id: r.item_id,
        item_num: r.item_num,
        rate: r.rate,
        set: r.set,
      })).sort((a, b) => a.set - b.set || a.item_id - b.item_id),
    }))
    .sort((a, b) => a.pin.localeCompare(b.pin));

  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
