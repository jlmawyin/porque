// Contratos compartidos de Porque (única fuente para cliente y servidor).
// Sin dependencias: este mismo archivo se sirve al navegador.
// Español + USD + datos ficticios para la demo inicial.

export const CURRENCY = 'USD';
export const LOCALE = 'es-EC';
export const AI_IMAGE_LABEL = 'Imagen ilustrativa generada con IA';

// Tope de la ronda real 1 (PROPUESTA pendiente de aprobación; no es autorización).
export const ROUND1_CAPS = Object.freeze({
  transcribeCalls: 15,
  transcribeMinutes: 15,
  sparkCalls: 30,
  sparkTokens: 60000,
  imageCalls: 10,
  maxInFlight: 1,
});

export const ErrorCodes = Object.freeze({
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT_STALE: 'CONFLICT_STALE',
  CONFIRMATION_INVALID: 'CONFIRMATION_INVALID',
  RATE_LIMITED: 'RATE_LIMITED',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  REAL_AI_DISABLED: 'REAL_AI_DISABLED',
  AUDIO_UNSUPPORTED: 'AUDIO_UNSUPPORTED',
  AUDIO_CONVERT_REQUIRED: 'AUDIO_CONVERT_REQUIRED',
  ACCOUNT_EXISTS: 'ACCOUNT_EXISTS',
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);
export const isNonEmptyString = (v, max = 500) =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;

// ---- Dinero: centavos enteros, decidido en servidor ----
const WORDS = new Map(Object.entries({
  cero: 0, uno: 1, un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciseis: 16, dieciséis: 16,
  diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21,
  veintidos: 22, veintidós: 22, veintitres: 23, veintitrés: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintiséis: 26,
  veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30,
  cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80,
  noventa: 90, cien: 100, ciento: 100,
}));

/** «cinco dólares» -> 500. Devuelve centavos o null si no hay importe claro. */
export function parsePriceEsToCents(text) {
  if (typeof text !== 'string') return null;
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const mNum = t.match(/(\d+)\s*(?:[.,](\d{1,2}))?\s*(?:dolar(?:es)?|usd|\$)/);
  if (mNum) {
    const dollars = Number(mNum[1]);
    const cents = mNum[2] ? Number(mNum[2].padEnd(2, '0')) : 0;
    if (!Number.isSafeInteger(dollars) || dollars > 1000000) return null;
    return dollars * 100 + cents;
  }
  const tokens = t.split(/[^a-z]+/).filter(Boolean);
  let total = 0;
  let found = false;
  for (const tok of tokens) {
    if (tok === 'y') continue;
    if (WORDS.has(tok)) {
      total += WORDS.get(tok);
      found = true;
      continue;
    }
    if (tok === 'dolar' || tok === 'dolares' || tok === 'usd') {
      found = found && total > 0 ? true : found;
      break;
    }
  }
  if (!found || total <= 0 || total > 1000000) return null;
  if (!/(dolar|dolares|usd|\$)/.test(t)) return null;
  return total * 100;
}

export const formatCentsUSD = (cents) =>
  `$${(cents / 100).toFixed(2)} USD`;

/** Total en servidor: suma de centavos enteros. */
export function totalCents(lines) {
  if (!Array.isArray(lines)) throw new Error('lines must be array');
  let total = 0;
  for (const line of lines) {
    if (!Number.isInteger(line?.priceCents) || line.priceCents < 0) throw new Error('bad priceCents');
    if (!Number.isInteger(line?.qty) || line.qty < 1 || line.qty > 1000) throw new Error('bad qty');
    total += line.priceCents * line.qty;
    if (!Number.isSafeInteger(total)) throw new Error('total overflow');
  }
  return total;
}

// ---- Tipos y modalidades (Fase 3) ----
export const KINDS = ['product', 'initiative'];
export const MODALITIES = ['donations', 'business', 'both'];
export const MODALITY_LABEL = Object.freeze({ donations: 'Donaciones', business: 'Negocio', both: 'Ambas' });
export function validateDraftCreate(body) {
  const kind = body?.kind ?? 'product';
  if (!KINDS.includes(kind)) return { errors: ['kind inválido'] };
  return { value: { kind } };
}

// ---- Borrador ----
export const DRAFT_STATUSES = ['draft', 'ready'];
export const PENDING_FIELDS = ['name', 'price', 'description'];

export function validateDraftPatch(patch) {
  const errors = [];
  if (typeof patch !== 'object' || patch === null) return { errors: ['patch must be object'] };
  const out = {};
  if (patch.name !== undefined) {
    if (!isNonEmptyString(patch.name, 120)) errors.push('name inválido (1-120)');
    else out.name = patch.name.trim();
  }
  if (patch.priceCents !== undefined) {
    if (!Number.isInteger(patch.priceCents) || patch.priceCents < 0 || patch.priceCents > 100000000) {
      errors.push('priceCents inválido');
    } else out.priceCents = patch.priceCents;
  }
  if (patch.priceText !== undefined) {
    if (typeof patch.priceText !== 'string' || patch.priceText.length > 200) errors.push('priceText inválido');
    else {
      const cents = parsePriceEsToCents(patch.priceText);
      if (cents === null) errors.push('priceText sin importe claro');
      else out.priceCents = cents;
    }
  }
  if (patch.description !== undefined) {
    if (typeof patch.description !== 'string' || patch.description.length > 2000) errors.push('description inválida');
    else out.description = patch.description.trim();
  }
  if (patch.imageRef !== undefined) {
    if (patch.imageRef !== null && !isNonEmptyString(patch.imageRef, 300)) errors.push('imageRef inválido');
    else out.imageRef = patch.imageRef;
  }
  if (patch.modality !== undefined) {
    if (!MODALITIES.includes(patch.modality)) errors.push('modality inválida');
    else out.modality = patch.modality;
  }
  if (patch.purpose !== undefined) {
    if (typeof patch.purpose !== 'string' || patch.purpose.length > 500) errors.push('purpose inválido');
    else out.purpose = patch.purpose.trim();
  }
  if (patch.goalCents !== undefined) {
    if (patch.goalCents !== null && (!Number.isInteger(patch.goalCents) || patch.goalCents < 1 || patch.goalCents > 100000000)) {
      errors.push('goalCents inválido');
    } else out.goalCents = patch.goalCents;
  }
  return errors.length ? { errors } : { value: out };
}

export function pendingOf(draft) {
  const p = [];
  if (!draft?.name) p.push('name');
  if (draft?.kind === 'initiative') {
    if (!draft?.modality) p.push('modality');
  } else if (!Number.isInteger(draft?.priceCents)) {
    p.push('price');
  }
  if (!draft?.description) p.push('description');
  return p;
}

// Hash determinista cyrb53 (cliente+servidor). La confirmación la protege el
// token de revisión secreto; el hash solo detecta cambios de contenido.
export function canonicalDraft(d) {
  return JSON.stringify({
    kind: d?.kind ?? 'product',
    name: d?.name ?? null,
    priceCents: d?.priceCents ?? null,
    currency: CURRENCY,
    description: d?.description ?? null,
    imageRef: d?.imageRef ?? null,
    imageAi: d?.imageAi ? 1 : 0,
    modality: d?.modality ?? null,
    purpose: d?.purpose ?? null,
    goalCents: d?.goalCents ?? null,
  });
}

export function contentHashOf(canonical) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < canonical.length; i++) {
    const ch = canonical.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

// ---- Cuentas (Fase 2). La contraseña solo vive en memoria del servidor. ----
export const ACCOUNT = Object.freeze({ minPassword: 12, maxPassword: 200, maxName: 80, maxEmail: 254 });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = (v) => typeof v === 'string' && v.length <= ACCOUNT.maxEmail && EMAIL_RE.test(v.trim());
export function validateAccountRegister(body) {
  const errors = [];
  if (!isNonEmptyString(body?.name, ACCOUNT.maxName)) errors.push('name inválido (1-80)');
  if (!isEmail(body?.email ?? '')) errors.push('email inválido');
  const pw = body?.password;
  if (typeof pw !== 'string' || pw.length < ACCOUNT.minPassword || pw.length > ACCOUNT.maxPassword) {
    errors.push('password inválida (12-200 caracteres)');
  }
  if (errors.length) return { errors };
  return { value: { name: body.name.trim(), email: body.email.trim().toLowerCase(), password: pw } };
}

// ---- Compartir (Fase 4): URL pública canónica. La base es configuración
// explícita del servidor; sin base válida no hay URL pública afirmable.
// Una base localhost, loopback o privada NUNCA es pública: con ella no hay
// URL afirmable ni QR presentado como accesible desde otro dispositivo.
// Una URL configurada tampoco demuestra despliegue.
function hostNoPublico(hostname) {
  const h = String(hostname ?? '').toLowerCase().replace(/\.$/, '');
  if (!h || h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '::1' || h === '[::1]' || h === '0.0.0.0' || h === '::' || h === '[::]') return true;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const o = v4.slice(1).map(Number);
    if (o.some((n) => n > 255)) return true;
    if (o[0] === 127 || o[0] === 10) return true; // loopback, privada 10/8
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true; // privada 172.16/12
    if (o[0] === 192 && o[1] === 168) return true; // privada 192.168/16
    if (o[0] === 169 && o[1] === 254) return true; // enlace local
    return false;
  }
  if (h.includes(':')) return true; // IPv6 literal: sin confirmar como pública
  if (!h.includes('.')) return true; // un solo nombre: probable red local
  if (h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.lan')) return true;
  return false;
}
export function publicInitiativeUrl(base, id) {
  if (typeof base !== 'string' || !/^https?:\/\/[^/\s]+$/i.test(base.trim())) return null;
  if (typeof id !== 'string' || !/^[A-Za-z0-9-]+$/.test(id)) return null;
  let host = '';
  try {
    host = new URL(base.trim()).hostname;
  } catch {
    return null;
  }
  if (hostNoPublico(host)) return null;
  return `${base.trim()}/i/${id}`;
}

// ---- Apoyos (Fase 5): intención o simulación explícita. Jamás dinero recibido. ----
export const SUPPORT_KINDS = ['intent', 'simulated'];
export const SUPPORT_LABEL = Object.freeze({ intent: 'Intención de apoyo', simulated: 'Simulación' });
export function validateSupport(body) {
  const errors = [];
  if (!SUPPORT_KINDS.includes(body?.kind)) errors.push('kind inválido');
  const a = body?.amountCents;
  if (a !== undefined && a !== null && (!Number.isInteger(a) || a < 1 || a > 100000000)) errors.push('amountCents inválido');
  if (body?.message !== undefined && body?.message !== null && (typeof body.message !== 'string' || body.message.length > 500)) errors.push('message inválido');
  if (body?.nickname !== undefined && body?.nickname !== null && (typeof body.nickname !== 'string' || !body.nickname.trim() || body.nickname.length > 60)) errors.push('nickname inválido');
  if (errors.length) return { errors };
  return {
    value: {
      kind: body.kind,
      amountCents: a ?? null,
      message: (body.message ?? '').trim() || null,
      nickname: body.nickname ? body.nickname.trim() : null,
    },
  };
}

// ---- Audio (contrato H0a; objetivo de conversión pendiente de confirmación oficial) ----
export const AUDIO_TARGET = Object.freeze({
  container: 'wav',
  encoding: 'pcm16',
  channels: 1,
  sampleRates: [16000, 24000],
  maxMinutes: 10,
});

export function audioIntakeVerdict(meta) {
  if (!meta || typeof meta !== 'object') return { verdict: 'rejected', reason: 'meta ausente' };
  const mime = String(meta.mime ?? '').toLowerCase();
  const minutes = Number(meta.durationMs ?? 0) / 60000;
  if (!(minutes > 0) || minutes > AUDIO_TARGET.maxMinutes) {
    return { verdict: 'rejected', reason: 'duración fuera de rango (máx 10 min)' };
  }
  const sr = Number(meta.sampleRate ?? 0);
  const ch = Number(meta.channels ?? 0);
  const isWav = mime.includes('wav') || mime.includes('wave') || mime.includes('x-wav');
  if (isWav && ch === 1 && AUDIO_TARGET.sampleRates.includes(sr)) {
    return { verdict: 'accepted', target: AUDIO_TARGET };
  }
  return { verdict: 'convert-required', target: AUDIO_TARGET, reason: `captura ${mime || '?'} → convertir a WAV PCM16 mono 16/24 kHz (contrato H0a por confirmar)` };
}
