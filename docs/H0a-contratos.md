# H0a — Contratos técnicos (verificado transcribe+imagen, 2026-11-05)

Estado global: **transcribe e imagen verificados en documentación
oficial** (cuerpos leídos el 2026-11-05); spark sigue sin verificar.
Ninguna llamada real desde este repo hasta hoy: el transporte existe,
apagado por defecto, y exige llave + presupuesto aprobado por Jorge.

## Verificado oficial: transcripción (`muse-voice-transcribe-1.0`)

Fuente: `dev.meta.ai/docs` (`speech-to-text`,
`cookbook/voice-api-fundamentals`, `api-reference/voice/*`,
`pricing-rate-limits`), leídas el 2026-11-05.

- Endpoint: `POST https://api.meta.ai/v1/asr/transcribe` (one-shot;
  aparte existe `wss://…/v1/asr/realtime`, no usado).
- Auth: `Authorization: Bearer $MODEL_API_KEY`.
- Cuerpo: `multipart/form-data` con `request` (JSON:
  `{model, audioEncoding: "WAV", mode: "PUSH_TO_TALK",
  languageBias?: ["Spanish"|"English"], keywords?}`) + `audio`
  (WAV, `audio/wav`). Query opcional `sessionId` (correlación).
- Respuesta (`Accept: application/json`): `{transcript, turns: []}`
  (en PUSH_TO_TALK los turnos vienen vacíos; el texto va junto).
- Entrada: WAV PCM16 mono 16/24 kHz (24 nativa); máx 10 min o 32 MB.
  El cookbook oficial convierte con
  `ffmpeg -i entrada -ac 1 -ar 24000 -sample_fmt s16 salida.wav`.
- Errores: 400 (WAV inválido/>10min/no-multipart), 406 (Accept),
  413 (>32 MB), 429 (concurrencia/hora, con backoff), 500 (fallo);
  taxonomía `type`/`code` + mensaje client-safe + session id.
- Precio oficial: **$0.18/hora de audio procesado**, segundos
  enteros hacia abajo, sin mínimos (equivale a $3/1000 min).
- Topes Meta: 256 sesiones simultáneas; 16.000 sesiones/hora.

## Verificado oficial: imagen (`muse-image-1.0`)

Fuente: `dev.meta.ai/docs` (`image-generation`,
`cookbook/muse-image`, `api-reference/images/*`,
`pricing-rate-limits`), leídas el 2026-11-05.

- Conflicto de terceros resuelto: existen DOS vías oficiales.
  Porque usa la única apta para portadas sueltas:
  `POST https://api.meta.ai/v1/images/generations`
  (JSON, estilo OpenAI; `POST /v1/responses` es la vía conversacional).
- Auth: `Authorization: Bearer $MODEL_API_KEY`.
- Petición: `{model: "muse-image-1.0", prompt, n: 1,
  size: "1280x800", response_format: "b64_json"}` (`size` solo fija
  el aspecto, aquí 8:5 de portadas; `quality` se acepta e ignora).
- Respuesta: `{created, data: [{b64_json, revised_prompt?}]}`.
- Precio oficial: **$0.01/imagen plana**; solo cuentan las
  devueltas (fallos y filtradas no se facturan).
- Topes Meta: 150 RPM, sin TPM.

## Sin verificar (terceros, NO usar en real)

- Spark (`muse-spark-1.3/1.2/1.1`): $1.25/1M entrada,
  $0.15/1M cacheada, $4.25/1M salida; 3000 RPM y 4M TPM por equipo.
  Contributor ($0.10/$0.002/$0.20 a cambio de entrenar con el
  contenido) → **no se activa** (decisión ética y de producto).

## Implementado en el repo (apagado por defecto)

- `POST /api/audio/transcribe` con `audio/wav`: valida WAV,
  exige contrato+llave+IA habilitada+reserva, llama a Meta,
  concilia segundos reales; JSON sigue yendo al doble.
- Conversión opus→WAV en el navegador (`web/audio-convert.mjs`,
  Web Audio local, sin otra API ni ffmpeg en servidor).
- `POST /api/ai/image`: genera portada 8:5, guarda PNG/JPEG en
  `data/img-ai/`, sirve `/img/ai/<uuid>.<ext>`; `image_ai` la
  deriva el servidor; sin habilitar responde el doble.
- Sin habilitar: `REAL_AI_DISABLED` (voz) o doble (imagen).
  Detalle, costos y activación: `docs/informe-meta-2026-11-05.md`.

## Pendiente antes de la ronda real 1

1. ~~Inspeccionar cuerpos oficiales (transcribe+imagen).~~ Hecho
   2026-11-05. Spark sigue pendiente (no se usa en real).
2. ~~Confirmar tarifas y conceptos facturables.~~ Hecho: voz
   $0.18/h (segundos enteros ↓), imagen $0.01/u (solo devueltas).
3. ~~Confirmar formato de captura y conversión.~~ Hecho: el
   navegador captura webm/opus; conversión local a WAV 24 kHz.
4. Presupuesto aprobado por Jorge + `META_CONTRACTS_VERIFIED=1` +
   `META_MODEL_API_KEY` en servidor + `meta.ai_enabled=1` +
   primera llamada real supervisada. Procedimiento en el informe.
