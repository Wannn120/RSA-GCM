'use strict';

/*
  Kumpulan fungsi matematika dasar untuk RSA.
  Semua hitungan memakai BigInt agar bilangan bulat tidak kehilangan presisi.
  Tidak ada library eksternal yang dipakai.
*/

function toBigInt(value, name = 'nilai') {
  try {
    return typeof value === 'bigint' ? value : BigInt(value);
  } catch {
    throw new TypeError(`${name} harus berupa bilangan bulat yang valid.`);
  }
}

function abs(n) {
  n = toBigInt(n);
  return n < 0n ? -n : n;
}

function gcd(a, b) {
  a = abs(a);
  b = abs(b);
  while (b !== 0n) {
    const sisa = a % b;
    a = b;
    b = sisa;
  }
  return a;
}

function gcdTrace(a, b) {
  a = abs(a);
  b = abs(b);
  const steps = [];
  while (b !== 0n) {
    const q = a / b;
    const r = a % b;
    steps.push({ a, b, q, r });
    a = b;
    b = r;
  }
  return { gcd: a, steps };
}

function extendedGcd(a, b) {
  a = toBigInt(a);
  b = toBigInt(b);

  let oldR = a;
  let r = b;
  let oldS = 1n;
  let s = 0n;
  let oldT = 0n;
  let t = 1n;
  const steps = [];

  while (r !== 0n) {
    const q = oldR / r;
    steps.push({ q, oldR, r, oldS, s, oldT, t });
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
    [oldT, t] = [t, oldT - q * t];
  }

  if (oldR < 0n) {
    oldR = -oldR;
    oldS = -oldS;
    oldT = -oldT;
  }

  return { gcd: oldR, x: oldS, y: oldT, steps };
}

function mod(n, m) {
  n = toBigInt(n);
  m = toBigInt(m);
  if (m === 0n) throw new RangeError('Modulus tidak boleh 0.');
  const r = n % m;
  return r < 0n ? r + abs(m) : r;
}

function modInverse(a, m) {
  a = toBigInt(a);
  m = toBigInt(m);
  if (m <= 1n) throw new RangeError('Modulus invers harus lebih besar dari 1.');
  const result = extendedGcd(a, m);
  if (result.gcd !== 1n) {
    throw new RangeError(`Invers modulo tidak ada karena gcd(${a}, ${m}) = ${result.gcd}.`);
  }
  return mod(result.x, m);
}

function modPow(base, exponent, modulus) {
  base = toBigInt(base);
  exponent = toBigInt(exponent);
  modulus = toBigInt(modulus);
  if (modulus <= 0n) throw new RangeError('Modulus harus positif.');
  if (exponent < 0n) throw new RangeError('Eksponen tidak boleh negatif.');

  let result = 1n;
  base = mod(base, modulus);

  while (exponent > 0n) {
    if (exponent % 2n === 1n) result = (result * base) % modulus;
    exponent /= 2n;
    base = (base * base) % modulus;
  }
  return result;
}

function modPowTrace(base, exponent, modulus) {
  base = toBigInt(base);
  exponent = toBigInt(exponent);
  modulus = toBigInt(modulus);
  if (modulus <= 0n) throw new RangeError('Modulus harus positif.');
  if (exponent < 0n) throw new RangeError('Eksponen tidak boleh negatif.');

  let result = 1n;
  let currentBase = mod(base, modulus);
  let currentExponent = exponent;
  const steps = [];

  while (currentExponent > 0n) {
    const bit = currentExponent % 2n;
    const before = result;
    if (bit === 1n) result = (result * currentBase) % modulus;
    steps.push({
      exponent: currentExponent,
      bit,
      base: currentBase,
      resultBefore: before,
      resultAfter: result
    });
    currentExponent /= 2n;
    currentBase = (currentBase * currentBase) % modulus;
  }
  return { result, steps };
}

function lcm(a, b) {
  a = toBigInt(a);
  b = toBigInt(b);
  if (a === 0n || b === 0n) return 0n;
  return abs((a / gcd(a, b)) * b);
}

module.exports = {
  toBigInt,
  abs,
  gcd,
  gcdTrace,
  extendedGcd,
  mod,
  modInverse,
  modPow,
  modPowTrace,
  lcm
};
