// Iniciativas (Fase 3): borrador kind=initiative con modalidad,
// publicación con puerta de completitud y catálogo público.
import { describe, it, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unlinkSync, existsSync } from 'node:fs';
import { createApp } from '../server/main.mjs';
import { TEST_SECRET } from './helper.mjs';
import { publicInitiativeUrl } from '../shared/contracts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pw = (tag) => `contrasena-segura-${tag}-987`;
let seq = 0;
const freshEmail = (tag) => `fase3-${tag}-${seq++}-${randomUUID().slice(0, 8)}@ejemplo.com`;

async function boot() {
  const dbPath = join(ROOT, 'data', `.test-initiatives-${randomUUID()}.sqlite`);
  const { server, db } = createApp({ dbPath, secret: TEST_SECRET });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: async () => {
      try { await new Promise((resolve) => server.close(resolve)); } catch { /* noop */ }
      try { db.close(); } catch { /* noop */ }
      for (const f of [dbPath, dbPath + '-journal', dbPath + '-wal', dbPath + '-shm']) {
        try { if (existsSync(f)) unlinkSync(f); } catch { /* noop */ }
      }
    },
  };
}

async function http(base, path, { method = 'GET', body, cookie = '', csrf = '' } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  if (csrf) headers['x-csrf'] = csrf;
  const res = await fetch(base + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
  return { status: res.status, body: json, text };
}

const jarOf = (r) => ({ cookie: (r.setCookie.split(';')[0] ?? ''), csrf: r.body.csrf ?? '' });

async function register(base, name, email, password) {
  const res = await fetch(base + '/api/account/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  return { status: res.status, body: await res.json(), setCookie: res.headers.get('set-cookie') ?? '' };
}

async function createDraft(base, s, extra = {}) {
  return http(base, '/api/drafts', {
    method: 'POST', body: { clientOpId: randomUUID(), ...extra }, cookie: s.cookie, csrf: s.csrf,
  });
}

async function patchDraft(base, s, id, patch, baseRevision = 1) {
  return http(base, `/api/drafts/${id}`, {
    method: 'PATCH', body: { baseRevision, clientOpId: randomUUID(), patch },
    cookie: s.cookie, csrf: s.csrf,
  });
}

async function reviewPublish(base, s, id) {
  const rv = await http(base, `/api/drafts/${id}/review`, {
    method: 'POST', cookie: s.cookie, csrf: s.csrf,
  });
  assert.equal(rv.status, 200);
  return http(base, `/api/drafts/${id}/publish`, {
    method: 'POST',
    body: { reviewToken: rv.body.review.reviewToken, contentHash: rv.body.review.contentHash, clientOpId: randomUUID() },
    cookie: s.cookie, csrf: s.csrf,
  });
}

describe('iniciativas (Fase 3)', async () => {
  const t = await boot();
  after(() => t.close());
  let A; let B;
  const emailA = freshEmail('alba');

  before(async () => {
    const ra = await register(t.base, 'Alba', emailA, pw('alba'));
    assert.equal(ra.status, 201);
    A = jarOf(ra);
    const rb = await register(t.base, 'Beto', freshEmail('beto'), pw('beto'));
    assert.equal(rb.status, 201);
    B = jarOf(rb);
  });

  it('kind inválido al crear → 400', async () => {
    const r = await createDraft(t.base, A, { kind: 'cooperativa' });
    assert.equal(r.status, 400);
  });

  it('flujo completo: crear kind, modality, publicar y ver en público con ownerName y products', async () => {
    const c = await createDraft(t.base, A, { kind: 'initiative' });
    assert.equal(c.status, 201);
    assert.equal(c.body.draft.kind, 'initiative');
    const id = c.body.draft.id;
    const p = await patchDraft(t.base, A, id, {
      name: 'Huerta comunitaria', description: 'Huerta ficticia del barrio',
      modality: 'donations', purpose: 'Fondos para semillas', goalCents: 200000,
    });
    assert.equal(p.status, 200);
    assert.equal(p.body.draft.modality, 'donations');
    assert.equal(p.body.draft.goalCents, 200000);
    const pub = await reviewPublish(t.base, A, id);
    assert.equal(pub.status, 201);
    assert.equal(pub.body.product.kind, 'initiative');
    assert.equal(pub.body.product.modality, 'donations');
    const pid = pub.body.product.id;

    const list = await http(t.base, '/api/initiatives');
    assert.equal(list.status, 200);
    const item = list.body.initiatives.find((i) => i.id === pid);
    assert.ok(item, 'la iniciativa publicada aparece en el listado');
    assert.equal(item.ownerName, 'Alba');
    assert.equal(item.modality, 'donations');
    assert.equal(item.goalCents, 200000);
    assert.ok(!('owner_user_id' in item), 'sin id de propietario');
    assert.ok(!JSON.stringify(item).includes(emailA), 'sin emails');

    const detail = await http(t.base, `/api/initiatives/${pid}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.initiative.id, pid);
    assert.equal(detail.body.initiative.ownerName, 'Alba');
    assert.ok(Array.isArray(detail.body.products));
  });

  it('sin modality no publica: 422 y no aparece en público', async () => {
    const c = await createDraft(t.base, A, { kind: 'initiative' });
    const id = c.body.draft.id;
    await patchDraft(t.base, A, id, { name: 'Sin modalidad', description: 'Falta modality' });
    const pub = await reviewPublish(t.base, A, id);
    assert.equal(pub.status, 422);
    assert.match(pub.body.detail ?? '', /modality/);
    const list = await http(t.base, '/api/initiatives');
    assert.ok(!list.body.initiatives.some((i) => i.draftId === id), 'el borrador no publicado no se expone');
  });

  it('detalle ajeno o inexistente → 404', async () => {
    const missing = await http(t.base, `/api/initiatives/${randomUUID()}`);
    assert.equal(missing.status, 404);
    // Un producto no es iniciativa: su id da 404 en este detalle.
    const c = await createDraft(t.base, A);
    const id = c.body.draft.id;
    await patchDraft(t.base, A, id, { name: 'Miel', priceCents: 300, description: 'Ficticia' });
    const pub = await reviewPublish(t.base, A, id);
    assert.equal(pub.status, 201);
    const notInitiative = await http(t.base, `/api/initiatives/${pub.body.product.id}`);
    assert.equal(notInitiative.status, 404);
    // Un borrador tampoco se expone por aquí.
    const draftAsDetail = await http(t.base, `/api/initiatives/${id}`);
    assert.equal(draftAsDetail.status, 404);
  });

  it('producto heredado intacto: kind por defecto, publica y no sale en iniciativas', async () => {
    const c = await createDraft(t.base, A);
    assert.equal(c.status, 201);
    assert.equal(c.body.draft.kind, 'product');
    const id = c.body.draft.id;
    await patchDraft(t.base, A, id, { name: 'Pan', priceCents: 150, description: 'Ficticio' });
    const pub = await reviewPublish(t.base, A, id);
    assert.equal(pub.status, 201);
    assert.equal(pub.body.product.kind, 'product');
    const cat = await http(t.base, '/api/products');
    assert.ok(cat.body.products.some((p) => p.id === pub.body.product.id));
    const list = await http(t.base, '/api/initiatives');
    assert.ok(!list.body.initiatives.some((i) => i.id === pub.body.product.id));
  });

  it('detalle incluye products[] del mismo dueño con campos acotados', async () => {
    const ci = await createDraft(t.base, A, { kind: 'initiative' });
    const iid = ci.body.draft.id;
    await patchDraft(t.base, A, iid, {
      name: 'Fondo escolar', description: 'Útiles ficticios', modality: 'both',
    });
    const pubI = await reviewPublish(t.base, A, iid);
    assert.equal(pubI.status, 201);
    const cp = await createDraft(t.base, A);
    const pid2 = cp.body.draft.id;
    await patchDraft(t.base, A, pid2, { name: 'Cuaderno', priceCents: 250, description: 'Ficticio' });
    const pubP = await reviewPublish(t.base, A, pid2);
    assert.equal(pubP.status, 201);

    const detail = await http(t.base, `/api/initiatives/${pubI.body.product.id}`);
    assert.equal(detail.status, 200);
    const found = detail.body.products.find((p) => p.id === pubP.body.product.id);
    assert.ok(found, 'el producto del mismo dueño aparece en products[]');
    assert.deepEqual(Object.keys(found).sort(), ['currency', 'description', 'id', 'imageAi', 'imageRef', 'name', 'priceCents']);
    assert.equal(found.priceCents, 250);
  });

  it('aislamiento: B no toca la iniciativa de A', async () => {
    const c = await createDraft(t.base, A, { kind: 'initiative' });
    const id = c.body.draft.id;
    await patchDraft(t.base, A, id, {
      name: 'Río limpio', description: 'Jornada ficticia', modality: 'business',
    });
    const getB = await http(t.base, `/api/drafts/${id}`, { cookie: B.cookie });
    assert.equal(getB.status, 404);
    const patchB = await patchDraft(t.base, B, id, { name: 'Intruso' }, 2);
    assert.equal(patchB.status, 404);
    const reviewB = await http(t.base, `/api/drafts/${id}/review`, {
      method: 'POST', cookie: B.cookie, csrf: B.csrf,
    });
    assert.equal(reviewB.status, 404);
    const pubB = await http(t.base, `/api/drafts/${id}/publish`, {
      method: 'POST',
      body: { clientOpId: randomUUID(), reviewToken: randomUUID(), contentHash: 'x' },
      cookie: B.cookie, csrf: B.csrf,
    });
    assert.equal(pubB.status, 404);
    const stillA = await http(t.base, `/api/drafts/${id}`, { cookie: A.cookie });
    assert.equal(stillA.status, 200);
    assert.equal(stillA.body.draft.name, 'Río limpio');
    assert.equal(stillA.body.draft.modality, 'business');
  });

  it('compartir: sin base no hay URL pública; ruta local y QR pendiente', async () => {
    const c = await createDraft(t.base, A, { kind: 'initiative' });
    const id = c.body.draft.id;
    await patchDraft(t.base, A, id, { name: 'Comparte', description: 'Ficticia', modality: 'donations' });
    const pub = await reviewPublish(t.base, A, id);
    const pid = pub.body.product.id;
    const s = await http(t.base, `/api/share/initiative/${pid}`);
    assert.equal(s.status, 200);
    assert.equal(s.body.share.localPath, `/i/${pid}`);
    assert.equal(s.body.share.url, null);
    assert.equal(s.body.share.isPublic, false);
    assert.equal(s.body.share.qr.available, false);
    assert.ok(!JSON.stringify(s.body).includes(emailA));
    const missing = await http(t.base, `/api/share/initiative/${randomUUID()}`);
    assert.equal(missing.status, 404);
  });

  it('publicInitiativeUrl solo construye con base explícita válida', () => {
    assert.equal(publicInitiativeUrl('https://porque.somospanas.com', 'abc-123'), 'https://porque.somospanas.com/i/abc-123');
    assert.equal(publicInitiativeUrl('', 'abc-123'), null);
    assert.equal(publicInitiativeUrl('nota-url', 'abc-123'), null);
    assert.equal(publicInitiativeUrl('https://porque.somospanas.com/', 'abc-123'), null);
    assert.equal(publicInitiativeUrl('https://porque.somospanas.com', '../x'), null);
  });

  it('publicInitiativeUrl rechaza bases localhost, loopback o privadas', () => {
    for (const base of [
      'http://127.0.0.1:4177',
      'http://localhost:4177',
      'http://LOCALHOST',
      'http://[::1]:4177',
      'http://10.0.0.5',
      'http://172.16.0.9',
      'http://192.168.1.20',
      'http://169.254.10.20',
      'http://mi-servidor',
      'http://tienda.local',
    ]) {
      assert.equal(publicInitiativeUrl(base, 'abc-123'), null, base);
    }
    assert.equal(
      publicInitiativeUrl('https://porque.somospanas.com', 'abc-123'),
      'https://porque.somospanas.com/i/abc-123',
    );
  });
});
