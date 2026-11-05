import { describe, it, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helper.mjs';

describe('demo para jueces: entrada sin registro', async () => {
  const t = await startTestServer();
  after(() => t.close());
  const prev = process.env.PORQUE_DEMO;
  beforeEach(() => { process.env.PORQUE_DEMO = '1'; });
  afterEach(() => {
    if (prev === undefined) delete process.env.PORQUE_DEMO;
    else process.env.PORQUE_DEMO = prev;
  });
  const anon = (path, opts = {}) =>
    t.api(path, { ...opts, headers: { cookie: '', 'x-csrf': '', ...(opts.headers ?? {}) } });

  it('desactivada: 404 como si no existiera', async () => {
    delete process.env.PORQUE_DEMO;
    const r = await anon('/api/demo/start', { method: 'POST', body: '{}' });
    assert.equal(r.status, 404);
  });

  it('activada: 201 con sesión demo desechable', async () => {
    const r = await anon('/api/demo/start', { method: 'POST', body: '{}' });
    assert.equal(r.status, 201);
    assert.equal(r.body.demo, true);
    assert.match(r.body.user.email, /@porque\.demo$/);
    assert.ok(r.body.csrf);
    const cookie = (r.headers.get('set-cookie') ?? '').split(';')[0];
    assert.match(cookie, /^porque_session=/);
    const me = await t.api('/api/account/me', { headers: { cookie, 'x-csrf': r.body.csrf } });
    assert.equal(me.status, 200);
    assert.equal(me.body.demo, true);
    assert.equal(me.body.user.id, r.body.user.id);
  });

  it('cada inicio es una identidad distinta: los jueces no se pisan', async () => {
    const a = await anon('/api/demo/start', { method: 'POST', body: '{}' });
    const b = await anon('/api/demo/start', { method: 'POST', body: '{}' });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.notEqual(a.body.user.id, b.body.user.id);
  });

  it('cuenta normal: me.demo es false', async () => {
    const r = await anon('/api/account/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Ana', email: 'ana-demo@example.com', password: 'secreto-largo-1' }),
    });
    assert.equal(r.status, 201);
    const cookie = (r.headers.get('set-cookie') ?? '').split(';')[0];
    const me = await t.api('/api/account/me', { headers: { cookie, 'x-csrf': r.body.csrf } });
    assert.equal(me.body.demo, false);
  });

  it('tope horario de demos: 429 sin crear más', async () => {
    const now = new Date().toISOString();
    const ins = t.db.prepare(
      'INSERT INTO users (id, name, email, pw_hash, pw_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    );
    for (let i = 0; i < 60; i += 1) {
      ins.run(`demo-cap-${i}`, 'Cap', `cap-${i}@porque.demo`, 'h', 's', now);
    }
    const r = await anon('/api/demo/start', { method: 'POST', body: '{}' });
    assert.equal(r.status, 429);
  });
});
