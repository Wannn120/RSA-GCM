'use strict';

const { gcdTrace, extendedGcd, modPowTrace } = require('./math');
const { generateKeyPairFromPrimes } = require('./rsa');

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

function traceEncryptBlock(message, publicKey) {
  return modPowTrace(message, publicKey.e, publicKey.n);
}

function traceDecryptBlock(cipher, privateKey) {
  return modPowTrace(cipher, privateKey.d, privateKey.n);
}

module.exports = { traceKeyGeneration, traceEncryptBlock, traceDecryptBlock };
