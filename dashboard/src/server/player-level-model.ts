import { z } from 'zod';

export type AssignmentStatus = 'pending' | 'applied' | 'failed' | 'cancelled';

export type PlayerLevelAssignment = {
  player_id: string;
  player_name: string;
  target_level: number;
  from_level: number | null;
  status: AssignmentStatus;
  attempts: number;
  last_error: string | null;
  requested_by: string;
  requested_at: string;
  applied_at: string | null;
  /** Filled in when the list is read, not stored. */
  online?: boolean;
  current_level?: number | null;
};

export type PlayerLevelHistoryEntry = {
  id: string;
  player_id: string;
  player_name: string;
  from_level: number | null;
  to_level: number;
  action: string;
  operator: string;
  details: string | null;
  created_at: string;
};

export type PlayerLevelData = {
  levelCap: number;
  assignments: PlayerLevelAssignment[];
  history: PlayerLevelHistoryEntry[];
};

export const assignPlayerLevelSchema = z.object({
  player_id: z.coerce.number().int().min(1, 'Karakter harus dipilih.'),
  target_level: z.coerce
    .number()
    .int()
    .min(1, 'Level minimal 1.')
    .max(255, 'Level maksimal 255.'),
  note: z.string().max(200).optional(),
});

export type AssignPlayerLevelInput = z.infer<typeof assignPlayerLevelSchema>;

export const cancelPlayerLevelSchema = z.object({
  player_id: z.coerce.number().int().min(1),
});

/**
 * What should happen to an assignment right now.
 *
 * A character that is online is held in ZoneServer memory and written
 * back to the database when it is saved, so writing the level while the
 * player is connected would simply be overwritten. Those wait instead,
 * and the sweep picks them up once the character is gone.
 */
export type AssignmentPlan =
  | { action: 'apply-now'; reason: string }
  | { action: 'queue'; reason: string }
  | { action: 'noop'; reason: string };

export function planFor(input: {
  online: boolean;
  currentLevel: number | null;
  targetLevel: number;
}): AssignmentPlan {
  if (input.currentLevel !== null && input.currentLevel === input.targetLevel) {
    return { action: 'noop', reason: `Karakter sudah berada di level ${input.targetLevel}.` };
  }
  if (input.online) {
    return {
      action: 'queue',
      reason: 'Karakter sedang online. Level akan diterapkan otomatis setelah logout.',
    };
  }
  return { action: 'apply-now', reason: 'Karakter sedang offline. Level diterapkan sekarang.' };
}

/** Guards the operator-supplied level against the configured server cap. */
export function checkLevelCap(targetLevel: number, levelCap: number): string | null {
  if (targetLevel > levelCap) {
    return `Level ${targetLevel} melebihi batas server (${levelCap}).`;
  }
  return null;
}

export function describeChange(fromLevel: number | null, toLevel: number): string {
  if (fromLevel === null) return `Set ke level ${toLevel}`;
  if (toLevel > fromLevel) return `Naik dari level ${fromLevel} ke ${toLevel}`;
  if (toLevel < fromLevel) return `Turun dari level ${fromLevel} ke ${toLevel}`;
  return `Tetap di level ${toLevel}`;
}
