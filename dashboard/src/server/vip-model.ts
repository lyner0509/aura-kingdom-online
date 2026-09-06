import { createHash } from 'node:crypto';
import { z } from 'zod';

export const vipTierSchema = z.object({
  level: z.coerce.number().int().min(1).max(10),
  name: z.string().min(1, 'Nama tier harus diisi.').max(50),
  required_points: z.coerce.number().int().min(0, 'Poin minimal adalah 0.'),
  exp_bonus_percent: z.coerce.number().int().min(0).max(200),
  drop_bonus_percent: z.coerce.number().int().min(0).max(200),
  gold_bonus_percent: z.coerce.number().int().min(0).max(200),
  move_speed_percent: z.coerce.number().int().min(0).max(50),
  daily_loyalty_points: z.coerce.number().int().min(0).max(100000),
  daily_item_id: z.coerce.number().int().min(0),
  daily_item_count: z.coerce.number().int().min(1).max(999),
  buff_desc: z.string().max(255).default(''),
});

export const updateVipSettingsSchema = z.object({
  revision: z.string().min(1, 'Revision diperlukan.'),
  is_enabled: z.boolean().default(true),
  points_per_ap: z.coerce.number().int().min(1).max(1000).default(1),
  auto_vip_on_spending: z.boolean().default(true),
  daily_mail_reward_enabled: z.boolean().default(true),
  daily_mail_title: z.string().min(1).max(60).default('Hadiah Harian VIP Server'),
  daily_mail_content: z.string().min(1).max(500).default('Terima kasih atas dukunganmu pada server! Berikut hadiah harian sesuai tingkat VIP akunmu.'),
  tiers: z.array(vipTierSchema).min(1, 'Minimal 1 tier VIP harus didefinisikan.'),
});

export const grantVipSchema = z.object({
  username: z.string().min(3, 'Username minimal 3 karakter.').max(32),
  vip_level: z.coerce.number().int().min(1, 'VIP Level minimal 1').max(10, 'VIP Level maksimal 10'),
  vip_points: z.coerce.number().int().min(0).default(0),
  duration_days: z.coerce.number().int().nullable().optional(), // null = permanent, number = days
  custom_expires_at: z.string().nullable().optional(),
});

export type VipTier = z.infer<typeof vipTierSchema>;
export type UpdateVipSettingsInput = z.infer<typeof updateVipSettingsSchema>;
export type GrantVipInput = z.infer<typeof grantVipSchema>;

export type VipSettings = {
  id: number;
  is_enabled: boolean;
  points_per_ap: number;
  auto_vip_on_spending: boolean;
  daily_mail_reward_enabled: boolean;
  daily_mail_title: string;
  daily_mail_content: string;
  last_mail_dispatch_at: string | null;
  last_mail_dispatch_status: string | null;
  updated_at: string;
  updated_by: string;
};

export type AccountVip = {
  account_id: number;
  username: string;
  vip_level: number;
  vip_points: number;
  is_active: boolean;
  expires_at: string | null;
  last_daily_claim_at: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string;
};

export type VipHistoryEntry = {
  id: string;
  operator: string;
  action: string;
  target_account: string | null;
  vip_level: number | null;
  details: string | null;
  created_at: string;
};

export function revisionForVip(settings: VipSettings, tiers: VipTier[]): string {
  const sortedTiers = [...tiers].sort((a, b) => a.level - b.level);
  const canonical = {
    is_enabled: settings.is_enabled,
    points_per_ap: settings.points_per_ap,
    auto_vip_on_spending: settings.auto_vip_on_spending,
    daily_mail_reward_enabled: settings.daily_mail_reward_enabled,
    daily_mail_title: settings.daily_mail_title,
    daily_mail_content: settings.daily_mail_content,
    tiers: sortedTiers.map((t) => ({
      level: t.level,
      name: t.name,
      required_points: t.required_points,
      exp_bonus_percent: t.exp_bonus_percent,
      drop_bonus_percent: t.drop_bonus_percent,
      gold_bonus_percent: t.gold_bonus_percent,
      move_speed_percent: t.move_speed_percent,
      daily_loyalty_points: t.daily_loyalty_points,
      daily_item_id: t.daily_item_id,
      daily_item_count: t.daily_item_count,
    })),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex').slice(0, 16);
}
