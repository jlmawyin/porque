# Registro — primera entrega local

## Avances (2026-10-31)

- H0a parcial: 16 lecturas oficiales/búsquedas; páginas localizadas,
  cuerpos sin inspeccionar; terceros coherentes registrados como NO
  verificados. Fichas en `adapters/meta-contracts.mjs`.
- H0b mínimo: auth (scrypt, sesiones httpOnly, CSRF, bloqueo 5/10min),
  límites persistentes con reserva atómica y apagado por defecto.
- H1 con dobles: intake de audio con veredicto, transcripción y
  propuestas etiquetadas `FAKE-DOUBLE`, modos A/B/C en panel.
- H2: borrador CRUD + revisiones, idempotencia, 409 con ambas
  versiones, revisión→publicación con confirmación exacta, catálogo
  público, consultas (preparada/abierta, sin estados de envío).
- Correcciones por revisión sin shell: carga resiliente de
  `node:sqlite`, transacciones explícitas, `server` en ayudante de
  tests, extracción de nombre del doble, detección robusta de main.

## Pruebas

- Escritas 8 suites (`tests/`): auth, money, drafts, publish, limits,
  late (tardías/inválidas/inyección), restart, audio.
- Estado: **NO ejecutadas** — ejecución por shell bloqueada este turno
  (ver Intentos). Ningún criterio se declara superado sin evidencia.

## Intentos (contador persistente en `docs/intentos.json`)

- shell-exec: 2/3. (1) sandbox por defecto: fallo de infraestructura
  ajeno al proyecto. (2) vía elevada: aprobación abortada. No se
  reintenta en bucle; pendiente de Jorge.

## Revisión estática (continuación, sin shell)

- Trazado completo de `server/api.mjs` y `shared/contracts.mjs`.
- Correcciones: (1) `validateDraftPatch` devuelve `{errors}` también
  con parche ausente; (2) publicar exige borrador completo (422 +
  campos faltantes) además de confirmación exacta.
- Archivos verificados por lectura directa: existen. Nota: la búsqueda
  indexada no ve parte del árbol (rareza OneDrive/índice); la lectura
  directa es la fuente fiable hasta poder listar por shell.

## Desbloqueo y recorrido (2026-11-01)

- Etapa 1: ejecución por vía oficial; `node --version` v24.15.0;
  `tests/money.test.mjs` 4/4.
- Etapa 2: 3 correcciones (action review/publish, `.get(since)`,
  cierre idempotente + finally garantizado). Enfocadas 14/14.
- Etapa 3: sonda RECORRIDO OK (Galletas, 500, Ficticias de prueba);
  catálogo y panel verificados en navegador real; favicon añadido.
- Suite completa `npm test`: 28/28 en ~2 s (lista explícita por
  fallo de `node --test <dir>` en este entorno).
- Limpieza: sonda y `.playwright-cli/` eliminados. Quedan `data/`
  (demo local) y `.env` (privados, ignorados).

## Bloqueos

- B1 Ejecución de shell (tests, arranque, commits): bloquea verificar
  la entrega y crear commits locales. No bloquea seguir escribiendo
  código/docs. Tras 3 turnos consecutivos sin shell, el objetivo pasa a
  BLOQUEADO pendiente de Jorge: aprobar ejecución de shell (o reparar
  el sandbox) para `npm test`, arranque y commits locales.
- B2 Teléfono exacto: bloquea solo validación en dispositivo.
- B3 Presupuesto aprobado: bloquea solo llamadas reales.
- B4 Bases del evento: bloquean solo decisiones de entrega.
- B5 Datos operativos del servidor: bloquean solo despliegue.

## Cierre funcional Fase 1 (2026-11-04, encargo unificado)

- Pretendido: 4 correcciones mínimas + recorrido por clics
  escritorio+390px con capturas, QR descarga+decode, reinicio, SW,
  consola; checkpoint local antes de idiomas.
- Terminado: 4/4 correcciones aplicadas y verificadas en UI/API;
  recorrido ES completo (portada → registro → crear iniciativa →
  guardar → revisar → publicar → pública → compartir/QR → intención
  de apoyo); reinicio con persistencia; SW único porque-v2; QR
  decodificado igual a URL esperada.
- Archivos: `web/panel.js` (revisar exige guardar; save conserva
  campos; espejo documentado), `web/panel.html` (aviso offline
  preciso), `web/initiative.html` (nota configurada-no-despliegue),
  `shared/contracts.mjs` (base localhost/loopback/privada nunca
  pública), `tests/initiatives.test.mjs` (+1 prueba), `docs/*`.
- Comandos y resultados: `node --check` panel.js+contracts OK;
  `tests/initiatives.test.mjs` 10/10; `npm test` 59/59 fail 0
  (~4 s, 11 archivos); playwright: registro, guardar, revisar
  bloqueado con mensaje, publicar v1, apoyo 201 con resumen 1/0;
  share con base loopback → url null + QR no disponible; QR
  `https://porque.somospanas.com/i/62501b6a-…` decodificado exacto.
  Consola: `/` y `/i/:id` 0 errores; `/panel` 2 404 gestionados
  (sondeo de apoyos sobre lista pública, no bloqueantes), sin
  excepciones JS. Espejo: initiative rev4 (última guardada).
- Versión comprobada: código con correcciones F1 sobre 982fc16
  (pendiente de checkpoint local en este commit).
- Evidencia: `.playwright-cli/f1-portada-desktop.png`,
  `f1-panel-editor-desktop.png`, `f1-panel-revision-desktop.png`,
  `f1-publica-desktop.png`, `f1-publica-qr-desktop.png`,
  `f1-portada-390.png`, `f1-publica-390.png`,
  `f1-qr-descargado.gif` (decodificado OK).
- Observado fuera de alcance (no tocado): botones de modalidad
  guardan solo modalidad y re-renderizan (pueden vaciar nombre sin
  guardar si se pulsan entre ediciones); prefijo QR duplicado en
  nota ("QR no disponible: QR no disponible:…", a limpiar en
  Fase 2); "1 intenciones" sin pluralizar (Fase 2); 404 de apoyos
  ajenos en consola (diseño previo: lista pública sin filtro).
- Pendiente: checkpoint local → Fase 2 textos → Fase 3 ES/EN →
  verificación final + push.
