'use strict';

// File test ini menguji fitur end-to-end dari aplikasi: AES, hybrid encryption,
// tamper detection, benchmark comparison, dan simulasi pengiriman antar pihak.
// Setiap blok test berfungsi sebagai pengaman agar perubahan di src tidak merusak perilaku aplikasi.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { generateKeyPairFromPrimes } = require('../lib/rsa');
const { hybridEncrypt, hybridDecrypt, hybridDecryptCrt } = require('../lib/hybrid');
const { generateAesKey, encryptAesGcm, decryptAesGcm } = require('../lib/aes-gcm');
const { checksum, tamperBlock } = require('../lib/tamper');
const { encodeText } = require('../lib/message-codec');
const { ServerSimulator } = require('../lib/server-simulator');

// Pasangan kecil ini dipakai bersama agar tes RSA dan hybrid dapat diulang dengan hasil konsisten.
const pair = generateKeyPairFromPrimes(61n, 53n, 17n);

// Uji ini mengecek apakah AES-GCM dapat mengenkripsi dan memulihkan pesan UTF-8 tanpa berubah.
test('AES-GCM mandiri mengenkripsi dan memulihkan pesan UTF-8', () => {
  const key = generateAesKey();
  const payload = encryptAesGcm('AES saja 🎓', key);
  assert.equal(decryptAesGcm(payload, key), 'AES saja 🎓');
  assert.equal(payload.algorithm, 'aes-256-gcm');
});

// Uji ini memastikan perubahan pada ciphertext atau tag autentikasi akan memicu kegagalan dekripsi.
test('AES-GCM mandiri menolak ciphertext atau authentication tag yang diubah', () => {
  const key = generateAesKey();
  const payload = encryptAesGcm('Pesan autentik', key);
  const changedCiphertext = {
    ...payload,
    ciphertext: `${(Number.parseInt(payload.ciphertext.slice(0, 2), 16) ^ 1).toString(16).padStart(2, '0')}${payload.ciphertext.slice(2)}`
  };
  const changedTag = {
    ...payload,
    authTag: `${(Number.parseInt(payload.authTag.slice(0, 2), 16) ^ 1).toString(16).padStart(2, '0')}${payload.authTag.slice(2)}`
  };
  assert.throws(() => decryptAesGcm(changedCiphertext, key));
  assert.throws(() => decryptAesGcm(changedTag, key));
});

// Uji ini memeriksa flow hybrid RSA + AES-GCM: pesan dienkripsi dengan AES dan kunci AES dibungkus RSA.
test('hybrid RSA + AES-GCM mengembalikan pesan UTF-8', () => {
  const payload = hybridEncrypt('Halo 🎓', pair.publicKey);
  const restored = hybridDecrypt(payload, pair.privateKey);
  assert.equal(restored.text, 'Halo 🎓');
  assert.equal(payload.algorithm, 'aes-256-gcm');
  assert.equal(payload.wrappedKey.length, 32);
  assert.equal(Buffer.from(payload.iv, 'hex').length, 12);
  assert.equal(Buffer.from(payload.authTag, 'hex').length, 16);
});

// Uji ini memastikan varian CRT tetap aman dan dapat mengembalikan pesan yang sama seperti dekripsi biasa.
test('hybrid dengan RSA-CRT memulihkan kunci AES dan pesan UTF-8', () => {
  const payload = hybridEncrypt('Hybrid CRT 😊', pair.publicKey);
  const restored = hybridDecryptCrt(payload, pair.privateKey, pair.details.p, pair.details.q);
  assert.equal(restored.text, 'Hybrid CRT 😊');
});

// Uji ini memastikan perubahan pada ciphertext atau tag akan ditolak walaupun payload hybrid sudah dibungkus RSA.
test('AES-GCM menolak ciphertext atau authentication tag yang telah diubah', () => {
  const payload = hybridEncrypt('Pesan yang harus autentik', pair.publicKey);
  const firstByte = Number.parseInt(payload.ciphertext.slice(0, 2), 16);
  const changedByte = (firstByte ^ 1).toString(16).padStart(2, '0');
  const changedCiphertext = { ...payload, ciphertext: `${changedByte}${payload.ciphertext.slice(2)}` };
  const firstTagByte = Number.parseInt(payload.authTag.slice(0, 2), 16);
  const changedTagByte = (firstTagByte ^ 1).toString(16).padStart(2, '0');
  const changedTag = { ...payload, authTag: `${changedTagByte}${payload.authTag.slice(2)}` };
  assert.throws(() => hybridDecrypt(changedCiphertext, pair.privateKey));
  assert.throws(() => hybridDecrypt(changedTag, pair.privateKey));
});

// Uji ini mengecek bahwa modulus RSA yang terlalu kecil tidak dapat membungkus kunci AES 32 byte.
test('hybrid menolak modulus RSA yang tidak dapat membungkus byte', () => {
  const smallPair = generateKeyPairFromPrimes(3n, 5n, 3n);
  assert.throws(() => hybridEncrypt('Halo', smallPair.publicKey), /lebih besar dari 255/);
});

test('batch perbandingan memakai n acak unik dan round-trip dua skema', () => {
  const { runComparisonBatch } = require('../lib/comparison');
  const result = runComparisonBatch({ runs: 8, minPrime: 100, maxPrime: 999, messageBytes: 16 });
  assert.equal(result.rows.length, 8);
  assert.equal(result.allRoundTripsPassed, true);
  assert.equal(new Set(result.rows.map(row => row.n)).size, 8);
  assert.equal(result.rows.every(row => row.messageBytes === 16), true);
  assert.ok(result.summary.rsaDecryptMs.mean >= 0);
  assert.ok(result.summary.hybridDecryptCrtMs.mean >= 0);
});

// Uji ini menegaskan bahwa batch comparison harus menolak jumlah runs yang di luar batas yang aman.
test('batch perbandingan menolak ukuran percobaan di luar batas', () => {
  const { runComparisonBatch } = require('../lib/comparison');
  assert.throws(() => runComparisonBatch({ runs: 1001 }), /Jumlah percobaan/);
});

test('perintah CLI compare mengembalikan data batch untuk dua skema', () => {
  const cliPath = path.join(__dirname, '..', 'lib', 'cli.js');
  const output = execFileSync(process.execPath, [cliPath, 'compare', '5', '100', '999', '16'], {
    encoding: 'utf8'
  });
  const result = JSON.parse(output);
  assert.equal(result.allRoundTripsPassed, true);
  assert.equal(result.rows.length, 5);
  assert.equal(new Set(result.rows.map(row => row.n)).size, 5);
});

// Uji ini mengecek bahwa tampering satu byte membuat checksum berubah dan terdeteksi.
test('perubahan byte membuat checksum demo berbeda untuk contoh', () => {
  const original = encodeText('MATDIS');
  const changed = tamperBlock(original, 0, 1n);
  assert.notEqual(checksum(original), checksum(changed));
  assert.deepEqual(original, encodeText('MATDIS'));
});

// Uji ini mensimulasikan pengiriman pesan dari Alice ke Bob seperti alur komunikasi aman yang diinginkan.
test('Alice mengirim pesan UTF-8 kepada Bob', () => {
  const alice = new ServerSimulator('Alice', pair);
  const bob = new ServerSimulator('Bob', pair);
  const received = alice.sendTo(bob, 'Halo 😊');
  assert.equal(received.text, 'Halo 😊');
  assert.equal(bob.inbox.length, 1);
});
