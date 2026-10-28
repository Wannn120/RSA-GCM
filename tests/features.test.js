'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairFromPrimes } = require('../src/rsa');
const { hybridEncrypt, hybridDecrypt } = require('../src/hybrid');
const { checksum, tamperBlock } = require('../src/tamper');
const { encodeText } = require('../src/message-codec');
const { ServerSimulator } = require('../src/server-simulator');

const pair = generateKeyPairFromPrimes(61n, 53n, 17n);

test('hybrid demo mengembalikan isi dan kunci XOR', () => {
  const payload = hybridEncrypt('Halo 🎓', 42n, pair.publicKey);
  const restored = hybridDecrypt(payload, pair.privateKey);
  assert.equal(restored.text, 'Halo 🎓');
  assert.equal(restored.keyByte, 42n);
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
