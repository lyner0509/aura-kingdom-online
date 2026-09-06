import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  canAttempt,
  clearFailures,
  clearSession,
  currentSession,
  recordFailure,
  requireAuth,
  requireSameOrigin,
  setSession,
  verifyPassword,
} from './auth.js';
import { config } from './config.js';
import { databaseHealth, listPlayers, playerSummary } from './database.js';
import { LoyaltyError, readLoyalty, saveLoyalty } from './loyalty.js';
import { itemNames, readParagon, saveParagon, ParagonError } from './paragon.js';
import {
  controlService,
  readServiceLog,
  SERVICE_NAMES,
  serviceStatus,
  systemMetrics,
  type ServiceName,
} from './system.js';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '256kb' }));
app.use('/ops/api', requireSameOrigin);

app.get('/ops/api/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/ops/api/auth/session', (req, res) => {
  const session = currentSession(req);
  if (!session) return res.status(401).json({ authenticated: false });
  return res.json({ authenticated: true, user: session.user, expiresAt: session.exp * 1000 });
});

const loginSchema = z.object({ username: z.string().min(1).max(80), password: z.string().min(1).max(512) });
app.post('/ops/api/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Username dan password wajib diisi.' });

  const ip = req.ip ?? 'unknown';
  const attempt = canAttempt(ip);
  if (!attempt.allowed) {
    res.setHeader('Retry-After', String(attempt.retryAfter));
    return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi beberapa menit.' });
  }

  const userOk = parsed.data.username === config.DASHBOARD_ADMIN_USER;
  const passwordOk = verifyPassword(parsed.data.password);
  if (!userOk || !passwordOk) {
    recordFailure(ip);
    await new Promise((done) => setTimeout(done, 450));
    return res.status(401).json({ error: 'Username atau password tidak cocok.' });
  }

  clearFailures(ip);
  setSession(res, parsed.data.username);
  return res.json({ authenticated: true, user: parsed.data.username });
});

app.delete('/ops/api/auth/session', (_req, res) => {
  clearSession(res);
  res.status(204).end();
});

app.use('/ops/api', requireAuth);

app.get('/ops/api/overview', async (_req, res, next) => {
  try {
    const [system, services, database, players] = await Promise.all([
      systemMetrics(),
      serviceStatus(),
      databaseHealth(),
      playerSummary().catch(() => ({ total: 0, online: 0, maxLevel: 0 })),
    ]);
    res.json({ system, services, database, players });
  } catch (error) {
    next(error);
  }
});

const actionSchema = z.enum(['start', 'stop', 'restart']);
app.post('/ops/api/services/:action', async (req, res, next) => {
  try {
    const action = actionSchema.parse(req.params.action);
    const output = await controlService(action);
    res.json({ ok: true, action, output });
  } catch (error) {
    next(error);
  }
});

app.get('/ops/api/logs', async (req, res, next) => {
  try {
    const service = z.enum(SERVICE_NAMES).parse(req.query.service ?? 'WorldServer');
    const lines = z.coerce.number().int().min(20).max(500).default(120).parse(req.query.lines);
    const content = await readServiceLog(service as ServiceName, lines);
    res.json({ service, lines, content });
  } catch (error) {
    next(error);
  }
});

app.get('/ops/api/players', async (req, res, next) => {
  try {
    const search = z.string().max(80).default('').parse(req.query.search);
    const limit = z.coerce.number().int().min(1).max(100).default(40).parse(req.query.limit);
    res.json({ players: await listPlayers(search, limit) });
  } catch (error) {
    next(error);
  }
});

app.get('/ops/api/paragon', async (_req, res, next) => {
  try { res.set('Cache-Control', 'no-store').json(await readParagon()); }
  catch (error) { next(error); }
});
app.get('/ops/api/item-names', async (req, res, next) => {
  try {
    const raw = z.string().min(1).max(1600).parse(req.query.ids);
    const ids = [...new Set(raw.split(',').map(value => Number(value)))];
    if (!ids.length || ids.length > 150 || ids.some(id => !Number.isSafeInteger(id) || id < 1 || id > 2147483647)) {
      throw new ParagonError(400, 'Daftar Item ID tidak valid.');
    }
    res.set('Cache-Control', 'no-store').json({ itemNames: await itemNames(ids) });
  } catch (error) { next(error); }
});
app.put('/ops/api/paragon', async (req, res, next) => {
  try { res.json(await saveParagon(req.body, res.locals.session.user)); }
  catch (error) { next(error); }
});

app.get('/ops/api/loyalty', async (_req, res, next) => {
  try { res.set('Cache-Control', 'no-store').json(await readLoyalty()); }
  catch (error) { next(error); }
});
app.put('/ops/api/loyalty', async (req, res, next) => {
  try { res.json(await saveLoyalty(req.body, res.locals.session.user)); }
  catch (error) { next(error); }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ParagonError || error instanceof LoyaltyError) return res.status(error.status).json({ error: error.message });
  console.error(error);
  if (error instanceof z.ZodError) return res.status(400).json({ error: 'Parameter permintaan tidak valid.' });
  return res.status(500).json({ error: 'Operasi gagal. Periksa log service dashboard.' });
});

const here = dirname(fileURLToPath(import.meta.url));
const staticDir = resolve(here, '../dist');
if (existsSync(staticDir)) {
  app.use('/ops', express.static(staticDir, { maxAge: '1h', etag: true }));
  app.get('/ops/*splat', (_req, res) => res.sendFile(resolve(staticDir, 'index.html')));
}

app.listen(config.PORT, '127.0.0.1', () => {
  console.log(`Aura Kingdom Operations listening on http://127.0.0.1:${config.PORT}`);
});
