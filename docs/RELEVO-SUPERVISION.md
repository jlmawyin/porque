# Porque — estado y seguimiento con Jorge

## Estado 2026-11-04 (encargo unificado cerrado y entregado)

- HEAD: `91515e0` local y en GitHub, repo público desde 2026-11-04
  por decisión de Jorge. Árbol limpio tras el push.
- Implementado y verificado: portada, cuentas, iniciativas, apoyos,
  modalidades, QR, diseño UX, 4 correcciones funcionales, textos con
  identidad y versión ES/EN (detalle en `docs/registro.md`).
- Verificado con ejecución sobre el código final: `npm test` 63/63
  fail 0 (12 archivos de prueba); recorrido UI completo ES+EN por
  clics en escritorio y 390px con capturas; QR descargado y
  decodificado exacto; reinicio con persistencia; SW único porque-v3;
  consola sin errores bloqueantes. Emulación 390px, no Android físico.
- Contadores (`docs/intentos.json`, conservados): shell-exec 2/3
  resuelto; test-runner-dir 2/3 resuelto; shell-blocked-ux 1/3
  resuelto. Cero fallos nuevos.
- Bloqueos: ninguno activo.
- Pendientes: defecto conocido de botones de modalidad (vacían
  campos sin guardar; documentado, sin corregir); validación en
  Android físico; ronda real 1 (presupuesto); bases del evento;
  datos Contabo; despliegue en porque.somospanas.com.
- Próximo paso: lo que Jorge encargue (candidatos: defecto de
  modalidad, despliegue, ronda real 1).

## Propósito y alcance actual

Convertir la base local verificada (borrador → revisión → publicación →
catálogo, 28/28) en una experiencia comprensible: portada, cuentas,
iniciativas (donaciones y/o negocio), página pública, QR, apoyos y
accesibilidad. Autorizado: trabajo local en PROJECT_ROOT, dependencias
del proyecto, migraciones no destructivas y commits locales sin
secretos. NO autorizado: pagos reales, llamadas facturables sin
presupuesto aprobado, despliegue ni cambios de infraestructura.
Push y visibilidad pública autorizados expresamente por Jorge
(main en GitHub al día con `91515e0`, repo público desde 2026-11-04).

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
- Web: `web/index.html`, `web/initiative.html`, `web/panel.html`,
  `web/panel.js`, `web/i18n.mjs`, `web/styles.css`, `web/sw.js`.
- Pruebas: `tests/*.test.mjs` (12 archivos de prueba, 63 pruebas). Docs: `docs/registro.md`,
  `docs/intentos.json`, `docs/H0a-contratos.md`,
  `docs/presupuesto-ronda1.md`, `docs/decisiones.md`,
  `docs/productos-ia.md`, `docs/RELEVO-SESION.md`.
- Privados (no versionar): `.env`, `data/`.

## Decisiones y supuestos

- Stack: Node 24, 1 dependencia (qrcode-generator MIT, solo QR),
  SQLite, vainilla. Histórico "cero dependencias" válido hasta 2026-11-01.
- Fase 2 (previsto): tabla `users` (nombre público, correo único,
  hash scrypt), sesiones con `user_id`; `sellers` heredado solo para
  datos existentes con propietario NULL (no tocables por cuentas
  nuevas); aislamiento verificado con dos cuentas.
- Idiomas: español e inglés con selector en vivo (el supuesto
  histórico "solo es" quedó sustituido en Fase 3). USD, una
  iniciativa por cuenta (mínimo).
- Supuesto: QR = solo URL pública de `PUBLIC_BASE_URL` explícita;
  `127.0.0.1` nunca se presenta como pública.
- Supuesto: donaciones = intención/simulación etiquetada, jamás
  “dinero recibido”; consultas ≠ pedidos pagados.

## Intentos consumidos (histórico, ver `docs/intentos.json`)

- `shell-exec`: 2/3, resuelto. `test-runner-dir`: 2/3, resuelto.
  `shell-blocked-ux`: 1/3, resuelto. Sin reintentos en bucle.

## Comandos y resultados de verificación

- `npm test` sobre código final: 63/63 fail 0, ~4 s
  (12 archivos de prueba).
- Recorrido UI por clics ES+EN (escritorio y 390px) con capturas
  en `.playwright-cli/` (no versionadas); QR descargado y
  decodificado exacto; reinicio con persistencia.

## Verificación por tipo

- UI: recorrido completo por clics ES+EN en navegador real.
- API: suite 63/63 sobre el código final.
- Dobles: etiquetados `FAKE-DOUBLE`, sin valor de integración real.
- Integración real con APIs de IA: ninguna ejecutada; H0a parcial,
  presupuesto $0.50 propuesto pendiente de aprobación.

## Cómo arrancar y recorrer la demo

```powershell
cd C:\Users\Jorge\OneDrive\hackathon\porque
npm start
# abrir http://127.0.0.1:4177 y /panel (secreto en .env local)
npm test
```

## Bloqueos, pendientes y próximo paso

- Bloqueos: ninguno activo. Incidentes de shell anteriores,
  resueltos (detalle en `docs/intentos.json` y `docs/registro.md`).
- Pendientes: defecto conocido de botones de modalidad;
  validación en Android físico; ronda real 1 (presupuesto); bases
  del evento; datos Contabo; despliegue.
- Próximo paso: lo que Jorge encargue.

## Repositorio y despliegue

- Repo: https://github.com/jlmawyin/porque (público desde
  2026-11-04 por decisión de Jorge; main al día con `91515e0`).
  Dominio previsto: porque.somospanas.com (decisión de producto;
  Cloudflare→Contabo según Jorge, HTTPS y funcionamiento por
  verificar en su etapa). Repo público ≠ sitio publicado: el
  despliegue no está ejecutado.
