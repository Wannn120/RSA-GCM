'use strict';

// File ini memuat inti algoritma RSA dan operasi pendukung untuk enkripsi/dekripsi blok numerik.
// Semua fungsi selanjutnya dipakai oleh GUI dan test untuk melihat bagaimana RSA bekerja secara edukatif.
const { gcd, mod, modInverse, modPow, toBigInt } = require('./math');
const { isPrimeTrial } = require('./primality');

// Membuat eksponen publik e yang relatif prima terhadap phi(n), sehingga invers modular d ada.
// Jika user tidak memberi nilai e, program akan memilih e default yang aman untuk pembelajaran.
function choosePublicExponent(phi, preferred = 65537n) {
  phi = toBigInt(phi);
  preferred = toBigInt(preferred);
  if (preferred > 1n && preferred < phi && gcd(preferred, phi) === 1n) return preferred;

  for (let e = 3n; e < phi; e += 2n) {
    if (gcd(e, phi) === 1n) return e;
  }
  throw new RangeError('Tidak menemukan e yang relatif prima terhadap phi(n).');
}

// Membentuk pasangan kunci RSA dari p dan q yang diketahui.
// Fungsi ini mengembalikan publicKey, privateKey, dan detail matematis seperti n dan phi(n).
function generateKeyPairFromPrimes(p, q, requestedE) {
  // Konversi input ke BigInt agar semua operasi berikutnya tetap presisi tanpa floating point.
  p = toBigInt(p, 'p');
  q = toBigInt(q, 'q');
  // RSA hanya valid jika p dan q adalah bilangan prima berbeda.
  if (!isPrimeTrial(p)) throw new RangeError(`p = ${p} bukan bilangan prima.`);
  if (!isPrimeTrial(q)) throw new RangeError(`q = ${q} bukan bilangan prima.`);
  if (p === q) throw new RangeError('p dan q harus berbeda.');

  // n adalah modulus yang dipakai untuk enkripsi dan dekripsi; phi(n) dibutuhkan untuk mencari d.
  const n = p * q;
  const phi = (p - 1n) * (q - 1n);
  // Jika user tidak memberi e, pilih secara otomatis; jika diberi, pakai nilai tersebut.
  const e = requestedE === undefined || requestedE === null || requestedE === ''
    ? choosePublicExponent(phi)
    : toBigInt(requestedE, 'e');

  // Eksponen publik harus valid dan relatif prima terhadap phi(n), supaya invers modulo ada.
  if (e <= 1n || e >= phi) throw new RangeError('e harus memenuhi 1 < e < phi(n).');
  if (gcd(e, phi) !== 1n) throw new RangeError(`e harus relatif prima dengan phi(n). gcd(${e}, ${phi}) bukan 1.`);

  // d adalah invers modular dari e terhadap phi(n), sehingga e*d ≡ 1 mod phi(n).
  const d = modInverse(e, phi);
  return {
    publicKey: { e, n },
    privateKey: { d, n },
    details: { p, q, n, phi, e, d }
  };
}

// Enkripsi RSA untuk satu blok angka m mengikuti rumus c = m^e mod n.
// Blok pesan harus berada pada rentang 0 <= m < n agar valid untuk teksbook RSA.
function encryptNumber(message, publicKey) {
  const m = toBigInt(message, 'message');
  const { e, n } = publicKey;
  if (m < 0n || m >= n) throw new RangeError(`Blok pesan harus berada pada 0 <= m < n. Nilai m = ${m}, n = ${n}.`);
  return modPow(m, e, n);
}

// Dekripsi RSA untuk satu blok angka c mengikuti rumus m = c^d mod n.
function decryptNumber(cipher, privateKey) {
  const c = toBigInt(cipher, 'cipher');
  const { d, n } = privateKey;
  if (c < 0n || c >= n) throw new RangeError(`Cipher harus berada pada 0 <= c < n. Nilai c = ${c}, n = ${n}.`);
  return modPow(c, d, n);
}

// RSA-CRT mempercepat dekripsi dengan membagi nilai modulo n menjadi dua faktor p dan q.
// Dengan CRT, dekripsi dilakukan terhadap modulo p dan q lalu digabungkan kembali.
function decryptNumberCrt(cipher, privateKey, p, q) {
  const c = toBigInt(cipher, 'cipher');
  p = toBigInt(p, 'p');
  q = toBigInt(q, 'q');
  const { d, n } = privateKey;
  if (c < 0n || c >= n) throw new RangeError(`Cipher harus berada pada 0 <= c < n. Nilai c = ${c}, n = ${n}.`);
  if (p <= 1n || q <= 1n || p === q || p * q !== n) {
    throw new RangeError('Faktor CRT harus berupa p dan q berbeda dengan p × q = n.');
  }

  // Pada CRT, eksponen d dikurangi terhadap p-1 dan q-1 agar perhitungan kecil.
  const dp = mod(d, p - 1n);
  const dq = mod(d, q - 1n);
  // qInverse dipakai untuk menggabungkan sisa modulo p dan q menjadi satu hasil.
  const qInverse = modInverse(q, p);
  const m1 = modPow(c, dp, p);
  const m2 = modPow(c, dq, q);
  const h = mod(qInverse * (m1 - m2), p);
  return m2 + h * q;
}

// encryptBlocks menerapkan enkripsi RSA ke seluruh daftar blok dalam sebuah pesan.
function encryptBlocks(blocks, publicKey) {
  return blocks.map(block => encryptNumber(block, publicKey));
}

// decryptBlocks menerapkan dekripsi RSA biasa ke seluruh blok ciphertext.
function decryptBlocks(blocks, privateKey) {
  return blocks.map(block => decryptNumber(block, privateKey));
}

// decryptBlocksCrt menerapkan versi dekripsi cepat dengan CRT ke seluruh blok ciphertext.
function decryptBlocksCrt(blocks, privateKey, p, q) {
  return blocks.map(block => decryptNumberCrt(block, privateKey, p, q));
}

// signNumber adalah fungsi demonstrasi tanda tangan textbook, bukan tanda tangan produksi.
function signNumber(message, privateKey) {
  const m = toBigInt(message);
  if (m < 0n || m >= privateKey.n) throw new RangeError('Pesan untuk tanda tangan harus lebih kecil dari n.');
  return modPow(m, privateKey.d, privateKey.n);
}

// verifyNumber memeriksa apakah signature yang diberikan sesuai dengan message yang dipanggil.
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
