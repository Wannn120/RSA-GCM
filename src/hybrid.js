'use strict';

const { encryptNumber, decryptNumber, decryptNumberCrt } = require('./rsa');
const { generateAesKey, encryptAesGcm, decryptAesGcm } = require('./aes-gcm');

// Panjang kunci AES-256 dalam byte; setiap elemen nantinya satu blok RSA pendidikan.
const KEY_BYTES = 32;

// Hybrid menggabungkan RSA untuk kunci sesi dan AES-GCM untuk isi pesan.
function hybridEncrypt(text, publicKey) {
  // RSA textbook hanya dapat membungkus sebuah byte jika n lebih besar dari 255.
  if (publicKey.n <= 255n) {
    throw new RangeError('n RSA harus lebih besar dari 255 untuk membungkus byte kunci AES.');
  }

  // Buat kunci AES baru untuk pesan ini, lalu enkripsi payload simetris.
  const key = generateAesKey();
  const encrypted = encryptAesGcm(text, key);
  // Modulus contoh terlalu kecil untuk satu kunci 256-bit, jadi enkripsi tiap byte.
  const wrappedKey = Array.from(key, byte => encryptNumber(BigInt(byte), publicKey));

  // Kirim metadata AES bersama kunci AES yang sudah dibungkus RSA.
  return { ...encrypted, wrappedKey };
}

// Penerima membuka byte kunci dengan RSA sebelum meminta AES-GCM memeriksa tag.
function hybridDecrypt(payload, privateKey) {
  // Pastikan payload punya semua blok byte untuk menyusun ulang kunci 32-byte.
  if (!payload || !Array.isArray(payload.wrappedKey) || payload.wrappedKey.length !== KEY_BYTES) {
    throw new TypeError(`wrappedKey harus berisi ${KEY_BYTES} blok RSA.`);
  }

  // Tiap blok RSA dipulihkan ke byte; nilai di luar rentang menandakan payload/key salah.
  const key = Buffer.from(payload.wrappedKey.map((block, index) => {
    const byte = decryptNumber(block, privateKey);
    if (byte < 0n || byte > 255n) {
      throw new RangeError(`Blok kunci AES ke-${index} bukan byte yang valid.`);
    }
    return Number(byte);
  }));

  // GCM memeriksa authentication tag sebelum plaintext dapat dianggap valid.
  return { text: decryptAesGcm(payload, key) };
}

// Varian ini mengubah hanya operasi RSA private-key; isi pesan tetap dibuka dengan AES-GCM.
function hybridDecryptCrt(payload, privateKey, p, q) {
  if (!payload || !Array.isArray(payload.wrappedKey) || payload.wrappedKey.length !== KEY_BYTES) {
    throw new TypeError(`wrappedKey harus berisi ${KEY_BYTES} blok RSA.`);
  }

  // Pulihkan setiap byte kunci AES memakai dua eksponensial kecil dan rekombinasi CRT.
  const key = Buffer.from(payload.wrappedKey.map((block, index) => {
    const byte = decryptNumberCrt(block, privateKey, p, q);
    if (byte < 0n || byte > 255n) {
      throw new RangeError(`Blok kunci AES ke-${index} bukan byte yang valid.`);
    }
    return Number(byte);
  }));

  return { text: decryptAesGcm(payload, key) };
}

module.exports = { hybridEncrypt, hybridDecrypt, hybridDecryptCrt };
