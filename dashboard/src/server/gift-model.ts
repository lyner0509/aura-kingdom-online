import { z } from 'zod';

export const giftSettingsSchema = z.object({
  default_sender_name: z.string().trim().min(1).max(32).default('Game Master'),
  default_mail_title: z.string().trim().min(1).max(40).default('[Hadiah GM] Hadiah Spesial'),
  default_mail_content: z.string().trim().min(1).max(500).default('Selamat! Kamu menerima hadiah item dari Game Master. Selamat berpetualang di Azuria!'),
  default_is_bound: z.boolean().default(true),
  allow_online_broadcast: z.boolean().default(true),
});

export type GiftSettings = z.infer<typeof giftSettingsSchema> & {
  id: number;
  updated_at?: string;
  updated_by?: string;
};

export const sendGiftPayloadSchema = z.object({
  target_type: z.enum(['character', 'online', 'all']).default('character'),
  target_query: z.string().trim().optional(),
  item_id: z.coerce.number().int().positive('Item ID harus angka positif'),
  item_name: z.string().trim().max(128).optional().default(''),
  item_count: z.coerce.number().int().min(1, 'Jumlah item minimal 1').max(9999, 'Jumlah item maksimal 9999').default(1),
  is_bound: z.boolean().default(true),
  gold: z.coerce.number().int().min(0).default(0),
  sender_name: z.string().trim().max(32).optional(),
  title: z.string().trim().max(40).optional(),
  content: z.string().trim().max(500).optional(),
  announce: z.boolean().default(false),
  announce_message: z.string().trim().max(100).optional(),
}).refine(
  (data) => data.target_type !== 'character' || (data.target_query && data.target_query.length > 0),
  { message: 'Nama atau ID karakter tujuan wajib diisi.', path: ['target_query'] }
);

export type SendGiftPayload = z.infer<typeof sendGiftPayloadSchema>;

export type GiftHistoryEntry = {
  id: number;
  operator: string;
  target_type: 'character' | 'online' | 'all';
  target_name: string;
  char_id: number | null;
  item_id: number;
  item_name: string;
  item_count: number;
  is_bound: boolean;
  gold: number;
  title: string;
  content: string;
  announced: boolean;
  delivered_count: number;
  created_at: string;
};
