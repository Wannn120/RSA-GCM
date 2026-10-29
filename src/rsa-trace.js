'use strict';

// File rsa-trace.js menambahkan penjelasan langkah demi langkah untuk proses RSA.
// Ia tidak mengganti implementasi utama; ia hanya menghasilkan jejak matematis yang dapat
// ditampilkan di CLI atau GUI agar siswa bisa melihat bagaimana n, phi(n), e, dan d dihitung.
const { gcdTrace, extendedGcd, modPowTrace } = require('./math');
const { generateKeyPairFromPrimes } = require('./rsa');

// traceKeyGeneration membangkitkan pasangan kunci dan menyertakan semua langkah penjelasan.
function traceKeyGeneration(p, q, e) {
  const pair = generateKeyPairFromPrimes(p, q, e);
  const { phi } = pair.details;
  const gcdInfo = gcdTrace(pair.details.e, phi);
  const inverseInfo = extendedGcd(pair.details.e, phi);

  return {
    ...pair.details,
    gcdSteps: gcdInfo.steps,
    extendedGcd: inverseInfo,
    explanation: [
      `n = p × q = ${pair.details.p} × ${pair.details.q} = ${pair.details.n}`,
      `phi(n) = (p - 1) × (q - 1) = ${pair.details.phi}`,
      `e = ${pair.details.e} dipilih dengan syarat gcd(e, phi(n)) = 1`,
      `d adalah invers e modulo phi(n), sehingga e × d mod phi(n) = 1`,
      `d = ${pair.details.d}`
    ]
  };
}

// traceEncryptBlock menampilkan langkah per langkah operasi c = m^e mod n.
function traceEncryptBlock(message, publicKey) {
  return modPowTrace(message, publicKey.e, publicKey.n);
}

// traceDecryptBlock menampilkan langkah per langkah operasi m = c^d mod n.
function traceDecryptBlock(cipher, privateKey) {
  return modPowTrace(cipher, privateKey.d, privateKey.n);
}

module.exports = { traceKeyGeneration, traceEncryptBlock, traceDecryptBlock };
