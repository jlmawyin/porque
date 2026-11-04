// Auth de un vendedor: secreto robusto solo en servidor (env o archivo privado),
// hash scrypt, sesiones con cookie httpOnly y límite de intentos de login.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { audit, nowIso } from './db.mjs';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_FAILS = 5;

export function loadSellerSecret({ env = process.env, file = null } = {}) {
  const fromEnv = env.PORQUE_SELLER_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (fromEnv) throw new Error('PORQUE_SELLER_SECRET demasiado corto (mínimo 32 caracteres)');
  if (file && existsSync(file)) {
    const v = readFileSync(file, 'utf8').trim();
    if (v.length >= 32) return v;
    throw new Error('secreto en archivo demasiado corto (mínimo 32 caracteres)');
  }
  if (env.PORQUE_ALLOW_EPHEMERAL_SECRET === '1') {
    return '__EPHEMERAL_TEST__:' + randomBytes(24).toString('hex');
  }
  throw new Error('Falta PORQUE_SELLER_SECRET (o archivo privado). Ver README.');
}

const hashSecret = (secret, salt) =>
  scryptSync(secret, salt, 32).toString('hex');

function sellerRow(db) {
  return db.prepare('SELECT * FROM sellers WHERE id = 1').get();
}

/** Fija el secreto en el primer arranque; después solo verifica. */
export function ensureSeller(db, secret) {
  if (!sellerRow(db)) {
    const salt = randomBytes(16).toString('hex');
    db.prepare(
      'INSERT INTO sellers (id, secret_hash, secret_salt, created_at) VALUES (1, ?, ?, ?)',
    ).run(hashSecret(secret, salt), salt, nowIso());
    audit(db, 'system', 'seller.created', 'seller:1');
  }
}

function recentFails(db) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
  return db.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE ok = 0 AND at > ?').get(since).n;
}

export function login(db, secretAttempt) {
  if (recentFails(db) >= LOGIN_MAX_FAILS) {
    return { ok: false, locked: true };
  }
  const row = sellerRow(db);
  let ok = false;
  if (row && typeof secretAttempt === 'string') {
    const a = Buffer.from(hashSecret(secretAttempt, row.secret_salt), 'hex');
    const b = Buffer.from(row.secret_hash, 'hex');
    ok = a.length === b.length && timingSafeEqual(a, b);
  }
  db.prepare('INSERT INTO login_attempts (at, ok) VALUES (?, ?)').run(nowIso(), ok ? 1 : 0);
  if (!ok) return { ok: false, locked: false };
  const id = randomBytes(16).toString('hex');
  const token = randomBytes(32).toString('hex');
  const csrf = randomBytes(16).toString('hex');
  const tokenHash = hashSecret(token, id);
  const expires = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare(
    'INSERT INTO sessions (id, token_hash, csrf, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, tokenHash, csrf, nowIso(), expires);
  audit(db, 'seller', 'auth.login', 'session:' + id);
  return { ok: true, id, token, csrf, expires };
}

export function sessionOf(db, cookieHeader) {
  const m = /porque_session=([0-9a-f]{32})\.([0-9a-f]{64})/.exec(cookieHeader ?? '');
  if (!m) return null;
  const [, id, token] = m;
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!row || row.expires_at < nowIso()) return null;
  const a = Buffer.from(hashSecret(token, id), 'hex');
  const b = Buffer.from(row.token_hash, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return row;
}

export function logout(db, sessionId) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  audit(db, 'seller', 'auth.logout', 'session:' + sessionId);
}

export const sessionCookie = (id, token, expires) =>
  `porque_session=${id}.${token}; HttpOnly; SameSite=Lax; Path=/; Expires=${new Date(expires).toUTCString()}`;

export const clearSessionCookie = () =>
  'porque_session=; HttpOnly; SameSite=Lax; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
