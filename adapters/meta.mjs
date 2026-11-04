// Adaptador Meta Model API — REAL DESACTIVADO POR DEFECTO.
// Las llamadas reales exigen: contratos oficiales verificados (H0a completa),
// IA habilitada en BD, aprobación de ronda con tope, reserva atómica previa.
// Este bloque solo prepara la configuración; no realiza llamadas.
import { META_CONTRACTS } from './meta-contracts.mjs';

export class RealAiDisabledError extends Error {
  constructor(reason) {
    super(reason);
    this.code = 'REAL_AI_DISABLED';
  }
}

export function contractsVerified({ env = process.env } = {}) {
  return env.META_CONTRACTS_VERIFIED === '1';
}

/** Devuelve la ficha del contrato o lanza si no está verificada/habilitada. */
export function requireRealContract(kind, { env = process.env, aiEnabled = false } = {}) {
  const ficha = META_CONTRACTS[kind];
  if (!ficha) throw new RealAiDisabledError(`integración desconocida: ${kind}`);
  if (ficha.status !== 'verified') {
    throw new RealAiDisabledError(`${kind}: contrato pendiente de verificación oficial (H0a)`);
  }
  if (!contractsVerified({ env })) throw new RealAiDisabledError('META_CONTRACTS_VERIFIED != 1');
  if (!aiEnabled) throw new RealAiDisabledError('IA real desactivada (apagado por defecto)');
  const key = env.META_MODEL_API_KEY;
  if (!key) throw new RealAiDisabledError('falta META_MODEL_API_KEY en servidor');
  return { ficha, key };
}

// Transporte real: se implementa contra el contrato verificado en la etapa de
// pruebas reales aprobadas. Hoy lanza siempre (las APIs están desactivadas).
export async function realRequest() {
  throw new RealAiDisabledError('transporte real no habilitado en esta entrega');
}
