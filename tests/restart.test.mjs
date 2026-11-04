import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startTestServer } from './helper.mjs';
import { createApp } from '../server/main.mjs';
import { TEST_SECRET } from './helper.mjs';

describe('recuperación tras reinicio', () => {
  it('borrador, producto y sesión sobreviven al reinicio', async () => {
    const t = await startTestServer();
    let app2 = null;
    try {
    const c = await t.api('/api/drafts', { method: 'POST', body: JSON.stringify({ clientOpId: randomUUID() }) });
    const id = c.body.draft.id;
    await t.api(`/api/drafts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ baseRevision: 1, clientOpId: randomUUID(), patch: { name: 'Café', priceCents: 250, description: 'Ficticio' } }),
    });
    const rv = await t.api(`/api/drafts/${id}/review`, { method: 'POST' });
    await t.api(`/api/drafts/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify({ reviewToken: rv.body.review.reviewToken, contentHash: rv.body.review.contentHash, clientOpId: randomUUID() }),
    });
    const cookie = t.cookie;
    const dbPath = t.dbPath;
    // Reinicio: cerrar y reabrir sobre el mismo archivo.
    const { server } = t;
    await new Promise((resolve) => server.close(resolve));
    t.db.close();
    app2 = createApp({ dbPath, secret: TEST_SECRET });
    await new Promise((resolve) => app2.server.listen(0, '127.0.0.1', resolve));
      const base2 = `http://127.0.0.1:${app2.server.address().port}`;
      const d = await fetch(`${base2}/api/drafts/${id}`, { headers: { cookie } }).then((r) => r.json());
      assert.equal(d.draft.name, 'Café'); // sesión y borrador intactos
      const cat = await fetch(base2 + '/api/products').then((r) => r.json());
      assert.equal(cat.products.length, 1); // publicado intacto
    } finally {
      if (app2) {
        await new Promise((resolve) => app2.server.close(resolve));
        try { app2.db.close(); } catch { /* noop */ }
      }
      await t.close(); // idempotente; limpia solo sus temporales
    }
  });
});
