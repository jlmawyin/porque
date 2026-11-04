# Porque — porque somos panas

PWA de catálogo y comercio adaptativo (demo local, datos ficticios).
Ayuda a emprendedores a gestionar su catálogo hablando, respondiendo
preguntas breves o tocando controles accesibles, según lo que les
resulte más cómodo en cada momento.

- Demo: un vendedor, español, USD, datos ficticios.
- Dominio previsto: `porque.somospanas.com` (decisión de producto;
  esta entrega es solo local, sin publicar ni tocar infraestructura).
- APIs reales del producto: **desactivadas por defecto**. Dobles de
  prueba claramente etiquetados (`FAKE-DOUBLE`).
- Estado: portada, cuentas con propiedad, iniciativas (donaciones /
  negocio / ambas) con página pública `/i/:id`, apoyos como intención
  o simulación (nunca dinero), modalidades A/B/C y URL canónica.
  QR descargable pendiente de instalar dependencia.
  Verificación ejecutada pendiente de shell (ver `docs/RELEVO-SUPERVISION.md`).

## Ejecutar en local

Requiere Node 24+ (usa `node:sqlite`, `node:test`; cero dependencias).

```powershell
node scripts/gen-secret.mjs   # crea .env privado (no versionado)
npm start                      # http://127.0.0.1:4177  (panel: /panel)
npm test                       # suite automatizada
```

El secreto vive en `.env` o `data/.secret` (privados, ignorados por git).
Nunca aparece en código, commits, logs ni navegador.

## Estructura

- `web/` — PWA (portada, Explorar, página de iniciativa, Mi espacio
  con modos A/B/C y apoyos, service worker).
- `server/` — API mismo origen: auth heredado, cuentas, borradores
  (productos e iniciativas), publicación, consultas, apoyos,
  compartir, audio, límites.
- `shared/contracts.mjs` — contratos únicos cliente+servidor (importes,
  validación, hash de confirmación, veredicto de audio).
- `adapters/` — `meta-contracts.mjs` (fichas H0a), `meta.mjs` (vía real
  bloqueada), `fakes.mjs` (dobles etiquetados).
- `tests/` — 8 suites con `node:test` (ver `docs/registro.md`).
- `docs/` — H0a, presupuesto, decisiones, registro, intentos.
- `data/` — SQLite + secreto (persistente y privado; ignorado por git).

## Reglas de integridad (implementadas)

- Precios y totales en el servidor, centavos enteros.
- Guardar ≠ publicar: publicar exige confirmar el contenido exacto
  revisado; cualquier cambio invalida la revisión.
- Idempotencia por `clientOpId`; conflictos: se conservan ambas
  versiones y la persona elige (sin fusión avanzada).
- Límites persistentes antes que APIs: reserva atómica, conciliación,
  sin reintento automático de gasto incierto, apagado por defecto.
- Cuentas con scrypt, bloqueo y propiedad: lo ajeno es 404; lo
  heredado no se atribuye a nadie.
- Sin retención de audio; las pausas no confirman ni publican.
- Apoyos: intención o simulación etiquetada; jamás dinero recibido;
  resumen público solo con conteos.
- Compartir: URL canónica solo con base explícita; QR pendiente.
- Imágenes sintéticas con etiqueta visible
  «Imagen ilustrativa generada con IA»; publicar sin imagen es posible.

Ver `docs/decisiones.md`, `docs/H0a-contratos.md` y
`docs/presupuesto-ronda1.md`.
