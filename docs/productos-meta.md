# Productos de Meta en Porque (2026-11-04)

Solo hechos verificables en el repo, sus pruebas y sus registros.
Sin evidencia no hay atribución.

## Usado para construir el código

- Muse Code (Muse Spark de Meta), modelo `muse-spark-1.3`
  según metadatos de sesión local.
- Evidencia: autoría de los commits `982fc16`, `ed710aa`,
  `91515e0` y recorridos citados en `docs/registro.md`.

## Previstos para el producto, no ejecutados

Base aportada por el operador: `https://api.meta.ai/v1`.
Estado H0a: parcial, contratos `unverified`, vía real bloqueada
(`adapters/meta.mjs` lanza `RealAiDisabledError`; exige
`META_CONTRACTS_VERIFIED=1` + IA habilitada + `META_MODEL_API_KEY`,
ninguno activo en esta entrega).

- Spark Standard (`muse-spark-1.3/1.2/1.1`): ficha en
  `adapters/meta-contracts.mjs` (`spark`, `unverified`).
  Sin endpoint confirmado. Ver `docs/H0a-contratos.md`.
- Transcripción (`muse-voice-transcribe-1.0`): ficha
  `transcribe`, `unverified`. Sin endpoint confirmado.
- Imagen (`muse-image-1.0`): ficha `image`, `unverified`.
  Endpoint en conflicto entre terceros, pendiente oficial.
- Otros solo localizados como páginas (cuerpos sin
  inspeccionar): `structured-output`, `media-segmentation`,
  `sam/*`, `cookbook/sam`. Sin ficha ni integración.

## Explícitamente no usados

- Modo Contributor de Spark: no se activa (decisión ética
  y de producto, ver `docs/H0a-contratos.md`).
- Transporte real (`realRequest`): lanza siempre en esta
  entrega; cero llamadas facturables ejecutadas.
- Ronda real 1: propuesta de $0.50 pendiente de aprobación
  (ver `docs/presupuesto-ronda1.md`).

## Qué se usó en su lugar

- Dobles locales etiquetados `FAKE-DOUBLE`
  (`adapters/fakes.mjs`): transcripción, propuestas, imagen.
- `speechSynthesis` del navegador: capacidad de plataforma,
  no producto Meta.
