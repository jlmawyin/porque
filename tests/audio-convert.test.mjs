import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  downmixToMono, resampleLinear, floatToPcm16, encodeWavPcm16,
} from '../web/audio-convert.mjs';
import { parseWavPcm16 } from '../shared/contracts.mjs';

const sine = (n, cycles = 4) => {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = Math.sin((2 * Math.PI * cycles * i) / n);
  return out;
};

describe('conversión local opus→WAV (sin otra API)', () => {
  it('downmix promedia canales', () => {
    const m = downmixToMono([new Float32Array([1, -1]), new Float32Array([0.5, 0.5])]);
    assert.deepEqual([...m], [0.75, -0.25]);
  });

  it('resample 48k→24k reduce a la mitad y conserva forma', () => {
    const r = resampleLinear(sine(480), 48000, 24000);
    assert.equal(r.length, 240);
    assert.ok(Math.abs(r[0]) < 0.01 && Math.abs(r[15] - 1) < 0.05);
  });

  it('float→pcm16 recorta y escala', () => {
    assert.deepEqual([...floatToPcm16(new Float32Array([1, -1, 2, -2, 0]))], [32767, -32768, 32767, -32768, 0]);
  });

  it('WAV codificado pasa el validador del servidor (16k y 24k)', () => {
    for (const rate of [16000, 24000]) {
      const wav = encodeWavPcm16(floatToPcm16(sine(rate)), rate);
      const v = parseWavPcm16(wav);
      assert.equal(v.ok, true);
      assert.equal(v.sampleRate, rate);
      assert.equal(v.channels, 1);
      assert.ok(Math.abs(v.seconds - 1) < 0.001);
    }
  });

  it('validador rechaza: no-RIFF, estéreo, 8 kHz, largo y gigante', () => {
    assert.equal(parseWavPcm16(new Uint8Array(100)).ok, false);
    const wav = encodeWavPcm16(floatToPcm16(sine(160)), 16000);
    const stereo = wav.slice();
    stereo[22] = 2;
    assert.match(parseWavPcm16(stereo).reason, /mono/);
    const bad = encodeWavPcm16(floatToPcm16(sine(80)), 8000);
    assert.match(parseWavPcm16(bad).reason, /tasa/);
    const long = encodeWavPcm16(floatToPcm16(sine(160)), 16000);
    new DataView(long.buffer).setUint32(40, 16000 * 2 * 601, true); // data de 601 s
    assert.match(parseWavPcm16(long).reason, /duración/);
    assert.match(parseWavPcm16(new Uint8Array(33 * 1024 * 1024)).reason, /32 MB/);
  });
});
