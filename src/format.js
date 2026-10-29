'use strict';

// File format.js berfungsi sebagai helper untuk menampilkan data ke terminal atau browser.
// Kita sering ingin melihat hasil RSA, gcd, atau trace dalam bentuk yang mudah dibaca,
// bukan raw object JavaScript yang sulit diikuti saat presentasi.

// stringify mengubah data JavaScript menjadi JSON string yang aman untuk BigInt.
function stringify(value, indent = 2) {
  return JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item, indent);
}

// table membuat output tabular sederhana untuk menampilkan data ringkas dalam CLI.
function table(rows, columns) {
  if (!rows.length) return '(tidak ada data)';
  const widths = {};
  for (const col of columns) {
    widths[col] = Math.max(col.length, ...rows.map(row => String(row[col] ?? '').length));
  }
  const header = columns.map(col => col.padEnd(widths[col])).join('  ');
  const body = rows.map(row => columns.map(col => String(row[col] ?? '').padEnd(widths[col])).join('  '));
  return [header, ...body].join('\n');
}

module.exports = { stringify, table };
