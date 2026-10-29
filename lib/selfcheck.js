'use strict';

const assert = require('assert');
const { gcd, modInverse, modPow } = require('./math');
const { isPrimeTrial } = require('./primality');
const { generateKeyPairFromPrimes, encryptBlocks, decryptBlocks } = require('./rsa');
const { encodeText, decodeText } = require('./message-codec');

// Uji batas untuk memastikan seluruh pemeriksaan utama berjalan dengan benar.
function runSelfCheck() {
  assert.strictEqual(gcd(48n, 18n), 6n); // Uji batas untuk memastikan gcd bekerja dengan benar.
  assert.strictEqual(modInverse(17n, 3120n), 2753n); // Uji batas untuk memastikan mod inverse bekerja dengan benar.
  assert.strictEqual(modPow(65n, 17n, 3233n), 2790n); // Uji batas untuk memastikan modPow bekerja dengan benar.
  assert.strictEqual(isPrimeTrial(61n), true); // 61 adalah bilangan prima.
  assert.strictEqual(isPrimeTrial(63n), false); // 63 = 7 × 9, bukan prima.

  const pair = generateKeyPairFromPrimes(61n, 53n, 17n); // Uji batas untuk memastikan key generation RSA menghasilkan nilai yang diharapkan.
  assert.strictEqual(pair.details.n, 3233n); // 61 × 53 = 3233
  assert.strictEqual(pair.details.phi, 3120n); // (61 - 1) × (53 - 1) = 60 × 52 = 3120
  assert.strictEqual(pair.details.d, 2753n); // d adalah invers dari e mod phi, yaitu 17 × 2753 ≡ 1 (mod 3120)

  const text = 'Halo Matdis';
  const encrypted = encryptBlocks(encodeText(text), pair.publicKey); // Uji batas untuk memastikan enkripsi dan dekripsi RSA menghasilkan plaintext yang sama.
  const decrypted = decryptBlocks(encrypted, pair.privateKey); // Uji batas untuk memastikan dekripsi RSA menghasilkan plaintext yang sama dengan plaintext asli.
  assert.strictEqual(decodeText(decrypted), text);

  console.log('Self-check berhasil: seluruh pemeriksaan utama lolos.');
}

if (require.main === module) runSelfCheck();
module.exports = { runSelfCheck };
