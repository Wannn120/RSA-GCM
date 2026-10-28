'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

// Kunci acak 32 byte memberi AES-256 satu kunci baru untuk tiap sesi.
function generateAesKey() {
  return crypto.randomBytes(KEY_BYTES);
}

// IV dibuat unik dan disimpan bersama ciphertext; IV bukan kunci rahasia.
function encryptAesGcm(text, key, iv = crypto.randomBytes(IV_BYTES)) {
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
    throw new RangeError(`Kunci AES-256 harus berupa ${KEY_BYTES} byte.`);
  }
  if (!Buffer.isBuffer(iv) || iv.length !== IV_BYTES) {
    throw new RangeError(`IV AES-GCM harus berupa ${IV_BYTES} byte.`);
  }

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(text), 'utf8'),
    cipher.final()
  ]);

  return {
    algorithm: ALGORITHM,
    iv: iv.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex')
  };
}

// Hex diperiksa sebelum Buffer membacanya agar payload rusak tidak diterima diam-diam.
function parseHex(value, name, expectedBytes) {
  if (typeof value !== 'string' || !/^(?:[0-9a-f]{2})*$/i.test(value)) {
    throw new TypeError(`${name} harus berupa string hex yang valid.`);
  }
  const bytes = Buffer.from(value, 'hex');
  if (expectedBytes !== undefined && bytes.length !== expectedBytes) {
    throw new RangeError(`${name} harus berukuran ${expectedBytes} byte.`);
  }
  return bytes;
}

// GCM hanya mengembalikan plaintext setelah authentication tag berhasil diverifikasi.
function decryptAesGcm(payload, key) {
  if (!payload || payload.algorithm !== ALGORITHM) {
    throw new TypeError(`Payload harus menggunakan ${ALGORITHM}.`);
  }
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
    throw new RangeError(`Kunci AES-256 harus berupa ${KEY_BYTES} byte.`);
  }

  const iv = parseHex(payload.iv, 'IV', IV_BYTES);
  const ciphertext = parseHex(payload.ciphertext, 'Ciphertext');
  const authTag = parseHex(payload.authTag, 'Authentication tag', AUTH_TAG_BYTES);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return plaintext.toString('utf8');
}

module.exports = { generateAesKey, encryptAesGcm, decryptAesGcm };
