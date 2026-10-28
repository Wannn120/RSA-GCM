'use strict';

const { gcd, modInverse, modPow, toBigInt } = require('./math');
const { isPrimeTrial } = require('./primality');

function choosePublicExponent(phi, preferred = 65537n) {
  phi = toBigInt(phi);
  preferred = toBigInt(preferred);
  if (preferred > 1n && preferred < phi && gcd(preferred, phi) === 1n) return preferred;

  for (let e = 3n; e < phi; e += 2n) {
    if (gcd(e, phi) === 1n) return e;
  }
  throw new RangeError('Tidak menemukan e yang relatif prima terhadap phi(n).');
}

function generateKeyPairFromPrimes(p, q, requestedE) {
  p = toBigInt(p, 'p');
  q = toBigInt(q, 'q');
  if (!isPrimeTrial(p)) throw new RangeError(`p = ${p} bukan bilangan prima.`);
  if (!isPrimeTrial(q)) throw new RangeError(`q = ${q} bukan bilangan prima.`);
  if (p === q) throw new RangeError('p dan q harus berbeda.');

  const n = p * q;
  const phi = (p - 1n) * (q - 1n);
  const e = requestedE === undefined || requestedE === null || requestedE === ''
    ? choosePublicExponent(phi)
    : toBigInt(requestedE, 'e');

  if (e <= 1n || e >= phi) throw new RangeError('e harus memenuhi 1 < e < phi(n).');
  if (gcd(e, phi) !== 1n) throw new RangeError(`e harus relatif prima dengan phi(n). gcd(${e}, ${phi}) bukan 1.`);

  const d = modInverse(e, phi);
  return {
    publicKey: { e, n },
    privateKey: { d, n },
    details: { p, q, n, phi, e, d }
  };
}

function encryptNumber(message, publicKey) {
  const m = toBigInt(message, 'message');
  const { e, n } = publicKey;
  if (m < 0n || m >= n) throw new RangeError(`Blok pesan harus berada pada 0 <= m < n. Nilai m = ${m}, n = ${n}.`);
  return modPow(m, e, n);
}

function decryptNumber(cipher, privateKey) {
  const c = toBigInt(cipher, 'cipher');
  const { d, n } = privateKey;
  if (c < 0n || c >= n) throw new RangeError(`Cipher harus berada pada 0 <= c < n. Nilai c = ${c}, n = ${n}.`);
  return modPow(c, d, n);
}

function encryptBlocks(blocks, publicKey) {
  return blocks.map(block => encryptNumber(block, publicKey));
}

function decryptBlocks(blocks, privateKey) {
  return blocks.map(block => decryptNumber(block, privateKey));
}

function signNumber(message, privateKey) {
  const m = toBigInt(message);
  if (m < 0n || m >= privateKey.n) throw new RangeError('Pesan untuk tanda tangan harus lebih kecil dari n.');
  return modPow(m, privateKey.d, privateKey.n);
}

function verifyNumber(message, signature, publicKey) {
  const recovered = modPow(signature, publicKey.e, publicKey.n);
  return recovered === toBigInt(message);
}

module.exports = {
  choosePublicExponent,
  generateKeyPairFromPrimes,
  encryptNumber,
  decryptNumber,
  encryptBlocks,
  decryptBlocks,
  signNumber,
  verifyNumber
};
