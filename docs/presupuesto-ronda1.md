# Presupuesto — Ronda real 1 (PROPUESTA, pendiente de aprobación)

Topes duros (los impone el servidor aunque el coste estimado falle):

- Transcripción: ≤15 llamadas, ≤15 min totales, clips ≤60 s.
- Spark: ≤30 llamadas, ≤60.000 tokens facturables totales.
- Imágenes: ≤10 individuales.
- Concurrencia: 1 petición real en vuelo. Cero reintentos automáticos
  en gasto incierto; la reserva retenida no se libera para re-gastar.

## Coste estimado (tarifas de terceros POR CONFIRMAR en H0a)

- Audio: 15 min × $0.003 = **$0.045**.
- Spark peor caso (todo salida): 0.06M × $4.25 = **$0.255**.
  Mezcla típica (40k entrada + 20k salida): $0.05 + $0.085 = $0.135.
- Imágenes: 10 × $0.01 = **$0.10**.
- **Techo propuesto de la ronda: $0.50 USD.**

Fórmula de conciliación: cada llamada reserva su estimación y concilia
con el uso real informado por la API (entrada, salida y cualquier otro
concepto facturable que confirme H0a). Lo incierto queda retenido.

## Aclaración de Jorge (2026-11): $0.50 es la propuesta de UNA ronda
de APIs, no el presupuesto total. Disponibilidad indicada para el
proyecto: superior a $50. Se separan cuatro bolsas:

- Presupuesto total del proyecto: >$50 (tope operativo por definir
  con Jorge antes de gastar; esta entrega visual no consume APIs).
- Rondas de API del producto: $0.50 propuestos para ronda 1,
  pendientes de aprobación expresa + tarifas oficiales.
- Desarrollo (Muse Code): facturación propia, independiente.
- Infraestructura (Contabo + dominio): existente de Jorge.

Sin aprobación expresa de ronda y tope, las APIs reales siguen
desactivadas. No se inventan techos, tarifas ni contratos.

## Costes separados (no incluidos en la ronda 1)

- Muse Code (desarrollo): facturación propia, independiente.
- Alojamiento Contabo + dominio: infraestructura existente de Jorge.
- Esta propuesta cubre solo APIs del producto en la ronda 1.

Aprobación requerida de Jorge: topes + techo $0.50 + tarifas oficiales.
Sin esa confirmación expresa, las APIs reales siguen desactivadas.
