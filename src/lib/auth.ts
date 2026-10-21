import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { store } from './store';
const authPath = () => path.resolve(process.env.LOCAL_DATA_DIR || '.local', 'auth.json');
export const cookieName = 'cadu_session';
export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
function localAuth(): { hash: string; secret: string } | null {
  if (process.env.NODE_ENV === 'production' || !existsSync(authPath())) return null;
  return JSON.parse(readFileSync(authPath(), 'utf8'));
}
export function configured() {
  return (
    !!(
      process.env.ADMIN_PASSWORD_HASH &&
      process.env.SESSION_SECRET &&
      process.env.SESSION_SECRET.length >= 32
    ) || !!localAuth()
  );
}
export function setup(password: string) {
  if (process.env.NODE_ENV === 'production' || configured())
    throw new Error('Cadastro inicial indisponível.');
  mkdirSync(path.dirname(authPath()), { recursive: true });
  writeFileSync(
    authPath(),
    JSON.stringify({ hash: hashPassword(password), secret: randomBytes(48).toString('hex') }),
    { mode: 0o600, flag: 'wx' },
  );
}
export function verifyPassword(password: string) {
  const hash = process.env.ADMIN_PASSWORD_HASH || localAuth()?.hash || '';
  const [salt, value] = hash.split(':');
  if (!salt || !/^[a-f0-9]{128}$/i.test(value || '')) return false;
  return timingSafeEqual(Buffer.from(value, 'hex'), scryptSync(password, salt, 64));
}
function secret() {
  const value = process.env.SESSION_SECRET || localAuth()?.secret;
  if (!value || value.length < 32) throw new Error('Sessão não configurada.');
  return value;
}
export function signSession(now = Date.now()) {
  const body = Buffer.from(
    JSON.stringify({ exp: now + 8 * 60 * 60 * 1000, nonce: randomBytes(12).toString('hex') }),
  ).toString('base64url');
  return `${body}.${createHmac('sha256', secret()).update(body).digest('base64url')}`;
}
export function validSession(value: string | undefined, now = Date.now()) {
  if (!value || !configured()) return false;
  try {
    const [body, sig] = value.split('.');
    const expected = createHmac('sha256', secret()).update(body).digest('base64url');
    return (
      sig?.length === expected.length &&
      timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) &&
      JSON.parse(Buffer.from(body, 'base64url').toString()).exp > now
    );
  } catch {
    return false;
  }
}
export async function rateLimit(key: string, max: number, windowMs: number) {
  // Persisted and atomically updated across requests/processes.
  const digest = createHmac('sha256', process.env.SESSION_SECRET || 'local-rate-limit')
    .update(key)
    .digest('hex');
  const allowed = await store().mutate((s) => {
    const now = Date.now();
    for (const [id, item] of Object.entries(s.rateLimits))
      if (now - item.start > 24 * 3600_000) delete s.rateLimits[id];
    const item = s.rateLimits[digest];
    if (!item || now - item.start >= windowMs) {
      s.rateLimits[digest] = { start: now, count: 1 };
      return true;
    }
    if (item.count >= max) return false;
    item.count++;
    return true;
  });
  if (!allowed) throw new Error('Muitas solicitações. Aguarde e tente novamente.');
}
