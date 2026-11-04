# H0a — Contratos técnicos (lectura, 2026-10-31)

Estado global: **parcial**. Las páginas oficiales se localizaron pero su
cuerpo no fue inspeccionable con lectura automática (solo navegación).
Los datos de terceros son coherentes entre sí pero **no verifican** el
contrato oficial. Ninguna llamada real hasta confirmar + presupuesto
aprobado por Jorge.

## Lectura oficial directa

- Base aportada por el operador: `https://api.meta.ai/v1` (corroborada
  por terceros; pendiente ver en docs el base path por capacidad).
- Páginas oficiales localizadas (estructura del sitio confirmada):
  `overview`, `models`, `authentication`, `quickstart`,
  `pricing-rate-limits`, `speech-to-text`, `image-generation`,
  `structured-output`, `media-segmentation`, `sam/*`,
  `cookbook/muse-voice-transcribe`, `cookbook/muse-image`,
  `cookbook/sam`, `api-reference/*`.
- Cuerpos no inspeccionados: el lector devolvió solo navegación antes
  del truncado. Pendiente: endpoints exactos, parámetros, formatos de
  audio admitidos, esquemas de respuesta y errores, tarifas oficiales.

## Terceros coherentes (SIN confirmar oficialmente)

- Spark Standard (`muse-spark-1.3/1.2/1.1`): $1.25/1M entrada,
  $0.15/1M cacheada, $4.25/1M salida; 3000 RPM y 4M TPM por equipo.
  Contributor: $0.10/$0.002/$0.20 a cambio de entrenar con el contenido
  → **no se activa** (decisión ética y de producto).
- Transcripción (`muse-voice-transcribe-1.0`): $3/1000 min audio
  ($0.003/min); WAV PCM16 mono 16/24 kHz, máx 10 min. El multipart
  `request`+`audio` y el tope de 32 MB aparecen en un solo tercero:
  sin confirmar. Solo convierte voz en texto; no sintetiza.
- Imagen (`muse-image-1.0`): $0.01/imagen. Endpoint en conflicto entre
  terceros (Responses vs `images/generations`): pendiente oficial.

## Pendiente antes de la ronda real 1

1. Inspeccionar cuerpos oficiales (endpoints, formatos, errores).
2. Confirmar tarifas y conceptos facturables (entrada/salida/otros).
3. Confirmar formato de captura real por navegador y conversión.
4. Presupuesto aprobado + `META_CONTRACTS_VERIFIED=1` + habilitación
   explícita (apagado por defecto en `meta.ai_enabled`).
