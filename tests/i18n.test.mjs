// i18n (Fase 3): prioridad de idioma y paridad de diccionarios.
// Sin DOM: resolveLang/t son puros y se prueban en Node.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLang, t, modalityName, STRINGS } from '../web/i18n.mjs';

describe('i18n (Fase 3)', () => {
  it('prioridad: ?lang válido → guardada → navegador → español', () => {
    assert.equal(resolveLang({ query: 'en', saved: 'es', nav: 'es-ES' }), 'en');
    assert.equal(resolveLang({ query: 'es', saved: 'en', nav: 'en-US' }), 'es');
    assert.equal(resolveLang({ query: 'fr', saved: 'en', nav: 'es-ES' }), 'en');
    assert.equal(resolveLang({ saved: 'en', nav: 'es-ES' }), 'en');
    assert.equal(resolveLang({ nav: 'en-US' }), 'en');
    assert.equal(resolveLang({ nav: 'es-MX' }), 'es');
    assert.equal(resolveLang({ nav: 'fr-FR' }), 'es');
    assert.equal(resolveLang({}), 'es');
    assert.equal(resolveLang({ query: 'EN' }), 'en');
    assert.equal(resolveLang(), 'es');
  });

  it('diccionarios es/en con las mismas claves', () => {
    const es = Object.keys(STRINGS.es).sort();
    const en = Object.keys(STRINGS.en).sort();
    assert.ok(es.length > 100, 'diccionario con contenido');
    assert.deepEqual(en, es);
    for (const k of es) {
      assert.equal(typeof STRINGS.es[k], 'string', `es.${k}`);
      assert.equal(typeof STRINGS.en[k], 'string', `en.${k}`);
    }
  });

  it('t interpola, cae al español y nunca vacía en silencio', () => {
    assert.equal(t('en', 'consultingAbout', { name: 'Miel' }), 'Inquiry about: Miel');
    assert.equal(t('es', 'consultingAbout', { name: 'Miel' }), 'Consulta sobre: Miel');
    assert.equal(t('fr', 'loading'), 'Cargando…');
    assert.equal(t('en', 'clave-inexistente'), 'clave-inexistente');
  });

  it('modalityName traduce por código, sin tocar contenidos', () => {
    assert.equal(modalityName('es', 'donations'), 'Donaciones');
    assert.equal(modalityName('en', 'donations'), 'Donations');
    assert.equal(modalityName('en', 'business'), 'Business');
    assert.equal(modalityName('en', 'both'), 'Both');
    assert.equal(modalityName('en', 'otra'), 'Not set');
    assert.equal(modalityName('es', null), 'Sin definir');
  });
});
