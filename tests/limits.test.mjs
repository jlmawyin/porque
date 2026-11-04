import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startTestServer } from './helper.mjs';
import { reserve, reconcile, holdUncertain, setAiEnabled, aiEnabled } from '../server/limits.mjs';

describe('límites antes que APIs reales', async () => {
  const t = await startTestServer();
  after(() => t.close());

  it('vía real bloqueada por defecto (503 REAL_AI_DISABLED)', async () => {
    assert.equal(aiEnabled(t.db), false);
    const r = await t.api('/api/ai/real', { method: 'POST', body: JSON.stringify({}) });
    assert.equal(r.status, 503);
    assert.equal(r.body.error, 'REAL_AI_DISABLED');
  });

  it('reserva atómica: no se supera el tope por concurrencia', async () => {
    setAiEnabled(t.db, true, 'test');
    const scope = 'Scope-' + randomUUID();
    const results = await Promise.all(
      Array.from({ length: 12 }, () => reserve(t.db, scope, 'image', 1)),
    );
    const okCount = results.filter((r) => r.ok).length;
    assert.equal(okCount, 10); // tope de ronda: 10 imágenes
    assert.ok(results.some((r) => r.reason === 'LIMIT_EXCEEDED'));
    setAiEnabled(t.db, false, 'test');
  });

  it('conciliación baja el uso; lo incierto queda retenido', async () => {
    setAiEnabled(t.db, true, 'test');
    const scope = 'Scope-' + randomUUID();
    const r1 = reserve(t.db, scope, 'spark', 1000);
    assert.equal(r1.ok, true);
    const rec = reconcile(t.db, r1.reservationId, 200);
    assert.equal(rec.ok, true);
    assert.equal(rec.released, 800);
    const r2 = reserve(t.db, scope, 'spark', 500);
    holdUncertain(t.db, r2.reservationId, 'respuesta cortada');
    const row = t.db.prepare('SELECT state FROM reservations WHERE id = ?').get(r2.reservationId);
    assert.equal(row.state, 'held'); // retenida: no se libera ni reintenta
    setAiEnabled(t.db, false, 'test');
  });
});
