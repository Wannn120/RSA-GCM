'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { gcd, extendedGcd, modInverse, modPow } = require('../lib/math');

// Uji batas untuk memastikan fungsi matematika dasar bekerja dengan benar.
test('gcd Euclid menghasilkan pembagi bersama terbesar', () => {
  assert.equal(gcd(48n, 18n), 6n);
});

// Uji batas untuk memastikan extended gcd menghasilkan identitas Bezout.
test('extended gcd memenuhi identitas Bezout', () => {
  const r = extendedGcd(17n, 3120n);
  assert.equal(r.gcd, 1n);
  assert.equal(17n * r.x + 3120n * r.y, 1n);
});

// Uji batas untuk memastikan mod inverse bekerja dengan benar.
test('mod inverse RSA klasik benar', () => {
  assert.equal(modInverse(17n, 3120n), 2753n);
});

// Uji batas untuk memastikan mod inverse menolak jika tidak ada invers.
test('modPow square and multiply benar', () => {
  assert.equal(modPow(65n, 17n, 3233n), 2790n);
});
