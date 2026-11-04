import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, TEST_SECRET } from './helper.mjs';

describe('auth de vendedor', async () => {
  const t = await startTestServer();
  after(() => t.close());

  it('anónimo: estado falso y rutas protegidas 401', async () => {
    const anon = await fetch(t.base + '/api/auth/status').then((r) => r.json());
    assert.equal(anon.ok, false);
    const r = await fetch(t.base + '/api/drafts');
    assert.equal(r.status, 401);
  });

  it('secreto erróneo: 401 y no crea sesión', async () => {
    const r = await fetch(t.base + '/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: 'incorrecto-pero-largo-0123456789' }),
    });
    assert.equal(r.status, 401);
    assert.equal(r.headers.get('set-cookie'), null);
  });

  it('login correcto: cookie httpOnly + csrf, sin filtrar secreto', async () => {
    const r = await fetch(t.base + '/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: TEST_SECRET }),
    });
    assert.equal(r.status, 200);
    const setCookie = r.headers.get('set-cookie') ?? '';
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);
    const text = await r.text();
    assert.ok(!text.includes(TEST_SECRET), 'el secreto no sale en respuestas');
  });

  it('mutación sin CSRF válido: 403', async () => {
    const r = await fetch(t.base + '/api/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: t.cookie, 'x-csrf': 'malo' },
      body: JSON.stringify({ clientOpId: 'aaaaaaaa-0000-4000-8000-000000000000' }),
    });
    assert.equal(r.status, 403);
  });

  it('bloqueo tras 5 fallos en 10 minutos', async () => {
    const t2 = await startTestServer();
    try {
      for (let i = 0; i < 5; i++) {
        await fetch(t2.base + '/api/auth/login', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ secret: 'fallo-intencionado-largo-0123456789' }),
        });
      }
      const r = await fetch(t2.base + '/api/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret: TEST_SECRET }),
      });
      assert.equal(r.status, 429);
    } finally {
      await t2.close();
    }
  });
});
