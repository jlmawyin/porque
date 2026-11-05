// Conversión local de la grabación (webm/opus u otro contenedor del navegador)
// a WAV PCM16 mono 24 kHz, lo que exige Meta. Sin otra API ni servidor:
// usa Web Audio del propio navegador. Funciones puras sin DOM (probadas
// en Node) + recordingToWav (solo navegador).
export const CONVERT_RATE = 24000;
export const CONVERT_MAX_SECONDS = 600;

/** Promedia canales a mono. channels: Array<Float32Array> del mismo largo. */
export function downmixToMono(channels) {
  if (!channels?.length) return new Float32Array(0);
  const out = new Float32Array(channels[0].length);
  for (let i = 0; i < out.length; i += 1) {
    let s = 0;
    for (const ch of channels) s += ch[i] ?? 0;
    out[i] = s / channels.length;
  }
  return out;
}

/** Remuestreo lineal a otra tasa. */
export function resampleLinear(input, fromRate, toRate) {
  if (!(fromRate > 0) || !(toRate > 0) || !input?.length) return new Float32Array(0);
  if (fromRate === toRate) return Float32Array.from(input);
  const outLen = Math.max(1, Math.round((input.length * toRate) / fromRate));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i += 1) {
    const pos = (i * (input.length - 1)) / (outLen - 1 || 1);
    const lo = Math.floor(pos);
    const hi = Math.min(input.length - 1, lo + 1);
    out[i] = input[lo] + (input[hi] - input[lo]) * (pos - lo);
  }
  return out;
}

/** Float [-1,1] → PCM16 con recorte. */
export function floatToPcm16(input) {
  const out = new Int16Array(input?.length ?? 0);
  for (let i = 0; i < out.length; i += 1) {
    const v = Math.max(-1, Math.min(1, input[i] ?? 0));
    out[i] = v < 0 ? Math.round(v * 32768) : Math.round(v * 32767);
  }
  return out;
}

/** Codifica PCM16 mono a bytes WAV (RIFF, fmt 16, data). */
export function encodeWavPcm16(samples, sampleRate) {
  const n = samples?.length ?? 0;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const ascii = (o, s) => { for (let i = 0; i < s.length; i += 1) v.setUint8(o + i, s.charCodeAt(i)); };
  ascii(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i += 1) v.setInt16(44 + i * 2, samples[i], true);
  return new Uint8Array(buf);
}

/**
 * Convierte una grabación del navegador a WAV PCM16 mono 24 kHz.
 * Solo navegador (AudioContext). Lanza Error('audio-vacio'|'audio-largo'|
 * 'audio-ilegible') ante lo que Meta rechazaría.
 */
export async function recordingToWav(blob, { sampleRate = CONVERT_RATE } = {}) {
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AC || typeof OfflineAudioContext === 'undefined') throw new Error('audio-no-soportado');
  if (!blob?.size) throw new Error('audio-vacio');
  const raw = await blob.arrayBuffer();
  const srcCtx = new AC();
  let decoded;
  try {
    decoded = await srcCtx.decodeAudioData(raw.slice(0));
  } catch {
    await srcCtx.close().catch(() => {});
    throw new Error('audio-ilegible');
  }
  await srcCtx.close().catch(() => {});
  if (!(decoded.duration > 0)) throw new Error('audio-vacio');
  if (decoded.duration > CONVERT_MAX_SECONDS) throw new Error('audio-largo');
  const len = Math.max(1, Math.ceil(decoded.duration * sampleRate));
  const off = new OfflineAudioContext(1, len, sampleRate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  const wav = encodeWavPcm16(floatToPcm16(rendered.getChannelData(0)), sampleRate);
  return { wav, sampleRate, seconds: rendered.duration };
}
