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
