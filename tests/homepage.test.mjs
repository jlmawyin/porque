import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helper.mjs';

// La caja demo del evento ficticio vive en la portada servida.
describe('portada: caja demo evento ficticio', async () => {
  const t = await startTestServer();
  after(() => t.close());

  it('incluye sección demo con simulación explícita (ES por defecto)', async () => {
    const html = await (await fetch(t.base + '/')).text();
    assert.match(html, /id="demo-evento"/);
    assert.match(html, /data-i18n="demoEventBadge"/);
    assert.match(html, /DEMOSTRACIÓN · Evento ficticio/);
    assert.match(html, /id="demo-btn-donar"/);
    assert.match(html, /id="demo-btn-apoyar"/);
    assert.match(html, /id="demo-link-2"/);
    assert.match(html, /no mueve dinero real ni crea registros/);
  });

  it('todas las claves data-i18n de la portada existen en ES y EN', async () => {
    const html = await (await fetch(t.base + '/')).text();
    const keys = new Set([...html.matchAll(/data-i18n(?:-aria|-alt|-ph)?="(\w+)"/g)].map((m) => m[1]));
    assert.ok(keys.size > 10);
    const src = await (await fetch(t.base + '/i18n.mjs')).text();
    for (const k of keys) {
      const hits = src.split(`${k}:`).length - 1;
      assert.ok(hits >= 2, `clave ${k} sin par ES/EN`);
    }
  });
});
