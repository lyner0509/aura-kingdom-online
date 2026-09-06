import { createHash } from 'node:crypto';
import { z } from 'zod';

export type StarterPackItem = {
  id?: number;
  item_id: number;
  item_name?: string;
  item_count: number;
  is_bound: boolean;
  category: string;
  sort_order: number;
  note?: string;
};

export type StarterPackSettings = {
  id: number;
  is_enabled: boolean;
  auto_deliver_new_chars: boolean;
  mail_sender_name: string;
  mail_title: string;
  mail_content: string;
  bonus_gold: number;
  bonus_loyalty_points: number;
  min_character_level: number;
  max_claims_per_account: number;
  last_dispatch_at: string | null;
  last_dispatch_status: string | null;
  updated_at: string;
  updated_by: string;
};

export type StarterPackClaim = {
  id: number;
  account_id: number;
  username: string;
  character_id: number;
  character_name: string;
  delivery_method: string;
  items_delivered_count: number;
  gold_delivered: number;
  loyalty_delivered: number;
  operator: string;
  claimed_at: string;
};

export type StarterPackHistoryEntry = {
  id: string;
  operator: string;
  action: string;
  target: string | null;
  details: string | null;
  created_at: string;
};

export const starterPackItemSchema = z.object({
  id: z.number().int().positive().optional(),
  item_id: z.number().int().min(1, 'Item ID harus berupa angka positif.'),
  item_name: z.string().max(128).optional().default(''),
  item_count: z.number().int().min(1, 'Jumlah item minimal 1.').max(999, 'Jumlah item maksimal 999.'),
  is_bound: z.boolean().default(true),
  category: z.string().max(32).default('general'),
  sort_order: z.number().int().default(0),
  note: z.string().max(255).optional().default(''),
});

export const updateStarterPackSettingsSchema = z.object({
  revision: z.string().min(1, 'Revision diperlukan.'),
  is_enabled: z.boolean(),
  auto_deliver_new_chars: z.boolean(),
  mail_sender_name: z.string().trim().min(1, 'Nama pengirim surat tidak boleh kosong.').max(32, 'Nama pengirim maksimal 32 karakter.'),
  mail_title: z.string().trim().min(1, 'Judul surat tidak boleh kosong.').max(40, 'Judul surat maksimal 40 karakter.'),
  mail_content: z.string().trim().min(1, 'Isi surat tidak boleh kosong.').max(500, 'Isi surat maksimal 500 karakter.'),
  bonus_gold: z.number().int().min(0, 'Bonus gold minimal 0.').max(100_000_000, 'Bonus gold maksimal 100.000.000.'),
  bonus_loyalty_points: z.number().int().min(0, 'Bonus Loyalty Points minimal 0.').max(1_000_000, 'Bonus Loyalty Points maksimal 1.000.000.'),
  min_character_level: z.number().int().min(1, 'Level minimum karakter minimal 1.').max(120, 'Level karakter maksimal 120.'),
  max_claims_per_account: z.number().int().min(0, 'Batas klaim minimal 0 (0 = tidak terbatas).').max(99, 'Batas klaim maksimal 99.'),
  items: z.array(starterPackItemSchema),
});

export type UpdateStarterPackSettingsInput = z.infer<typeof updateStarterPackSettingsSchema>;

export const grantStarterPackSchema = z.object({
  target_type: z.enum(['character', 'account']),
  target_name: z.string().trim().min(1, 'Nama karakter atau username harus diisi.'),
  override_claim_limit: z.boolean().optional().default(false),
});

export type GrantStarterPackInput = z.infer<typeof grantStarterPackSchema>;

export const batchDispatchStarterPackSchema = z.object({
  min_level: z.number().int().min(1).max(120).optional(),
});

export type BatchDispatchStarterPackInput = z.infer<typeof batchDispatchStarterPackSchema>;

export function revisionForStarterPack(
  settings: Pick<
    StarterPackSettings,
    | 'is_enabled'
    | 'auto_deliver_new_chars'
    | 'mail_sender_name'
    | 'mail_title'
    | 'mail_content'
    | 'bonus_gold'
    | 'bonus_loyalty_points'
    | 'min_character_level'
    | 'max_claims_per_account'
  >,
  items: StarterPackItem[]
): string {
  const sortedItems = [...items]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.item_id - b.item_id)
    .map((item) => ({
      item_id: item.item_id,
      item_count: item.item_count,
      is_bound: !!item.is_bound,
      category: item.category || 'general',
      sort_order: item.sort_order ?? 0,
      note: item.note || '',
    }));

  const canonical = {
    is_enabled: !!settings.is_enabled,
    auto_deliver_new_chars: !!settings.auto_deliver_new_chars,
    mail_sender_name: (settings.mail_sender_name || '').trim(),
    mail_title: (settings.mail_title || '').trim(),
    mail_content: (settings.mail_content || '').trim(),
    bonus_gold: Number(settings.bonus_gold) || 0,
    bonus_loyalty_points: Number(settings.bonus_loyalty_points) || 0,
    min_character_level: Number(settings.min_character_level) || 1,
    max_claims_per_account: Number(settings.max_claims_per_account) || 1,
    items: sortedItems,
  };

  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex').slice(0, 16);
}
