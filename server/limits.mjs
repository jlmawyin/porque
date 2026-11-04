// Límites persistentes de consumo: por sesión y globales, reserva atómica,
// conciliación y apagado. Existen antes de habilitar cualquier API real.
import { randomUUID } from 'node:crypto';
import { ROUND1_CAPS } from '../shared/contracts.mjs';
import { audit, nowIso } from './db.mjs';

// kind -> unidad y topes (ronda 1 propuesta; solo bajan sin aprobación).
export const LIMITS = Object.freeze({
  transcribe: { unit: 'minutes', perSession: ROUND1_CAPS.transcribeMinutes, global: ROUND1_CAPS.transcribeMinutes, maxCallsSession: ROUND1_CAPS.transcribeCalls, maxCallsGlobal: ROUND1_CAPS.transcribeCalls },
  spark: { unit: 'tokens', perSession: ROUND1_CAPS.sparkTokens, global: ROUND1_CAPS.sparkTokens, maxCallsSession: ROUND1_CAPS.sparkCalls, maxCallsGlobal: ROUND1_CAPS.sparkCalls },
  image: { unit: 'images', perSession: ROUND1_CAPS.imageCalls, global: ROUND1_CAPS.imageCalls, maxCallsSession: ROUND1_CAPS.imageCalls, maxCallsGlobal: ROUND1_CAPS.imageCalls },
});

const WINDOW = 'round1';

// Transacción inmediata explícita (BEGIN IMMEDIATE): la reserva descuenta del
// tope de forma atómica aunque haya peticiones concurrentes.
function withImmediate(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* noop */ }
    throw e;
  }
}

function usage(db, scope, kind) {
  return (
    db.prepare('SELECT used, calls FROM usage_windows WHERE scope = ? AND kind = ? AND window = ?').get(
      scope, kind, WINDOW,
    ) ?? { used: 0, calls: 0 }
  );
}

function addUsage(db, scope, kind, units, calls) {
  db.prepare(
    `INSERT INTO usage_windows (scope, kind, window, used, calls) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (scope, kind, window) DO UPDATE SET used = used + ?, calls = calls + ?`,
  ).run(scope, kind, WINDOW, units, calls, units, calls);
}

export function aiEnabled(db) {
  return db.prepare("SELECT value FROM meta WHERE key = 'ai_enabled'").get()?.value === '1';
}

export function setAiEnabled(db, on, actor) {
  db.prepare("UPDATE meta SET value = ? WHERE key = 'ai_enabled'").run(on ? '1' : '0');
  audit(db, actor, on ? 'limits.ai_enabled' : 'limits.ai_disabled', 'meta:ai_enabled');
}

/**
 * Reserva atómica: descuenta del tope dentro de una transacción inmediata.
 * Si el resultado real es incierto, la reserva queda 'held' y NO se libera
 * para volver a gastar; tampoco hay reintento automático.
 */
export function reserve(db, sessionScope, kind, unitsEstimate) {
  const spec = LIMITS[kind];
  if (!spec) return { ok: false, reason: 'kind desconocido' };
  if (!(unitsEstimate > 0)) return { ok: false, reason: 'unidades inválidas' };
  if (!aiEnabled(db)) return { ok: false, reason: 'REAL_AI_DISABLED', disabled: true };
  return withImmediate(db, () => {
    const s = usage(db, `session:${sessionScope}`, kind);
    const g = usage(db, 'global', kind);
    if (s.used + unitsEstimate > spec.perSession || s.calls + 1 > spec.maxCallsSession) {
      return { ok: false, reason: 'LIMIT_EXCEEDED', scope: 'session' };
    }
    if (g.used + unitsEstimate > spec.global || g.calls + 1 > spec.maxCallsGlobal) {
      return { ok: false, reason: 'LIMIT_EXCEEDED', scope: 'global' };
    }
    const id = randomUUID();
    db.prepare(
      'INSERT INTO reservations (id, scope, kind, units, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(id, `session:${sessionScope}`, kind, unitsEstimate, nowIso());
    addUsage(db, `session:${sessionScope}`, kind, unitsEstimate, 1);
    addUsage(db, 'global', kind, unitsEstimate, 1);
    return { ok: true, reservationId: id };
  });
}

/** Concilia con el consumo real informado por la API (solo puede bajar lo usado). */
export function reconcile(db, reservationId, actualUnits) {
  const r = db.prepare('SELECT * FROM reservations WHERE id = ?').get(reservationId);
  if (!r || r.state !== 'held') return { ok: false };
  const delta = Math.min(r.units, Math.max(0, r.units - actualUnits));
  withImmediate(db, () => {
    if (delta > 0) {
      addUsage(db, r.scope, r.kind, -delta, 0);
      addUsage(db, 'global', r.kind, -delta, 0);
    }
    db.prepare("UPDATE reservations SET state = 'consumed', reconciled_at = ? WHERE id = ?").run(
      nowIso(), reservationId,
    );
  });
  return { ok: true, released: delta };
}

/** Marca consumo incierto: la reserva queda retenida, sin liberar ni reintentar. */
export function holdUncertain(db, reservationId, note) {
  db.prepare('UPDATE reservations SET note = ? WHERE id = ? AND state = \'held\'').run(
    String(note).slice(0, 200), reservationId,
  );
  audit(db, 'system', 'limits.uncertain', 'reservation:' + reservationId, note);
}

export function status(db, sessionScope) {
  const out = { aiEnabled: aiEnabled(db), window: WINDOW, kinds: {} };
  for (const [kind, spec] of Object.entries(LIMITS)) {
    out.kinds[kind] = {
      unit: spec.unit,
      session: { ...usage(db, `session:${sessionScope}`, kind), cap: spec.perSession, maxCalls: spec.maxCallsSession },
      global: { ...usage(db, 'global', kind), cap: spec.global, maxCalls: spec.maxCallsGlobal },
    };
  }
  return out;
}
