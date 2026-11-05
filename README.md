# Porque — porque somos panas

PWA de catálogo y comercio adaptativo (demo local, datos ficticios).
Ayuda a emprendedores a gestionar su catálogo hablando, respondiendo
preguntas breves o tocando controles accesibles, según lo que les
resulte más cómodo en cada momento.

- Demo: cuentas, español e inglés, USD, datos ficticios.
- Dominio previsto: `porque.somospanas.com` (decisión de producto;
  esta entrega es solo local, sin publicar ni tocar infraestructura).
- APIs reales del producto: **desactivadas por defecto**. Dobles de
  prueba claramente etiquetados (`FAKE-DOUBLE`).
- Estado: portada, cuentas con propiedad, iniciativas (donaciones /
  negocio / ambas) con página pública `/i/:id`, apoyos como intención
  o simulación (nunca dinero), modalidades A/B/C, URL canónica y
  QR descargable con base pública configurada (no disponible sin
  ella). Interfaz en español e inglés.
  Verificado con ejecución: suite 63/63 y recorrido UI ES+EN
  (ver `docs/registro.md`). Sin despliegue.

## Ejecutar en local

Requiere Node 24+ (usa `node:sqlite`, `node:test`; 1 dependencia: `qrcode-generator`, solo QR).

```powershell
node scripts/gen-secret.mjs   # crea .env privado (no versionado)
npm start                      # http://127.0.0.1:4177  (panel: /panel)
npm test                       # suite automatizada
```

El secreto vive en `.env` o `data/.secret` (privados, ignorados por git).
Nunca aparece en código, commits, logs ni navegador.

## Demo para jueces (opcional)

Desactivada por defecto. Para permitir entrar sin registro:

```powershell
$env:PORQUE_DEMO='1'; npm start
```

Cada clic en «Probar la demo» crea una cuenta desechable nueva
(`demo-*@porque.demo`, sin contraseña conocida) y «Reiniciar demo»
cambia a otra identidad limpia. Sin PORQUE_DEMO=1 la ruta responde
404 como si no existiera.

La portada incluye además un evento ficticio («Cena solidaria de
Panas») con donación y apoyo simulados solo en el navegador: no
mueve dinero ni crea registros.

## Voz e imagen reales (Meta, apagadas por defecto)

Transcripción (`muse-voice-transcribe-1.0`) y portadas
(`muse-image-1.0`) con contratos verificados en docs oficiales.
Exigen llave y activación explícita en servidor; sin ellas, la
voz responde `REAL_AI_DISABLED` y la imagen usa el doble.
Contratos, costos ($0.18/h voz, $0.01/imagen), topes y
activación paso a paso: `docs/informe-meta-2026-11-05.md`.

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
- `tests/` — 12 archivos de prueba, 63 pruebas con `node:test` (ver `docs/registro.md`).
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
- Compartir: URL canónica solo con base explícita no local; QR
  descargable con base pública configurada (no disponible sin ella;
  una URL configurada no confirma despliegue).
- Imágenes sintéticas con etiqueta visible
  «Imagen ilustrativa generada con IA»; publicar sin imagen es posible.

Ver `docs/decisiones.md`, `docs/H0a-contratos.md` y
`docs/presupuesto-ronda1.md`.
