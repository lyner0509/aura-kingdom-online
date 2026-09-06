import { createHash } from 'node:crypto';
import { z } from 'zod';

export const rateNumberSchema = z.coerce.number().int().min(50, 'Rate minimal adalah 50% (0.5x)').max(1000, 'Rate maksimal adalah 1000% (10x)');

export const updateExpBonusSchema = z.object({
  revision: z.string().min(1, 'Revision diperlukan.'),
  exp_rate: rateNumberSchema,
  quest_exp_rate: rateNumberSchema,
  drop_rate: rateNumberSchema,
  gold_rate: rateNumberSchema,
  np_rate: rateNumberSchema,
  is_event_active: z.boolean().default(false),
  event_name: z.string().max(120).nullable().optional(),
  event_start: z.string().nullable().optional(),
  event_end: z.string().nullable().optional(),
  event_exp_rate: rateNumberSchema.default(200),
  event_quest_exp_rate: rateNumberSchema.default(150),
  event_drop_rate: rateNumberSchema.default(150),
  event_gold_rate: rateNumberSchema.default(150),
  event_np_rate: rateNumberSchema.default(150),
  broadcast_event: z.boolean().default(true),
  apply_immediately: z.boolean().default(false),
});

export type UpdateExpBonusInput = z.infer<typeof updateExpBonusSchema>;

export type ExpBonusSettings = {
  id: number;
  exp_rate: number;
  quest_exp_rate: number;
  drop_rate: number;
  gold_rate: number;
  np_rate: number;
  is_event_active: boolean;
  event_name: string | null;
  event_start: string | null;
  event_end: string | null;
  event_exp_rate: number;
  event_quest_exp_rate: number;
  event_drop_rate: number;
  event_gold_rate: number;
  event_np_rate: number;
  broadcast_event: boolean;
  updated_at: string;
  updated_by: string;
  last_applied_at: string | null;
  last_applied_status: string | null;
};

export type EffectiveRates = {
  exp_rate: number;
  quest_exp_rate: number;
  drop_rate: number;
  gold_rate: number;
  np_rate: number;
  isEventEffective: boolean;
  eventName: string | null;
  timeRemainingSeconds: number | null;
};

export type ExpBonusHistoryEntry = {
  id: string;
  operator: string;
  action: string;
  exp_rate: number;
  drop_rate: number;
  gold_rate: number;
  np_rate: number;
  is_event_active: boolean;
  event_name: string | null;
  applied_to_server: boolean;
  note: string | null;
  created_at: string;
};

export function computeEffectiveRates(
  settings: Pick<
    ExpBonusSettings,
    | 'exp_rate'
    | 'quest_exp_rate'
    | 'drop_rate'
    | 'gold_rate'
    | 'np_rate'
    | 'is_event_active'
    | 'event_name'
    | 'event_start'
    | 'event_end'
    | 'event_exp_rate'
    | 'event_quest_exp_rate'
    | 'event_drop_rate'
    | 'event_gold_rate'
    | 'event_np_rate'
  >,
  nowMs: number = Date.now()
): EffectiveRates {
  let isEventEffective = Boolean(settings.is_event_active);
  let timeRemainingSeconds: number | null = null;

  if (isEventEffective) {
    if (settings.event_start) {
      const startTime = new Date(settings.event_start).getTime();
      if (!Number.isNaN(startTime) && nowMs < startTime) {
        isEventEffective = false;
      }
    }
    if (isEventEffective && settings.event_end) {
      const endTime = new Date(settings.event_end).getTime();
      if (!Number.isNaN(endTime)) {
        if (nowMs > endTime) {
          isEventEffective = false;
        } else {
          timeRemainingSeconds = Math.max(0, Math.floor((endTime - nowMs) / 1000));
        }
      }
    }
  }

  if (isEventEffective) {
    return {
      exp_rate: settings.event_exp_rate,
      quest_exp_rate: settings.event_quest_exp_rate,
      drop_rate: settings.event_drop_rate,
      gold_rate: settings.event_gold_rate,
      np_rate: settings.event_np_rate,
      isEventEffective: true,
      eventName: settings.event_name ?? null,
      timeRemainingSeconds,
    };
  }

  return {
    exp_rate: settings.exp_rate,
    quest_exp_rate: settings.quest_exp_rate,
    drop_rate: settings.drop_rate,
    gold_rate: settings.gold_rate,
    np_rate: settings.np_rate,
    isEventEffective: false,
    eventName: null,
    timeRemainingSeconds: null,
  };
}

export function revisionForExpBonus(settings: ExpBonusSettings): string {
  const canonical = {
    exp_rate: settings.exp_rate,
    quest_exp_rate: settings.quest_exp_rate,
    drop_rate: settings.drop_rate,
    gold_rate: settings.gold_rate,
    np_rate: settings.np_rate,
    is_event_active: settings.is_event_active,
    event_name: settings.event_name ?? '',
    event_start: settings.event_start ?? '',
    event_end: settings.event_end ?? '',
    event_exp_rate: settings.event_exp_rate,
    event_quest_exp_rate: settings.event_quest_exp_rate,
    event_drop_rate: settings.event_drop_rate,
    event_gold_rate: settings.event_gold_rate,
    event_np_rate: settings.event_np_rate,
    broadcast_event: settings.broadcast_event,
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex').slice(0, 16);
}

export function buildCgiPacket(cgiKey: string, command: string): Buffer {
  const cmdStr = `${cgiKey},${command}`;
  const cmdBuf = Buffer.from(cmdStr, 'latin1');
  const payloadLen = 2 + cmdBuf.length;
  const pkt = Buffer.alloc(2 + payloadLen);
  pkt.writeUInt16LE(payloadLen, 0);
  pkt.writeUInt16LE(cmdBuf.length, 2);
  cmdBuf.copy(pkt, 4);
  return pkt;
}
