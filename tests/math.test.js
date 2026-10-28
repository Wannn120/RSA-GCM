'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { gcd, extendedGcd, modInverse, modPow } = require('../src/math');

test('gcd Euclid menghasilkan pembagi bersama terbesar', () => {
  assert.equal(gcd(48n, 18n), 6n);
});

test('extended gcd memenuhi identitas Bezout', () => {
  const r = extendedGcd(17n, 3120n);
  assert.equal(r.gcd, 1n);
  assert.equal(17n * r.x + 3120n * r.y, 1n);
});

test('mod inverse RSA klasik benar', () => {
  assert.equal(modInverse(17n, 3120n), 2753n);
});

test('modPow square and multiply benar', () => {
  assert.equal(modPow(65n, 17n, 3233n), 2790n);
});
