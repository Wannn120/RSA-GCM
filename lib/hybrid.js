'use strict';

// Skema hybrid adalah gabungan dua prinsip keamanan: RSA untuk membungkus kunci simetris,
// dan AES-GCM untuk mengenkripsi isi pesan. Dengan cara ini, kunci sesi tetap aman,
// sementara content data bisa dienkripsi dalam ukuran yang lebih efisien.
const { encryptNumber, decryptNumber, decryptNumberCrt } = require('./rsa');
const { generateAesKey, encryptAesGcm, decryptAesGcm } = require('./aes-gcm');

// Panjang kunci AES-256 dalam byte; setiap byte nanti dibungkus satu per satu oleh RSA.
const KEY_BYTES = 32;

// hybridEncrypt membangun payload hybrid: AES mengenkripsi pesan, RSA membungkus kunci simetris.
function hybridEncrypt(text, publicKey) {
  // RSA textbook hanya dapat membungkus satu byte jika modulus n lebih besar dari 255.
  if (publicKey.n <= 255n) {
    throw new RangeError('n RSA harus lebih besar dari 255 untuk membungkus byte kunci AES.');
  }

  // Buat kunci AES baru untuk pesan ini, lalu enkripsi payload menggunakan AES-GCM.
  const key = generateAesKey();
  const encrypted = encryptAesGcm(text, key);
  // Karena modulus demo biasanya kecil, langkah ini membungkus tiap byte kunci AES satu per satu.
  const wrappedKey = Array.from(key, byte => encryptNumber(BigInt(byte), publicKey));

  // Mengembalikan payload lengkap: metadata AES + kunci yang dilindungi RSA.
  return { ...encrypted, wrappedKey };
}

// hybridDecrypt membuka byte kunci RSA, lalu memakai hasilnya untuk memulihkan kunci AES.
// Setelah kunci kembali, AES-GCM akan memvalidasi tag autentikasi sebelum plaintext dikembalikan.
function hybridDecrypt(payload, privateKey) {
  // Validasi payload harus memiliki 32 blok RSA yang merepresentasikan 32 byte kunci AES.
  if (!payload || !Array.isArray(payload.wrappedKey) || payload.wrappedKey.length !== KEY_BYTES) {
    throw new TypeError(`wrappedKey harus berisi ${KEY_BYTES} blok RSA.`);
  }

  // Setiap blok RSA dibuka dengan private key untuk menghasilkan byte kunci AES asli.
  const key = Buffer.from(payload.wrappedKey.map((block, index) => {
    const byte = decryptNumber(block, privateKey);
    if (byte < 0n || byte > 255n) {
      throw new RangeError(`Blok kunci AES ke-${index} bukan byte yang valid.`);
    }
    return Number(byte);
  }));

  // Setelah kunci dipulihkan, decryptAesGcm memeriksa tag autentikasi agar data tidak bisa diubah.
  return { text: decryptAesGcm(payload, key) };
}

// hybridDecryptCrt sama seperti hybridDecrypt, hanya saja proses RSA dekripsi memakai CRT untuk efisiensi.
function hybridDecryptCrt(payload, privateKey, p, q) {
  if (!payload || !Array.isArray(payload.wrappedKey) || payload.wrappedKey.length !== KEY_BYTES) {
    throw new TypeError(`wrappedKey harus berisi ${KEY_BYTES} blok RSA.`);
  }

  // Menggunakan CRT mempercepat pembukaan kunci RSA untuk tiap byte sebelum AES-GCM memeriksa tag.
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
