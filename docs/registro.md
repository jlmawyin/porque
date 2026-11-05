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

## Fase 2 textos con identidad (2026-11-04, encargo unificado)

- Pretendido: aplicar referencias de voz "porque somos panas" sin
  rediseño ni cambio de distribución; botones con acciones claras.
- Terminado: portada ya traía hero/sub (conservados); registro con
  "Crea tu espacio y comparte lo que haces." + sub con panas;
  negocios con "Detrás de cada producto…"; compartir con "Corre la
  voz…"; confirmación de apoyo con "Gracias por estar ahí…"
  manteniendo etiqueta intención/simulación + nota honesta.
  Limpieza: prefijo QR duplicado y "1 intenciones" pluralizado.
  Sin historias, testimonios ni impacto inventados.
- Archivos: `web/index.html`, `web/panel.html`,
  `web/initiative.html` (solo textos).
- Comandos: sin suite (textos de cliente; verificación visual en
  recorrido final ES/EN).
- Versión comprobada: sobre checkpoint ed710aa (verificación en
  bloque final, mismo turno).
- Pendiente: Fase 3 + verificación final (hecho debajo).

## Fase 3 ES/EN + verificación final (2026-11-04, encargo unificado)

- Pretendido: versión final bilingüe con selector visible y
  accesible, diccionarios locales, cambio en vivo sin perder
  campos/sesión ni publicar; recorrido ES+EN en 390px y escritorio.
- Terminado: `web/i18n.mjs` nuevo (resolveLang + t + applyStatic +
  initI18n, ~200 claves ES/EN con paridad probada); selector
  Español | English en las 3 páginas (sin banderas, con estilo de
  navegación); prioridad ?lang→guardada→navegador→es; elección
  explícita recordada + ?lang compartible sin recarga; Why Porque?
  solo en EN; USD sin conversión; contenidos de usuarios sin
  traducir; limitaciones reales en cada idioma (notas offline,
  espejo, QR, palabra-número ES en precio documentada por dígitos
  en EN); SW porque-v3 con i18n.mjs en shell.
- Archivos: `web/i18n.mjs` (nuevo), `tests/i18n.test.mjs` (nuevo,
  registrado en `npm test`), `web/index.html`, `web/panel.html`,
  `web/panel.js`, `web/initiative.html`, `web/styles.css`,
  `web/sw.js`, `package.json`, `docs/*`.
- Comandos y resultados: `node --check` panel/i18n/sw + scripts en
  línea OK; `npm test` 63/63 fail 0 (12 archivos); playwright EN:
  portada (?lang, selector, Why, lang, guardada), registro, cambio
  ES↔EN a mitad de formulario (campos+sesión+suciedad intactos),
  guardar→revisar→publicar v1, pública con QR+descarga, intención
  201 con resumen singular; regresión ES (portada, pública,
  singular); 390px EN (portada, pública); consola `/`+`/i/` 0
  errores, `/panel` 0 errores; SW caché única porque-v3; reinicio
  sin base: persistencia F1+EN, nota local EN y motivo QR EN;
  QR re-decodificado exacto sobre código final.
- Versión comprobada: código final F3 (este commit).
- Evidencia: `.playwright-cli/f3-portada-en-desktop.png`,
  `f3-why-porque-en.png`, `f3-portada-en-390.png`,
  `f3-panel-en-desktop.png`, `f3-publica-en-desktop.png`,
  `f3-publica-en-390.png`, `f3-portada-es-desktop.png`,
  `f3-publica-es-desktop.png` (+ serie f1-* del cierre funcional).
- Notas: mensajes transitorios a mitad de pantalla conservan su
  idioma hasta la próxima acción (estándar); detalles de error del
  servidor se muestran tal cual con marco en idioma local;
  manifiesto conserva lang nominal "es" (estático). Contadores de
  intentos sin cambios (todo resuelto, 0 fallos nuevos).
- Pendiente: commit de cierre + push normal + informe (este turno).

## Corrección documental (2026-11-04, encargo de Jorge)

- Pretendido: corregir documentación antes de continuar; solo docs,
  sin tocar código ni reescribir historial.
- Terminado: encabezado del relevo cambiado a "Porque — estado y
  seguimiento con Jorge"; `docs/productos-ia.md` reescrito solo con
  hechos verificables (herramienta, capacidades, integraciones
  ejecutadas/pendientes; fuera atribuciones deducidas e
  inventarios especulativos); README, decisiones D1 y relevo
  actualizados a la evidencia (QR disponible, 1 dependencia, 12
  archivos/63 pruebas, ES/EN, repo público, sin despliegue);
  nuevo `docs/RELEVO-SESION.md` breve para sesión nueva.
- Archivos: `docs/RELEVO-SUPERVISION.md`, `docs/productos-ia.md`,
  `docs/RELEVO-SESION.md` (nuevo), `README.md`,
  `docs/decisiones.md`, `docs/registro.md`.
- Comandos: revisión de diff + commit documental + push normal.
- Pendiente: lo que Jorge encargue.
