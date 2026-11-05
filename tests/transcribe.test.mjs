import { describe, it, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helper.mjs';
import { setAiEnabled } from '../server/limits.mjs';
import { floatToPcm16, encodeWavPcm16 } from '../web/audio-convert.mjs';

// NINGUNA llamada real: el servidor recibe un fetch doble por inyección.
describe('transcripción real Meta (dobles, sin llamadas)', async () => {
  const holder = {};
  const t = await startTestServer({ metaFetch: (...a) => holder.fn(...a) });
  after(() => t.close());
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

  const wav2s = Buffer.from(encodeWavPcm16(floatToPcm16(
    Float32Array.from({ length: 32000 }, (_, i) => Math.sin((2 * Math.PI * 4 * i) / 32000)),
  ), 16000));
  const enable = () => {
    process.env.META_CONTRACTS_VERIFIED = '1';
    process.env.META_MODEL_API_KEY = 'test-key';
    setAiEnabled(t.db, true, 'test');
  };
  const wavPost = (body, headers = {}) =>
    t.api('/api/audio/transcribe', {
      method: 'POST', body, headers: { 'content-type': 'audio/wav', ...headers },
    });
  const okFetch = (seen) => async (url, opts) => {
    seen.url = String(url);
    seen.opts = opts;
    return {
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ transcript: 'HOLA JUEZ', turns: [], sessionId: 'm1' }),
    };
  };
  const countingThrower = (counter) => async () => {
    counter.n += 1;
    throw new Error('Meta no debe llamarse aquí');
  };

  it('doble JSON sin cambios (fake:true)', async () => {
    const r = await t.api('/api/audio/transcribe', {
      method: 'POST', body: JSON.stringify({ script: 'Galletas' }),
    });
    assert.equal(r.body.result.fake, true);
    assert.equal(r.body.result.transcript, 'Galletas');
  });

  it('WAV sin habilitar: 503 REAL_AI_DISABLED y Meta jamás llamada', async () => {
    const counter = { n: 0 };
    holder.fn = countingThrower(counter);
    const r = await wavPost(wav2s);
    assert.equal(r.status, 503);
    assert.equal(r.body.error, 'REAL_AI_DISABLED');
    assert.equal(counter.n, 0);
  });

  it('habilitada + Meta 200: transcript, segundos y petición exacta', async () => {
    enable();
    const seen = {};
    holder.fn = okFetch(seen);
    const r = await wavPost(wav2s, { 'x-audio-language': 'en' });
    assert.equal(r.status, 200);
    assert.equal(r.body.result.fake, false);
    assert.equal(r.body.result.transcript, 'HOLA JUEZ');
    assert.equal(r.body.result.secondsBilled, 2);
    assert.match(seen.url, /^https:\/\/api\.meta\.ai\/v1\/asr\/transcribe\?sessionId=/);
    assert.equal(seen.opts.method, 'POST');
    assert.equal(seen.opts.headers.Authorization, 'Bearer test-key');
    assert.equal(seen.opts.headers.Accept, 'application/json');
    const reqJson = JSON.parse(await seen.opts.body.get('request').text());
    assert.deepEqual(reqJson, {
      model: 'muse-voice-transcribe-1.0', audioEncoding: 'WAV',
      mode: 'PUSH_TO_TALK', languageBias: ['English'],
    });
    assert.equal(seen.opts.body.get('audio').type, 'audio/wav');
    // Auditoría sin transcript ni audio.
    const row = t.db.prepare("SELECT detail FROM audit WHERE action = 'audio.transcribed' ORDER BY id DESC LIMIT 1").get();
    assert.ok(row && !row.detail.includes('HOLA'));
    // Reserva consumida: 2 s conciliados.
    const u = t.db.prepare("SELECT used, calls FROM usage_windows WHERE kind = 'transcribe' AND scope = 'global'").get();
    assert.equal(u.calls, 1);
    assert.ok(Math.abs(u.used - 2 / 60) < 1e-9);
  });

  it('idioma por defecto: español', async () => {
    enable();
    const seen = {};
    holder.fn = okFetch(seen);
    await wavPost(wav2s);
    const reqJson = JSON.parse(await seen.opts.body.get('request').text());
    assert.deepEqual(reqJson.languageBias, ['Spanish']);
  });

  it('Meta 429: nuestro 429 y reserva liberada (sin gastar)', async () => {
    enable();
    const before = t.db.prepare("SELECT used FROM usage_windows WHERE kind = 'transcribe' AND scope = 'global'").get()?.used ?? 0;
    holder.fn = async () => ({
      ok: false, status: 429,
      headers: { get: () => 'application/json' },
      json: async () => ({ type: 'rate_limited' }),
    });
    const r = await wavPost(wav2s);
    assert.equal(r.status, 429);
    const after = t.db.prepare("SELECT used FROM usage_windows WHERE kind = 'transcribe' AND scope = 'global'").get()?.used ?? 0;
    assert.ok(Math.abs(after - before) < 1e-9);
  });

  it('Meta 400: nuestro 400 y reserva liberada', async () => {
    enable();
    holder.fn = async () => ({
      ok: false, status: 400,
      headers: { get: () => 'application/json' },
      json: async () => ({ type: 'bad_audio' }),
    });
    const r = await wavPost(wav2s);
    assert.equal(r.status, 400);
    assert.match(r.body.detail, /bad_audio/);
  });

  it('fallo de red: 502 META_ERROR y reserva retenida (held)', async () => {
    enable();
    holder.fn = async () => { throw new TypeError('network down'); };
    const r = await wavPost(wav2s);
    assert.equal(r.status, 502);
    assert.equal(r.body.error, 'META_ERROR');
    const held = t.db.prepare("SELECT COUNT(*) AS n FROM reservations WHERE state = 'held' AND kind = 'transcribe'").get();
    assert.equal(held.n, 1);
  });

  it('bytes no-WAV: 415 sin llamar a Meta', async () => {
    enable();
    const counter = { n: 0 };
    holder.fn = countingThrower(counter);
    const r = await wavPost(Buffer.alloc(100, 7));
    assert.equal(r.status, 415);
    assert.equal(counter.n, 0);
  });

  it('tope agotado: 429 sin llamar a Meta', async () => {
    enable();
    const sid = t.cookie.split('=')[1].split('.')[0];
    t.db.prepare(
      `INSERT INTO usage_windows (scope, kind, window, used, calls) VALUES (?, 'transcribe', 'round1', 15, 99)
       ON CONFLICT (scope, kind, window) DO UPDATE SET used = 15, calls = 99`,
    ).run('session:' + sid);
    const counter = { n: 0 };
    holder.fn = countingThrower(counter);
    const r = await wavPost(wav2s);
    assert.equal(r.status, 429);
    assert.equal(counter.n, 0);
  });

  it('más de 32 MB: 413', async () => {
    enable();
    const counter = { n: 0 };
    holder.fn = countingThrower(counter);
    const r = await wavPost(Buffer.alloc(33 * 1024 * 1024, 0));
    assert.equal(r.status, 413);
    assert.equal(counter.n, 0);
  });
});
