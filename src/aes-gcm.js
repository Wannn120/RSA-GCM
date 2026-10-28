'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

// Ukuran kunci tetap menentukan AES-256, sedangkan isinya harus acak dari CSPRNG Node.js.
function generateAesKey() {
  return crypto.randomBytes(KEY_BYTES);
}

// IV dibuat baru untuk setiap pesan dan disimpan bersama ciphertext; IV bukan rahasia.
function encryptAesGcm(text, key, iv = crypto.randomBytes(IV_BYTES)) {
  // Tolak ukuran yang tidak didukung agar API tidak menerima kunci/IV yang keliru.
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
    throw new RangeError(`Kunci AES-256 harus berupa ${KEY_BYTES} byte.`);
  }
  if (!Buffer.isBuffer(iv) || iv.length !== IV_BYTES) {
    throw new RangeError(`IV AES-GCM harus berupa ${IV_BYTES} byte.`);
  }

  // createCipheriv menginisialisasi AES-256-GCM dengan kunci dan IV tersebut.
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  // update memproses plaintext; final menyelesaikan operasi sebelum tag diambil.
  const ciphertext = Buffer.concat([
    cipher.update(String(text), 'utf8'),
    cipher.final()
  ]);

  return {
    algorithm: ALGORITHM,
    // Hex membuat bytes aman diserialisasi sebagai JSON atau ditampilkan di CLI.
    iv: iv.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex')
  };
}

// Validasi format hex mencegah Buffer menerima string ganjil/terpotong secara diam-diam.
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

// GCM tidak menyerahkan plaintext final jika authentication tag gagal diverifikasi.
function decryptAesGcm(payload, key) {
  if (!payload || payload.algorithm !== ALGORITHM) {
    throw new TypeError(`Payload harus menggunakan ${ALGORITHM}.`);
  }
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
    throw new RangeError(`Kunci AES-256 harus berupa ${KEY_BYTES} byte.`);
  }

  // Pulihkan field payload ke bytes dan pastikan panjang IV serta tag tepat.
  const iv = parseHex(payload.iv, 'IV', IV_BYTES);
  const ciphertext = parseHex(payload.ciphertext, 'Ciphertext');
  const authTag = parseHex(payload.authTag, 'Authentication tag', AUTH_TAG_BYTES);
  // Tag wajib dipasang sebelum final; final akan melempar error jika data dimodifikasi.
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return plaintext.toString('utf8');
}

module.exports = { generateAesKey, encryptAesGcm, decryptAesGcm };
