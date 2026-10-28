'use strict';

const { gcd, mod, modInverse, modPow, toBigInt } = require('./math');
const { isPrimeTrial } = require('./primality');

// Pilih e default yang relatif prima terhadap phi supaya invers privat d selalu ada.
function choosePublicExponent(phi, preferred = 65537n) {
  phi = toBigInt(phi);
  preferred = toBigInt(preferred);
  if (preferred > 1n && preferred < phi && gcd(preferred, phi) === 1n) return preferred;

  for (let e = 3n; e < phi; e += 2n) {
    if (gcd(e, phi) === 1n) return e;
  }
  throw new RangeError('Tidak menemukan e yang relatif prima terhadap phi(n).');
}

// Bentuk kunci RSA dari p dan q yang sudah diketahui agar perhitungan bisa dipelajari.
function generateKeyPairFromPrimes(p, q, requestedE) {
  // Konversi di awal menjaga semua operasi berikutnya tetap memakai BigInt.
  p = toBigInt(p, 'p');
  q = toBigInt(q, 'q');
  // RSA mensyaratkan dua bilangan prima berbeda.
  if (!isPrimeTrial(p)) throw new RangeError(`p = ${p} bukan bilangan prima.`);
  if (!isPrimeTrial(q)) throw new RangeError(`q = ${q} bukan bilangan prima.`);
  if (p === q) throw new RangeError('p dan q harus berbeda.');

  // n menjadi modulus public/private key; phi dipakai untuk mencari pasangan e dan d.
  const n = p * q;
  const phi = (p - 1n) * (q - 1n);
  // Gunakan e yang diminta, atau pilih nilai default jika pemanggil tidak memberi e.
  const e = requestedE === undefined || requestedE === null || requestedE === ''
    ? choosePublicExponent(phi)
    : toBigInt(requestedE, 'e');

  // e harus berada di rentang valid dan memiliki invers modulo phi(n).
  if (e <= 1n || e >= phi) throw new RangeError('e harus memenuhi 1 < e < phi(n).');
  if (gcd(e, phi) !== 1n) throw new RangeError(`e harus relatif prima dengan phi(n). gcd(${e}, ${phi}) bukan 1.`);

  // d adalah invers e: e*d kongruen 1 modulo phi(n).
  const d = modInverse(e, phi);
  return {
    publicKey: { e, n },
    privateKey: { d, n },
    details: { p, q, n, phi, e, d }
  };
}

// Enkripsi RSA textbook untuk satu blok angka m: c = m^e mod n.
function encryptNumber(message, publicKey) {
  const m = toBigInt(message, 'message');
  const { e, n } = publicKey;
  if (m < 0n || m >= n) throw new RangeError(`Blok pesan harus berada pada 0 <= m < n. Nilai m = ${m}, n = ${n}.`);
  return modPow(m, e, n);
}

// Dekripsi RSA biasa untuk satu blok angka c: m = c^d mod n.
function decryptNumber(cipher, privateKey) {
  const c = toBigInt(cipher, 'cipher');
  const { d, n } = privateKey;
  if (c < 0n || c >= n) throw new RangeError(`Cipher harus berada pada 0 <= c < n. Nilai c = ${c}, n = ${n}.`);
  return modPow(c, d, n);
}

// CRT menghitung dua hasil modulo prima yang lebih kecil, lalu menyatukannya menjadi plaintext.
function decryptNumberCrt(cipher, privateKey, p, q) {
  const c = toBigInt(cipher, 'cipher');
  p = toBigInt(p, 'p');
  q = toBigInt(q, 'q');
  const { d, n } = privateKey;
  if (c < 0n || c >= n) throw new RangeError(`Cipher harus berada pada 0 <= c < n. Nilai c = ${c}, n = ${n}.`);
  if (p <= 1n || q <= 1n || p === q || p * q !== n) {
    throw new RangeError('Faktor CRT harus berupa p dan q berbeda dengan p × q = n.');
  }

  // Kurangi eksponen dengan Teorema Fermat sehingga kedua operasi pangkat lebih ringan.
  const dp = mod(d, p - 1n);
  const dq = mod(d, q - 1n);
  // qInverse memungkinkan residu modulo p dan q digabungkan kembali.
  const qInverse = modInverse(q, p);
  // Hitung plaintext pada masing-masing modulus prima.
  const m1 = modPow(c, dp, p);
  const m2 = modPow(c, dq, q);
  // Cari koreksi h agar m2 + h*q memiliki residu m1 modulo p.
  const h = mod(qInverse * (m1 - m2), p);
  // Hasil ini sekaligus memenuhi residu modulo p dan modulo q.
  return m2 + h * q;
}

// Terapkan enkripsi satu blok ke seluruh byte/angka pesan.
function encryptBlocks(blocks, publicKey) {
  return blocks.map(block => encryptNumber(block, publicKey));
}

// Terapkan dekripsi RSA biasa pada tiap blok ciphertext.
function decryptBlocks(blocks, privateKey) {
  return blocks.map(block => decryptNumber(block, privateKey));
}

// Terapkan dekripsi CRT ke tiap blok, memakai faktor prima pembentuk n.
function decryptBlocksCrt(blocks, privateKey, p, q) {
  return blocks.map(block => decryptNumberCrt(block, privateKey, p, q));
}

// Fungsi demonstrasi tanda tangan textbook untuk satu angka; bukan tanda tangan produksi.
function signNumber(message, privateKey) {
  const m = toBigInt(message);
  if (m < 0n || m >= privateKey.n) throw new RangeError('Pesan untuk tanda tangan harus lebih kecil dari n.');
  return modPow(m, privateKey.d, privateKey.n);
}

// Verifikasi mengembalikan signature ke ruang pesan menggunakan public key.
function verifyNumber(message, signature, publicKey) {
  const recovered = modPow(signature, publicKey.e, publicKey.n);
  return recovered === toBigInt(message);
}

module.exports = {
  choosePublicExponent,
  generateKeyPairFromPrimes,
  encryptNumber,
  decryptNumber,
  decryptNumberCrt,
  encryptBlocks,
  decryptBlocks,
  decryptBlocksCrt,
  signNumber,
  verifyNumber
};
