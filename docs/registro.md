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

## Mejoras demo + formulario (2026-11-05, encargo de Jorge)

- Pretendido: (1) botones DEMO sin registro para jueces, (2) botón
  Reset, (3) simplificar el llenado de datos, (4) organizar los
  botones de iniciativas. Sin tocar cuentas/datos reales.
- Terminado: `POST /api/demo/start` (solo con PORQUE_DEMO=1; sin
  ella responde 404), identidad demo desechable por clic
  (`demo-*@porque.demo`, sin contraseña conocida), `me.demo`,
  tope 60 demos/hora; botón demo en portada y panel; banner demo +
  «Reiniciar demo» (cambia a identidad limpia, conserva lo anterior);
  formulario numerado 1-5/1-4 (solo cuenta lo visible), ayudas
  breves, modalidad con descripciones antes que portada, modos
  Hablar/Paso a paso en desplegable «Otras formas de completar»,
  propósito/meta ocultos en productos y Negocio (sin borrar datos);
  estilo `.secundario` (antes existía la clase sin regla) aplicado
  a Volver/Cancelar/Abrir/Retomar/Copiar/Recuperar/demo; paso 1
  dice «Tu producto» en productos; chip de estado se re-renderiza
  al cambiar idioma; SW `porque-v6`; README documenta PORQUE_DEMO;
  18 claves i18n ES/EN nuevas con paridad.
- Verificado: suite 72/72 (5 tests demo nuevos: 404 desactivada,
  201+sesión, identidades distintas, me.demo false en normal,
  429 al tope); navegador ES+EN: demo desactivada muestra aviso
  honesto, entrada demo llega a bienvenida con banner, crear→
  guardar→revisar→publicar v1, reset vuelve a 0 borradores con
  identidad nueva (BD: 2 demos, 1 borrador+1 publicado intactos),
  Negocio oculta pg y conserva propósito al volver, Paso a paso
  funciona desde el desplegable, producto 1-4 sin pg, chip Draft/
  Borrador al alternar idioma; consola sin errores; SW único v6.
- Archivos: `server/accounts.mjs`, `server/api.mjs`,
  `tests/demo.test.mjs` (nuevo), `package.json`, `web/panel.html`,
  `web/panel.js`, `web/index.html`, `web/i18n.mjs`,
  `web/styles.css`, `web/sw.js`, `README.md`, `docs/registro.md`.
- Evidencia: `output/playwright/demo-form-es.png`,
  `output/playwright/demo-form-producto.png`.
- Pendiente: commit + push si Jorge lo pide (no pedidos este
  turno); activar PORQUE_DEMO=1 donde se necesite la demo.

## Voz e imagen reales Meta (2026-11-05, encargo de Jorge)

- Pretendido: arreglar el audio con `muse-voice-transcribe-1.0`,
  usar hasta `muse-image-1.0` para el hackathon, informes, y
  decir si se necesita otra API.
- Terminado: contratos transcribe+imagen VERIFICADOS en docs
  oficiales (endpoints, esquemas, errores, precios, topes);
  transporte real con gates (ficha+env+IA+llave+reserva);
  `POST /api/audio/transcribe` binario con validación WAV y
  conciliación por segundos; conversión opus→WAV en navegador
  sin otra API; `POST /api/ai/image` real con portadas 8:5 en
  `data/img-ai/` + `image_ai` derivada por servidor; UI Hablar
  y «Generar portada con IA» ES/EN; SW `porque-v8`; spark
  queda doble (contrato sin verificar, decisión de alcance).
- Verificado: suite 96/96 (22 Meta + resto); navegador ES:
  botón IA pre/post guardado, mensaje de doble sin llave,
  tubería WAV sintética (24 kHz→503 honesto), imageAi=true y
  etiqueta en revisión; consola sin errores JS. CERO llamadas
  reales (sin llave): ronda real 1 pendiente en servidor.
- Respuesta: NO se necesita otra API (solo Meta Model API).
- Archivos: `adapters/meta.mjs`, `adapters/meta-contracts.mjs`,
  `server/api.mjs`, `server/main.mjs`, `shared/contracts.mjs`,
  `web/audio-convert.mjs` (nuevo), `web/panel.html`,
  `web/panel.js`, `web/i18n.mjs`, `web/sw.js`,
  `tests/audio-convert.test.mjs`, `tests/transcribe.test.mjs`,
  `tests/ai-image.test.mjs` (nuevos), `tests/helper.mjs`,
  `tests/audio.test.mjs` (título), `package.json`,
  `docs/H0a-contratos.md`, `docs/informe-meta-2026-11-05.md`
  (nuevo), `README.md`, `docs/registro.md`.
- Pendiente: llave en servidor + presupuesto + activación +
  ronda real 1 (procedimiento en el informe); commit/push/dist
  si Jorge lo pide.

## Caja demo evento ficticio (2026-11-05, encargo de Jorge)

- Pretendido: recuadro visible al entrar con opciones demo para
  participar en un evento ficticio de recaudación y donar.
- Terminado: sección `#demo-evento` en portada tras el hero:
  «Cena solidaria de Panas (ficticia)» con insignia
  DEMOSTRACIÓN, portada, meta de ejemplo $500, barra de
  progreso, Donar (simulación: $1/$5/$10 + monto, máx
  $10.000) y Apoyar (demo: nombre+mensaje, lista), Crear tu
  propio evento (demo sin registro), nota de simulación y
  Reiniciar. Todo local (localStorage): sin API, sin
  registros, sin dinero. 24 claves ES/EN; test portada nuevo.
- Verificado: navegador ES+EN: donar $5 ($120→$125 + gracias),
  apoyo con nombre+mensaje en lista, reset ($120, 0 apoyos),
  EN completo; captura `output/playwright/demo-evento-en.png`;
  suite 96/96. Defecto encontrado y corregido: `renderDemo()`
  antes de `getLang` (TDZ) → movido tras init.
- Decisión: simulación local en vez de evento sembrado en BD
  para no mezclar datos ficticios con publicaciones reales;
  el flujo real con registros queda a un clic (demo).
- Archivos: `web/index.html`, `web/i18n.mjs`, `web/styles.css`,
  `web/sw.js`, `tests/homepage.test.mjs` (nuevo),
  `package.json`, `README.md`, `docs/registro.md`.
- Pendiente: commit/push/dist si Jorge lo pide.
