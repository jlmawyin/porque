// Genera el secreto del vendedor en .env (privado, no versionado).
// No muestra el valor: informa solo presencia y longitud.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV = join(ROOT, '.env');
const force = process.argv.includes('--force');

let current = '';
if (existsSync(ENV)) {
  const m = /^PORQUE_SELLER_SECRET=(.*)$/m.exec(readFileSync(ENV, 'utf8'));
  if (m) current = m[1].trim();
}
if (current && !force) {
  console.log(`.env ya contiene secreto (longitud ${current.length}). Usa --force para rotar.`);
  process.exit(0);
}
const secret = randomBytes(36).toString('base64url');
let body = existsSync(ENV) ? readFileSync(ENV, 'utf8') : '';
if (/^PORQUE_SELLER_SECRET=/m.test(body)) {
  body = body.replace(/^PORQUE_SELLER_SECRET=.*$/m, `PORQUE_SELLER_SECRET=${secret}`);
} else {
  if (body && !body.endsWith('\n')) body += '\n';
  body += `PORQUE_SELLER_SECRET=${secret}\n`;
}
writeFileSync(ENV, body, { mode: 0o600 });
console.log(`Secreto generado en .env (longitud ${secret.length}). No lo compartas ni lo subas al repo.`);
