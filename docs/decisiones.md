# Decisiones

- D1 Cero dependencias (Node 24 + `node:sqlite` + `node:test` + web
  vainilla). Motivo: plazo corto, auditoría simple, sin red de
  registro ni toolchain. Revisable si H0a exige un SDK oficial.
  Actualización 2026-11-04: 1 dependencia (`qrcode-generator` MIT,
  solo QR, autorizada por Jorge por ser pequeña y mantenida).
- D2 SQLite en `data/` con WAL. Sobrevive a reinicios y despliegues
  solo con disco persistente y privado (decidido para la demo).
- D3 Contratos únicos en `shared/contracts.mjs` servido al navegador.
- D4 Conflictos: conservar ambas y elegir (sin fusión avanzada).
- D5 Confirmación ligada a hash del contenido exacto + token de
  revisión de un uso; la voz («sí», transcripción tardía, TTS) nunca
  publica sola; las pausas no confirman.
- D6 Límites antes que APIs: reserva atómica, conciliación, apagado
  por defecto, sin reintento de gasto incierto.
- D7 Dobles etiquetados `FAKE-DOUBLE`, limitados a desarrollo/tests.
- D8 Recortes: SAM primero; intocables voz real e interpretación
  real; imagen mínima como objetivo salvo bloqueo evidenciado.
- D9 Narrativa general y capacidades demostrables; ejemplos ficticios
  etiquetados; sin casos identificables ni validaciones inventadas.
- D10 Sin remote git configurado en esta entrega (repositorio
  reservado anotado, pendiente de etapa autorizada).
