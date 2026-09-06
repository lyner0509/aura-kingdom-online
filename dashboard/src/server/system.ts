import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { config } from './config.js';

const execFileAsync = promisify(execFile);

export const SERVICE_NAMES = [
  'TicketServer',
  'GatewayServer',
  'LoginServer',
  'MissionServer',
  'WorldServer',
  'ZoneServer',
] as const;

export type ServiceName = (typeof SERVICE_NAMES)[number];
export type ServiceState = {
  name: ServiceName;
  online: boolean;
  pid: number | null;
  cpu: number;
  memoryMb: number;
  uptimeSeconds: number | null;
};

async function controller(args: string[]): Promise<string> {
  const { stdout, stderr } = await execFileAsync('sudo', [config.CONTROL_COMMAND, ...args], {
    timeout: args[0] === 'restart' || args[0] === 'start' || args[0] === 'stop' ? 120_000 : 10_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  return `${stdout}${stderr}`.trim();
}

export async function serviceStatus(): Promise<ServiceState[]> {
  if (config.NODE_ENV === 'development') {
    return SERVICE_NAMES.map((name, index) => ({
      name,
      online: index !== 3,
      pid: index !== 3 ? 3200 + index * 17 : null,
      cpu: index === 5 ? 12.7 : index !== 3 ? 0.8 + index * 0.4 : 0,
      memoryMb: index === 5 ? 684 : index !== 3 ? 22 + index * 74 : 0,
      uptimeSeconds: index !== 3 ? 274_120 - index * 153 : null,
    }));
  }
  const output = await controller(['status', '--json']);
  return JSON.parse(output) as ServiceState[];
}

export async function controlService(action: 'start' | 'stop' | 'restart'): Promise<string> {
  if (config.NODE_ENV === 'development') return `Simulasi ${action} berhasil.`;
  return controller([action]);
}

export async function readServiceLog(service: ServiceName, lines: number): Promise<string> {
  if (config.NODE_ENV === 'development') {
    const stamp = new Date().toISOString();
    return Array.from({ length: Math.min(lines, 22) }, (_, index) =>
      `${stamp} [${service}] ${index % 5 === 0 ? 'heartbeat accepted' : 'worker tick completed'}`,
    ).join('\n');
  }
  return controller(['logs', service, String(lines)]);
}

export type ActivePlayersResult = {
  online: number;
  accounts: number[];
  characters: number[];
};

let cachedActivePlayers: { data: ActivePlayersResult; expiresAt: number } | null = null;

/**
 * Same reading as getActivePlayers, but it throws instead of reporting an
 * empty realm when the controller cannot be reached. Callers that decide
 * whether it is safe to write to a character's row must be able to tell
 * "nobody is online" apart from "we could not find out".
 */
export async function getActivePlayersStrict(): Promise<ActivePlayersResult> {
  if (config.NODE_ENV === 'development') return getActivePlayers();

  const now = Date.now();
  if (cachedActivePlayers && cachedActivePlayers.expiresAt > now) {
    return cachedActivePlayers.data;
  }
  const raw = await controller(['active-players']);
  const data = JSON.parse(raw) as ActivePlayersResult;
  if (!data || !Array.isArray(data.characters)) {
    throw new Error('Daftar pemain online tidak bisa dibaca.');
  }
  cachedActivePlayers = { data, expiresAt: now + 3000 };
  return data;
}

export async function getActivePlayers(): Promise<ActivePlayersResult> {
  if (config.NODE_ENV === 'development') {
    return {
      online: 2,
      accounts: [2418, 2419],
      characters: [10482, 10431],
    };
  }

  const now = Date.now();
  if (cachedActivePlayers && cachedActivePlayers.expiresAt > now) {
    return cachedActivePlayers.data;
  }

  try {
    const raw = await controller(['active-players']);
    const data = JSON.parse(raw) as ActivePlayersResult;
    cachedActivePlayers = { data, expiresAt: now + 3000 };
    return data;
  } catch (error) {
    console.error('Failed to get active players from controller:', error);
    return { online: 0, accounts: [], characters: [] };
  }
}

function parseMeminfo(value: string): { total: number; available: number } {
  const fields = Object.fromEntries(
    value
      .split('\n')
      .map((line) => line.match(/^(\w+):\s+(\d+)/))
      .filter(Boolean)
      .map((match) => [match![1], Number(match![2]) * 1024]),
  );
  return { total: fields.MemTotal ?? 0, available: fields.MemAvailable ?? 0 };
}

export async function systemMetrics() {
  if (config.NODE_ENV === 'development') {
    return {
      hostname: 'aura-v15-local',
      uptimeSeconds: 274_200,
      load: [0.42, 0.36, 0.31],
      memory: { used: 1_392_640_000, total: 3_865_470_000 },
      disk: { usedPercent: 30, used: '18G', total: '59G' },
      sampledAt: new Date().toISOString(),
    };
  }

  const [uptimeText, loadText, memoryText, hostname, diskOutput] = await Promise.all([
    readFile('/proc/uptime', 'utf8'),
    readFile('/proc/loadavg', 'utf8'),
    readFile('/proc/meminfo', 'utf8'),
    readFile('/etc/hostname', 'utf8'),
    execFileAsync('df', ['-B1', '--output=size,used,pcent', '/']),
  ]);
  const memory = parseMeminfo(memoryText);
  const diskLine = diskOutput.stdout.trim().split('\n').at(-1)?.trim().split(/\s+/) ?? [];

  return {
    hostname: hostname.trim(),
    uptimeSeconds: Number.parseFloat(uptimeText),
    load: loadText.split(' ').slice(0, 3).map(Number),
    memory: { used: memory.total - memory.available, total: memory.total },
    disk: {
      total: Number(diskLine[0] ?? 0),
      used: Number(diskLine[1] ?? 0),
      usedPercent: Number.parseInt(diskLine[2] ?? '0'),
    },
    sampledAt: new Date().toISOString(),
  };
}
