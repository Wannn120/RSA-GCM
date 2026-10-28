'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateKeyPairFromPrimes,
  encryptBlocks,
  decryptBlocks,
  decryptBlocksCrt
} = require('../src/rsa');
const { encodeText, decodeText } = require('../src/message-codec');

// Uji batas untuk memastikan key generation RSA menghasilkan nilai yang diharapkan.
test('key generation contoh RSA menghasilkan nilai yang diharapkan', () => {
  const pair = generateKeyPairFromPrimes(61n, 53n, 17n);
  assert.equal(pair.details.n, 3233n);
  assert.equal(pair.details.phi, 3120n);
  assert.equal(pair.details.d, 2753n);
});

// Uji batas untuk memastikan enkripsi dan dekripsi RSA menghasilkan plaintext yang sama.
test('teks kembali sama setelah enkripsi dan dekripsi', () => {
  const pair = generateKeyPairFromPrimes(61n, 53n, 17n);
  const message = 'MATDIS';
  const cipher = encryptBlocks(encodeText(message), pair.publicKey);
  const restored = decodeText(decryptBlocks(cipher, pair.privateKey));
  assert.equal(restored, message);
});

// Uji batas untuk memastikan dekripsi RSA-CRT menghasilkan plaintext yang sama dengan dekripsi RSA biasa.
test('dekripsi RSA-CRT menghasilkan plaintext yang sama dengan dekripsi RSA biasa', () => {
  const pair = generateKeyPairFromPrimes(61n, 53n, 17n);
  const message = 'Uji CRT 🎓';
  const cipher = encryptBlocks(encodeText(message), pair.publicKey);
  const standard = decodeText(decryptBlocks(cipher, pair.privateKey));
  const crt = decodeText(decryptBlocksCrt(cipher, pair.privateKey, pair.details.p, pair.details.q));
  assert.equal(crt, standard);
  assert.equal(crt, message);
});

// Uji batas untuk memastikan dekripsi RSA-CRT menolak faktor yang tidak sesuai dengan modulus.
test('dekripsi RSA-CRT menolak faktor yang tidak sesuai dengan modulus', () => {
  const pair = generateKeyPairFromPrimes(61n, 53n, 17n);
  const cipher = encryptBlocks([65n], pair.publicKey);
  assert.throws(() => decryptBlocksCrt(cipher, pair.privateKey, 61n, 59n), /p × q = n/);
});

// Uji batas untuk memastikan dekripsi RSA-CRT menolak faktor yang bukan prima.
test('menolak p yang bukan prima', () => {
  assert.throws(() => generateKeyPairFromPrimes(60n, 53n, 17n));
});
