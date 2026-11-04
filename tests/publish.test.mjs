import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startTestServer } from './helper.mjs';

async function readyDraft(t, patch = { name: 'Galletas', priceCents: 500, description: 'Ficticias' }) {
  const c = await t.api('/api/drafts', { method: 'POST', body: JSON.stringify({ clientOpId: randomUUID() }) });
  const id = c.body.draft.id;
  await t.api(`/api/drafts/${id}`, {
    method: 'PATCH', body: JSON.stringify({ baseRevision: 1, clientOpId: randomUUID(), patch }),
  });
  return id;
}

describe('publicación con confirmación exacta', async () => {
  const t = await startTestServer();
  after(() => t.close());

  it('revisar y publicar: producto versionado y visible en catálogo', async () => {
    const id = await readyDraft(t);
    const rv = await t.api(`/api/drafts/${id}/review`, { method: 'POST' });
    assert.equal(rv.status, 200);
    const pub = await t.api(`/api/drafts/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify({ reviewToken: rv.body.review.reviewToken, contentHash: rv.body.review.contentHash, clientOpId: randomUUID() }),
    });
    assert.equal(pub.status, 201);
    assert.equal(pub.body.product.version, 1);
    assert.equal(pub.body.product.priceCents, 500);
    const cat = await fetch(t.base + '/api/products').then((r) => r.json());
    assert.ok(cat.products.some((p) => p.id === pub.body.product.id));
  });

  it('hash o token ajenos no publican', async () => {
    const id = await readyDraft(t);
    const rv = await t.api(`/api/drafts/${id}/review`, { method: 'POST' });
    const bad = await t.api(`/api/drafts/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify({ reviewToken: rv.body.review.reviewToken, contentHash: '0000000000000000', clientOpId: randomUUID() }),
    });
    assert.equal(bad.status, 422);
  });

  it('publicar dos veces con la misma clave: un solo producto', async () => {
    const id = await readyDraft(t);
    const rv = await t.api(`/api/drafts/${id}/review`, { method: 'POST' });
    const key = randomUUID();
    const payload = { reviewToken: rv.body.review.reviewToken, contentHash: rv.body.review.contentHash, clientOpId: key };
    const a = await t.api(`/api/drafts/${id}/publish`, { method: 'POST', body: JSON.stringify(payload) });
    const b = await t.api(`/api/drafts/${id}/publish`, { method: 'POST', body: JSON.stringify(payload) });
    assert.equal(a.status, 201);
    assert.equal(b.body.idempotentReplay, true);
    assert.equal(a.body.product.id, b.body.product.id);
  });

  it('consulta: preparar y abrir, sin estados de envío', async () => {
    const id = await readyDraft(t);
    const rv = await t.api(`/api/drafts/${id}/review`, { method: 'POST' });
    const pub = await t.api(`/api/drafts/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify({ reviewToken: rv.body.review.reviewToken, contentHash: rv.body.review.contentHash, clientOpId: randomUUID() }),
    });
    const pid = pub.body.product.id;
    const q = await fetch(t.base + '/api/inquiries', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: pid, channel: 'link', clientOpId: randomUUID() }),
    }).then((r) => r.json());
    assert.equal(q.inquiry.status, 'prepared');
    const o = await fetch(t.base + `/api/inquiries/${q.inquiry.id}/opened`, { method: 'POST' }).then((r) => r.json());
    assert.equal(o.inquiry.status, 'opened');
    assert.ok(!JSON.stringify(o).includes('enviado'));
  });
});
