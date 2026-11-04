// Ayudante de pruebas: servidor real en puerto efímero, BD temporal en data/.
import { randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unlinkSync, existsSync } from 'node:fs';
import { createApp } from '../server/main.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const TEST_SECRET = 'test-secreto-robusto-0123456789abcdef';

export async function startTestServer() {
  const name = `.test-${randomUUID()}.sqlite`;
  const dbPath = join(ROOT, 'data', name);
  const { server, db } = createApp({ dbPath, secret: TEST_SECRET });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const ctx = { base, db, dbPath, server, cookie: '', csrf: '' };
  const r = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: TEST_SECRET }),
  });
  const body = await r.json();
  ctx.cookie = (r.headers.get('set-cookie') ?? '').split(';')[0];
  ctx.csrf = body.csrf;
  let closed = false;
  ctx.close = async () => {
    if (closed) return; // idempotente: el doble cierre es seguro
    closed = true;
    try { await new Promise((resolve) => server.close(resolve)); } catch { /* noop */ }
    try { db.close(); } catch { /* noop */ }
    for (const f of [dbPath, dbPath + '-journal', dbPath + '-wal', dbPath + '-shm']) {
      try { if (existsSync(f)) unlinkSync(f); } catch { /* noop */ }
    }
  };
  ctx.api = async (path, opts = {}) => {
    const res = await fetch(base + path, {
      ...opts,
      headers: {
        'content-type': 'application/json',
        cookie: ctx.cookie,
        'x-csrf': ctx.csrf,
        ...(opts.headers ?? {}),
      },
    });
    return { status: res.status, body: await res.json(), headers: res.headers };
  };
  return ctx;
}
