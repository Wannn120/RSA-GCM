'use strict';

// File ini menangani operasi AES-256-GCM, yaitu enkripsi simetris yang juga melakukan autentikasi.
// AES-GCM sering dipakai bersama RSA untuk skema hybrid: RSA membungkus kunci, AES mengenkripsi pesan.
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

// generateAesKey membuat kunci acak 32 byte agar sesuai dengan AES-256.
function generateAesKey() {
  return crypto.randomBytes(KEY_BYTES);
}

// encryptAesGcm mengenkripsi teks dan mengembalikan payload yang berisi IV, ciphertext, dan authTag.
// authTag diperlukan agar penerima bisa memastikan data tidak diubah selama pengiriman.
function encryptAesGcm(text, key, iv = crypto.randomBytes(IV_BYTES)) {
  // Validasi kunci dan IV harus tepat untuk AES-256-GCM agar tidak terjadi error saat enkripsi.
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
    throw new RangeError(`Kunci AES-256 harus berupa ${KEY_BYTES} byte.`);
  }
  if (!Buffer.isBuffer(iv) || iv.length !== IV_BYTES) {
    throw new RangeError(`IV AES-GCM harus berupa ${IV_BYTES} byte.`);
  }

  // createCipheriv mempersiapkan mesin enkripsi AES-GCM dengan kunci dan IV tertentu.
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  // update lalu final memproses plaintext; hasilnya disimpan sebagai ciphertext.
  const ciphertext = Buffer.concat([
    cipher.update(String(text), 'utf8'),
    cipher.final()
  ]);

  return {
    algorithm: ALGORITHM,
    // IV dan ciphertext dikonversi ke hex agar mudah dikirim sebagai JSON atau ditampilkan di GUI.
    iv: iv.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex')
  };
}

// parseHex mengubah string heksadesimal menjadi Buffer dengan validasi panjang yang aman.
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

// decryptAesGcm memulihkan plaintext hanya jika IV, ciphertext, dan authTag valid.
// Jika tag tidak cocok, Node akan melempar error sehingga integritas data tetap terjaga.
function decryptAesGcm(payload, key) {
  if (!payload || payload.algorithm !== ALGORITHM) {
    throw new TypeError(`Payload harus menggunakan ${ALGORITHM}.`);
  }
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
    throw new RangeError(`Kunci AES-256 harus berupa ${KEY_BYTES} byte.`);
  }

  // Mengembalikan field payload ke byte agar dapat diproses oleh decipher.
  const iv = parseHex(payload.iv, 'IV', IV_BYTES);
  const ciphertext = parseHex(payload.ciphertext, 'Ciphertext');
  const authTag = parseHex(payload.authTag, 'Authentication tag', AUTH_TAG_BYTES);
  // Tag diset sebelum final agar dekripsi menolak perubahan data.
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return plaintext.toString('utf8');
}

module.exports = { generateAesKey, encryptAesGcm, decryptAesGcm };
