# Informe Meta — voz e imagen reales (2026-11-05, encargo de Jorge)

Objetivo: que el hackathon muestre interacción real con Meta
(`muse-voice-transcribe-1.0` + `muse-image-1.0`). Estado: contratos
verificados en docs oficiales, transporte implementado y probado con
dobles, **apagado por defecto, cero llamadas reales hechas**.

## 1. ¿Se necesita otra API?

**No.** La única API es Meta Model API (`https://api.meta.ai/v1`).
La conversión opus→WAV se hace en el navegador con Web Audio local
(`web/audio-convert.mjs`): sin ffmpeg en el servidor, sin costo,
sin otra dependencia. El proyecto sigue con 1 dependencia
(`qrcode-generator`, solo QR).

## 2. Contratos verificados (docs oficiales leídas hoy)

- Voz: `POST /v1/asr/transcribe`, multipart `request`+`audio`,
  WAV PCM16 mono 16/24 kHz, máx 10 min/32 MB, respuesta
  `{transcript, turns: []}`, errores 400/406/413/429/500 con
  taxonomía `type`/`code` + session id.
- Imagen: `POST /v1/images/generations`, JSON
  `{model, prompt, n: 1, size: "1280x800", response_format:
  "b64_json"}`, respuesta `{created, data: [{b64_json}]}`.
- Detalle completo: `docs/H0a-contratos.md`. Spark sigue SIN
  verificar y SIN transporte: las propuestas de texto siguen con
  reglas locales (doble), decisión explícita de alcance.

## 3. Costos oficiales y topes internos

- Voz: $0.18/hora de audio, segundos enteros hacia abajo, sin
  mínimos. Ejemplo: dictado de 30 s ≈ $0.0015.
- Imagen: $0.01 por imagen devuelta (fallos no se facturan).
- Topes ronda 1 (por sesión y globales, `ROUND1_CAPS`):
  voz 15 llamadas/15 min → **máx $0.045/ventana**;
  imagen 10 llamadas → **máx $0.10/ventana**.
- La reserva se toma ANTES de llamar; rechazo 4xx/429 libera;
  fallo incierto retiene sin reintento automático.

## 4. Qué se implementó (archivos)

- `adapters/meta-contracts.mjs`: fichas transcribe+imagen
  `verified` con endpoint, esquema, precio y topes oficiales.
- `adapters/meta.mjs`: `transcribeClip` (multipart, Bearer,
  `PUSH_TO_TALK`, `languageBias` ES/EN, timeout 180 s) y
  `generateCover` (JSON 8:5, valida magia PNG/JPEG y ≤8 MB);
  errores tipados `MetaApiError`.
- `server/api.mjs`: `POST /api/audio/transcribe` binario
  (valida WAV con `parseWavPcm16`, reserva por minuto,
  concilia segundos reales, auditoría sin transcript ni audio)
  y `POST /api/ai/image` real (prompt desde el borrador,
  guarda en `data/img-ai/`, `image_ai` derivada por servidor).
  JSON/doble anteriores intactos como fallback.
- `server/main.mjs`: sirve `GET /img/ai/<uuid>.<ext>`
  (público, inmutable; traversal imposible por regex).
- `web/audio-convert.mjs` (nuevo): DSP puro probado en Node +
  `recordingToWav` (decode + render 24 kHz mono).
- `web/panel.js` + `web/panel.html`: modo Hablar convierte y
  sube WAV (o doble sin grabación); bloque portada con
  «Generar portada con IA» + vista previa + «Usar esta
  portada»; etiqueta IA en revisión; 18+8 claves ES/EN.
- `web/sw.js`: `porque-v8`.

## 5. Pruebas (ninguna llamada real)

- Suite **96/96** (22 Meta nuevos + 2 portada):
  `audio-convert` (5), `transcribe` (10: 200/429/400/red/
  415/413/tope/idioma/doble/auditoría), `ai-image` (7: 200+
  servido/traversal/404/429/no-PNG/imageAi).
- Navegador ES/EN: botón IA deshabilitado pre-guardado y
  mensaje de doble sin llave; tubería WAV sintética
  (decode→24 kHz→subida→503 honesto); `imageAi=true` y
  etiqueta en revisión; consola sin errores JS.
- NO probado (imposible sin llave): respuesta real de Meta,
  facturación real, micrófono físico, assay de prompt.

## 6. Activación en el servidor del hackathon (Jorge ejecuta)

La llave NUNCA va en código, commits, dist ni navegador.
Pasos en el servidor (`porque-app`, datos `/opt/porque/data`):

1. Respaldar `/opt/porque/data`.
2. Desplegar este código SIN sustituir esa carpeta ni
   regenerar su secreto (procedimiento habitual).
3. Añadir al entorno del contenedor (solo servidor):
   `META_MODEL_API_KEY=<llave>` y `PORQUE_DEMO=1` si los
   jueces entran sin registro. NO `META_CONTRACTS_VERIFIED`
   todavía.
4. Reiniciar y comprobar la versión pública SIN cambios
   visibles (todo sigue en doble).
5. Aprobar presupuesto (ver §3) y activar:
   `META_CONTRACTS_VERIFIED=1` + en BD
   `UPDATE meta SET value = '1' WHERE key = 'ai_enabled';`
   (o el mecanismo de `setAiEnabled`), reiniciar.
6. Ronda real 1 supervisada: grabar 10 s → Transcribir →
   debe devolver texto real; generar 1 portada → debe
   mostrar vista previa; revisar `/api/limits` (uso > 0)
   y auditoría (`audio.transcribed`, `ai.image_generated`).
7. Para apagar: quitar `META_CONTRACTS_VERIFIED` o poner
   `ai_enabled=0` y reiniciar (vuelve a dobles al instante).

## 7. Riesgos y límites honestos

- La primera llamada real puede fallar por llave, red o
  formato: el servidor responde 502/400/429 explicados, sin
  reintento automático ni cobros ocultos (topes internos).
- Solo se factura lo procesado/devuelto; aun así, cada
  prueba real gasta centavos: agrupar la ronda 1.
- Spark (propuestas) NO es real: si un juez pregunta,
  «Transcribir» e «Imagen» son Meta; las propuestas de
  texto son reglas locales.
- Las portadas IA llevan siempre la etiqueta «Imagen
  ilustrativa generada con IA»; el servidor impide
  etiquetar imágenes ajenas.
