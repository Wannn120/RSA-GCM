'use strict';

// File tamper.js mencontohkan cara memeriksa integritas data.
// Saat data diubah, checksum akan berubah. Ini mirip prinsip yang dipakai pada tag autentikasi
// dan MAC: data yang dimodifikasi harus terdeteksi sebelum dianggap valid.

// checksum menghitung nilai kontrol berdasarkan semua blok data agar perubahan kecil terdeteksi.
function checksum(blocks, modulus = 1000003n) {
  let total = 0n;
  for (let i = 0; i < blocks.length; i++) {
    total = (total + BigInt(i + 1) * BigInt(blocks[i])) % modulus;
  }
  return total;
}

// tamperBlock membuat salinan data lalu mengubah satu blok tertentu dengan delta tertentu.
function tamperBlock(blocks, index, delta = 1n) {
  if (index < 0 || index >= blocks.length) throw new RangeError('Index blok di luar rentang.');
  const copy = blocks.map(BigInt);
  copy[index] += BigInt(delta);
  return copy;
}

// compareBlocks membandingkan dua rangkaian blok dan melaporkan perbedaan index per index.
function compareBlocks(original, changed) {
  const max = Math.max(original.length, changed.length);
  const differences = [];
  for (let i = 0; i < max; i++) {
    if (original[i] !== changed[i]) {
      differences.push({ index: i, before: original[i], after: changed[i] });
    }
  }
  return differences;
}

module.exports = { checksum, tamperBlock, compareBlocks };
