import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helper.mjs';

describe('audio: intake y doble de transcripción', async () => {
  const t = await startTestServer();
  after(() => t.close());

  it('WAV PCM16 mono 16 kHz: aceptado (contrato H0a por confirmar)', async () => {
    const r = await t.api('/api/audio/intake', {
      method: 'POST',
      body: JSON.stringify({ mime: 'audio/wav', bytes: 32000, durationMs: 2000, sampleRate: 16000, channels: 1 }),
    });
    assert.equal(r.body.verdict, 'accepted');
  });

  it('captura típica webm/opus: requiere conversión, no se rechaza en silencio', async () => {
    const r = await t.api('/api/audio/intake', {
      method: 'POST',
      body: JSON.stringify({ mime: 'audio/webm;codecs=opus', bytes: 50000, durationMs: 5000 }),
    });
    assert.equal(r.body.verdict, 'convert-required');
    assert.deepEqual(r.body.target.sampleRates, [16000, 24000]);
  });

  it('más de 10 minutos: rechazado con motivo', async () => {
    const r = await t.api('/api/audio/intake', {
      method: 'POST',
      body: JSON.stringify({ mime: 'audio/wav', bytes: 999, durationMs: 11 * 60 * 1000, sampleRate: 16000, channels: 1 }),
    });
    assert.equal(r.status, 415);
  });

  it('transcripción doble va etiquetada como falsa', async () => {
    const r = await t.api('/api/audio/transcribe', {
      method: 'POST', body: JSON.stringify({ script: 'Galletas, cinco dólares', durationMs: 3000 }),
    });
    assert.equal(r.body.result.fake, true);
    assert.equal(r.body.result.mark, 'FAKE-DOUBLE');
    assert.equal(r.body.result.transcript, 'Galletas, cinco dólares');
  });
});
