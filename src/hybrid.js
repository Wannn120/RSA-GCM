'use strict';

const { encryptNumber, decryptNumber } = require('./rsa');
const { generateAesKey, encryptAesGcm, decryptAesGcm } = require('./aes-gcm');

const KEY_BYTES = 32;

// Hybrid menggabungkan RSA untuk kunci sesi dan AES-GCM untuk isi pesan.
function hybridEncrypt(text, publicKey) {
  if (publicKey.n <= 255n) {
    throw new RangeError('n RSA harus lebih besar dari 255 untuk membungkus byte kunci AES.');
  }

  const key = generateAesKey();
  const encrypted = encryptAesGcm(text, key);
  const wrappedKey = Array.from(key, byte => encryptNumber(BigInt(byte), publicKey));

  return { ...encrypted, wrappedKey };
}

// Penerima membuka byte kunci dengan RSA sebelum meminta AES-GCM memeriksa tag.
function hybridDecrypt(payload, privateKey) {
  if (!payload || !Array.isArray(payload.wrappedKey) || payload.wrappedKey.length !== KEY_BYTES) {
    throw new TypeError(`wrappedKey harus berisi ${KEY_BYTES} blok RSA.`);
  }

  const key = Buffer.from(payload.wrappedKey.map((block, index) => {
    const byte = decryptNumber(block, privateKey);
    if (byte < 0n || byte > 255n) {
      throw new RangeError(`Blok kunci AES ke-${index} bukan byte yang valid.`);
    }
    return Number(byte);
  }));

  return { text: decryptAesGcm(payload, key) };
}

module.exports = { hybridEncrypt, hybridDecrypt };
