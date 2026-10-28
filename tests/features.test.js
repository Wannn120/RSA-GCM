'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { generateKeyPairFromPrimes } = require('../src/rsa');
const { hybridEncrypt, hybridDecrypt } = require('../src/hybrid');
const { generateAesKey, encryptAesGcm, decryptAesGcm } = require('../src/aes-gcm');
const { checksum, tamperBlock } = require('../src/tamper');
const { encodeText } = require('../src/message-codec');
const { ServerSimulator } = require('../src/server-simulator');

const pair = generateKeyPairFromPrimes(61n, 53n, 17n);

test('AES-GCM mandiri mengenkripsi dan memulihkan pesan UTF-8', () => {
  const key = generateAesKey();
  const payload = encryptAesGcm('AES saja 🎓', key);
  assert.equal(decryptAesGcm(payload, key), 'AES saja 🎓');
  assert.equal(payload.algorithm, 'aes-256-gcm');
});

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

test('hybrid RSA + AES-GCM mengembalikan pesan UTF-8', () => {
  const payload = hybridEncrypt('Halo 🎓', pair.publicKey);
  const restored = hybridDecrypt(payload, pair.privateKey);
  assert.equal(restored.text, 'Halo 🎓');
  assert.equal(payload.algorithm, 'aes-256-gcm');
  assert.equal(payload.wrappedKey.length, 32);
  assert.equal(Buffer.from(payload.iv, 'hex').length, 12);
  assert.equal(Buffer.from(payload.authTag, 'hex').length, 16);
});

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

test('hybrid menolak modulus RSA yang tidak dapat membungkus byte', () => {
  const smallPair = generateKeyPairFromPrimes(3n, 5n, 3n);
  assert.throws(() => hybridEncrypt('Halo', smallPair.publicKey), /lebih besar dari 255/);
});

test('perintah CLI compare mengembalikan hasil round-trip semua metode', () => {
  const cliPath = path.join(__dirname, '..', 'src', 'cli.js');
  const output = execFileSync(process.execPath, [cliPath, 'compare', '61', '53', '17', 'Halo Matdis'], {
    encoding: 'utf8'
  });
  const result = JSON.parse(output);
  assert.equal(result.semuaHasilSama, true);
  assert.equal(result.perbandingan.length, 3);
  assert.deepEqual(result.perbandingan.map(entry => entry.hasil), ['Halo Matdis', 'Halo Matdis', 'Halo Matdis']);
});

test('perubahan byte membuat checksum demo berbeda untuk contoh', () => {
  const original = encodeText('MATDIS');
  const changed = tamperBlock(original, 0, 1n);
  assert.notEqual(checksum(original), checksum(changed));
  assert.deepEqual(original, encodeText('MATDIS'));
});

test('Alice mengirim pesan UTF-8 kepada Bob', () => {
  const alice = new ServerSimulator('Alice', pair);
  const bob = new ServerSimulator('Bob', pair);
  const received = alice.sendTo(bob, 'Halo 😊');
  assert.equal(received.text, 'Halo 😊');
  assert.equal(bob.inbox.length, 1);
});
