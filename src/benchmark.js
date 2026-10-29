'use strict';

// File benchmark ini mengukur performa fungsi modular exponentiation dari src/math.js.
// Tujuannya agar kita bisa melihat berapa lama operasi RSA sebenarnya memakan waktu
// ketika dieksekusi berulang dalam jumlah tertentu. Fungsinya berguna untuk demo,
// eksperimen, dan perbandingan performa antar skema.
const { performance } = require('perf_hooks');
const { modPow } = require('./math');

// benchmark menjalankan loop modular exponentiation beberapa kali dan mengukur durasinya.
function benchmark(iterations = 5000) {
  const base = 123456789n;
  const exponent = 65537n;
  const modulus = 1000000007n;
  const start = performance.now();
  let result = 0n;
  for (let i = 0; i < iterations; i++) result = modPow(base + BigInt(i), exponent, modulus);
  const end = performance.now();
  return { iterations, milliseconds: end - start, lastResult: result };
}

// Bagian ini hanya berjalan saat file dijalankan sebagai script langsung dari terminal.
// Ini memudahkan user mengecek kecepatan tanpa harus memanggil fungsi secara manual.
const iterations = Number(process.argv[2] || 5000);
const result = benchmark(iterations);
console.log(`Iterasi: ${result.iterations}`);
console.log(`Waktu: ${result.milliseconds.toFixed(3)} ms`);
console.log(`Hasil terakhir: ${result.lastResult}`);
console.log('Benchmark memakai performance_hooks bawaan Node.js, bukan library eksternal.');

module.exports = { benchmark };
