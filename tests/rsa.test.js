'use strict';

// File test ini memvalidasi fungsi inti RSA yang ada di src/rsa.js.
// Tujuan utamanya adalah memastikan algoritma menghasilkan nilai yang benar,
// mengembalikan plaintext yang sama saat round-trip, dan menolak input yang invalid.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateKeyPairFromPrimes,
  encryptBlocks,
  decryptBlocks,
  decryptBlocksCrt
} = require('../src/rsa');
const { encodeText, decodeText } = require('../src/message-codec');

// Uji ini memastikan generator kunci RSA untuk p=61, q=53, e=17 menghasilkan param yang benar.
// Nilai hasil yang diharapkan ini sangat berguna sebagai referensi saat membandingkan kunci manual.
test('key generation contoh RSA menghasilkan nilai yang diharapkan', () => {
  const pair = generateKeyPairFromPrimes(61n, 53n, 17n);
  assert.equal(pair.details.n, 3233n);
  assert.equal(pair.details.phi, 3120n);
  assert.equal(pair.details.d, 2753n);
});

// Uji ini memeriksa apakah enkripsi dan dekripsi RSA mengembalikan pesan asli.
// Prosesnya: string -> blok numerik -> enkripsi -> dekripsi -> string lagi.
test('teks kembali sama setelah enkripsi dan dekripsi', () => {
  const pair = generateKeyPairFromPrimes(61n, 53n, 17n);
  const message = 'MATDIS';
  const cipher = encryptBlocks(encodeText(message), pair.publicKey);
  const restored = decodeText(decryptBlocks(cipher, pair.privateKey));
  assert.equal(restored, message);
});

// Uji ini membandingkan hasil dekripsi RSA biasa dengan dekripsi CRT pada data yang sama.
// Jika kedua hasil sama, maka implementasi CRT benar dan tidak merusak plaintext.
test('dekripsi RSA-CRT menghasilkan plaintext yang sama dengan dekripsi RSA biasa', () => {
  const pair = generateKeyPairFromPrimes(61n, 53n, 17n);
  const message = 'Uji CRT 🎓';
  const cipher = encryptBlocks(encodeText(message), pair.publicKey);
  const standard = decodeText(decryptBlocks(cipher, pair.privateKey));
  const crt = decodeText(decryptBlocksCrt(cipher, pair.privateKey, pair.details.p, pair.details.q));
  assert.equal(crt, standard);
  assert.equal(crt, message);
});

// Uji ini memastikan fungsi CRT menolak kombinasi faktor p dan q yang tidak cocok dengan n.
// Jika faktor tidak valid, pemanggilan harus melempar error dan tidak menghasilkan hasil salah.
test('dekripsi RSA-CRT menolak faktor yang tidak sesuai dengan modulus', () => {
  const pair = generateKeyPairFromPrimes(61n, 53n, 17n);
  const cipher = encryptBlocks([65n], pair.publicKey);
  assert.throws(() => decryptBlocksCrt(cipher, pair.privateKey, 61n, 59n), /p × q = n/);
});

// Uji ini memastikan generator kunci menolak input yang bukan bilangan prima.
// Ini penting supaya p dan q yang dipakai benar-benar memenuhi syarat matematika RSA.
test('menolak p yang bukan prima', () => {
  assert.throws(() => generateKeyPairFromPrimes(60n, 53n, 17n));
});
