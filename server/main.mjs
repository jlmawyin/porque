// Porque — mismo origen: API + PWA estática. Sin dependencias.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.mjs';
import { loadSellerSecret, ensureSeller } from './auth.mjs';
import { createRouter } from './api.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const AI_COVER_RE = /^\/img\/ai\/([0-9a-f-]+\.(?:png|jpe?g))$/;

function serveStatic(req, res, imgDir) {
  const url = new URL(req.url, 'http://local');
  const mAi = AI_COVER_RE.exec(url.pathname);
  if (mAi) {
    const path = join(imgDir, mAi[1]);
    if (!existsSync(path)) return false;
    res.writeHead(200, {
      'content-type': mAi[1].endsWith('.png') ? 'image/png' : 'image/jpeg',
      'cache-control': 'public, max-age=31536000, immutable',
    });
    res.end(readFileSync(path));
    return true;
  }
  let rel;
  if (url.pathname === '/') rel = 'web/index.html';
  else if (url.pathname === '/panel') rel = 'web/panel.html';
  else if (url.pathname.startsWith('/p/')) rel = 'web/index.html';
  else if (url.pathname.startsWith('/i/')) rel = 'web/initiative.html';
  else if (url.pathname.startsWith('/shared/')) rel = normalize(url.pathname.slice(1));
  else rel = normalize(join('web', url.pathname));
  if (!rel.startsWith('web') && !rel.startsWith('shared')) {
    res.writeHead(403).end();
    return true;
  }
  const path = join(ROOT, rel);
  if (!existsSync(path)) return false;
  res.writeHead(200, {
    'content-type': MIME[extname(path)] ?? 'application/octet-stream',
    'cache-control': 'no-cache',
  });
  res.end(readFileSync(path));
  return true;
}

export function createApp({ dbPath, publicBase = '', secret, imgDir, metaFetch } = {}) {
  const resolvedDb = dbPath ?? join(ROOT, 'data', 'porque.sqlite');
  const db = openDb(resolvedDb);
  const sellerSecret = secret ?? loadSellerSecret({ file: join(ROOT, 'data', '.secret') });
  ensureSeller(db, sellerSecret);
  const resolvedImgDir = imgDir ?? join(dirname(resolvedDb), 'img-ai');
  const router = createRouter(db, { publicBase, imgDir: resolvedImgDir, metaFetch });
  const server = createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && !req.url.startsWith('/api/')) {
        if (serveStatic(req, res, resolvedImgDir)) return;
        res.writeHead(404).end('no encontrado');
        return;
      }
      if (!req.url.startsWith('/api/')) {
        res.writeHead(404).end('no encontrado');
        return;
      }
      await router(req, res);
    } catch (e) {
      // Nunca volcar secretos ni trazas con datos: mensaje acotado.
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'INTERNAL', detail: 'error interno' }));
      }
    }
  });
  return { server, db };
}

const invoked = process.argv[1] ? normalize(process.argv[1]) : '';
const selfPath = normalize(fileURLToPath(import.meta.url));
const isMain = invoked === selfPath || invoked.toLowerCase() === selfPath.toLowerCase();
if (isMain) {
  loadEnvFile(join(ROOT, '.env'));
  const port = Number(process.env.PORT ?? 4177);
  const { server } = createApp({ publicBase: process.env.PUBLIC_BASE_URL ?? process.env.PUBLIC_BASE ?? '' });
  server.listen(port, () => {
    console.log(`Porque en http://127.0.0.1:${port} (panel: /panel)`);
  });
}
