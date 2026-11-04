// Cuentas de usuario (Fase 2): registro, login con bloqueo por cuenta,
// logout y perfil. Contraseñas con scrypt; sesiones con user_id.
// Nunca devuelve ni registra hashes ni contraseñas. Sin envío de correos:
// jamás se afirma verificación de correo.
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { validateAccountRegister } from '../shared/contracts.mjs';
import { audit, nowIso } from './db.mjs';
import { sessionCookie, clearSessionCookie } from './auth.mjs';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;
const MAX_REGISTER_PER_HOUR = 30;

const hashPw = (password, salt) => scryptSync(password, salt, 32).toString('hex');

export const publicUser = (row) =>
  row && { id: row.id, name: row.name, email: row.email, createdAt: row.created_at };

function openSession(db, userId) {
  const id = randomBytes(16).toString('hex');
  const token = randomBytes(32).toString('hex');
  const csrf = randomBytes(16).toString('hex');
  const tokenHash = scryptSync(token, id, 32).toString('hex');
  const expires = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare(
    'INSERT INTO sessions (id, token_hash, csrf, created_at, expires_at, user_id) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, tokenHash, csrf, nowIso(), expires, userId);
  return { sessionId: id, token, csrf, expires, setCookie: sessionCookie(id, token, expires) };
}

export function registerUser(db, body) {
  const v = validateAccountRegister(body ?? {});
  if (v.errors) return { ok: false, invalid: true, errors: v.errors };
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = db.prepare('SELECT COUNT(*) AS n FROM users WHERE created_at > ?').get(since).n;
  if (recent >= MAX_REGISTER_PER_HOUR) return { ok: false, rateLimited: true };
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(v.value.email)) {
    return { ok: false, exists: true };
  }
  const id = randomUUID();
  const salt = randomBytes(16).toString('hex');
  const createdAt = nowIso();
  try {
    db.prepare(
      'INSERT INTO users (id, name, email, pw_hash, pw_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(id, v.value.name, v.value.email, hashPw(v.value.password, salt), salt, createdAt);
  } catch (e) {
    if (String(e?.message).includes('UNIQUE')) return { ok: false, exists: true };
    throw e;
  }
  audit(db, 'account', 'account.registered', 'user:' + id);
  const s = openSession(db, id);
  return { ok: true, user: { id, name: v.value.name, email: v.value.email, createdAt }, ...s };
}

export function loginUser(db, body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body?.password;
  if (!email || typeof password !== 'string' || !password) return { ok: false };
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row) {
    hashPw('secreto-ficticio-para-tiempo-comparable', 'sal-ficticia-0000000000000000');
    return { ok: false };
  }
  if (row.locked_until && row.locked_until > nowIso()) return { ok: false, locked: true };
  let ok = false;
  try {
    const a = Buffer.from(hashPw(password, row.pw_salt), 'hex');
    const b = Buffer.from(row.pw_hash, 'hex');
    ok = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    ok = false;
  }
  if (!ok) {
    const fails = (row.failed_attempts ?? 0) + 1;
    if (fails >= MAX_FAILS) {
      db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(
        fails, new Date(Date.now() + LOCK_MS).toISOString(), row.id,
      );
    } else {
      db.prepare('UPDATE users SET failed_attempts = ? WHERE id = ?').run(fails, row.id);
    }
    audit(db, 'account', 'account.login_failed', 'user:' + row.id);
    return { ok: false };
  }
  db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(row.id);
  audit(db, 'account', 'account.login', 'user:' + row.id);
  const s = openSession(db, row.id);
  return { ok: true, user: publicUser(row), ...s };
}

export function logoutUser(db, sessionId) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  audit(db, 'account', 'account.logout', 'session:' + sessionId);
  return clearSessionCookie();
}

export function meOf(db, session) {
  if (!session) return null;
  if (!session.user_id) return { legacy: true };
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
  if (!row) return null;
  return { user: publicUser(row) };
}
