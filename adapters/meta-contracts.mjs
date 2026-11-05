// Fichas de contratos Meta (H0a). Estado honestamente marcado:
// 'unverified' = solo fuentes de terceros o dato del operador, por confirmar
// en documentación oficial antes de cualquier llamada real.
export const META_BASE_URL = 'https://api.meta.ai/v1';

export const META_CONTRACTS = Object.freeze({
  spark: {
    status: 'unverified',
    modelRef: 'muse-spark-1.3',
    mode: 'Standard (referencia inicial; Contributor NO se activa)',
    pricingNote: 'terceros coherentes: $1.25/1M entrada, $0.15/1M cacheada, $4.25/1M salida — POR CONFIRMAR en docs oficiales',
    rateNote: 'terceros: 3000 RPM, 4M TPM por equipo (Standard) — POR CONFIRMAR',
    endpoint: null, // sin inspeccionar cuerpo oficial: pendiente
    source: 'docs/H0a-contratos.md',
  },
  transcribe: {
    status: 'verified',
    modelRef: 'muse-voice-transcribe-1.0',
    endpoint: 'https://api.meta.ai/v1/asr/transcribe',
    method: 'POST multipart/form-data (request: JSON, audio: WAV)',
    authNote: 'oficial: Authorization: Bearer $MODEL_API_KEY',
    requestNote: 'oficial: {model, audioEncoding: WAV, mode: PUSH_TO_TALK, languageBias?: ["Spanish"|"English"]}; respuesta {transcript, turns: []}',
    pricingNote: 'oficial 2026-11-05: $0.18/hora de audio, segundos enteros hacia abajo, sin mínimos',
    formatNote: 'oficial: WAV PCM16 mono 16/24 kHz (24 nativa), máx 10 min o 32 MB',
    errorNote: 'oficial: 400 WAV inválido, 406 Accept, 413 >32MB, 429 concurrencia/hora (backoff), 500 fallo; taxonomía type/code + sessionId',
    rateNote: 'oficial: 256 simultáneos; 16.000 sesiones/hora',
    source: 'docs/H0a-contratos.md (verificado 2026-11-05)',
  },
  image: {
    status: 'verified',
    modelRef: 'muse-image-1.0',
    endpoint: 'https://api.meta.ai/v1/images/generations',
    method: 'POST JSON (OpenAI-compatible; Responses es la otra vía oficial)',
    authNote: 'oficial: Authorization: Bearer $MODEL_API_KEY',
    requestNote: 'oficial: {model, prompt, n: 1, size: "1280x800" (solo aspecto 8:5), response_format: b64_json}; respuesta {created, data: [{b64_json, revised_prompt?}]}',
    pricingNote: 'oficial 2026-11-05: $0.01/imagen plana; solo cuentan las devueltas (fallos y filtradas no)',
    rateNote: 'oficial: 150 RPM, sin TPM',
    source: 'docs/H0a-contratos.md (verificado 2026-11-05)',
  },
});
