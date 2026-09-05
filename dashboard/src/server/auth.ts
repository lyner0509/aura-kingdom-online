import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config.js';

const COOKIE_NAME = 'aura_session';
const SESSION_AGE_SECONDS = 8 * 60 * 60;
const attempts = new Map<string, { count: number; resetAt: number }>();

type Session = { user: string; exp: number; nonce: string };

function base64url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function sign(value: string): string {
  return createHmac('sha256', config.SESSION_SECRET).update(value).digest('base64url');
}

function parseCookies(header = ''): Record<string, string> {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim().split('='))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)]),
  );
}

function tokenFor(user: string): string {
  const payload: Session = {
    user,
    exp: Math.floor(Date.now() / 1000) + SESSION_AGE_SECONDS,
    nonce: randomBytes(12).toString('hex'),
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

function readToken(req: Request): Session | null {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Session;
    if (!session.user || session.exp < Date.now() / 1000) return null;
    return session;
  } catch {
    return null;
  }
}

export function verifyPassword(password: string): boolean {
  const [, algorithm, n, r, p, salt, expectedHex] = config.DASHBOARD_PASSWORD_HASH.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  try {
    const actual = scryptSync(password, salt, 64, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    const expected = Buffer.from(expectedHex, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function canAttempt(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const state = attempts.get(ip);
  if (!state || state.resetAt < now) {
    attempts.set(ip, { count: 0, resetAt: now + 15 * 60_000 });
    return { allowed: true };
  }
  if (state.count >= 8) {
    return { allowed: false, retryAfter: Math.ceil((state.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

export function recordFailure(ip: string): void {
  const now = Date.now();
  const state = attempts.get(ip) ?? { count: 0, resetAt: now + 15 * 60_000 };
  state.count += 1;
  attempts.set(ip, state);
}

export function clearFailures(ip: string): void {
  attempts.delete(ip);
}

export function setSession(res: Response, user: string): void {
  res.cookie(COOKIE_NAME, tokenFor(user), {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_AGE_SECONDS * 1000,
    path: '/',
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const session = readToken(req);
  if (!session) {
    res.status(401).json({ error: 'Sesi tidak valid atau sudah berakhir.' });
    return;
  }
  res.locals.session = session;
  next();
}

export function currentSession(req: Request): Session | null {
  return readToken(req);
}

export function requireSameOrigin(req: Request, res: Response, next: NextFunction): void {
  if (config.NODE_ENV === 'development') return next();
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && host && new URL(origin).host !== host) {
    res.status(403).json({ error: 'Origin permintaan tidak diizinkan.' });
    return;
  }
  next();
}
