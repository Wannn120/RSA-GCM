'use strict';

const assert = require('assert');
const { gcd, modInverse, modPow } = require('./math');
const { isPrimeTrial } = require('./primality');
const { generateKeyPairFromPrimes, encryptBlocks, decryptBlocks } = require('./rsa');
const { encodeText, decodeText } = require('./message-codec');

function runSelfCheck() {
  assert.strictEqual(gcd(48n, 18n), 6n);
  assert.strictEqual(modInverse(17n, 3120n), 2753n);
  assert.strictEqual(modPow(65n, 17n, 3233n), 2790n);
  assert.strictEqual(isPrimeTrial(61n), true);
  assert.strictEqual(isPrimeTrial(63n), false);

  const pair = generateKeyPairFromPrimes(61n, 53n, 17n);
  assert.strictEqual(pair.details.n, 3233n);
  assert.strictEqual(pair.details.phi, 3120n);
  assert.strictEqual(pair.details.d, 2753n);

  const text = 'Halo Matdis';
  const encrypted = encryptBlocks(encodeText(text), pair.publicKey);
  const decrypted = decryptBlocks(encrypted, pair.privateKey);
  assert.strictEqual(decodeText(decrypted), text);

  console.log('Self-check berhasil: seluruh pemeriksaan utama lolos.');
}

if (require.main === module) runSelfCheck();
module.exports = { runSelfCheck };
