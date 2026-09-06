import { createHash } from 'node:crypto';
import { z } from 'zod';

export const dropRateNumberSchema = z.coerce
  .number()
  .int()
  .min(50, 'Rate minimal adalah 50% (0.5x)')
  .max(1000, 'Rate maksimal adalah 1000% (10x)');

export const chanceNumberSchema = z.coerce
  .number()
  .int()
  .min(0, 'Peluang minimal adalah 0%')
  .max(100, 'Peluang maksimal adalah 100%');

export const rareRateNumberSchema = z.coerce
  .number()
  .int()
  .min(50, 'Rate minimal adalah 50% (0.5x)')
  .max(500, 'Rate maksimal adalah 500% (5x)');

export const updateDropLootSchema = z.object({
  revision: z.string().min(1, 'Revision diperlukan.'),
  drop_rate: dropRateNumberSchema,
  boss_drop_rate: dropRateNumberSchema,
  dungeon_drop_rate: dropRateNumberSchema,
  quest_drop_rate: dropRateNumberSchema,
  gold_drop_rate: dropRateNumberSchema,
  extra_loot_chance: chanceNumberSchema,
  rare_drop_rate: rareRateNumberSchema,
  is_event_active: z.boolean().default(false),
  event_name: z.string().max(120).nullable().optional(),
  event_start: z.string().nullable().optional(),
  event_end: z.string().nullable().optional(),
  event_drop_rate: dropRateNumberSchema.default(200),
  event_boss_drop_rate: dropRateNumberSchema.default(150),
  event_dungeon_drop_rate: dropRateNumberSchema.default(200),
  event_quest_drop_rate: dropRateNumberSchema.default(150),
  event_gold_drop_rate: dropRateNumberSchema.default(150),
  event_extra_loot_chance: chanceNumberSchema.default(25),
  event_rare_drop_rate: rareRateNumberSchema.default(150),
  broadcast_event: z.boolean().default(true),
  apply_immediately: z.boolean().default(false),
});

export type UpdateDropLootInput = z.infer<typeof updateDropLootSchema>;

export type DropLootSettings = {
  id: number;
  drop_rate: number;
  boss_drop_rate: number;
  dungeon_drop_rate: number;
  quest_drop_rate: number;
  gold_drop_rate: number;
  extra_loot_chance: number;
  rare_drop_rate: number;
  is_event_active: boolean;
  event_name: string | null;
  event_start: string | null;
  event_end: string | null;
  event_drop_rate: number;
  event_boss_drop_rate: number;
  event_dungeon_drop_rate: number;
  event_quest_drop_rate: number;
  event_gold_drop_rate: number;
  event_extra_loot_chance: number;
  event_rare_drop_rate: number;
  broadcast_event: boolean;
  updated_at: string;
  updated_by: string;
  last_applied_at: string | null;
  last_applied_status: string | null;
};

export type EffectiveDropRates = {
  drop_rate: number;
  boss_drop_rate: number;
  dungeon_drop_rate: number;
  quest_drop_rate: number;
  gold_drop_rate: number;
  extra_loot_chance: number;
  rare_drop_rate: number;
  isEventEffective: boolean;
  eventName: string | null;
  timeRemainingSeconds: number | null;
};

export type DropLootHistoryEntry = {
  id: string;
  operator: string;
  action: string;
  drop_rate: number;
  boss_drop_rate: number;
  dungeon_drop_rate: number;
  gold_drop_rate: number;
  extra_loot_chance: number;
  rare_drop_rate: number;
  is_event_active: boolean;
  event_name: string | null;
  applied_to_server: boolean;
  note: string | null;
  created_at: string;
};

export function computeEffectiveDropRates(
  settings: Pick<
    DropLootSettings,
    | 'drop_rate'
    | 'boss_drop_rate'
    | 'dungeon_drop_rate'
    | 'quest_drop_rate'
    | 'gold_drop_rate'
    | 'extra_loot_chance'
    | 'rare_drop_rate'
    | 'is_event_active'
    | 'event_name'
    | 'event_start'
    | 'event_end'
    | 'event_drop_rate'
    | 'event_boss_drop_rate'
    | 'event_dungeon_drop_rate'
    | 'event_quest_drop_rate'
    | 'event_gold_drop_rate'
    | 'event_extra_loot_chance'
    | 'event_rare_drop_rate'
  >,
  nowMs: number = Date.now()
): EffectiveDropRates {
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
      drop_rate: settings.event_drop_rate,
      boss_drop_rate: settings.event_boss_drop_rate,
      dungeon_drop_rate: settings.event_dungeon_drop_rate,
      quest_drop_rate: settings.event_quest_drop_rate,
      gold_drop_rate: settings.event_gold_drop_rate,
      extra_loot_chance: settings.event_extra_loot_chance,
      rare_drop_rate: settings.event_rare_drop_rate,
      isEventEffective: true,
      eventName: settings.event_name ?? null,
      timeRemainingSeconds,
    };
  }

  return {
    drop_rate: settings.drop_rate,
    boss_drop_rate: settings.boss_drop_rate,
    dungeon_drop_rate: settings.dungeon_drop_rate,
    quest_drop_rate: settings.quest_drop_rate,
    gold_drop_rate: settings.gold_drop_rate,
    extra_loot_chance: settings.extra_loot_chance,
    rare_drop_rate: settings.rare_drop_rate,
    isEventEffective: false,
    eventName: null,
    timeRemainingSeconds: null,
  };
}

export function revisionForDropLoot(settings: DropLootSettings): string {
  const canonical = {
    drop_rate: settings.drop_rate,
    boss_drop_rate: settings.boss_drop_rate,
    dungeon_drop_rate: settings.dungeon_drop_rate,
    quest_drop_rate: settings.quest_drop_rate,
    gold_drop_rate: settings.gold_drop_rate,
    extra_loot_chance: settings.extra_loot_chance,
    rare_drop_rate: settings.rare_drop_rate,
    is_event_active: settings.is_event_active,
    event_name: settings.event_name ?? '',
    event_start: settings.event_start ?? '',
    event_end: settings.event_end ?? '',
    event_drop_rate: settings.event_drop_rate,
    event_boss_drop_rate: settings.event_boss_drop_rate,
    event_dungeon_drop_rate: settings.event_dungeon_drop_rate,
    event_quest_drop_rate: settings.event_quest_drop_rate,
    event_gold_drop_rate: settings.event_gold_drop_rate,
    event_extra_loot_chance: settings.event_extra_loot_chance,
    event_rare_drop_rate: settings.event_rare_drop_rate,
    broadcast_event: settings.broadcast_event,
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex').slice(0, 16);
}
