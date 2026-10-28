'use strict';

/*
  Kumpulan fungsi matematika dasar untuk RSA.
  Semua hitungan memakai BigInt agar bilangan bulat tidak kehilangan presisi.
  Tidak ada library eksternal yang dipakai.
*/

// Konversi ke BigInt dengan penanganan error
function toBigInt(value, name = 'nilai') {
  // Konversi terpusat agar input invalid mendapatkan error yang konsisten.
  try {
    return typeof value === 'bigint' ? value : BigInt(value);
  } catch {
    throw new TypeError(`${name} harus berupa bilangan bulat yang valid.`);
  }
}

function abs(n) {
  // Normalisasi tanda diperlukan oleh gcd dan fungsi modulo.
  n = toBigInt(n);
  return n < 0n ? -n : n;
}

function gcd(a, b) {
  // Algoritma Euclid mengganti (a,b) dengan (b, a mod b) sampai b habis.
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
  // Sama dengan gcd, tetapi setiap pembagian disimpan
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
  // Menghasilkan gcd dan koefisien x,y yang memenuhi a*x + b*y = gcd(a,b).
  a = toBigInt(a);
  b = toBigInt(b);

  // oldR/r adalah pasangan Euclid; oldS/s dan oldT/t adalah koefisien untuk a dan b.
  let oldR = a;
  let r = b;
  let oldS = 1n;
  let s = 0n;
  let oldT = 0n;
  let t = 1n;
  const steps = [];

  while (r !== 0n) {
    // q adalah hasil bagi; baris ini menjadi satu langkah tabel Extended Euclid.
    const q = oldR / r;
    steps.push({ q, oldR, r, oldS, s, oldT, t });
    // Terapkan relasi sisa baru, sekaligus perbarui koefisien Bezout yang sejalan.
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
  // Pastikan hasil selalu dalam bentuk residu non-negatif, termasuk untuk n negatif.
  n = toBigInt(n);
  m = toBigInt(m);
  if (m === 0n) throw new RangeError('Modulus tidak boleh 0.');
  const r = n % m;
  return r < 0n ? r + abs(m) : r;
}

function modInverse(a, m) {
  // Invers hanya ada jika gcd(a,m)=1; koefisien x Extended Euclid menjadi inversnya.
  a = toBigInt(a);
  m = toBigInt(m);
  if (m <= 1n) throw new RangeError('Modulus invers harus lebih besar dari 1.');
  const result = extendedGcd(a, m);
  if (result.gcd !== 1n) {
    throw new RangeError(`Invers modulo tidak ada karena gcd(${a}, ${m}) = ${result.gcd}.`);
  }
  return mod(result.x, m);
}

// Menghitung base^exponent (mod modulus)
function modPow(base, exponent, modulus) {
  // Ubah base, exponent, modulus ke BigInt
  base = toBigInt(base);
  exponent = toBigInt(exponent);
  modulus = toBigInt(modulus);
  // Pastikan modulus dan exponent valid
  if (modulus <= 0n) throw new RangeError('Modulus harus positif.');
  if (exponent < 0n) throw new RangeError('Eksponen tidak boleh negatif.');

  // Pangkat modular dihitung dari bit terbawah: kalikan bila ganjil, lalu kuadratkan base.
  let result = 1n;
  base = mod(base, modulus);

  // Loop hingga exponent habis
  while (exponent > 0n) {
    if (exponent % 2n === 1n) result = (result * base) % modulus;
    exponent /= 2n;
    base = (base * base) % modulus;
  }
  return result;
}

function modPowTrace(base, exponent, modulus) {
  // Versi berjejak menghasilkan jawaban sama dengan modPow sambil menyimpan tiap iterasi.
  base = toBigInt(base);
  exponent = toBigInt(exponent);
  modulus = toBigInt(modulus);
  if (modulus <= 0n) throw new RangeError('Modulus harus positif.');
  if (exponent < 0n) throw new RangeError('Eksponen tidak boleh negatif.');

  // currentExponent terus dibagi dua; currentBase dikuadratkan pada setiap putaran.
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
  // Bagi lebih dulu dengan gcd untuk mengurangi besaran perkalian antara.
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
