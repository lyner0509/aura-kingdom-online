export type ServiceState = {
  name: string;
  online: boolean;
  pid: number | null;
  cpu: number;
  memoryMb: number;
  uptimeSeconds: number | null;
};

export type Overview = {
  system: {
    hostname: string;
    uptimeSeconds: number;
    load: number[];
    memory: { used: number; total: number };
    disk: { usedPercent: number; used: number | string; total: number | string };
    sampledAt: string;
  };
  services: ServiceState[];
  database: { available: boolean; latencyMs: number };
  players: { total: number; online: number; maxLevel: number };
};

export type Player = {
  id: string;
  name: string;
  level: number;
  classId: number | null;
  online: boolean;
  lastSeen: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Permintaan gagal (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type { ParagonReward } from '../../server/paragon-model';
export type ParagonData = {
  rows: import('../../server/paragon-model').ParagonReward[];
  itemNames: Record<string, string>;
  revision: string;
  history: { id: string; actor: string; createdAt: string }[];
  readOnly: boolean;
};

export type { LoyaltyItem } from '../../server/loyalty-model';
export type LoyaltyData = {
  rows: import('../../server/loyalty-model').LoyaltyItem[];
  itemNames: Record<string, string>;
  revision: string;
  history: { id: string; actor: string; createdAt: string }[];
  readOnly: boolean;
};

export type { BonusItem } from '../../server/bonus-model';
export type BonusData = {
  rows: import('../../server/bonus-model').BonusItem[];
  itemNames: Record<string, string>;
  revision: string;
  history: { id: string; actor: string; createdAt: string }[];
  readOnly: boolean;
};

export type { ItemMallItem } from '../../server/itemmall-model';
export type ItemMallData = {
  rows: import('../../server/itemmall-model').ItemMallItem[];
  itemNames: Record<string, string>;
  revision: string;
  history: { id: string; actor: string; createdAt: string }[];
  readOnly: boolean;
};

export type RedeemCodeReward = {
  item_id: number;
  item_name?: string;
  item_num: number;
  rate: number;
  set: number;
};

export type RedeemCodeItem = {
  pin: string;
  password: string;
  rule_id: number;
  description: string;
  state: 'open' | 'used' | 'create' | 'disabled';
  pin_set: number;
  account_id: number;
  account_name?: string | null;
  character_id: number;
  character_name?: string | null;
  log_time: string | null;
  rewards: RedeemCodeReward[];
};

export type RedeemCodeData = {
  codes: RedeemCodeItem[];
  itemNames: Record<string, string>;
  revision: string;
  history: { id: string; operator: string; action: string; pin?: string; rule_id?: number; details: string; createdAt: string }[];
  readOnly: boolean;
};

export type CreateRedeemCodePayload = {
  pin: string;
  password?: string;
  description: string;
  pin_set?: number;
  state?: 'open' | 'create' | 'disabled';
  rewards: { item_id: number; item_num: number; rate?: number; set?: number }[];
};

export type BatchGenerateRedeemCodePayload = {
  prefix?: string;
  count: number;
  password?: string;
  description: string;
  pin_set?: number;
  state?: 'open' | 'create' | 'disabled';
  rewards: { item_id: number; item_num: number; rate?: number; set?: number }[];
};

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

export type ExpBonusData = {
  settings: ExpBonusSettings;
  effectiveRates: EffectiveRates;
  revision: string;
  history: ExpBonusHistoryEntry[];
  readOnly: boolean;
};

export type UpdateExpBonusPayload = {
  revision: string;
  exp_rate: number;
  quest_exp_rate: number;
  drop_rate: number;
  gold_rate: number;
  np_rate: number;
  is_event_active: boolean;
  event_name?: string | null;
  event_start?: string | null;
  event_end?: string | null;
  event_exp_rate: number;
  event_quest_exp_rate: number;
  event_drop_rate: number;
  event_gold_rate: number;
  broadcast_event: boolean;
  apply_immediately?: boolean;
};

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

export type DropLootData = {
  settings: DropLootSettings;
  effectiveRates: EffectiveDropRates;
  revision: string;
  history: DropLootHistoryEntry[];
  readOnly: boolean;
};

export type UpdateDropLootPayload = {
  revision: string;
  drop_rate: number;
  boss_drop_rate: number;
  dungeon_drop_rate: number;
  quest_drop_rate: number;
  gold_drop_rate: number;
  extra_loot_chance: number;
  rare_drop_rate: number;
  is_event_active: boolean;
  event_name?: string | null;
  event_start?: string | null;
  event_end?: string | null;
  event_drop_rate: number;
  event_boss_drop_rate: number;
  event_dungeon_drop_rate: number;
  event_quest_drop_rate: number;
  event_gold_drop_rate: number;
  event_extra_loot_chance: number;
  event_rare_drop_rate: number;
  broadcast_event: boolean;
  apply_immediately?: boolean;
};

export type VipTier = {
  level: number;
  name: string;
  required_points: number;
  exp_bonus_percent: number;
  drop_bonus_percent: number;
  gold_bonus_percent: number;
  move_speed_percent: number;
  daily_loyalty_points: number;
  daily_item_id: number;
  daily_item_count: number;
  buff_desc: string;
};

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

export type VipData = {
  settings: VipSettings;
  tiers: VipTier[];
  members: AccountVip[];
  stats: {
    totalVipAccounts: number;
    activeVipAccounts: number;
    maxVipLevel: number;
    totalVipPoints: number;
  };
  revision: string;
  history: VipHistoryEntry[];
  readOnly: boolean;
};

export type UpdateVipSettingsPayload = {
  revision: string;
  is_enabled: boolean;
  points_per_ap: number;
  auto_vip_on_spending: boolean;
  daily_mail_reward_enabled: boolean;
  daily_mail_title: string;
  daily_mail_content: string;
  tiers: VipTier[];
};

export type GrantVipPayload = {
  username: string;
  vip_level: number;
  vip_points?: number;
  duration_days?: number | null;
  custom_expires_at?: string | null;
};

export const api = {
  itemNames: (ids: number[]) => request<{ itemNames: Record<string, string> }>(`/ops/api/item-names?ids=${encodeURIComponent(ids.join(','))}`, { cache: 'no-store' }),
  paragon: () => request<ParagonData>('/ops/api/paragon', { cache: 'no-store' }),
  saveParagon: (revision: string, rows: ParagonData['rows']) =>
    request<{ changed: boolean; revision: string }>('/ops/api/paragon', {
      method: 'PUT', body: JSON.stringify({ revision, rows }),
    }),
  loyalty: () => request<LoyaltyData>('/ops/api/loyalty', { cache: 'no-store' }),
  saveLoyalty: (revision: string, rows: LoyaltyData['rows']) =>
    request<{ changed: boolean; revision: string }>('/ops/api/loyalty', {
      method: 'PUT', body: JSON.stringify({ revision, rows }),
    }),
  bonus: () => request<BonusData>('/ops/api/bonus-mall', { cache: 'no-store' }),
  saveBonus: (revision: string, rows: BonusData['rows']) =>
    request<{ changed: boolean; revision: string }>('/ops/api/bonus-mall', {
      method: 'PUT', body: JSON.stringify({ revision, rows }),
    }),
  itemMall: () => request<ItemMallData>('/ops/api/item-mall', { cache: 'no-store' }),
  saveItemMall: (revision: string, rows: ItemMallData['rows']) =>
    request<{ changed: boolean; revision: string }>('/ops/api/item-mall', {
      method: 'PUT', body: JSON.stringify({ revision, rows }),
    }),
  redeemCodes: () => request<RedeemCodeData>('/ops/api/redeem-codes', { cache: 'no-store' }),
  createRedeemCode: (payload: CreateRedeemCodePayload) =>
    request<{ ok: boolean; pin: string; ruleId: number }>('/ops/api/redeem-codes', {
      method: 'POST', body: JSON.stringify(payload),
    }),
  batchGenerateRedeemCodes: (payload: BatchGenerateRedeemCodePayload) =>
    request<{ ok: boolean; count: number; ruleId: number; pins: string[] }>('/ops/api/redeem-codes/batch', {
      method: 'POST', body: JSON.stringify(payload),
    }),
  updateRedeemCodeState: (pin: string, state: 'open' | 'create' | 'disabled') =>
    request<{ ok: boolean; pin: string; state: string }>(`/ops/api/redeem-codes/${encodeURIComponent(pin)}`, {
      method: 'PATCH', body: JSON.stringify({ state }),
    }),
  deleteRedeemCode: (pin: string) =>
    request<{ ok: boolean; pin: string }>(`/ops/api/redeem-codes/${encodeURIComponent(pin)}`, {
      method: 'DELETE',
    }),
  expBonus: () => request<ExpBonusData>('/ops/api/exp-bonus', { cache: 'no-store' }),
  saveExpBonus: (payload: UpdateExpBonusPayload) =>
    request<{ ok: boolean; revision: string; effectiveRates: EffectiveRates; applied: boolean; message: string }>('/ops/api/exp-bonus', {
      method: 'PUT', body: JSON.stringify(payload),
    }),
  applyExpBonusNow: () =>
    request<{ ok: boolean; effectiveRates: EffectiveRates; applied: boolean; message: string }>('/ops/api/exp-bonus/apply', {
      method: 'POST',
    }),
  dropLoot: () => request<DropLootData>('/ops/api/drop-loot', { cache: 'no-store' }),
  saveDropLoot: (payload: UpdateDropLootPayload) =>
    request<{ ok: boolean; revision: string; effectiveRates: EffectiveDropRates; applied: boolean; message: string }>('/ops/api/drop-loot', {
      method: 'PUT', body: JSON.stringify(payload),
    }),
  applyDropLootNow: () =>
    request<{ ok: boolean; effectiveRates: EffectiveDropRates; applied: boolean; message: string }>('/ops/api/drop-loot/apply', {
      method: 'POST',
    }),
  vip: () => request<VipData>('/ops/api/vip', { cache: 'no-store' }),
  saveVipSettings: (payload: UpdateVipSettingsPayload) =>
    request<{ ok: boolean; revision: string; message: string }>('/ops/api/vip/settings', {
      method: 'PUT', body: JSON.stringify(payload),
    }),
  grantVip: (payload: GrantVipPayload) =>
    request<{ ok: boolean; message: string; member: AccountVip }>('/ops/api/vip/members', {
      method: 'POST', body: JSON.stringify(payload),
    }),
  revokeVip: (username: string) =>
    request<{ ok: boolean; message: string }>(`/ops/api/vip/members/${encodeURIComponent(username)}`, {
      method: 'DELETE',
    }),
  extendVip: (username: string, days = 30) =>
    request<{ ok: boolean; message: string; expires_at: string }>(`/ops/api/vip/members/${encodeURIComponent(username)}/extend`, {
      method: 'POST', body: JSON.stringify({ days }),
    }),
  dispatchVipMail: () =>
    request<{ ok: boolean; dispatchedCount: number; message: string }>('/ops/api/vip/dispatch-mail', {
      method: 'POST',
    }),
  session: () => request<{ authenticated: boolean; user: string; expiresAt: number }>('/ops/api/auth/session'),
  login: (username: string, password: string) =>
    request<{ authenticated: true; user: string }>('/ops/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<void>('/ops/api/auth/session', { method: 'DELETE' }),
  overview: () => request<Overview>('/ops/api/overview'),
  control: (action: 'start' | 'stop' | 'restart') =>
    request<{ ok: boolean; output: string }>(`/ops/api/services/${action}`, { method: 'POST' }),
  logs: (service: string, lines = 120) =>
    request<{ service: string; content: string }>(`/ops/api/logs?service=${encodeURIComponent(service)}&lines=${lines}`),
  players: (search = '', signal?: AbortSignal) =>
    request<{ players: Player[] }>(`/ops/api/players?search=${encodeURIComponent(search)}&limit=60`, { signal, cache: 'no-store' }),
};
