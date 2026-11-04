import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startTestServer } from './helper.mjs';

describe('borrador: idempotencia, revisiones y conflictos', async () => {
  const t = await startTestServer();
  after(() => t.close());

  it('crear con la misma clave dos veces: un solo borrador (replay)', async () => {
    const key = randomUUID();
    const a = await t.api('/api/drafts', { method: 'POST', body: JSON.stringify({ clientOpId: key }) });
    const b = await t.api('/api/drafts', { method: 'POST', body: JSON.stringify({ clientOpId: key }) });
    assert.equal(a.status, 201);
    assert.equal(b.body.idempotentReplay, true);
    assert.equal(a.body.draft.id, b.body.draft.id);
    const list = await t.api('/api/drafts');
    assert.equal(list.body.drafts.filter((d) => d.id === a.body.draft.id).length, 1);
  });

  it('editar aplica revisión+1 y valida', async () => {
    const c = await t.api('/api/drafts', { method: 'POST', body: JSON.stringify({ clientOpId: randomUUID() }) });
    const id = c.body.draft.id;
    const p = await t.api(`/api/drafts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ baseRevision: 1, clientOpId: randomUUID(), patch: { name: 'Galletas', priceText: 'cinco dólares' } }),
    });
    assert.equal(p.status, 200);
    assert.equal(p.body.draft.revision, 2);
    assert.equal(p.body.draft.priceCents, 500);
    const bad = await t.api(`/api/drafts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ baseRevision: 2, clientOpId: randomUUID(), patch: { priceCents: -3 } }),
    });
    assert.equal(bad.status, 400);
  });

  it('base obsoleta: 409 y conserva ambas versiones; se elige', async () => {
    const c = await t.api('/api/drafts', { method: 'POST', body: JSON.stringify({ clientOpId: randomUUID() }) });
    const id = c.body.draft.id;
    await t.api(`/api/drafts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ baseRevision: 1, clientOpId: randomUUID(), patch: { name: 'Servidor' } }),
    });
    const stale = await t.api(`/api/drafts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ baseRevision: 1, clientOpId: randomUUID(), patch: { name: 'Cliente' } }),
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.conflict.server.name, 'Servidor');
    assert.equal(stale.body.conflict.client.name, 'Cliente');
    const cid = stale.body.conflict.id;
    const res = await t.api(`/api/drafts/${id}/conflicts/${cid}/resolve`, {
      method: 'POST', body: JSON.stringify({ choice: 'mine', clientOpId: randomUUID() }),
    });
    assert.equal(res.body.draft.name, 'Cliente');
  });

  it('editar invalida la revisión anterior', async () => {
    const c = await t.api('/api/drafts', { method: 'POST', body: JSON.stringify({ clientOpId: randomUUID() }) });
    const id = c.body.draft.id;
    await t.api(`/api/drafts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ baseRevision: 1, clientOpId: randomUUID(), patch: { name: 'Pan', priceCents: 100, description: 'rico' } }),
    });
    const rv = await t.api(`/api/drafts/${id}/review`, { method: 'POST' });
    await t.api(`/api/drafts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ baseRevision: 2, clientOpId: randomUUID(), patch: { description: 'cambiado' } }),
    });
    const pub = await t.api(`/api/drafts/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify({ reviewToken: rv.body.review.reviewToken, contentHash: rv.body.review.contentHash, clientOpId: randomUUID() }),
    });
    assert.equal(pub.status, 422);
    assert.equal(pub.body.error, 'CONFIRMATION_INVALID');
  });
});
