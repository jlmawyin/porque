# Productos de IA en Porque (2026-11-04)

Resumen limitado a hechos verificables en el repo, sus pruebas y sus
registros de ejecución. Sin evidencia no hay atribución.

## Herramienta utilizada para construir el código

- Muse Code (Muse Spark de Meta), modelo `muse-spark-1.3`
  según metadatos de sesión local. Evidencia: autoría de los
  commits `982fc16`, `ed710aa`, `91515e0` y registros de ejecución
  citados en `docs/registro.md`.

## Capacidades implementadas

Verificables en el código y la suite (`npm test`, 63/63):

- Catálogo público, borradores, revisión con confirmación exacta,
  publicación, consultas, cuentas con propiedad, iniciativas
  (donaciones/negocio/ambas), página pública `/i/:id`, apoyos como
  intención/simulación, modalidades A/B/C, QR, interfaz ES/EN,
  service worker offline, SQLite+WAL.

## Integraciones realmente ejecutadas

- `qrcode-generator` (dependencia local MIT): generación de QR
  verificada con descarga y decodificación contra la URL esperada.
- `node:sqlite`, registro npm (instalación), GitHub (push),
  Playwright con navegador real (verificación).
- Ninguna integración con APIs reales de IA fue ejecutada: la
  transcripción, las propuestas y la imagen usan dobles locales
  etiquetados `FAKE-DOUBLE`. La única voz es `speechSynthesis`
  del navegador (capacidad de plataforma).

## Integraciones pendientes

- APIs de Meta (Spark, transcripción de voz, imagen): pendientes
  de confirmación oficial de contratos (H0a) y de aprobación de
  presupuesto. Ver `docs/H0a-contratos.md` y
  `docs/presupuesto-ronda1.md`.
- Despliegue en servidor y dominio `porque.somospanas.com`:
  no ejecutado.
