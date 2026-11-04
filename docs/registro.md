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
