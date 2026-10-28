'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairFromPrimes, encryptBlocks, decryptBlocks } = require('../src/rsa');
const { encodeText, decodeText } = require('../src/message-codec');

test('key generation contoh RSA menghasilkan nilai yang diharapkan', () => {
  const pair = generateKeyPairFromPrimes(61n, 53n, 17n);
  assert.equal(pair.details.n, 3233n);
  assert.equal(pair.details.phi, 3120n);
  assert.equal(pair.details.d, 2753n);
});

test('teks kembali sama setelah enkripsi dan dekripsi', () => {
  const pair = generateKeyPairFromPrimes(61n, 53n, 17n);
  const message = 'MATDIS';
  const cipher = encryptBlocks(encodeText(message), pair.publicKey);
  const restored = decodeText(decryptBlocks(cipher, pair.privateKey));
  assert.equal(restored, message);
});

test('menolak p yang bukan prima', () => {
  assert.throws(() => generateKeyPairFromPrimes(60n, 53n, 17n));
});
