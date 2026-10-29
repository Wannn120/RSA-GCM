'use strict';

/*
  RSA menghitung bilangan, bukan teks.
  Codec ini mengubah teks menjadi byte UTF-8 lalu setiap byte menjadi BigInt.
  Untuk tujuan pembelajaran, satu byte menjadi satu blok RSA.
*/

function encodeText(text) {
  // Saat dijalankan di browser, gunakan TextEncoder agar tidak bergantung pada Buffer Node.
  const bytes = typeof Buffer !== 'undefined'
    ? Buffer.from(String(text), 'utf8')
    : new TextEncoder().encode(String(text));
  return Array.from(bytes, byte => BigInt(byte));
}

function decodeText(blocks) {
  // RSA mengembalikan angka; pastikan semua angka valid sebagai byte sebelum membuat byte array lagi.
  const bytes = blocks.map(value => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 255) {
      throw new RangeError(`Blok ${value} tidak dapat dikembalikan menjadi byte UTF-8.`);
    }
    return n;
  });
  const uint8 = Uint8Array.from(bytes);
  return typeof Buffer !== 'undefined'
    ? Buffer.from(uint8).toString('utf8')
    : new TextDecoder('utf-8', { fatal: true }).decode(uint8);
}

function explainEncoding(text) {
  // Bentuk tabel bantu untuk menunjukkan indeks, nilai desimal, dan hex tiap byte.
  const blocks = encodeText(text);
  return blocks.map((value, index) => ({
    index,
    byte: value,
    hex: Number(value).toString(16).padStart(2, '0')
  }));
}

module.exports = { encodeText, decodeText, explainEncoding };
