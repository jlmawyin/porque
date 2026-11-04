// DOBLES DE PRUEBA — claramente identificados, solo para desarrollo y tests.
// Nada de lo que devuelven cuenta como evidencia de integración real.
import { randomUUID } from 'node:crypto';
import { parsePriceEsToCents, AI_IMAGE_LABEL } from '../shared/contracts.mjs';

export const FAKE_MARK = 'FAKE-DOUBLE';

/** Transcripción simulada: devuelve el guion indicado (para H1 con dobles). */
export function fakeTranscribe({ script = '', durationMs = 0 } = {}) {
  return {
    fake: true,
    mark: FAKE_MARK,
    transcript: String(script).slice(0, 2000),
    durationMs,
    note: 'Doble de prueba: no es transcripción real.',
  };
}

const norm = (w) => w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const NAME_STOP = new Set(['cuesta', 'cuestan', 'vale', 'valen', 'precio', 'dolar', 'dolares', 'usd', 'con', 'de', 'y']);
const NUMBER_WORDS = new Set('cero,uno,un,una,dos,tres,cuatro,cinco,seis,siete,ocho,nueve,diez,once,doce,trece,catorce,quince,dieciseis,diecisiete,dieciocho,diecinueve,veinte,treinta,cuarenta,cincuenta,sesenta,setenta,ochenta,noventa,cien,ciento'.split(','));

/** Propuesta estructurada simulada a partir de texto (p. ej. «Galletas, cinco dólares»). */
export function fakePropose({ text = '', baseRevision = 0, draft = null } = {}) {
  const clean = String(text).slice(0, 2000);
  const priceCents = parsePriceEsToCents(clean);
  const words = clean.split(/[^A-Za-záéíóúñü]+/i).filter(Boolean);
  const nameWords = [];
  for (const w of words) {
    const n = norm(w);
    if (NAME_STOP.has(n) || NUMBER_WORDS.has(n) || /\d/.test(w)) break;
    nameWords.push(w);
    if (nameWords.join(' ').length > 60) break;
  }
  const patch = {};
  if (nameWords.length && !draft?.name) patch.name = cap(nameWords.join(' ').slice(0, 120));
  if (priceCents !== null) patch.priceCents = priceCents;
  if (draft?.kind === 'initiative' && !draft?.description && clean.trim()) {
    patch.description = clean.trim().slice(0, 500); // palabras del usuario, sin inventar
  }
  const merged = { ...(draft ?? {}), ...patch };
  return {
    fake: true,
    mark: FAKE_MARK,
    proposalId: randomUUID(),
    baseRevision,
    patch,
    missing: [
      ...(!merged.name ? ['name'] : []),
      ...(merged.kind === 'initiative'
        ? (!merged.modality ? ['modality'] : [])
        : (!Number.isInteger(merged.priceCents) ? ['price'] : [])),
      ...(!merged.description ? ['description'] : []),
    ],
    note: 'Doble de prueba: no es interpretación real de Spark.',
  };
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Descripción simulada: solo reformula lo dado, nunca inventa datos. */
export function fakeDescribe({ draft = null } = {}) {
  const parts = [];
  if (draft?.name) parts.push(draft.name);
  if (Number.isInteger(draft?.priceCents)) parts.push(`a $${(draft.priceCents / 100).toFixed(2)} USD`);
  return {
    fake: true,
    mark: FAKE_MARK,
    description: parts.length ? `${parts.join(' ')} (descripción de prueba).` : '',
    invented: [],
    note: 'Doble de prueba: no inventa ingredientes, cantidades ni condiciones.',
  };
}

/** Imagen simulada: marcador local + etiqueta obligatoria. */
export function fakeImage({ draft = null } = {}) {
  return {
    fake: true,
    mark: FAKE_MARK,
    imageRef: 'fake:placeholder:' + (draft?.id ?? 'draft'),
    label: AI_IMAGE_LABEL,
    note: 'Doble de prueba: no es imagen generada real.',
  };
}
