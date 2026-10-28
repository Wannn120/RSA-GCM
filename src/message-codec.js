'use strict';

/*
  RSA menghitung bilangan, bukan teks.
  Codec ini mengubah teks menjadi byte UTF-8 lalu setiap byte menjadi BigInt.
  Untuk tujuan pembelajaran, satu byte menjadi satu blok RSA.
*/

function encodeText(text) {
  const bytes = Buffer.from(String(text), 'utf8');
  return Array.from(bytes, byte => BigInt(byte));
}

function decodeText(blocks) {
  const bytes = blocks.map(value => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 255) {
      throw new RangeError(`Blok ${value} tidak dapat dikembalikan menjadi byte UTF-8.`);
    }
    return n;
  });
  return Buffer.from(bytes).toString('utf8');
}

function explainEncoding(text) {
  const blocks = encodeText(text);
  return blocks.map((value, index) => ({
    index,
    byte: value,
    hex: Number(value).toString(16).padStart(2, '0')
  }));
}

module.exports = { encodeText, decodeText, explainEncoding };
