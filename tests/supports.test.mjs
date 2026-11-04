// Apoyos honestos (Fase 5): intención o simulación explícita.
// Sin pagos reales: jamás dinero recibido. BD temporal, node:test.
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
const freshEmail = (tag) => `fase5-${tag}-${seq++}-${randomUUID().slice(0, 8)}@ejemplo.com`;

async function boot() {
  const dbPath = join(ROOT, 'data', `.test-supports-${randomUUID()}.sqlite`);
  const { server, db } = createApp({ dbPath, secret: TEST_SECRET });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    db,
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

async function legacyLogin(base) {
  const res = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: TEST_SECRET }),
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

async function publishInitiative(base, s, modality = 'donations') {
  const c = await createDraft(base, s, { kind: 'initiative' });
  assert.equal(c.status, 201);
  const p = await patchDraft(base, s, c.body.draft.id, {
    name: 'Fondo ficticio', description: 'Iniciativa ficticia de prueba',
    modality, purpose: 'Prueba sin dinero real',
  });
  assert.equal(p.status, 200);
  const pub = await reviewPublish(base, s, c.body.draft.id);
  assert.equal(pub.status, 201);
  return pub.body.product.id;
}

describe('apoyos honestos (Fase 5)', async () => {
  const t = await boot();
  after(() => t.close());
  let A; let B; let legacy;
  let iid; // iniciativa donations de A
  let bizId; // iniciativa business de A

  before(async () => {
    const ra = await register(t.base, 'Alba', freshEmail('alba'), pw('alba'));
    assert.equal(ra.status, 201);
    A = jarOf(ra);
    const rb = await register(t.base, 'Beto', freshEmail('beto'), pw('beto'));
    assert.equal(rb.status, 201);
    B = jarOf(rb);
    const rl = await legacyLogin(t.base);
    assert.equal(rl.status, 200);
    legacy = jarOf(rl);
    iid = await publishInitiative(t.base, A, 'donations');
    bizId = await publishInitiative(t.base, A, 'business');
  });

  it('intent 201 con etiquetas honestas y sin exponer nickname/mensaje', async () => {
    const r = await http(t.base, `/api/initiatives/${iid}/supports`, {
      method: 'POST',
      body: {
        kind: 'intent', amountCents: 500, message: 'Ánimo equipo', nickname: 'Veci',
        clientOpId: randomUUID(),
      },
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.support.kind, 'intent');
    assert.equal(r.body.support.amountCents, 500);
    assert.equal(r.body.support.status, 'expressed');
    assert.ok(r.body.support.id);
    assert.ok(r.body.support.createdAt);
    assert.equal(r.body.labels.kind, 'Intención de apoyo');
    assert.equal(r.body.labels.note, 'Expresado. No es dinero recibido.');
    assert.ok(!('message' in (r.body.support ?? {})), 'la respuesta pública no lleva mensaje');
    assert.ok(!('nickname' in (r.body.support ?? {})), 'la respuesta pública no lleva nickname');
    assert.ok(!r.text.includes('Veci'), 'el nickname no aparece en la respuesta pública');
    assert.ok(!r.text.includes('Ánimo equipo'), 'el mensaje no aparece en la respuesta pública');
  });

  it('simulated 201 con etiqueta de simulación', async () => {
    const r = await http(t.base, `/api/initiatives/${iid}/supports`, {
      method: 'POST',
      body: { kind: 'simulated', amountCents: 1000, clientOpId: randomUUID() },
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.support.kind, 'simulated');
    assert.equal(r.body.labels.kind, 'Simulación');
    assert.equal(r.body.labels.note, 'Expresado. No es dinero recibido.');
  });

  it('apoyo inválido → 400', async () => {
    const r = await http(t.base, `/api/initiatives/${iid}/supports`, {
      method: 'POST',
      body: { kind: 'donacion', clientOpId: randomUUID() },
    });
    assert.equal(r.status, 400);
  });

  it('modality solo negocio → 400 explicado', async () => {
    const r = await http(t.base, `/api/initiatives/${bizId}/supports`, {
      method: 'POST',
      body: { kind: 'intent', clientOpId: randomUUID() },
    });
    assert.equal(r.status, 400);
    assert.match(r.body.detail ?? '', /negocio|business/);
  });

  it('summary cuenta por tipo y lleva la nota honesta', async () => {
    const sid = await publishInitiative(t.base, A, 'both');
    const k1 = randomUUID();
    await http(t.base, `/api/initiatives/${sid}/supports`, {
      method: 'POST', body: { kind: 'intent', nickname: 'Ana', clientOpId: k1 },
    });
    await http(t.base, `/api/initiatives/${sid}/supports`, {
      method: 'POST', body: { kind: 'intent', clientOpId: randomUUID() },
    });
    await http(t.base, `/api/initiatives/${sid}/supports`, {
      method: 'POST', body: { kind: 'simulated', amountCents: 250, clientOpId: randomUUID() },
    });
    const s = await http(t.base, `/api/initiatives/${sid}/supports/summary`);
    assert.equal(s.status, 200);
    assert.equal(s.body.intents, 2);
    assert.equal(s.body.simulated, 1);
    assert.equal(s.body.note, 'Expresiones de apoyo, no fondos recibidos');
    assert.ok(!s.text.includes('Ana'), 'el summary público no expone nicknames');
  });

  it('propietario lista con mensajes; ajeno 404; sin sesión 401', async () => {
    const list = await http(t.base, `/api/initiatives/${iid}/supports`, {
      cookie: A.cookie, csrf: A.csrf,
    });
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.body.supports));
    const found = list.body.supports.find((x) => x.nickname === 'Veci');
    assert.ok(found, 'el propietario ve nickname y mensaje');
    assert.equal(found.message, 'Ánimo equipo');
    assert.deepEqual(Object.keys(found).sort(),
      ['amountCents', 'createdAt', 'id', 'kind', 'message', 'nickname', 'status']);
    assert.ok(!JSON.stringify(list.body).includes('@'), 'sin emails: no existen');

    const other = await http(t.base, `/api/initiatives/${iid}/supports`, {
      cookie: B.cookie, csrf: B.csrf,
    });
    assert.equal(other.status, 404);

    const anon = await http(t.base, `/api/initiatives/${iid}/supports`);
    assert.equal(anon.status, 401);
  });

  it('idempotencia: misma clave no duplica', async () => {
    const sid = await publishInitiative(t.base, A, 'donations');
    const key = randomUUID();
    const first = await http(t.base, `/api/initiatives/${sid}/supports`, {
      method: 'POST', body: { kind: 'intent', clientOpId: key },
    });
    assert.equal(first.status, 201);
    const second = await http(t.base, `/api/initiatives/${sid}/supports`, {
      method: 'POST', body: { kind: 'intent', clientOpId: key },
    });
    assert.equal(second.status, 201);
    assert.equal(second.body.support.id, first.body.support.id);
    assert.equal(second.body.idempotentReplay, true);
    const s = await http(t.base, `/api/initiatives/${sid}/supports/summary`);
    assert.equal(s.body.intents, 1);
  });

  it('iniciativa inexistente o no iniciativa → 404 en las tres rutas', async () => {
    const missing = randomUUID();
    const p = await http(t.base, `/api/initiatives/${missing}/supports`, {
      method: 'POST', body: { kind: 'intent', clientOpId: randomUUID() },
    });
    assert.equal(p.status, 404);
    const s = await http(t.base, `/api/initiatives/${missing}/supports/summary`);
    assert.equal(s.status, 404);
    const l = await http(t.base, `/api/initiatives/${missing}/supports`, {
      cookie: A.cookie, csrf: A.csrf,
    });
    assert.equal(l.status, 404);

    // Un producto no es iniciativa.
    const c = await createDraft(t.base, A);
    await patchDraft(t.base, A, c.body.draft.id, { name: 'Miel', priceCents: 300, description: 'Ficticia' });
    const pub = await reviewPublish(t.base, A, c.body.draft.id);
    const pid = pub.body.product.id;
    const pp = await http(t.base, `/api/initiatives/${pid}/supports`, {
      method: 'POST', body: { kind: 'intent', clientOpId: randomUUID() },
    });
    assert.equal(pp.status, 404);
    const ps = await http(t.base, `/api/initiatives/${pid}/supports/summary`);
    assert.equal(ps.status, 404);
  });

  it('auditoría sin mensaje ni nickname', async () => {
    const rows = t.db.prepare("SELECT * FROM audit WHERE action = 'support.expressed'").all();
    assert.ok(rows.length > 0);
    for (const r of rows) {
      assert.ok(!String(r.detail).includes('Veci'));
      assert.ok(!String(r.detail).includes('Ánimo'));
      assert.ok(!String(r.entity).includes('Veci'));
    }
  });

  it('propiedad heredada: owner NULL visible para sesión vendedora, 404 para usuarios', async () => {
    const lid = await publishInitiative(t.base, legacy, 'donations');
    await http(t.base, `/api/initiatives/${lid}/supports`, {
      method: 'POST', body: { kind: 'intent', nickname: 'Heredado', clientOpId: randomUUID() },
    });
    const mine = await http(t.base, `/api/initiatives/${lid}/supports`, {
      cookie: legacy.cookie, csrf: legacy.csrf,
    });
    assert.equal(mine.status, 200);
    assert.equal(mine.body.supports.length, 1);
    assert.equal(mine.body.supports[0].nickname, 'Heredado');
    const foreign = await http(t.base, `/api/initiatives/${lid}/supports`, {
      cookie: A.cookie, csrf: A.csrf,
    });
    assert.equal(foreign.status, 404);
  });
});
