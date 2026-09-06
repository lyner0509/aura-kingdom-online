import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4173),
  DASHBOARD_ADMIN_USER: z.string().min(3).default('admin'),
  DASHBOARD_PASSWORD_HASH: z.string().startsWith('$scrypt$'),
  SESSION_SECRET: z.string().min(32),
  CONTROL_COMMAND: z.string().default('/usr/local/sbin/aura-dashboard-ctl'),
  PGHOST: z.string().default('/var/run/postgresql'),
  PGUSER: z.string().default('akdashboard'),
  GAME_DB: z.string().default('FFDB1'),
  ACCOUNT_DB: z.string().default('FFAccount'),
  MEMBER_DB: z.string().default('FFMember'),
  ZONE_CGI_HOST: z.string().default('10.11.18.118'),
  ZONE_CGI_PORT: z.coerce.number().int().min(1).max(65535).default(20060),
  ZONE_CGI_KEY: z.string().default('0KjaM85BjfqjA'),
  // Highest level an operator may assign from the dashboard. Raise it
  // here when the server's own cap moves.
  PLAYER_LEVEL_CAP: z.coerce.number().int().min(1).max(255).default(99),
});

const developmentDefaults = {
  DASHBOARD_PASSWORD_HASH:
    '$scrypt$16384$8$1$6b7ca93eb4c9a9edfb190b7817534f44$7a761ca329e36c4083352cda09a65a379afeb8b9692a629c93ebd971e6cdb9a9ea82e39bca0c87bf9a23fdaae46e12552625ba1c6dc8f18150c274f61ce89194',
  SESSION_SECRET: 'local-development-secret-change-before-production',
};

const parsed = schema.safeParse({ ...developmentDefaults, ...process.env });
if (!parsed.success) {
  console.error('Invalid dashboard configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (
  parsed.data.NODE_ENV === 'production' &&
  parsed.data.SESSION_SECRET === developmentDefaults.SESSION_SECRET
) {
  console.error('SESSION_SECRET must be changed in production.');
  process.exit(1);
}

export const config = parsed.data;
