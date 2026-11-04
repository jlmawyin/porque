// SQLite (node:sqlite) con WAL. Los datos sobreviven a reinicios y despliegues
// solo si el archivo vive en almacenamiento persistente y privado.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

let DatabaseSync;
try {
  ({ DatabaseSync } = createRequire(import.meta.url)('node:sqlite'));
} catch {
  throw new Error('node:sqlite no disponible: usa Node 24+ sin flags experimentales.');
}

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sellers (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  secret_hash TEXT NOT NULL, secret_salt TEXT NOT NULL,
  created_at TEXT NOT NULL, failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, csrf TEXT NOT NULL,
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (id INTEGER PRIMARY KEY, at TEXT NOT NULL, ok INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'draft',
  name TEXT, price_cents INTEGER, currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT, image_ref TEXT, image_ai INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS idempotency (
  key TEXT PRIMARY KEY, endpoint TEXT NOT NULL, status_code INTEGER NOT NULL,
  body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conflicts (
  id TEXT PRIMARY KEY, draft_id TEXT NOT NULL, base_revision INTEGER NOT NULL,
  server_snapshot TEXT NOT NULL, client_snapshot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS reviews (
  token TEXT PRIMARY KEY, draft_id TEXT NOT NULL, content_hash TEXT NOT NULL,
  snapshot TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, draft_id TEXT NOT NULL, draft_revision INTEGER NOT NULL,
  version INTEGER NOT NULL, name TEXT NOT NULL, price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  image_ref TEXT, image_ai INTEGER NOT NULL DEFAULT 0, published_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL, channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'prepared', created_at TEXT NOT NULL, opened_at TEXT
);
CREATE TABLE IF NOT EXISTS usage_windows (
  scope TEXT NOT NULL, kind TEXT NOT NULL, window TEXT NOT NULL,
  used REAL NOT NULL DEFAULT 0, calls INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, kind, window)
);
CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL, kind TEXT NOT NULL,
  units REAL NOT NULL, state TEXT NOT NULL DEFAULT 'held',
  created_at TEXT NOT NULL, reconciled_at TEXT, note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY, at TEXT NOT NULL, actor TEXT NOT NULL,
  action TEXT NOT NULL, entity TEXT NOT NULL, detail TEXT NOT NULL DEFAULT ''
);
`;

// Migración 2 (Fase 2, no destructiva): cuentas y propiedad.
// owner_user_id NULL = dato heredado (no atribuible automáticamente).
function hasColumn(db, table, col) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
}
function migrate2(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    pw_hash TEXT NOT NULL, pw_salt TEXT NOT NULL,
    created_at TEXT NOT NULL, failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT
  )`);
  if (!hasColumn(db, 'drafts', 'owner_user_id')) db.exec('ALTER TABLE drafts ADD COLUMN owner_user_id TEXT');
  if (!hasColumn(db, 'products', 'owner_user_id')) db.exec('ALTER TABLE products ADD COLUMN owner_user_id TEXT');
  if (!hasColumn(db, 'sessions', 'user_id')) db.exec('ALTER TABLE sessions ADD COLUMN user_id TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS idx_drafts_owner ON drafts(owner_user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_products_owner ON products(owner_user_id)');
  db.prepare("INSERT INTO meta (key, value) VALUES ('migration', '2') ON CONFLICT (key) DO UPDATE SET value = '2'").run();
}

// Migración 3 (Fase 3, no destructiva): iniciativas como borradores
// publicables con modalidad, propósito y meta opcional.
function migrate3(db) {
  for (const table of ['drafts', 'products']) {
    if (!hasColumn(db, table, 'kind')) db.exec(`ALTER TABLE ${table} ADD COLUMN kind TEXT DEFAULT 'product'`);
    if (!hasColumn(db, table, 'modality')) db.exec(`ALTER TABLE ${table} ADD COLUMN modality TEXT`);
    if (!hasColumn(db, table, 'purpose')) db.exec(`ALTER TABLE ${table} ADD COLUMN purpose TEXT`);
    if (!hasColumn(db, table, 'goal_cents')) db.exec(`ALTER TABLE ${table} ADD COLUMN goal_cents INTEGER`);
  }
  db.exec("UPDATE drafts SET kind = 'product' WHERE kind IS NULL");
  db.exec("UPDATE products SET kind = 'product' WHERE kind IS NULL");
  db.prepare("INSERT INTO meta (key, value) VALUES ('migration', '3') ON CONFLICT (key) DO UPDATE SET value = '3'").run();
}

// Migración 5 (Fase 5, no destructiva): apoyos como intenciones o
// simulaciones. Sin dinero recibido, sin datos de pago, sin emails.
function migrate5(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS supports (
    id TEXT PRIMARY KEY, initiative_id TEXT NOT NULL, kind TEXT NOT NULL,
    amount_cents INTEGER, message TEXT, nickname TEXT,
    status TEXT NOT NULL DEFAULT 'expressed', created_at TEXT NOT NULL
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_supports_initiative ON supports(initiative_id)');
  db.prepare("INSERT INTO meta (key, value) VALUES ('migration', '5') ON CONFLICT (key) DO UPDATE SET value = '5'").run();
}

export function openDb(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema'").get();
  if (!row) db.prepare("INSERT INTO meta (key, value) VALUES ('schema', '1')").run();
  if (!db.prepare("SELECT value FROM meta WHERE key = 'ai_enabled'").get()) {
    db.prepare("INSERT INTO meta (key, value) VALUES ('ai_enabled', '0')").run();
  }
  migrate2(db);
  migrate3(db);
  migrate5(db);
  return db;
}

export const nowIso = () => new Date().toISOString();

export function audit(db, actor, action, entity, detail = '') {
  db.prepare('INSERT INTO audit (at, actor, action, entity, detail) VALUES (?, ?, ?, ?, ?)').run(
    nowIso(), actor, action, entity, String(detail).slice(0, 500),
  );
}
