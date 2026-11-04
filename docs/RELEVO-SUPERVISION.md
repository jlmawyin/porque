# RELEVO — Supervisión de Porque (para Claude + Jorge)

## Supervisión general — estado 2026-11-04 y plan del turno

- Partida: HEAD 982fc16 local y GitHub; solo este relevo con cambios
  locales (conservados, no reescritos). panel.js sintaxis válida, sin
  NUL, sin faltanDe duplicado; qrcode-generator declarado.
- Verificado con ejecución (2026-11-04, sobre 982fc16 limpio): npm test
  pass 58 fail 0 (11 archivos de prueba). Es validación API de ese
  commit, NO del recorrido por interfaz (incompleto) ni del código que
  cambie este turno.
- Implementado: Fases 1–7 + UX Etapas 1–2 (portada, cuentas,
  iniciativas, apoyos, modalidades, QR, diseño).
- Encargo unificado en curso: Fase 1 cierre funcional → checkpoint
  local → Fase 2 textos con identidad → Fase 3 ES/EN → verificación
  final → commit+push. Sin funciones nuevas, sin cambio de stack, sin
  llamadas facturables, sin despliegue.
- Plan de este turno: (1) Fase 1: 4 correcciones mínimas (revisar exige
  guardar con campos sucios; save fallido conserva campos incl. precio;
  base localhost/loopback/privada nunca pública ni QR accesible;
  espejo offline documentado como última versión guardada);
  (2) recorrido por clics escritorio+390px con capturas, QR
  descarga+decode, reinicio, SW, consola; (3) checkpoint local;
  (4) Fase 2 textos; (5) Fase 3 ES/EN; (6) verificación final ES/EN +
  npm test sobre código final; (7) informes + commit + push normal.
  Archivos previstos: web/panel.js, web/panel.html,
  web/initiative.html, shared/contracts.mjs,
  tests/initiatives.test.mjs, web/* (Fases 2–3), docs/*.
  Cierre: recorrido UI completo ES/EN evidenciado + suite verde sobre
  código final + push normal al repo autorizado.
- Contadores (docs/intentos.json, sin reinicio): shell-exec 2/3
  resuelto; test-runner-dir 2/3 resuelto; shell-blocked-ux 1/3 abierto,
  pendiente de actualizar con evidencia de este turno.
- Bloqueos: ninguno activo. Turno anterior: veto de escritura OneDrive
  (timeouts) + apagado de PC a mitad del encargo unificado; estado
  actual comprobado por lectura antes de repetir operaciones.
- Fase 1 cerrada y verificada este turno (detalle en docs/registro.md):
  4/4 correcciones, recorrido ES completo con capturas, QR decode OK,
  reinicio con persistencia, suite 59/59 sobre código corregido.
- Próximo paso: checkpoint local y Fase 2 (textos con identidad).

## Propósito y alcance actual

Convertir la base local verificada (borrador → revisión → publicación →
catálogo, 28/28) en una experiencia comprensible: portada, cuentas,
iniciativas (donaciones y/o negocio), página pública, QR, apoyos y
accesibilidad. Autorizado: trabajo local en PROJECT_ROOT, dependencias
del proyecto, migraciones no destructivas y commits locales sin
secretos. NO autorizado: pagos reales, llamadas facturables sin
presupuesto aprobado, despliegue ni cambios de infraestructura.
Push al repo reservado autorizado expresamente por Jorge
(commit 982fc16 en main local y GitHub, 2026-11-04).

## Qué existía y qué se conserva

- Recorrido vendedor único con secreto (`/panel`), catálogo (`/`),
  API JSON mismo origen, SQLite+WAL en `data/`, contratos únicos en
  `shared/contracts.mjs`, dobles `FAKE-DOUBLE`, vía real bloqueada.
- Controles: precios en centavos en servidor, guardar≠publicar,
  revisión→confirmación exacta, idempotencia, 409 con ambas versiones,
  límites con reserva atómica, sin retención de audio.
- Se conserva todo y se extiende por cambios pequeños. Los datos
  existentes migran sin atribuirse al primer usuario que se registre.

## Qué se implementó realmente (histórico por fases)

> Histórico acumulado. Estado vigente arriba. "Pendiente de
> verificación" aquí = pendiente de recorrido UI/navegador salvo
> que se indique suite verde con fecha.

- Fase 1 implementada pendiente de verificación: portada (hero
  exacto, CTAs, cabecera, Explorar/Cómo funciona/Crear/F pie),
  catálogo y consultas conservados, estilos móvil-primero.
  Archivos: `web/index.html`, `web/styles.css` (revisados).
- Fase 2 implementada pendiente de verificación: cuentas
  (registro/login/logout/me, scrypt, bloqueo 5/10min, tope 30/h),
  propiedad con 404 e idempotencia por propietario, migración 2,
  `tests/accounts.test.mjs` añadido al runner.
- Fase 3 implementada pendiente de verificación: kind/modality/
  purpose/goalCents (contratos+migración 3), endpoints públicos
  /api/initiatives(+/:id con ownerName y products[]), página /i/:id,
  flujo iniciativa en panel, sección Iniciativas en Explorar.
  Alineación coordinador: detalle {initiative,products} hermanos.
- Agentes Fase 3 terminados: `fase3-ui-iniciativa` (5 archivos web),
  `fase3-server-iniciativa` (api.mjs + tests/initiatives.test.mjs).
- Fase 4 preparada pendiente de verificación (coordinador, sin
  agentes): `publicInitiativeUrl` (solo base explícita válida),
  `PUBLIC_BASE_URL`, `GET /api/share/initiative/:id` (localPath,
  url|null, isPublic, qr.available=false honesto), bloque compartir
  en /i/:id con nota local-vs-pública, 2 pruebas nuevas. QR
  descargable + decodificación pendientes de shell (npm install).
- Fase 5 implementada pendiente de verificación: apoyos
  (contratos+migración 5) con POST intención/simulación (201 +
  etiquetas honestas, auditoría sin datos personales), summary
  público con conteos + nota, lista de propietario con 404 ajeno;
  UI en /i/:id (dos formularios con confirmación explícita) y
  sección Apoyos en panel. Agentes `fase5-server-apoyos` y
  `fase5-ui-apoyos` terminados; suite añadida al runner.
- Etapa 1 UX terminada pendiente de verificación (ejecutor
  `ux-etapa1-fixes-qr`): 6/6 correcciones (modos #product-modes,
  nombre iniciativa persistente, confirmación publicar integrada,
  products filtra kind, URLs absolutas/relativas, SW v2
  network-first sin tocar datos) + QR preparado con
  `qrcode-generator` (MIT, dinámica, fallback honesto).
- Etapa 2 UX terminada pendiente de verificación (ejecutor
  `ux-etapa2-diseno`): sistema visual aplicado, portada 2 col con
  SVG original, Explorar dividido, registro con errores por campo,
  Mi espacio 1-4 con pasos, modos renombrados, pública con lateral.
  Corrección de integración: `faltanDe` no estaba definido (lo
  añadí; habría roto el panel). Shell sigue bloqueado.
- Etapa 3 UX pendiente de shell: `npm i qrcode-generator`, tests,
  recorrido navegador 390px+escritorio, capturas, commits.
- Pausa 2026-11-01: shell verificado caído en ambas vías (errores
  exactos en docs/intentos.json → shell-blocked-ux). Nada declarado
  completo sin evidencia. Reanudar con: npm install, npm test,
  playwright (portada, registro, espacio, /i/:id, QR, 390px),
  git init + commits sin secretos, cierre de relevo.
- Fase 6 implementada pendiente de verificación: modo B por kind
  (iniciativa: nombre/modalidad/descripción/propósito opcional, con
  mapeo donaciones/negocio/ambas y repetición guiada), modo A filtra
  a nombre/descripción en iniciativas con nota de modalidad por
  botones, micrófono con fallback manual explícito. Doble propone
  descripción con palabras del usuario en iniciativas.
  Interpretación registrada: voz en B edita borrador; publicar exige
  revisión+confirmación explícitas. Integración real: sin aprobación
  verificable de presupuesto → no ejecutada, pendiente.
- Fase 7 en curso: UI mínima de cuentas implementada en panel
  (pestañas Entrar/Crear cuenta, secreto heredado en details,
  logout por tipo de sesión, arranque recupera csrf+tipo).
  Pendiente de verificación: recorrido UI completo, regresión,
  QR por npm, commits. Todo bloqueado por shell.
- Entrega UX/UI (nuevo encargo): Etapa 1 en curso con ejecutor
  `ux-etapa1-fixes-qr` (6 correcciones + QR preparado). Shell hoy:
  sandbox roto persistente + prompts desactivados (mismo error
  exacto). Presupuesto: $0.50 = ronda API, total proyecto >$50
  (ver docs/presupuesto-ronda1.md); esta entrega no consume APIs.
- Fase 7 revisión estática: `tests/accounts.test.mjs` releído
  (registro, bloqueo, aislamiento, herencia, logout: coherente);
  README actualizado al alcance real con estado honesto.
- Sin commits nuevos aún (repo sin inicializar, sin shell).
- Shell hoy: persiste el bloqueo (prompts desactivados + sandbox
  roto); registrado, sin reintentos en bucle.

## Agentes y responsabilidades

- Coordinador (Muse): contratos compartidos, integración,
  verificación, commits, relevo. Archivos: `shared/`, `docs/`,
  raíz del proyecto.
- `fase1-ui-portada` (ejecutor interfaz): solo `web/`. Sin git,
  sin API, sin tests. Estado: terminado (2 archivos, 0 pendientes
  de API, sin verificación por shell bloqueado también para él).
- `fase2-server-cuentas` (ejecutor servidor): `server/accounts.mjs`
  (nuevo), rutas y propiedad en `server/api.mjs`,
  `tests/accounts.test.mjs`. Sin esquema ni contratos (coordinador).
  Estado: terminado y revisado (register/login/logout/me, bloqueo
  por cuenta, tope 30/h, propiedad con 404, idempotencia por
  propietario; sin verificación por shell).
- Contratos Fase 2 (coordinador): ACCOUNT, validateAccountRegister,
  ACCOUNT_EXISTS. Migración 2 no destructiva aplicada en abrir BD.
- Máximo 2 ejecutores simultáneos. Prohibido otros proveedores.

## Archivos relevantes

- Arranque: `package.json` (`npm start`, `npm test`), `server/main.mjs`.
- API: `server/api.mjs`; auth: `server/auth.mjs`; límites:
  `server/limits.mjs`; BD: `server/db.mjs`.
- Contratos: `shared/contracts.mjs`. Dobles: `adapters/fakes.mjs`.
- Web: `web/index.html`, `web/panel.html`, `web/panel.js`,
  `web/styles.css`, `web/sw.js`.
- Pruebas: `tests/*.test.mjs` (11 archivos de prueba, 58 pruebas). Docs: `docs/registro.md`,
  `docs/intentos.json`, `docs/H0a-contratos.md`,
  `docs/presupuesto-ronda1.md`, `docs/decisiones.md`.
- Privados (no versionar): `.env`, `data/`.

## Decisiones y supuestos

- Stack: Node 24, 1 dependencia (qrcode-generator MIT, solo QR),
  SQLite, vainilla. Histórico "cero dependencias" válido hasta 2026-11-01.
- Fase 2 (previsto): tabla `users` (nombre público, correo único,
  hash scrypt), sesiones con `user_id`; `sellers` heredado solo para
  datos existentes con propietario NULL (no tocables por cuentas
  nuevas); aislamiento verificado con dos cuentas.
- Supuesto: un idioma (es), USD, una iniciativa por cuenta (mínimo).
- Supuesto: QR = solo URL pública de `PUBLIC_BASE_URL` explícita;
  `127.0.0.1` nunca se presenta como pública.
- Supuesto: donaciones = intención/simulación etiquetada, jamás
  “dinero recibido”; consultas ≠ pedidos pagados.

## Fase actual e intentos consumidos

- Fase 1 (base y presentación), intento 1/3.
- `shell-exec`: 2 acumulados previos (resuelto entonces); hoy nueva
  denegación (prompts desactivados) + sandbox roto persistente.
  Contador compartido: NO reintentar en bucle.
- `test-runner-dir`: resuelto (lista explícita en `npm test`).

## Comandos y resultados de verificación

- `npm test` (estado previo verificado): 28/28, ~2 s.
- Hoy: `npm test` no ejecutable (bloqueo shell, ver Bloqueos).
- Recorrido previo: RECORRIDO OK por API + catálogo/panel en
  navegador real (Galletas, $5.00 USD).

## Verificación por tipo

- UI: catálogo y panel renderizados en navegador real (entrega
  anterior). Interacción panel con clics: pendiente.
- API: recorrido completo + 28 pruebas (entrega anterior).
- Dobles: etiquetados, sin valor de integración real.
- Integración real: ninguna ejecutada; H0a parcial, presupuesto
  $0.50 propuesto pendiente de aprobación.

## Cómo arrancar y recorrer la demo

```powershell
cd C:\Users\Jorge\OneDrive\hackathon\porque
npm start
# abrir http://127.0.0.1:4177 y /panel (secreto en .env local)
npm test
```

## Bloqueos, pendientes y próximo paso

- Shell: incidente 2026-10-31–11-01 RESUELTO (vía normal
  operativa desde 2026-11-04; evidencia: sonda + 58/58 + QR
  roundtrip ejecutados). Sin cambios de ACL ni elusiones.
- Pendientes no bloqueantes: Android físico, ronda real 1
  (presupuesto), bases del evento, datos Contabo, despliegue.
- Próximo paso: correcciones mínimas y verificación de este turno
  (ver Estado 2026-11-04).

## Preparación de repositorio y despliegue

- Repo reservado: https://github.com/jlmawyin/porque (sin remote
  configurado, sin push). Dominio previsto: porque.somospanas.com
  (decisión de producto; Cloudflare→Contabo según Jorge, HTTPS y
  funcionamiento por verificar en su etapa). Preparación ≠ publicación.
