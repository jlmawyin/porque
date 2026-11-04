import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePriceEsToCents, totalCents } from '../shared/contracts.mjs';

describe('importes en centavos (servidor)', () => {
  it('palabras en español', () => {
    assert.equal(parsePriceEsToCents('Galletas, cinco dólares'), 500);
    assert.equal(parsePriceEsToCents('un dólar'), 100);
    assert.equal(parsePriceEsToCents('doce dolares'), 1200);
    assert.equal(parsePriceEsToCents('veinticinco dólares'), 2500);
  });
  it('cifras con decimales', () => {
    assert.equal(parsePriceEsToCents('5 dólares'), 500);
    assert.equal(parsePriceEsToCents('5.50 USD'), 550);
    assert.equal(parsePriceEsToCents('5,5 dólares'), 550);
  });
  it('sin importe claro: null', () => {
    assert.equal(parsePriceEsToCents('galletas ricas'), null);
    assert.equal(parsePriceEsToCents('cinco'), null);
    assert.equal(parsePriceEsToCents(''), null);
  });
  it('totales enteros y rechazo de abusos', () => {
    assert.equal(totalCents([{ priceCents: 500, qty: 2 }, { priceCents: 150, qty: 1 }]), 1150);
    assert.throws(() => totalCents([{ priceCents: -5, qty: 1 }]));
    assert.throws(() => totalCents([{ priceCents: 5.5, qty: 1 }]));
    assert.throws(() => totalCents([{ priceCents: 5, qty: 0 }]));
  });
});
