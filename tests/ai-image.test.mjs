import { describe, it, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestServer } from './helper.mjs';
import { setAiEnabled } from '../server/limits.mjs';

// NINGUNA llamada real: el servidor recibe un fetch doble por inyección.
// Las portadas van a un dir temporal, nunca a data/.
describe('portada IA Meta (dobles, sin llamadas)', async () => {
  const imgDir = mkdtempSync(join(tmpdir(), 'porque-img-'));
  const holder = {};
  const t = await startTestServer({ imgDir, metaFetch: (...a) => holder.fn(...a) });
  after(() => { t.close(); rmSync(imgDir, { recursive: true, force: true }); });
  const prevVerified = process.env.META_CONTRACTS_VERIFIED;
  const prevKey = process.env.META_MODEL_API_KEY;
  const resetDouble = () => {
    holder.fn = async () => { throw new Error('Meta no debe llamarse sin doble'); };
  };
  resetDouble();
  afterEach(() => {
    resetDouble();
    setAiEnabled(t.db, false, 'test');
    if (prevVerified === undefined) delete process.env.META_CONTRACTS_VERIFIED;
    else process.env.META_CONTRACTS_VERIFIED = prevVerified;
    if (prevKey === undefined) delete process.env.META_MODEL_API_KEY;
    else process.env.META_MODEL_API_KEY = prevKey;
  });

  const enable = () => {
    process.env.META_CONTRACTS_VERIFIED = '1';
    process.env.META_MODEL_API_KEY = 'test-key';
    setAiEnabled(t.db, true, 'test');
  };
  // PNG válido en cabecera (magia + tamaño; el navegador decodifica al mostrar).
  const pngBytes = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(200)]);
  const okFetch = (seen) => async (url, opts) => {
    seen.url = String(url);
    seen.opts = opts;
    return {
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ created: 1, data: [{ b64_json: pngBytes.toString('base64') }] }),
    };
  };
  const countingThrower = (counter) => async () => {
    counter.n += 1;
    throw new Error('Meta no debe llamarse aquí');
  };
  const newDraft = async () => {
    const c = await t.api('/api/drafts', {
      method: 'POST',
      body: JSON.stringify({ clientOpId: randomUUID(), kind: 'initiative', initial: { name: 'Huerta', description: 'Comunitaria', modality: 'donations' } }),
    });
    return c.body.draft.id;
  };
  const gen = (draftId) =>
    t.api('/api/ai/image', { method: 'POST', body: JSON.stringify({ draftId }) });

  it('deshabilitada: doble etiquetado como falso (sin cambios)', async () => {
    const r = await gen(await newDraft());
    assert.equal(r.body.result.fake, true);
    assert.match(r.body.result.imageRef, /^fake:placeholder:/);
  });

  it('habilitada + Meta 200: guarda PNG, sirve /img/ai y petición exacta', async () => {
    enable();
    const seen = {};
    holder.fn = okFetch(seen);
    const r = await gen(await newDraft());
    assert.equal(r.status, 200);
    assert.equal(r.body.result.fake, false);
    assert.match(r.body.result.imageRef, /^\/img\/ai\/[0-9a-f-]+\.png$/);
    assert.equal(seen.url, 'https://api.meta.ai/v1/images/generations');
    assert.equal(seen.opts.headers.Authorization, 'Bearer test-key');
    const sent = JSON.parse(seen.opts.body);
    assert.equal(sent.model, 'muse-image-1.0');
    assert.equal(sent.n, 1);
    assert.equal(sent.size, '1280x800');
    assert.equal(sent.response_format, 'b64_json');
    assert.match(sent.prompt, /Huerta/);
    const name = r.body.result.imageRef.split('/').pop();
    assert.equal(existsSync(join(imgDir, name)), true);
    const got = await fetch(t.base + r.body.result.imageRef);
    assert.equal(got.status, 200);
    assert.equal(got.headers.get('content-type'), 'image/png');
    assert.equal((await got.arrayBuffer()).byteLength, pngBytes.length);
    const u = t.db.prepare("SELECT used, calls FROM usage_windows WHERE kind = 'image' AND scope = 'global'").get();
    assert.deepEqual([u.used, u.calls], [1, 1]);
  });

  it('inexistente: 404; traversal fuera de img-ai: 404', async () => {
    const a = await fetch(t.base + '/img/ai/00000000-0000-0000-0000-000000000000.png');
    assert.equal(a.status, 404);
    const b = await fetch(t.base + '/img/ai/..%2f..%2fporque.sqlite');
    assert.equal(b.status, 404);
  });

  it('borrador ajeno o inexistente: 404 sin llamar a Meta', async () => {
    enable();
    const counter = { n: 0 };
    holder.fn = countingThrower(counter);
    const r = await gen(randomUUID());
    assert.equal(r.status, 404);
    assert.equal(counter.n, 0);
  });

  it('Meta 429: nuestro 429 y reserva liberada', async () => {
    enable();
    const before = t.db.prepare("SELECT used FROM usage_windows WHERE kind = 'image' AND scope = 'global'").get()?.used ?? 0;
    holder.fn = async () => ({
      ok: false, status: 429,
      headers: { get: () => 'application/json' },
      json: async () => ({ type: 'rate_limited' }),
    });
    const r = await gen(await newDraft());
    assert.equal(r.status, 429);
    const after = t.db.prepare("SELECT used FROM usage_windows WHERE kind = 'image' AND scope = 'global'").get()?.used ?? 0;
    assert.equal(after, before);
  });

  it('bytes no-PNG: 502 META_ERROR y reserva retenida', async () => {
    enable();
    holder.fn = async () => ({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ created: 1, data: [{ b64_json: Buffer.alloc(200, 1).toString('base64') }] }),
    });
    const r = await gen(await newDraft());
    assert.equal(r.status, 502);
    assert.equal(r.body.error, 'META_ERROR');
    const held = t.db.prepare("SELECT COUNT(*) AS n FROM reservations WHERE state = 'held' AND kind = 'image'").get();
    assert.equal(held.n, 1);
  });

  it('imageAi la deriva el servidor: /img/ai/* → true, otra → false', async () => {
    enable();
    holder.fn = okFetch({});
    const id = await newDraft();
    const g = await gen(id);
    const ref = g.body.result.imageRef;
    const d1 = await t.api(`/api/drafts/${id}`);
    const p1 = await t.api(`/api/drafts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ baseRevision: d1.body.draft.revision, clientOpId: randomUUID(), patch: { imageRef: ref } }),
    });
    assert.equal(p1.body.draft.imageAi, true);
    const p2 = await t.api(`/api/drafts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ baseRevision: p1.body.draft.revision, clientOpId: randomUUID(), patch: { imageRef: '/img/portada-apoyo.svg' } }),
    });
    assert.equal(p2.body.draft.imageAi, false);
  });
});
