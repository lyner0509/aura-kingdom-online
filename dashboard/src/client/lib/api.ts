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
export const api = {
  itemNames: (ids: number[]) => request<{ itemNames: Record<string, string> }>(`/ops/api/item-names?ids=${encodeURIComponent(ids.join(','))}`, { cache: 'no-store' }),
  paragon: () => request<ParagonData>('/ops/api/paragon', { cache: 'no-store' }),
  saveParagon: (revision: string, rows: ParagonData['rows']) =>
    request<{ changed: boolean; revision: string }>('/ops/api/paragon', {
      method: 'PUT', body: JSON.stringify({ revision, rows }),
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
