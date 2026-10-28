'use strict';

/*
  Modul ini bukan hybrid encryption produksi.
  Tujuannya memperagakan ide bahwa RSA biasanya dipakai untuk melindungi kunci,
  sedangkan data besar memakai operasi yang lebih ringan.
  Agar tidak menyembunyikan konsep di balik library, contoh memakai XOR sederhana.
  XOR di sini hanya demonstrasi matematika dan tidak aman untuk data nyata.
*/

const { encryptNumber, decryptNumber } = require('./rsa');

function xorBytes(bytes, keyByte) {
  const k = Number(keyByte) & 255;
  return bytes.map(byte => byte ^ k);
}

function hybridEncrypt(text, keyByte, publicKey) {
  const k = BigInt(keyByte);
  if (k < 0n || k > 255n) throw new RangeError('Kunci byte harus 0 sampai 255.');
  if (k >= publicKey.n) throw new RangeError('n RSA harus lebih besar dari nilai kunci byte.');
  const plainBytes = Array.from(Buffer.from(String(text), 'utf8'));
  const dataCipher = xorBytes(plainBytes, Number(k));
  const wrappedKey = encryptNumber(k, publicKey);
  return { wrappedKey, dataCipher };
}

function hybridDecrypt(payload, privateKey) {
  const keyByte = decryptNumber(payload.wrappedKey, privateKey);
  const plainBytes = xorBytes(payload.dataCipher, Number(keyByte));
  return { keyByte, text: Buffer.from(plainBytes).toString('utf8') };
}

module.exports = { xorBytes, hybridEncrypt, hybridDecrypt };
