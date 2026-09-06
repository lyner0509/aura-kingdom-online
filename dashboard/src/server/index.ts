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
import { databaseHealth, getPlayerDetail, listPlayers, playerSummary } from './database.js';
import { BonusError, readBonus, saveBonus } from './bonus.js';
import { ItemMallError, readItemMall, saveItemMall } from './itemmall.js';
import { LoyaltyError, readLoyalty, saveLoyalty } from './loyalty.js';
import { itemNames, itemIconCatalog, itemIcons, readParagon, saveParagon, ParagonError } from './paragon.js';
import {
  RedeemCodeError,
  readRedeemCodes,
  createRedeemCode,
  batchGenerateRedeemCodes,
  updateRedeemCodeState,
  deleteRedeemCode,
} from './redeem-code.js';
import {
  ExpBonusError,
  readExpBonus,
  saveExpBonus,
  applyExpBonusNow,
} from './exp-bonus.js';
import {
  DropLootError,
  readDropLoot,
  saveDropLoot,
  applyDropLootNow,
} from './drop-loot.js';
import {
  VipError,
  readVipData,
  saveVipSettings,
  grantVipMember,
  revokeVipMember,
  extendVipMember,
  dispatchDailyVipMail,
} from './vip.js';
import {
  StarterPackError,
  readStarterPackData,
  saveStarterPackSettings,
  grantStarterPack,
  batchDispatchStarterPack,
  revokeStarterPackClaim,
} from './starter-pack.js';
import {
  GiftError,
  readGiftSettings,
  saveGiftSettings,
  sendPlayerGift,
  readGiftHistory,
} from './gift.js';
import { queryItemIndex } from './item-index.js';
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

app.get('/ops/api/item-icon/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).send('Invalid item ID');
    }
    const icons = await itemIconCatalog();
    const iconName = icons[String(id)];
    if (!iconName) {
      return res.status(404).send('Icon not found');
    }
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    return res.redirect(302, `/ops/item-icons/${encodeURIComponent(iconName.toLowerCase())}.webp`);
  } catch {
    return res.status(500).send('Error resolving item icon');
  }
});

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
app.get('/ops/api/players/:id/detail', async (req, res, next) => {
  try {
    const detail = await getPlayerDetail(Number(req.params.id));
    if (!detail) return res.status(404).json({ error: 'Karakter tidak ditemukan.' });
    res.json({ detail });
  } catch (error) { next(error); }
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
    res.set('Cache-Control', 'no-store').json({
      itemNames: await itemNames(ids),
      itemIcons: await itemIcons(ids),
    });
  } catch (error) { next(error); }
});
app.get('/ops/api/item-index', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const page = typeof req.query.page === 'string' ? Number(req.query.page) : undefined;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const tradable = typeof req.query.tradable === 'string' ? (req.query.tradable as 'all' | 'tradable' | 'non_tradable') : undefined;
    const sort = typeof req.query.sort === 'string' ? (req.query.sort as 'id_asc' | 'id_desc' | 'name_asc' | 'name_desc') : undefined;

    const result = await queryItemIndex({ q, page, limit, category, tradable, sort });
    res.set('Cache-Control', 'no-store').json(result);
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

app.get('/ops/api/bonus-mall', async (_req, res, next) => {
  try { res.set('Cache-Control', 'no-store').json(await readBonus()); }
  catch (error) { next(error); }
});
app.put('/ops/api/bonus-mall', async (req, res, next) => {
  try { res.json(await saveBonus(req.body, res.locals.session.user)); }
  catch (error) { next(error); }
});

app.get('/ops/api/item-mall', async (_req, res, next) => {
  try { res.set('Cache-Control', 'no-store').json(await readItemMall()); }
  catch (error) { next(error); }
});
app.put('/ops/api/item-mall', async (req, res, next) => {
  try { res.json(await saveItemMall(req.body, res.locals.session.user)); }
  catch (error) { next(error); }
});

app.get('/ops/api/redeem-codes', async (_req, res, next) => {
  try { res.set('Cache-Control', 'no-store').json(await readRedeemCodes()); }
  catch (error) { next(error); }
});
app.post('/ops/api/redeem-codes', async (req, res, next) => {
  try { res.status(201).json(await createRedeemCode(req.body, res.locals.session.user)); }
  catch (error) { next(error); }
});
app.post('/ops/api/redeem-codes/batch', async (req, res, next) => {
  try { res.status(201).json(await batchGenerateRedeemCodes(req.body, res.locals.session.user)); }
  catch (error) { next(error); }
});
app.patch('/ops/api/redeem-codes/:pin', async (req, res, next) => {
  try { res.json(await updateRedeemCodeState(req.params.pin, req.body, res.locals.session.user)); }
  catch (error) { next(error); }
});
app.delete('/ops/api/redeem-codes/:pin', async (req, res, next) => {
  try { res.json(await deleteRedeemCode(req.params.pin, res.locals.session.user)); }
  catch (error) { next(error); }
});

app.get('/ops/api/exp-bonus', async (_req, res, next) => {
  try { res.set('Cache-Control', 'no-store').json(await readExpBonus()); }
  catch (error) { next(error); }
});
app.put('/ops/api/exp-bonus', async (req, res, next) => {
  try { res.json(await saveExpBonus(req.body, res.locals.session.user)); }
  catch (error) { next(error); }
});
app.post('/ops/api/exp-bonus/apply', async (_req, res, next) => {
  try { res.json(await applyExpBonusNow(res.locals.session.user)); }
  catch (error) { next(error); }
});

app.get('/ops/api/drop-loot', async (_req, res, next) => {
  try { res.set('Cache-Control', 'no-store').json(await readDropLoot()); }
  catch (error) { next(error); }
});
app.put('/ops/api/drop-loot', async (req, res, next) => {
  try { res.json(await saveDropLoot(req.body, res.locals.session.user)); }
  catch (error) { next(error); }
});
app.post('/ops/api/drop-loot/apply', async (_req, res, next) => {
  try { res.json(await applyDropLootNow(res.locals.session.user)); }
  catch (error) { next(error); }
});

app.get('/ops/api/vip', async (_req, res, next) => {
  try { res.set('Cache-Control', 'no-store').json(await readVipData()); }
  catch (error) { next(error); }
});
app.put('/ops/api/vip/settings', async (req, res, next) => {
  try { res.json(await saveVipSettings(req.body, res.locals.session.user)); }
  catch (error) { next(error); }
});
app.post('/ops/api/vip/members', async (req, res, next) => {
  try { res.status(201).json(await grantVipMember(req.body, res.locals.session.user)); }
  catch (error) { next(error); }
});
app.delete('/ops/api/vip/members/:username', async (req, res, next) => {
  try { res.json(await revokeVipMember(req.params.username, res.locals.session.user)); }
  catch (error) { next(error); }
});
app.post('/ops/api/vip/members/:username/extend', async (req, res, next) => {
  try { res.json(await extendVipMember(req.params.username, Number(req.body?.days || 30), res.locals.session.user)); }
  catch (error) { next(error); }
});
app.post('/ops/api/vip/dispatch-mail', async (_req, res, next) => {
  try { res.json(await dispatchDailyVipMail(res.locals.session.user)); }
  catch (error) { next(error); }
});

app.get('/ops/api/starter-pack', async (_req, res, next) => {
  try { res.set('Cache-Control', 'no-store').json(await readStarterPackData()); }
  catch (error) { next(error); }
});
app.put('/ops/api/starter-pack/settings', async (req, res, next) => {
  try { res.json(await saveStarterPackSettings(req.body, res.locals.session.user)); }
  catch (error) { next(error); }
});
app.post('/ops/api/starter-pack/grant', async (req, res, next) => {
  try { res.status(201).json(await grantStarterPack(req.body, res.locals.session.user)); }
  catch (error) { next(error); }
});
app.post('/ops/api/starter-pack/batch-dispatch', async (req, res, next) => {
  try { res.json(await batchDispatchStarterPack(res.locals.session.user, Number(req.body?.min_level || 1))); }
  catch (error) { next(error); }
});
app.delete('/ops/api/starter-pack/claims/:id', async (req, res, next) => {
  try { res.json(await revokeStarterPackClaim(Number(req.params.id), res.locals.session.user)); }
  catch (error) { next(error); }
});

app.get('/ops/api/gifts/settings', async (_req, res, next) => {
  try { res.set('Cache-Control', 'no-store').json(await readGiftSettings()); }
  catch (error) { next(error); }
});
app.put('/ops/api/gifts/settings', async (req, res, next) => {
  try { res.json(await saveGiftSettings(req.body, res.locals.session.user)); }
  catch (error) { next(error); }
});
app.post('/ops/api/gifts/send', async (req, res, next) => {
  try { res.json(await sendPlayerGift(req.body, res.locals.session.user)); }
  catch (error) { next(error); }
});
app.get('/ops/api/gifts/history', async (req, res, next) => {
  try { res.set('Cache-Control', 'no-store').json(await readGiftHistory(Number(req.query.limit || 50))); }
  catch (error) { next(error); }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (
    error instanceof ParagonError ||
    error instanceof LoyaltyError ||
    error instanceof BonusError ||
    error instanceof ItemMallError ||
    error instanceof RedeemCodeError ||
    error instanceof ExpBonusError ||
    error instanceof DropLootError ||
    error instanceof VipError ||
    error instanceof StarterPackError ||
    error instanceof GiftError
  ) return res.status(error.status).json({ error: error.message });
  console.error(error);
  if (error instanceof z.ZodError) return res.status(400).json({ error: 'Parameter permintaan tidak valid.' });
  return res.status(500).json({ error: 'Operasi gagal. Periksa log service dashboard.' });
});

const here = dirname(fileURLToPath(import.meta.url));
const staticDir = resolve(here, '../dist');

const iconDirs = [
  resolve(here, '../dist/item-icons'),
  resolve(here, '../../src/client/public/item-icons'),
  resolve(process.cwd(), 'src/client/public/item-icons'),
  '/opt/aura-dashboard/current/dist/item-icons',
];
for (const iconDir of iconDirs) {
  if (existsSync(iconDir)) {
    app.use('/ops/item-icons', express.static(iconDir, { maxAge: '7d', immutable: true }));
    break;
  }
}

const classIconDirs = [
  resolve(here, '../dist/class-icons'),
  resolve(here, '../../src/client/public/class-icons'),
  resolve(process.cwd(), 'src/client/public/class-icons'),
  '/opt/aura-dashboard/current/dist/class-icons',
];
for (const classIconDir of classIconDirs) {
  if (existsSync(classIconDir)) {
    app.use('/ops/class-icons', express.static(classIconDir, { maxAge: '7d', immutable: true }));
    break;
  }
}

const avatarDirs = [
  resolve(here, '../dist/avatars'),
  resolve(here, '../../src/client/public/avatars'),
  resolve(process.cwd(), 'src/client/public/avatars'),
  '/opt/aura-dashboard/current/dist/avatars',
];
for (const avatarDir of avatarDirs) {
  if (existsSync(avatarDir)) {
    app.use('/ops/avatars', express.static(avatarDir, { maxAge: '7d', immutable: true }));
    break;
  }
}

if (existsSync(staticDir)) {
  app.use('/ops', express.static(staticDir, { maxAge: '1h', etag: true }));
  app.get(['/ops', '/ops/', '/ops/*splat'], (_req, res) => res.sendFile(resolve(staticDir, 'index.html')));
}

app.listen(config.PORT, '127.0.0.1', () => {
  console.log(`Aura Kingdom Operations listening on http://127.0.0.1:${config.PORT}`);
});
