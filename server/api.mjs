// API mismo origen de Porque. JSON, sesiones en cookie httpOnly + CSRF.
// Precios y totales solo en servidor, centavos enteros.
import { randomUUID } from 'node:crypto';
import {
  ErrorCodes, isUuid, validateDraftCreate, validateDraftPatch, pendingOf,
  canonicalDraft, contentHashOf, totalCents, audioIntakeVerdict,
  publicInitiativeUrl, SUPPORT_LABEL, validateSupport,
} from '../shared/contracts.mjs';
import { audit, nowIso } from './db.mjs';
import { sessionOf, login, logout, sessionCookie, clearSessionCookie } from './auth.mjs';
import { registerUser, loginUser, logoutUser, meOf } from './accounts.mjs';
import { status as limitsStatus, reserve } from './limits.mjs';
import { fakeTranscribe, fakePropose, fakeDescribe, fakeImage } from '../adapters/fakes.mjs';
import { requireRealContract, RealAiDisabledError } from '../adapters/meta.mjs';

const MAX_JSON = 256 * 1024;
const REVIEW_TTL_MS = 15 * 60 * 1000;

export function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_JSON) {
        reject(Object.assign(new Error('body demasiado grande'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('JSON inválido'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

export const send = (res, code, obj, extra = {}) => {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', ...extra });
  res.end(body);
};

export const err = (res, code, error, detail = '') =>
  send(res, code, { ok: false, error, detail: String(detail).slice(0, 300) });

const draftOf = (row) => row && {
  id: row.id,
  revision: row.revision,
  status: row.status,
  kind: row.kind ?? 'product',
  name: row.name,
  priceCents: row.price_cents,
  currency: row.currency,
  description: row.description,
  modality: row.modality ?? null,
  purpose: row.purpose ?? null,
  goalCents: row.goal_cents ?? null,
  imageRef: row.image_ref,
  imageAi: !!row.image_ai,
  pending: pendingOf({
    kind: row.kind ?? 'product',
    name: row.name, priceCents: row.price_cents, description: row.description,
    modality: row.modality ?? null,
  }),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
};

const productOf = (row) => row && {
  id: row.id,
  draftId: row.draft_id,
  draftRevision: row.draft_revision,
  version: row.version,
  kind: row.kind ?? 'product',
  name: row.name,
  priceCents: row.price_cents,
  currency: row.currency,
  description: row.description,
  modality: row.modality ?? null,
  purpose: row.purpose ?? null,
  goalCents: row.goal_cents ?? null,
  imageRef: row.image_ref,
  imageAi: !!row.image_ai,
  publishedAt: row.published_at,
};

// Vista pública de iniciativa: lo publicado más el nombre del dueño.
// Nunca lleva ids de propietario ni emails.
const initiativeOf = (row) => ({
  ...productOf(row),
  ownerName: row.owner_name ?? null,
});

// Idempotencia: misma clave -> misma respuesta, sin duplicar la mutación.
// Con scope de propietario: la misma clave de otro propietario no ve ni
// repite la mutación ajena (cada propietario tiene su propio espacio).
function idempotent(db, res, key, endpoint, fn, scope = '') {
  if (!isUuid(key)) {
    err(res, 400, ErrorCodes.BAD_REQUEST, 'clientOpId debe ser UUID');
    return true;
  }
  const storeKey = scope ? `${scope}:${key}` : key;
  const prior = db.prepare('SELECT status_code, body FROM idempotency WHERE key = ?').get(storeKey);
  if (prior) {
    send(res, prior.status_code, { ...JSON.parse(prior.body), idempotentReplay: true });
    return true;
  }
  const out = fn();
  db.prepare('INSERT INTO idempotency (key, endpoint, status_code, body, created_at) VALUES (?, ?, ?, ?, ?)').run(
    storeKey, endpoint, out.code, JSON.stringify(out.body), nowIso(),
  );
  send(res, out.code, out.body);
  return true;
}

// Propiedad (Fase 2): la sesión de usuario solo ve filas con su
// owner_user_id; la sesión de vendedor heredada (user_id NULL) solo ve
// filas con owner NULL. Lo ajeno es 404, sin filtrar existencia.
const idemScope = (s) => (s?.user_id ? `u:${s.user_id}` : 'legacy');
function draftOwned(db, id, s) {
  return s?.user_id
    ? db.prepare('SELECT * FROM drafts WHERE id = ? AND owner_user_id = ?').get(id, s.user_id)
    : db.prepare('SELECT * FROM drafts WHERE id = ? AND owner_user_id IS NULL').get(id);
}

function authn(db, req, res) {
  const s = sessionOf(db, req.headers.cookie);
  if (!s) {
    err(res, 401, ErrorCodes.UNAUTHORIZED, 'sesión requerida');
    return null;
  }
  return s;
}

function csrf(req, res, session) {
  if (req.headers['x-csrf'] !== session.csrf) {
    err(res, 403, ErrorCodes.FORBIDDEN, 'CSRF inválido');
    return false;
  }
  return true;
}

export function createRouter(db, opts = {}) {
  const publicBase = opts.publicBase ?? '';
  return async function route(req, res) {
    const url = new URL(req.url, 'http://local');
    const { pathname } = url;
    const method = req.method;

    // ---- Auth ----
    if (method === 'POST' && pathname === '/api/auth/login') {
      const body = await readJson(req).catch((e) => ({ __e: e }));
      if (body.__e) return err(res, body.__e.status ?? 400, ErrorCodes.BAD_REQUEST, body.__e.message);
      const r = login(db, body.secret);
      if (!r.ok) {
        if (r.locked) return err(res, 429, ErrorCodes.RATE_LIMITED, 'demasiados intentos, espera 10 minutos');
        return err(res, 401, ErrorCodes.UNAUTHORIZED, 'secreto inválido');
      }
      return send(res, 200, { ok: true, csrf: r.csrf, expires: r.expires },
        { 'set-cookie': sessionCookie(r.id, r.token, r.expires) });
    }
    if (method === 'POST' && pathname === '/api/auth/logout') {
      const s = authn(db, req, res);
      if (!s) return;
      logout(db, s.id);
      return send(res, 200, { ok: true }, { 'set-cookie': clearSessionCookie() });
    }
    if (method === 'GET' && pathname === '/api/auth/status') {
      const s = sessionOf(db, req.headers.cookie);
      return send(res, 200, s ? { ok: true, csrf: s.csrf, expires: s.expires_at } : { ok: false });
    }

    // ---- Cuentas (Fase 2) ----
    if (method === 'POST' && pathname === '/api/account/register') {
      const body = await readJson(req).catch((e) => ({ __e: e }));
      if (body.__e) return err(res, body.__e.status ?? 400, ErrorCodes.BAD_REQUEST, body.__e.message);
      const r = registerUser(db, body);
      if (!r.ok) {
        if (r.rateLimited) return err(res, 429, ErrorCodes.RATE_LIMITED, 'límite de cuentas alcanzado, intenta más tarde');
        if (r.exists) return err(res, 409, ErrorCodes.ACCOUNT_EXISTS, 'esa cuenta ya existe');
        return err(res, 400, ErrorCodes.BAD_REQUEST, (r.errors ?? ['registro inválido']).join('; '));
      }
      return send(res, 201, { ok: true, user: r.user, csrf: r.csrf, expires: r.expires },
        { 'set-cookie': r.setCookie });
    }
    if (method === 'POST' && pathname === '/api/account/login') {
      const body = await readJson(req).catch((e) => ({ __e: e }));
      if (body.__e) return err(res, body.__e.status ?? 400, ErrorCodes.BAD_REQUEST, body.__e.message);
      const r = loginUser(db, body);
      if (!r.ok) {
        if (r.locked) return err(res, 429, ErrorCodes.RATE_LIMITED, 'cuenta bloqueada temporalmente, espera 10 minutos');
        return err(res, 401, ErrorCodes.UNAUTHORIZED, 'credenciales inválidas');
      }
      return send(res, 200, { ok: true, user: r.user, csrf: r.csrf, expires: r.expires },
        { 'set-cookie': r.setCookie });
    }
    if (method === 'POST' && pathname === '/api/account/logout') {
      const s = authn(db, req, res);
      if (!s) return;
      if (!csrf(req, res, s)) return;
      return send(res, 200, { ok: true }, { 'set-cookie': logoutUser(db, s.id) });
    }
    if (method === 'GET' && pathname === '/api/account/me') {
      const s = sessionOf(db, req.headers.cookie);
      if (!s) return err(res, 401, ErrorCodes.UNAUTHORIZED, 'sesión requerida');
      const me = meOf(db, s);
      if (!me) return err(res, 401, ErrorCodes.UNAUTHORIZED, 'sesión requerida');
      return send(res, 200, { ok: true, ...me });
    }

    // ---- Catálogo público ----
    if (method === 'GET' && pathname === '/api/products') {
      const rows = db.prepare(
        `SELECT * FROM products WHERE kind = 'product' AND (draft_id, version) IN
         (SELECT draft_id, MAX(version) FROM products GROUP BY draft_id) ORDER BY published_at DESC`,
      ).all();
      return send(res, 200, { ok: true, products: rows.map(productOf) });
    }
    const mProduct = method === 'GET' && /^\/api\/products\/([A-Za-z0-9-]+)$/.exec(pathname);
    if (mProduct) {
      const row = db.prepare('SELECT * FROM products WHERE id = ?').get(mProduct[1]);
      if (!row || (row.kind ?? 'product') !== 'product') return err(res, 404, ErrorCodes.NOT_FOUND);
      return send(res, 200, { ok: true, product: productOf(row) });
    }
    // ---- Iniciativas públicas (Fase 3): solo lo publicado kind=initiative,
    // última versión por borrador. Nunca borradores ni datos privados.
    if (method === 'GET' && pathname === '/api/initiatives') {
      const rows = db.prepare(
        `SELECT p.*, u.name AS owner_name FROM products p
         LEFT JOIN users u ON u.id = p.owner_user_id
         WHERE p.kind = 'initiative' AND (p.draft_id, p.version) IN
         (SELECT draft_id, MAX(version) FROM products GROUP BY draft_id)
         ORDER BY p.published_at DESC`,
      ).all();
      return send(res, 200, { ok: true, initiatives: rows.map(initiativeOf) });
    }
    const mInitiative = method === 'GET' && /^\/api\/initiatives\/([A-Za-z0-9-]+)$/.exec(pathname);
    if (mInitiative) {
      const row = db.prepare(
        `SELECT p.*, u.name AS owner_name FROM products p
         LEFT JOIN users u ON u.id = p.owner_user_id WHERE p.id = ?`,
      ).get(mInitiative[1]);
      if (!row || row.kind !== 'initiative') return err(res, 404, ErrorCodes.NOT_FOUND);
      const sameOwner = row.owner_user_id
        ? { sql: 'owner_user_id = ?', arg: row.owner_user_id }
        : { sql: 'owner_user_id IS NULL', arg: undefined };
      const prows = db.prepare(
        `SELECT * FROM products WHERE kind = 'product' AND ${sameOwner.sql} AND (draft_id, version) IN
         (SELECT draft_id, MAX(version) FROM products GROUP BY draft_id)
         ORDER BY published_at DESC`,
      ).all(...(sameOwner.arg === undefined ? [] : [sameOwner.arg]));
      const products = prows.map((p) => ({
        id: p.id, name: p.name, priceCents: p.price_cents, currency: p.currency,
        description: p.description, imageRef: p.image_ref, imageAi: !!p.image_ai,
      }));
      return send(res, 200, { ok: true, initiative: initiativeOf(row), products });
    }
    // ---- Apoyos honestos (Fase 5): intención o simulación explícita.
    // Sin pagos reales: jamás dinero recibido, sin datos de pago, sin emails.
    const mSupportPost = method === 'POST' && /^\/api\/initiatives\/([A-Za-z0-9-]+)\/supports$/.exec(pathname);
    if (mSupportPost) {
      const body = await readJson(req).catch((e) => ({ __e: e }));
      if (body.__e) return err(res, body.__e.status ?? 400, ErrorCodes.BAD_REQUEST, body.__e.message);
      const row = db.prepare('SELECT * FROM products WHERE id = ?').get(mSupportPost[1]);
      if (!row || row.kind !== 'initiative') return err(res, 404, ErrorCodes.NOT_FOUND);
      if (row.modality !== 'donations' && row.modality !== 'both') {
        return err(res, 400, ErrorCodes.BAD_REQUEST,
          'esta iniciativa es solo negocio (modality business): no admite expresiones de apoyo');
      }
      const v = validateSupport({
        kind: body.kind,
        amountCents: body.amountCents,
        message: body.message,
        nickname: body.nickname,
      });
      if (v.errors) return err(res, 400, ErrorCodes.BAD_REQUEST, v.errors.join('; '));
      return idempotent(db, res, body.clientOpId, 'supports.create', () => {
        const id = randomUUID();
        const createdAt = nowIso();
        db.prepare(
          'INSERT INTO supports (id, initiative_id, kind, amount_cents, message, nickname, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(id, row.id, v.value.kind, v.value.amountCents, v.value.message, v.value.nickname, 'expressed', createdAt);
        // Auditoría sin mensaje ni nickname: solo el tipo de apoyo.
        audit(db, 'public', 'support.expressed', 'initiative:' + row.id, v.value.kind);
        return {
          code: 201,
          body: {
            ok: true,
            support: {
              id, kind: v.value.kind, amountCents: v.value.amountCents,
              status: 'expressed', createdAt,
            },
            labels: {
              kind: SUPPORT_LABEL[v.value.kind],
              note: 'Expresado. No es dinero recibido.',
            },
          },
        };
      }, 'public');
    }
    const mSupportSummary = method === 'GET' && /^\/api\/initiatives\/([A-Za-z0-9-]+)\/supports\/summary$/.exec(pathname);
    if (mSupportSummary) {
      const row = db.prepare('SELECT * FROM products WHERE id = ?').get(mSupportSummary[1]);
      if (!row || row.kind !== 'initiative') return err(res, 404, ErrorCodes.NOT_FOUND);
      const counts = db.prepare(
        'SELECT kind, COUNT(*) AS n FROM supports WHERE initiative_id = ? GROUP BY kind',
      ).all(row.id);
      let intents = 0; let simulated = 0;
      for (const c of counts) {
        if (c.kind === 'intent') intents = c.n;
        else if (c.kind === 'simulated') simulated = c.n;
      }
      return send(res, 200, {
        ok: true, intents, simulated,
        note: 'Expresiones de apoyo, no fondos recibidos',
      });
    }
    const mSupportList = method === 'GET' && /^\/api\/initiatives\/([A-Za-z0-9-]+)\/supports$/.exec(pathname);
    if (mSupportList) {
      const s = authn(db, req, res);
      if (!s) return;
      const row = db.prepare('SELECT * FROM products WHERE id = ?').get(mSupportList[1]);
      if (!row || row.kind !== 'initiative') return err(res, 404, ErrorCodes.NOT_FOUND);
      // Propiedad como en Fase 2: usuario dueño u owner NULL con sesión
      // de vendedor heredada. Lo ajeno es 404, sin filtrar existencia.
      const owned = s.user_id ? row.owner_user_id === s.user_id : row.owner_user_id == null;
      if (!owned) return err(res, 404, ErrorCodes.NOT_FOUND);
      const rows = db.prepare(
        'SELECT * FROM supports WHERE initiative_id = ? ORDER BY created_at ASC',
      ).all(row.id);
      return send(res, 200, {
        ok: true,
        supports: rows.map((r) => ({
          id: r.id, kind: r.kind, amountCents: r.amount_cents,
          message: r.message, nickname: r.nickname,
          status: r.status, createdAt: r.created_at,
        })),
      });
    }
    // ---- Compartir (Fase 4): URL canónica + QR real tras dependencia.
    // QR con `qrcode-generator` (MIT, sin dependencias, mantenida): `npm i qrcode-generator`.
    // Sin instalar, qr:{available:false} con motivo (comportamiento honesto).
    // El QR codifica SOLO la URL pública, o el localPath claramente local.
    const mShare = method === 'GET' && /^\/api\/share\/initiative\/([A-Za-z0-9-]+)$/.exec(pathname);
    if (mShare) {
      const row = db.prepare('SELECT * FROM products WHERE id = ?').get(mShare[1]);
      if (!row || row.kind !== 'initiative') return err(res, 404, ErrorCodes.NOT_FOUND);
      const url = publicInitiativeUrl(publicBase, row.id);
      const text = url; // null = sin QR escaneable sin base pública
      let qr = url === null ? { available: false, reason: 'QR no disponible: falta URL pública (PUBLIC_BASE_URL)' } : { available: false, reason: 'QR pendiente: instala qrcode-generator' };
      try {
        const mod = await import('qrcode-generator');
        const makeQr = mod.default ?? mod;
        const q = makeQr(0, 'M');
        if (text === null) throw new Error('sin URL pública');
        q.addData(text);
        q.make();
        qr = { available: true, text, dataUrl: q.createDataURL(4, 0), local: false };
      } catch {
        // Dependencia no instalada: se conserva el fallback honesto.
      }
      return send(res, 200, {
        ok: true,
        share: {
          localPath: `/i/${row.id}`,
          url,
          isPublic: url !== null,
          qr,
        },
      });
    }
    if (method === 'POST' && pathname === '/api/inquiries') {
      const body = await readJson(req).catch((e) => ({ __e: e }));
      if (body.__e) return err(res, body.__e.status ?? 400, ErrorCodes.BAD_REQUEST, body.__e.message);
      if (!['link', 'copy', 'chat'].includes(body.channel)) {
        return err(res, 400, ErrorCodes.BAD_REQUEST, 'channel inválido');
      }
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(body.productId);
      if (!product) return err(res, 404, ErrorCodes.NOT_FOUND, 'producto inexistente');
      return idempotent(db, res, body.clientOpId, 'inquiries.create', () => {
        const id = randomUUID();
        db.prepare('INSERT INTO inquiries (id, product_id, channel, created_at) VALUES (?, ?, ?, ?)').run(
          id, product.id, body.channel, nowIso(),
        );
        return { code: 201, body: { ok: true, inquiry: { id, productId: product.id, channel: body.channel, status: 'prepared' }, url: `${publicBase}/p/${product.id}` } };
      });
    }
    const mOpened = method === 'POST' && /^\/api\/inquiries\/([A-Za-z0-9-]+)\/opened$/.exec(pathname);
    if (mOpened) {
      const row = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(mOpened[1]);
      if (!row) return err(res, 404, ErrorCodes.NOT_FOUND);
      db.prepare("UPDATE inquiries SET status = 'opened', opened_at = ? WHERE id = ?").run(nowIso(), row.id);
      return send(res, 200, { ok: true, inquiry: { id: row.id, status: 'opened' }, note: 'abierto no prueba envío, recepción ni aceptación' });
    }
    if (method === 'POST' && pathname === '/api/totals') {
      const body = await readJson(req).catch((e) => ({ __e: e }));
      if (body.__e) return err(res, body.__e.status ?? 400, ErrorCodes.BAD_REQUEST, body.__e.message);
      try {
        const total = totalCents(body.lines);
        return send(res, 200, { ok: true, totalCents: total, currency: 'USD' });
      } catch (e) {
        return err(res, 400, ErrorCodes.BAD_REQUEST, e.message);
      }
    }

    // ---- Rutas de vendedor ----
    const needAuth =
      pathname.startsWith('/api/drafts') || pathname.startsWith('/api/ai') ||
      pathname.startsWith('/api/audio') || pathname === '/api/limits';
    if (needAuth) {
      const s = authn(db, req, res);
      if (!s) return;
      if (method !== 'GET' && !csrf(req, res, s)) return;
      req.session = s;
    }

    if (method === 'GET' && pathname === '/api/limits') {
      return send(res, 200, { ok: true, limits: limitsStatus(db, req.session.id) });
    }

    if (method === 'POST' && pathname === '/api/drafts') {
      const body = await readJson(req).catch((e) => ({ __e: e }));
      if (body.__e) return err(res, body.__e.status ?? 400, ErrorCodes.BAD_REQUEST, body.__e.message);
      const vc = validateDraftCreate(body);
      if (vc.errors) return err(res, 400, ErrorCodes.BAD_REQUEST, vc.errors.join('; '));
      return idempotent(db, res, body.clientOpId, 'drafts.create', () => {
        const id = randomUUID();
        const now = nowIso();
        db.prepare('INSERT INTO drafts (id, kind, created_at, updated_at, owner_user_id) VALUES (?, ?, ?, ?, ?)').run(
          id, vc.value.kind, now, now, req.session.user_id ?? null,
        );
        audit(db, 'seller', 'draft.created', 'draft:' + id);
        return { code: 201, body: { ok: true, draft: draftOf(draftOwned(db, id, req.session)) } };
      }, idemScope(req.session));
    }
    if (method === 'GET' && pathname === '/api/drafts') {
      const rows = req.session.user_id
        ? db.prepare('SELECT * FROM drafts WHERE owner_user_id = ? ORDER BY updated_at DESC').all(req.session.user_id)
        : db.prepare('SELECT * FROM drafts WHERE owner_user_id IS NULL ORDER BY updated_at DESC').all();
      return send(res, 200, { ok: true, drafts: rows.map(draftOf) });
    }
    const mDraft = /^\/api\/drafts\/([A-Za-z0-9-]+)(\/(review|publish|conflicts))?$/.exec(pathname);
    if (mDraft) {
      const [, id, , action] = mDraft;
      const row = draftOwned(db, id, req.session);
      if (!row) return err(res, 404, ErrorCodes.NOT_FOUND);
      if (method === 'GET' && !action) return send(res, 200, { ok: true, draft: draftOf(row) });

      if (method === 'PATCH' && !action) {
        const body = await readJson(req).catch((e) => ({ __e: e }));
        if (body.__e) return err(res, body.__e.status ?? 400, ErrorCodes.BAD_REQUEST, body.__e.message);
        if (!Number.isInteger(body.baseRevision)) {
          return err(res, 400, ErrorCodes.BAD_REQUEST, 'baseRevision requerido');
        }
        const v = validateDraftPatch(body.patch);
        if (v.errors) return err(res, 400, ErrorCodes.BAD_REQUEST, v.errors.join('; '));
        return idempotent(db, res, body.clientOpId, 'drafts.patch', () => {
          const current = draftOwned(db, id, req.session);
          if (!current) return { code: 404, body: { ok: false, error: ErrorCodes.NOT_FOUND } };
          if (current.revision !== body.baseRevision) {
            // Conflicto: conservar ambas versiones y permitir elegir.
            const cid = randomUUID();
            const serverSnap = draftOf(current);
            const clientSnap = { ...serverSnap, ...v.value };
            db.prepare(
              'INSERT INTO conflicts (id, draft_id, base_revision, server_snapshot, client_snapshot, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            ).run(cid, id, body.baseRevision, JSON.stringify(serverSnap), JSON.stringify(clientSnap), nowIso());
            audit(db, 'seller', 'draft.conflict', 'draft:' + id, 'base ' + body.baseRevision + ' actual ' + current.revision);
            return { code: 409, body: { ok: false, error: ErrorCodes.CONFLICT_STALE, conflict: { id: cid, server: serverSnap, client: clientSnap } } };
          }
          const next = { ...draftOf(current), ...v.value };
          const now = nowIso();
          db.prepare(
            `UPDATE drafts SET revision = revision + 1, status = 'draft', name = ?, price_cents = ?,
             description = ?, image_ref = ?, modality = ?, purpose = ?, goal_cents = ?, updated_at = ? WHERE id = ?`,
          ).run(next.name ?? null, next.priceCents ?? null, next.description ?? null, next.imageRef ?? null,
            next.modality ?? null, next.purpose ?? null, next.goalCents ?? null, now, id);
          db.prepare('DELETE FROM reviews WHERE draft_id = ?').run(id); // cambiar invalida revisiones
          const updated = draftOf(db.prepare('SELECT * FROM drafts WHERE id = ?').get(id));
          audit(db, 'seller', 'draft.patched', 'draft:' + id, 'rev ' + updated.revision);
          return { code: 200, body: { ok: true, draft: updated } };
        }, idemScope(req.session));
      }

      if (method === 'POST' && action === 'review') {
        const d = draftOf(row);
        const canonical = canonicalDraft(d);
        const token = randomUUID();
        const expires = new Date(Date.now() + REVIEW_TTL_MS).toISOString();
        db.prepare('DELETE FROM reviews WHERE draft_id = ?').run(id);
        db.prepare('INSERT INTO reviews (token, draft_id, content_hash, snapshot, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
          token, id, contentHashOf(canonical), canonical, expires, nowIso(),
        );
        db.prepare("UPDATE drafts SET status = 'ready', updated_at = ? WHERE id = ?").run(nowIso(), id);
        return send(res, 200, { ok: true, review: { reviewToken: token, contentHash: contentHashOf(canonical), snapshot: d, expires } });
      }

      if (method === 'POST' && action === 'publish') {
        const body = await readJson(req).catch((e) => ({ __e: e }));
        if (body.__e) return err(res, body.__e.status ?? 400, ErrorCodes.BAD_REQUEST, body.__e.message);
        return idempotent(db, res, body.clientOpId, 'drafts.publish', () => {
          const owned = draftOwned(db, id, req.session);
          if (!owned) return { code: 404, body: { ok: false, error: ErrorCodes.NOT_FOUND } };
          const rv = db.prepare('SELECT * FROM reviews WHERE token = ? AND draft_id = ?').get(body.reviewToken, id);
          const current = draftOf(owned);
          if (current.pending.length) {
            return { code: 422, body: { ok: false, error: ErrorCodes.CONFIRMATION_INVALID, detail: 'faltan campos: ' + current.pending.join(', ') } };
          }
          const hashNow = contentHashOf(canonicalDraft(current));
          // La confirmación solo vale para el contenido exacto revisado.
          if (!rv || rv.expires_at < nowIso() || body.contentHash !== hashNow || rv.content_hash !== hashNow) {
            return { code: 422, body: { ok: false, error: ErrorCodes.CONFIRMATION_INVALID, detail: 'la revisión no corresponde al contenido actual; revisa de nuevo' } };
          }
          const version = (db.prepare('SELECT COALESCE(MAX(version), 0) AS m FROM products WHERE draft_id = ?').get(id).m) + 1;
          const pid = randomUUID();
          db.prepare(
            `INSERT INTO products (id, draft_id, draft_revision, version, kind, modality, purpose, goal_cents,
             name, price_cents, currency, description, image_ref, image_ai, published_at, owner_user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?)`,
          ).run(pid, id, current.revision, version, current.kind ?? 'product', current.modality ?? null,
            current.purpose ?? null, current.goalCents ?? null,
            current.name ?? 'Sin nombre', current.priceCents ?? 0,
            current.description ?? '', current.imageRef ?? null, current.imageAi ? 1 : 0, nowIso(), req.session.user_id ?? null);
          db.prepare('DELETE FROM reviews WHERE draft_id = ?').run(id);
          audit(db, 'seller', 'product.published', 'product:' + pid, 'v' + version);
          return { code: 201, body: { ok: true, product: productOf(db.prepare('SELECT * FROM products WHERE id = ?').get(pid)) } };
        }, idemScope(req.session));
      }
      return err(res, 404, ErrorCodes.NOT_FOUND);
    }

    const mResolve = method === 'POST' && /^\/api\/drafts\/([A-Za-z0-9-]+)\/conflicts\/([A-Za-z0-9-]+)\/resolve$/.exec(pathname);
    if (mResolve) {
      const [, id, cid] = mResolve;
      const body = await readJson(req).catch((e) => ({ __e: e }));
      if (body.__e) return err(res, body.__e.status ?? 400, ErrorCodes.BAD_REQUEST, body.__e.message);
      if (!['mine', 'theirs'].includes(body.choice)) {
        return err(res, 400, ErrorCodes.BAD_REQUEST, 'choice debe ser mine|theirs');
      }
      if (!draftOwned(db, id, req.session)) return err(res, 404, ErrorCodes.NOT_FOUND);
      return idempotent(db, res, body.clientOpId, 'conflicts.resolve', () => {
        const c = db.prepare("SELECT * FROM conflicts WHERE id = ? AND draft_id = ? AND status = 'open'").get(cid, id);
        if (!c) return { code: 404, body: { ok: false, error: ErrorCodes.NOT_FOUND } };
        if (body.choice === 'mine') {
          const snap = JSON.parse(c.client_snapshot);
          const now = nowIso();
          db.prepare(
            `UPDATE drafts SET revision = revision + 1, status = 'draft', name = ?, price_cents = ?,
             description = ?, image_ref = ?, modality = ?, purpose = ?, goal_cents = ?, updated_at = ? WHERE id = ?`,
          ).run(snap.name ?? null, snap.priceCents ?? null, snap.description ?? null, snap.imageRef ?? null,
            snap.modality ?? null, snap.purpose ?? null, snap.goalCents ?? null, now, id);
          db.prepare('DELETE FROM reviews WHERE draft_id = ?').run(id);
        }
        db.prepare("UPDATE conflicts SET status = 'resolved', resolved_at = ? WHERE id = ?").run(nowIso(), cid);
        audit(db, 'seller', 'draft.conflict_resolved', 'draft:' + id, body.choice);
        return { code: 200, body: { ok: true, draft: draftOf(draftOwned(db, id, req.session)) } };
      }, idemScope(req.session));
    }

    // ---- IA con dobles (etiquetados) + vía real bloqueada ----
    if (method === 'POST' && pathname === '/api/ai/propose') {
      const body = await readJson(req).catch((e) => ({ __e: e }));
      if (body.__e) return err(res, body.__e.status ?? 400, ErrorCodes.BAD_REQUEST, body.__e.message);
      const row = draftOwned(db, body.draftId, req.session);
      if (!row) return err(res, 404, ErrorCodes.NOT_FOUND);
      const d = draftOf(row);
      const p = fakePropose({ text: body.text ?? '', baseRevision: body.baseRevision ?? d.revision, draft: d });
      p.stale = p.baseRevision !== d.revision;
      p.currentRevision = d.revision;
      return send(res, 200, { ok: true, proposal: p });
    }
    if (method === 'POST' && pathname === '/api/ai/describe') {
      const body = await readJson(req).catch((e) => ({ __e: e }));
      if (body.__e) return err(res, body.__e.status ?? 400, ErrorCodes.BAD_REQUEST, body.__e.message);
      const row = draftOwned(db, body.draftId, req.session);
      if (!row) return err(res, 404, ErrorCodes.NOT_FOUND);
      return send(res, 200, { ok: true, result: fakeDescribe({ draft: draftOf(row) }) });
    }
    if (method === 'POST' && pathname === '/api/ai/image') {
      const body = await readJson(req).catch((e) => ({ __e: e }));
      if (body.__e) return err(res, body.__e.status ?? 400, ErrorCodes.BAD_REQUEST, body.__e.message);
      const row = draftOwned(db, body.draftId, req.session);
      if (!row) return err(res, 404, ErrorCodes.NOT_FOUND);
      return send(res, 200, { ok: true, result: fakeImage({ draft: draftOf(row) }) });
    }
    if (method === 'POST' && pathname === '/api/ai/real') {
      // Vía real: existe el cableado (reserva + contrato), pero está bloqueada.
      try {
        const { aiEnabled } = await import('./limits.mjs');
        requireRealContract('spark', { aiEnabled: aiEnabled(db) });
        const r = reserve(db, req.session.id, 'spark', 1000);
        if (!r.ok) return err(res, r.disabled ? 503 : 429, r.reason);
        return err(res, 503, ErrorCodes.REAL_AI_DISABLED, 'transporte real no habilitado en esta entrega');
      } catch (e) {
        if (e instanceof RealAiDisabledError) return err(res, 503, ErrorCodes.REAL_AI_DISABLED, e.message);
        throw e;
      }
    }

    // ---- Audio: intake (validación de formato) + transcripción doble ----
    if (method === 'POST' && pathname === '/api/audio/intake') {
      const body = await readJson(req).catch((e) => ({ __e: e }));
      if (body.__e) return err(res, body.__e.status ?? 400, ErrorCodes.BAD_REQUEST, body.__e.message);
      const v = audioIntakeVerdict(body);
      audit(db, 'seller', 'audio.intake', 'intake', v.verdict);
      if (v.verdict === 'rejected') return err(res, 415, ErrorCodes.AUDIO_UNSUPPORTED, v.reason);
      if (v.verdict === 'convert-required') {
        return send(res, 200, { ok: true, ...v, code: ErrorCodes.AUDIO_CONVERT_REQUIRED });
      }
      return send(res, 200, { ok: true, ...v });
    }
    if (method === 'POST' && pathname === '/api/audio/transcribe') {
      const body = await readJson(req).catch((e) => ({ __e: e }));
      if (body.__e) return err(res, body.__e.status ?? 400, ErrorCodes.BAD_REQUEST, body.__e.message);
      // Sin retención de audio: solo se acepta el guion de prueba del doble.
      return send(res, 200, { ok: true, result: fakeTranscribe({ script: body.script ?? '', durationMs: body.durationMs ?? 0 }) });
    }

    return err(res, 404, ErrorCodes.NOT_FOUND);
  };
}
