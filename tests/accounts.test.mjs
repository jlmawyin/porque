// Cuentas y propiedad (Fase 2): registro, login, bloqueo, me y aislamiento.
import { describe, it, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unlinkSync, existsSync } from 'node:fs';
import { createApp } from '../server/main.mjs';
import { TEST_SECRET } from './helper.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pw = (tag) => `contrasena-segura-${tag}-987`;
let seq = 0;
const freshEmail = (tag) => `fase2-${tag}-${seq++}-${randomUUID().slice(0, 8)}@ejemplo.com`;

async function boot() {
  const dbPath = join(ROOT, 'data', `.test-accounts-${randomUUID()}.sqlite`);
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
  return { status: res.status, body: json, text, setCookie: res.headers.get('set-cookie') ?? '' };
}

const jarOf = (r) => ({ cookie: (r.setCookie.split(';')[0] ?? ''), csrf: r.body.csrf ?? '' });

async function register(base, name, email, password) {
  return http(base, '/api/account/register', { method: 'POST', body: { name, email, password } });
}

async function createDraft(base, s) {
  return http(base, '/api/drafts', {
    method: 'POST', body: { clientOpId: randomUUID() }, cookie: s.cookie, csrf: s.csrf,
  });
}

async function sellerLogin(base) {
  const r = await http(base, '/api/auth/login', { method: 'POST', body: { secret: TEST_SECRET } });
  assert.equal(r.status, 200);
  return jarOf(r);
}

describe('cuentas y propiedad (Fase 2)', async () => {
  const t = await boot();
  after(() => t.close());
  let A; let B; let legacy; let draftA;
  const emailA = freshEmail('a');
  const emailB = freshEmail('b');

  before(async () => {
    legacy = await sellerLogin(t.base);
    const ra = await register(t.base, 'Alba', emailA, pw('alba'));
    assert.equal(ra.status, 201);
    A = jarOf(ra);
    const rb = await register(t.base, 'Beto', emailB, pw('beto'));
    assert.equal(rb.status, 201);
    B = jarOf(rb);
    const d = await createDraft(t.base, A);
    assert.equal(d.status, 201);
    draftA = d.body.draft.id;
    await http(t.base, `/api/drafts/${draftA}`, {
      method: 'PATCH',
      body: { baseRevision: 1, clientOpId: randomUUID(), patch: { name: 'Miel de A' } },
      cookie: A.cookie, csrf: A.csrf,
    });
  });

  it('registro ok: 201 + cookie + csrf, sin hashes ni contraseña', async () => {
    const r = await register(t.base, 'Nueva', freshEmail('nueva'), pw('nueva'));
    assert.equal(r.status, 201);
    assert.ok(r.body.user?.id);
    assert.equal(r.body.user.email, r.body.user.email.toLowerCase());
    assert.ok(r.body.csrf);
    assert.match(r.setCookie, /porque_session=/);
    assert.match(r.setCookie, /HttpOnly/);
    assert.ok(!r.text.includes('pw_hash'), 'sin hash en respuesta');
    assert.ok(!r.text.includes('pw_salt'), 'sin salt en respuesta');
  });

  it('duplicado (incluso con mayúsculas) → 409 ACCOUNT_EXISTS', async () => {
    const r = await register(t.base, 'Otra', emailA.toUpperCase(), pw('otra'));
    assert.equal(r.status, 409);
    assert.equal(r.body.error, 'ACCOUNT_EXISTS');
  });

  it('registro inválido → 400', async () => {
    const badMail = await register(t.base, 'X', 'no-es-email', pw('x'));
    assert.equal(badMail.status, 400);
    const shortPw = await register(t.base, 'X', freshEmail('corta'), 'corta');
    assert.equal(shortPw.status, 400);
    const noName = await register(t.base, '   ', freshEmail('noname'), pw('noname'));
    assert.equal(noName.status, 400);
  });

  it('login ok: 200 + sesión propia', async () => {
    const r = await http(t.base, '/api/account/login', {
      method: 'POST', body: { email: emailB, password: pw('beto') },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.user.email, emailB);
    assert.ok(r.body.csrf);
    assert.match(r.setCookie, /porque_session=/);
  });

  it('login erróneo → 401 genérico, sin distinguir motivo', async () => {
    const wrong = await http(t.base, '/api/account/login', {
      method: 'POST', body: { email: emailB, password: 'contrasena-incorrecta-000' },
    });
    assert.equal(wrong.status, 401);
    const unknown = await http(t.base, '/api/account/login', {
      method: 'POST', body: { email: freshEmail('nadie'), password: pw('nadie') },
    });
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.error, unknown.body.error);
  });

  it('bloqueo tras 5 fallos: la correcta también da 429', async () => {
    const email = freshEmail('bloqueo');
    const password = pw('bloqueo');
    const r = await register(t.base, 'Bloqueada', email, password);
    assert.equal(r.status, 201);
    for (let i = 0; i < 5; i++) {
      const f = await http(t.base, '/api/account/login', {
        method: 'POST', body: { email, password: 'contrasena-mala-00000000' },
      });
      assert.equal(f.status, 401);
    }
    const good = await http(t.base, '/api/account/login', {
      method: 'POST', body: { email, password },
    });
    assert.equal(good.status, 429);
  });

  it('me: usuario ve su perfil, heredado ve legacy, anónimo 401', async () => {
    const meA = await http(t.base, '/api/account/me', { cookie: A.cookie });
    assert.equal(meA.status, 200);
    assert.equal(meA.body.user.email, emailA);
    assert.ok(!('legacy' in meA.body));
    assert.ok(!JSON.stringify(meA.body).includes('pw_hash'));
    const meLegacy = await http(t.base, '/api/account/me', { cookie: legacy.cookie });
    assert.equal(meLegacy.status, 200);
    assert.equal(meLegacy.body.legacy, true);
    const anon = await http(t.base, '/api/account/me');
    assert.equal(anon.status, 401);
  });

  it('aislamiento A/B: B recibe 404 ante borrador de A', async () => {
    const listB = await http(t.base, '/api/drafts', { cookie: B.cookie });
    assert.ok(!listB.body.drafts.some((d) => d.id === draftA));
    const getB = await http(t.base, `/api/drafts/${draftA}`, { cookie: B.cookie });
    assert.equal(getB.status, 404);
    const patchB = await http(t.base, `/api/drafts/${draftA}`, {
      method: 'PATCH',
      body: { baseRevision: 2, clientOpId: randomUUID(), patch: { name: 'Intruso' } },
      cookie: B.cookie, csrf: B.csrf,
    });
    assert.equal(patchB.status, 404);
    const reviewB = await http(t.base, `/api/drafts/${draftA}/review`, {
      method: 'POST', cookie: B.cookie, csrf: B.csrf,
    });
    assert.equal(reviewB.status, 404);
    const pubB = await http(t.base, `/api/drafts/${draftA}/publish`, {
      method: 'POST',
      body: { clientOpId: randomUUID(), reviewToken: randomUUID(), contentHash: 'x' },
      cookie: B.cookie, csrf: B.csrf,
    });
    assert.equal(pubB.status, 404);
    const stillA = await http(t.base, `/api/drafts/${draftA}`, { cookie: A.cookie });
    assert.equal(stillA.status, 200);
    assert.equal(stillA.body.draft.name, 'Miel de A');
  });

  it('conflictos ajenos también son 404', async () => {
    const stale = await http(t.base, `/api/drafts/${draftA}`, {
      method: 'PATCH',
      body: { baseRevision: 1, clientOpId: randomUUID(), patch: { name: 'Rival' } },
      cookie: A.cookie, csrf: A.csrf,
    });
    assert.equal(stale.status, 409);
    const cid = stale.body.conflict.id;
    const resB = await http(t.base, `/api/drafts/${draftA}/conflicts/${cid}/resolve`, {
      method: 'POST', body: { choice: 'mine', clientOpId: randomUUID() },
      cookie: B.cookie, csrf: B.csrf,
    });
    assert.equal(resB.status, 404);
  });

  it('heredado y cuentas no se ven entre sí', async () => {
    const dl = await createDraft(t.base, legacy);
    assert.equal(dl.status, 201);
    const legacyId = dl.body.draft.id;
    const aSeesLegacy = await http(t.base, `/api/drafts/${legacyId}`, { cookie: A.cookie });
    assert.equal(aSeesLegacy.status, 404);
    const legacySeesA = await http(t.base, `/api/drafts/${draftA}`, { cookie: legacy.cookie });
    assert.equal(legacySeesA.status, 404);
    const listA = await http(t.base, '/api/drafts', { cookie: A.cookie });
    assert.ok(!listA.body.drafts.some((d) => d.id === legacyId));
    const listLegacy = await http(t.base, '/api/drafts', { cookie: legacy.cookie });
    assert.ok(!listLegacy.body.drafts.some((d) => d.id === draftA));
    assert.ok(listLegacy.body.drafts.some((d) => d.id === legacyId));
  });

  it('logout invalida la sesión', async () => {
    const r = await register(t.base, 'Sale', freshEmail('sale'), pw('sale'));
    const s = jarOf(r);
    const out = await http(t.base, '/api/account/logout', {
      method: 'POST', cookie: s.cookie, csrf: s.csrf,
    });
    assert.equal(out.status, 200);
    const me = await http(t.base, '/api/account/me', { cookie: s.cookie });
    assert.equal(me.status, 401);
  });
});
