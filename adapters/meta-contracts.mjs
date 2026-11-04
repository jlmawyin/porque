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
    status: 'unverified',
    modelRef: 'muse-voice-transcribe-1.0',
    pricingNote: 'terceros coherentes: $3 por 1000 min audio ($0.003/min) — POR CONFIRMAR',
    formatNote: 'terceros coherentes: WAV PCM16 mono 16/24 kHz, máx 10 min — POR CONFIRMAR; multipart request+audio y 32 MB sin confirmar',
    endpoint: null,
    source: 'docs/H0a-contratos.md',
  },
  image: {
    status: 'unverified',
    modelRef: 'muse-image-1.0',
    pricingNote: 'terceros coherentes: $0.01/imagen — POR CONFIRMAR',
    endpointNote: 'fuentes de terceros en conflicto (Responses vs images/generations) — PENDIENTE oficial',
    endpoint: null,
    source: 'docs/H0a-contratos.md',
  },
});
