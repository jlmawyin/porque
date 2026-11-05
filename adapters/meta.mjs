// Adaptador Meta Model API — REAL DESACTIVADO POR DEFECTO.
// Las llamadas reales exigen: contratos oficiales verificados (H0a completa),
// IA habilitada en BD, aprobación de ronda con tope, reserva atómica previa.
// Este bloque solo prepara la configuración; no realiza llamadas.
import { META_BASE_URL, META_CONTRACTS } from './meta-contracts.mjs';

export class RealAiDisabledError extends Error {
  constructor(reason) {
    super(reason);
    this.code = 'REAL_AI_DISABLED';
  }
}

export function contractsVerified({ env = process.env } = {}) {
  return env.META_CONTRACTS_VERIFIED === '1';
}

/** Devuelve la ficha del contrato o lanza si no está verificada/habilitada. */
export function requireRealContract(kind, { env = process.env, aiEnabled = false } = {}) {
  const ficha = META_CONTRACTS[kind];
  if (!ficha) throw new RealAiDisabledError(`integración desconocida: ${kind}`);
  if (ficha.status !== 'verified') {
    throw new RealAiDisabledError(`${kind}: contrato pendiente de verificación oficial (H0a)`);
  }
  if (!contractsVerified({ env })) throw new RealAiDisabledError('META_CONTRACTS_VERIFIED != 1');
  if (!aiEnabled) throw new RealAiDisabledError('IA real desactivada (apagado por defecto)');
  const key = env.META_MODEL_API_KEY;
  if (!key) throw new RealAiDisabledError('falta META_MODEL_API_KEY en servidor');
  return { ficha, key };
}

// Transporte genérico: spark sigue sin transporte (contrato sin verificar).
// Transcripción e imagen usan sus transportes (contratos verificados).
export async function realRequest() {
  throw new RealAiDisabledError('transporte real no habilitado en esta entrega');
}

// Error de la API Meta (transporte real). status 0 = red/timeout (incierto).
export class MetaApiError extends Error {
  constructor({ status = 0, type = null, code = null, sessionId = null, detail = '' } = {}) {
    super(`meta asr/transcribe: HTTP ${status}${type ? ` ${type}` : ''}${detail ? ` — ${detail}` : ''}`);
    this.name = 'MetaApiError';
    this.status = status;
    this.type = type;
    this.code = code;
    this.sessionId = sessionId;
  }
}

/**
 * Transcripción real one-shot contra el contrato verificado H0a (2026-11-05).
 * No decide gates: el llamador ya pasó requireRealContract + reserve.
 * fetchImpl inyectable para tests (por defecto fetch global). Nunca registra
 * audio ni llave; el sessionId propio correlaciona con los logs de Meta.
 */
export async function transcribeClip({
  wavBytes, language = 'es', key, sessionId,
  fetchImpl = globalThis.fetch, timeoutMs = 180000,
} = {}) {
  if (!wavBytes?.length) throw new MetaApiError({ status: -1, type: 'bad_audio', detail: 'wav vacío' });
  if (!key) throw new MetaApiError({ status: -1, type: 'bad_key', detail: 'sin llave' });
  const request = {
    model: META_CONTRACTS.transcribe.modelRef,
    audioEncoding: 'WAV',
    mode: 'PUSH_TO_TALK',
    languageBias: [language === 'en' ? 'English' : 'Spanish'],
  };
  const form = new FormData();
  form.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }));
  form.append('audio', new Blob([wavBytes], { type: 'audio/wav' }), 'clip.wav');
  const url = `${META_BASE_URL}/asr/transcribe?sessionId=${encodeURIComponent(sessionId ?? '')}`;
  let res;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new MetaApiError({
      status: 0, sessionId: sessionId ?? null,
      type: e?.name === 'TimeoutError' ? 'timeout' : 'network',
      detail: e?.name === 'TimeoutError' ? `sin respuesta en ${timeoutMs} ms` : 'fallo de red',
    });
  }
  const ctype = res.headers?.get?.('content-type') ?? '';
  let body = null;
  try {
    if (ctype.includes('json')) body = await res.json();
  } catch { body = null; }
  if (res.ok) {
    const transcript = typeof body?.transcript === 'string' ? body.transcript : '';
    if (!transcript) {
      throw new MetaApiError({ status: 200, type: 'bad_response', sessionId: sessionId ?? null, detail: 'sin transcript' });
    }
    return {
      transcript: transcript.slice(0, 8000),
      turns: Array.isArray(body?.turns) ? body.turns : [],
      sessionId: body?.sessionId ?? sessionId ?? null,
    };
  }
  throw new MetaApiError({
    status: res.status,
    type: body?.type ?? body?.errorType ?? null,
    code: body?.code ?? null,
    sessionId: body?.sessionId ?? sessionId ?? null,
  });
}

export const COVER_SIZE = '1280x800'; // aspecto 8:5 de las portadas
export const COVER_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Generación real de portada (contrato H0a-image verificado 2026-11-05).
 * Una imagen (n: 1), b64_json. No decide gates ni topes: el llamador ya
 * pasó requireRealContract + reserve. Devuelve bytes PNG/JPEG crudos.
 */
export async function generateCover({
  prompt, key, fetchImpl = globalThis.fetch, timeoutMs = 180000,
} = {}) {
  if (!prompt || !key) throw new MetaApiError({ status: -1, type: 'bad_request', detail: 'prompt o llave ausente' });
  let res;
  try {
    res = await fetchImpl(`${META_BASE_URL}/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: META_CONTRACTS.image.modelRef, prompt, n: 1,
        size: COVER_SIZE, response_format: 'b64_json',
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new MetaApiError({
      status: 0,
      type: e?.name === 'TimeoutError' ? 'timeout' : 'network',
      detail: e?.name === 'TimeoutError' ? `sin respuesta en ${timeoutMs} ms` : 'fallo de red',
    });
  }
  let body = null;
  try {
    if ((res.headers?.get?.('content-type') ?? '').includes('json')) body = await res.json();
  } catch { body = null; }
  if (!res.ok) {
    throw new MetaApiError({
      status: res.status, type: body?.type ?? body?.error?.type ?? null,
      code: body?.code ?? body?.error?.code ?? null,
    });
  }
  const b64 = body?.data?.[0]?.b64_json;
  if (typeof b64 !== 'string' || !b64) {
    throw new MetaApiError({ status: 200, type: 'bad_response', detail: 'sin b64_json' });
  }
  const bytes = Buffer.from(b64, 'base64');
  if (bytes.length > COVER_MAX_BYTES || bytes.length < 100) {
    throw new MetaApiError({ status: 200, type: 'bad_response', detail: 'tamaño de imagen inválido' });
  }
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!isPng && !isJpeg) throw new MetaApiError({ status: 200, type: 'bad_response', detail: 'no es PNG/JPEG' });
  return { bytes, format: isPng ? 'png' : 'jpeg', revisedPrompt: body.data[0].revised_prompt ?? null };
}
