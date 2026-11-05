# Relevo para sesión nueva — Porque (2026-11-04)

Supervisión: Jorge.

## Requisitos

- Demo local honesta: catálogo, cuentas, iniciativas, apoyos,
  QR, ES/EN. Datos ficticios, USD, sin pagos reales.
- Guardar ≠ publicar; revisión exacta; propiedad con 404;
  apoyos solo intención/simulación; QR solo con base pública
  configurada; APIs reales desactivadas sin H0a oficial y sin
  presupuesto aprobado por Jorge.
- Verificar con ejecución antes de declarar; conservar contadores
  de `docs/intentos.json`; commits sin secretos.

## Estado del código

- HEAD `91515e0`, repo público, árbol limpio tras el push.
- Todo implementado y verificado: Fases 1–7, UX, 4 correcciones
  funcionales, textos con identidad, ES/EN, SW porque-v3.
- Defecto conocido sin corregir: botones de modalidad guardan y
  re-renderizan, vaciando campos sin guardar.

## Pruebas

- `npm test`: 63/63 fail 0 (12 archivos).
- Recorrido UI ES+EN por clics, escritorio y 390px, con capturas
  (no versionadas); QR decodificado exacto; reinicio OK.
- No validado en Android físico.

## Pendientes

Defecto de modalidad; Android físico; ronda real 1; bases del
evento; datos Contabo; despliegue en porque.somospanas.com.

## Siguiente paso

Lo que Jorge encargue.
